import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APIFY_KEY    = process.env.APIFY_API_KEY ?? ''
const APIFY_BASE   = 'https://api.apify.com/v2/acts'
const POSTS_LIMIT  = 4   // recent posts to check per client
const COMMENT_LIMIT = 25  // comments to scrape per post

// ── Apify helpers ─────────────────────────────────────────────

async function apifyRun<T>(actor: string, input: Record<string, unknown>): Promise<T[]> {
  const url = `${APIFY_BASE}/${actor}/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=40&memory=512`
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
      signal:  AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      console.error(`[scrape-comments] Apify ${actor} returned ${res.status}`)
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data as T[] : []
  } catch (err) {
    console.error(`[scrape-comments] Apify ${actor} failed:`, err)
    return []
  }
}

// ── Dedup key — hash of platform + handle + text ─────────────

function dedupHash(platform: string, commenterHandle: string, commentText: string): string {
  return createHash('md5')
    .update(`${platform}:${commenterHandle}:${commentText.slice(0, 200)}`)
    .digest('hex')
}

// ── Platform resolver from handle field ───────────────────────

function resolvePlatform(source: 'instagram' | 'facebook'): string {
  return source
}

// ── Instagram scraper ─────────────────────────────────────────

interface ApifyPost {
  shortCode?: string
  url?:       string
  caption?:   string
}

interface ApifyComment {
  id?:             string
  text?:           string
  ownerUsername?:  string
  ownerFullName?:  string
  timestamp?:      string
  postUrl?:        string
}

async function scrapeInstagramComments(
  handle: string,
  clientId: string,
  postCaption: string,
  orgId: string | null,
): Promise<void> {
  if (!handle) return

  // Phase 1 — get recent post shortcodes from profile
  const posts = await apifyRun<ApifyPost>('apify~instagram-scraper', {
    directUrls:   [`https://www.instagram.com/${handle}/`],
    resultsType:  'posts',
    resultsLimit: POSTS_LIMIT,
  })

  if (!posts.length) return

  const postUrls = posts
    .map(p => p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : p.url)
    .filter(Boolean) as string[]

  if (!postUrls.length) return

  // Phase 2 — get comments from those posts
  const comments = await apifyRun<ApifyComment>('apify~instagram-comment-scraper', {
    directUrls:   postUrls,
    resultsLimit: COMMENT_LIMIT,
  })

  for (const c of comments) {
    const text   = c.text?.trim()
    const handle_c = c.ownerUsername ?? ''
    const name   = c.ownerFullName ?? c.ownerUsername ?? 'Unknown'
    if (!text || text.length < 2) continue

    const hash = dedupHash('instagram', handle_c, text)

    // Skip if already in queue
    const { count } = await supabase
      .from('moderation_items')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('commenter_handle', handle_c)
      .eq('comment_text', text)

    if ((count ?? 0) > 0) continue

    const postUrl = c.postUrl ?? postUrls[0] ?? ''
    const caption = posts.find(p => postUrl.includes(p.shortCode ?? ''))?.caption ?? postCaption

    await supabase.from('moderation_items').insert({
      client_id:        clientId,
      platform:         'instagram',
      commenter_name:   name,
      commenter_handle: handle_c,
      comment_text:     text,
      post_caption:     (caption ?? '').slice(0, 300),
      post_url:         postUrl,
      status:           'pending',
      organization_id:  orgId,
    })
  }
}

// ── Facebook scraper ──────────────────────────────────────────

interface ApifyFbComment {
  commentText?:   string
  profileName?:   string
  profileUrl?:    string
  date?:          string
  postUrl?:       string
}

async function scrapeFacebookComments(
  pageUrl: string,
  clientId: string,
  orgId: string | null,
): Promise<void> {
  if (!pageUrl) return

  const comments = await apifyRun<ApifyFbComment>('apify~facebook-comments-scraper', {
    startUrls:    [{ url: pageUrl }],
    resultsLimit: COMMENT_LIMIT,
    maxDepth:     1,
  })

  for (const c of comments) {
    const text   = c.commentText?.trim()
    const handle_c = c.profileUrl ?? c.profileName ?? ''
    const name   = c.profileName ?? 'Unknown'
    if (!text || text.length < 2) continue

    const { count } = await supabase
      .from('moderation_items')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('commenter_handle', handle_c)
      .eq('comment_text', text)

    if ((count ?? 0) > 0) continue

    await supabase.from('moderation_items').insert({
      client_id:        clientId,
      platform:         'facebook',
      commenter_name:   name,
      commenter_handle: handle_c,
      comment_text:     text,
      post_caption:     '',
      post_url:         c.postUrl ?? pageUrl,
      status:           'pending',
      organization_id:  orgId,
    })
  }
}

// ── Main cron handler ─────────────────────────────────────────

/**
 * GET /api/cron/scrape-comments
 *
 * Scrapes recent Instagram + Facebook comments for all active clients
 * and pushes new ones into the moderation queue.
 *
 * Reads social handles from clients.brand_identity_json:
 *   { instagram_handle: "username", facebook_page_url: "https://facebook.com/page" }
 *
 * Runs every 30–60 min via Vercel Cron. Protected by CRON_SECRET header.
 * No Meta Developer App required — uses Apify scrapers directly.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!APIFY_KEY) {
    return NextResponse.json({ error: 'APIFY_API_KEY not configured' }, { status: 503 })
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, brand_identity_json, organization_id')
    .eq('status', 'active')

  if (error) {
    console.error('[scrape-comments] Failed to fetch clients:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: { client: string; instagram: number; facebook: number; error?: string }[] = []

  for (const client of clients ?? []) {
    const brand = (client.brand_identity_json ?? {}) as Record<string, unknown>
    const instagramHandle  = brand.instagram_handle  as string | undefined
    const facebookPageUrl  = brand.facebook_page_url as string | undefined

    const result = { client: client.name, instagram: 0, facebook: 0 }
    const orgId = (client as Record<string, unknown>).organization_id as string | null ?? null

    try {
      if (instagramHandle) {
        const before = await supabase
          .from('moderation_items')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('platform', 'instagram')

        await scrapeInstagramComments(instagramHandle, client.id, '', orgId)

        const after = await supabase
          .from('moderation_items')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('platform', 'instagram')

        result.instagram = (after.count ?? 0) - (before.count ?? 0)
      }

      if (facebookPageUrl) {
        const before = await supabase
          .from('moderation_items')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('platform', 'facebook')

        await scrapeFacebookComments(facebookPageUrl, client.id, orgId)

        const after = await supabase
          .from('moderation_items')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('platform', 'facebook')

        result.facebook = (after.count ?? 0) - (before.count ?? 0)
      }
    } catch (err) {
      console.error(`[scrape-comments] Client ${client.name} failed:`, err)
    }

    results.push(result)
  }

  console.log('[scrape-comments] Done:', JSON.stringify(results))
  return NextResponse.json({ ok: true, results, ran_at: new Date().toISOString() })
}
