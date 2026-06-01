import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Only files under this prefix are considered post-specific (temp) uploads.
// Drive imports live under 'drive/' and are permanent library assets — never touched.
const POST_MEDIA_PREFIX = 'posts/'

function isOwnStorageUrl(url: string): boolean {
  return url.startsWith(SUPABASE_URL) && url.includes('/storage/v1/object/public/assets/')
}

function storagePathFromUrl(url: string): string {
  // Extract everything after "/storage/v1/object/public/assets/"
  const marker = '/storage/v1/object/public/assets/'
  const idx = url.indexOf(marker)
  return idx === -1 ? '' : url.slice(idx + marker.length)
}

/**
 * GET /api/cron/cleanup-storage
 *
 * Vercel Cron: runs daily at 02:30 UTC.
 *
 * 1. Finds scheduled_posts with status='published' and published_at > 24 h ago.
 * 2. Collects any media_urls that point to our own Supabase Storage AND live
 *    under the 'posts/' prefix (one-off post uploads, not library assets).
 * 3. Cross-checks against the assets table — skips any path that is a known
 *    library asset so we never delete something the user intentionally keeps.
 * 4. Deletes orphaned storage files.
 * 5. Clears media_urls on published posts older than 7 days to trim DB row size.
 */
export async function GET() {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const cutoff7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Fetch published posts with media, published more than 24 h ago ────────
  const { data: posts, error: postsErr } = await supabase
    .from('scheduled_posts')
    .select('id, media_urls, published_at')
    .eq('status', 'published')
    .not('media_urls', 'is', null)
    .lt('published_at', cutoff24h)

  if (postsErr) {
    console.error('[cleanup-storage] fetch posts error:', postsErr.message)
    return NextResponse.json({ error: postsErr.message }, { status: 500 })
  }

  if (!posts?.length) {
    return NextResponse.json({ deleted_files: 0, cleared_posts: 0, skipped_library: 0 })
  }

  // ── 2. Collect candidate storage paths (posts/ prefix only) ─────────────────
  const candidatePaths: string[] = []
  for (const post of posts) {
    const urls: string[] = Array.isArray(post.media_urls) ? post.media_urls : []
    for (const url of urls) {
      if (!isOwnStorageUrl(url)) continue
      const path = storagePathFromUrl(url)
      if (path.startsWith(POST_MEDIA_PREFIX)) {
        candidatePaths.push(path)
      }
    }
  }

  let deletedFiles = 0
  let skippedLibrary = 0

  if (candidatePaths.length > 0) {
    // ── 3. Cross-check assets table — never delete known library assets ────────
    const { data: libraryAssets } = await supabase
      .from('assets')
      .select('file_url')
      .in('file_url', candidatePaths.map(p => `${SUPABASE_URL}/storage/v1/object/public/assets/${p}`))

    const libraryUrls = new Set((libraryAssets ?? []).map(a => a.file_url as string))

    const toDelete = candidatePaths.filter(path => {
      const fullUrl = `${SUPABASE_URL}/storage/v1/object/public/assets/${path}`
      if (libraryUrls.has(fullUrl)) {
        skippedLibrary++
        return false
      }
      return true
    })

    // ── 4. Delete orphaned files in batches of 100 ────────────────────────────
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100)
      const { error: delErr } = await supabase.storage.from('assets').remove(batch)
      if (delErr) {
        console.error('[cleanup-storage] storage remove error:', delErr.message)
      } else {
        deletedFiles += batch.length
      }
    }
  }

  // ── 5. Clear media_urls on posts older than 7 days ───────────────────────────
  // Keeps the post record for audit history but drops the (now dead) URL references.
  const staleIds = posts
    .filter(p => p.published_at && p.published_at < cutoff7d)
    .map(p => p.id)

  let clearedPosts = 0
  if (staleIds.length > 0) {
    const { error: clearErr } = await supabase
      .from('scheduled_posts')
      .update({ media_urls: [] })
      .in('id', staleIds)

    if (clearErr) {
      console.error('[cleanup-storage] clear media_urls error:', clearErr.message)
    } else {
      clearedPosts = staleIds.length
    }
  }

  console.log(`[cleanup-storage] deleted_files=${deletedFiles} cleared_posts=${clearedPosts} skipped_library=${skippedLibrary}`)
  return NextResponse.json({ deleted_files: deletedFiles, cleared_posts: clearedPosts, skipped_library: skippedLibrary })
}
