import { NextRequest, NextResponse } from 'next/server'

const HAS_DB    = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const APIFY_KEY = process.env.APIFY_API_KEY ?? ''

const ACTORS: Record<string, string> = {
  instagram: 'apify~instagram-profile-scraper',
  tiktok:    'clockworks~tiktok-profile-scraper',
  youtube:   'streamers~youtube-channel-scraper',
  linkedin:  'apify~linkedin-company-scraper',
}

async function scrapeInstagram(handle: string): Promise<Partial<{ followers: number; avg_er: number; posting_frequency: number; top_content_types: Record<string, number> }>> {
  const username = handle.replace('@', '')
  const url = `https://api.apify.com/v2/acts/${ACTORS.instagram}/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=45&memory=256`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], resultsType: 'details', resultsLimit: 1 }),
  })
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}`)
  const items = await res.json() as Array<{
    followersCount?: number
    postsCount?: number
    mediaCount?: number
  }>
  const item = items[0]
  if (!item) throw new Error('No data returned')
  return {
    followers: item.followersCount ?? 0,
    avg_er: 0,
    posting_frequency: 0,
    top_content_types: {},
  }
}

async function scrapeTikTok(handle: string): Promise<Partial<{ followers: number; avg_er: number; posting_frequency: number }>> {
  const username = handle.replace('@', '')
  const url = `https://api.apify.com/v2/acts/${ACTORS.tiktok}/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=45&memory=256`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles: [username], profilesPerPage: 1 }),
  })
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}`)
  const items = await res.json() as Array<{ stats?: { followerCount?: number } }>
  const item = items[0]
  return {
    followers: item?.stats?.followerCount ?? 0,
    avg_er: 0,
    posting_frequency: 0,
  }
}

/**
 * POST /api/competitors/scrape
 * Body: { client_id, handle, platform }
 * Scrapes live metrics from Apify and upserts competitor_snapshots.
 * Falls back to zero-metric save if Apify fails (never breaks the UI).
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; handle?: string; platform?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, handle, platform } = body
  if (!client_id || !handle || !platform) {
    return NextResponse.json({ error: 'client_id, handle, platform required' }, { status: 400 })
  }
  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let metrics: Partial<{ followers: number; avg_er: number; posting_frequency: number; top_content_types: Record<string, number> }> = {}
  let scraped = false

  if (APIFY_KEY) {
    try {
      const p = platform.toLowerCase()
      if (p === 'instagram') metrics = await scrapeInstagram(handle)
      else if (p === 'tiktok') metrics = await scrapeTikTok(handle)
      scraped = true
    } catch (err) {
      console.error('[competitors/scrape] Apify error:', err)
    }
  }

  const { error } = await supabase
    .from('competitor_snapshots')
    .upsert({
      client_id,
      competitor_handle: handle,
      platform: platform.toLowerCase(),
      followers: metrics.followers ?? 0,
      avg_er: metrics.avg_er ?? 0,
      posting_frequency: metrics.posting_frequency ?? 0,
      top_content_types: metrics.top_content_types ?? {},
      captured_at: new Date().toISOString(),
    }, { onConflict: 'client_id,competitor_handle,platform' })

  if (error) {
    console.error('[competitors/scrape] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: true, scraped })
}
