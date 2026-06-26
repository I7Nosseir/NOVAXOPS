import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getScheduledPosts } from '@/lib/metricool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/cron/sync-status
 *
 * Vercel Cron: runs every hour (see vercel.json).
 * For every post still marked 'scheduled' in our DB whose scheduled_at has passed,
 * cross-references Metricool's scheduler to determine the real outcome:
 *   - PUBLISHED / not found in scheduler → mark published
 *   - ERROR / FAILED               → mark failed
 *   - Still in scheduler as SCHEDULED → leave as-is (not published yet)
 */
export async function GET() {
  // Posts still marked scheduled whose time has passed (5-min buffer for Metricool to process)
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, metricool_post_id, client_id, scheduled_at')
    .eq('status', 'scheduled')
    .not('metricool_post_id', 'is', null)
    .lt('scheduled_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!posts?.length) return NextResponse.json({ synced: 0, failed: 0, skipped: 0 })

  // Get unique client IDs → blogIds
  const clientIds = [...new Set(posts.map(p => p.client_id as string))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .in('id', clientIds)

  const blogIdMap: Record<string, string> = {}
  for (const c of clients ?? []) {
    if (c.metricool_blog_id) blogIdMap[c.id] = c.metricool_blog_id
  }

  // Fetch Metricool scheduler state for each blog (one call per blog, not per post)
  const metricoolPostMap: Record<string, string> = {} // metricool_post_id → status
  for (const [clientId, blogId] of Object.entries(blogIdMap)) {
    try {
      const mcPosts = await getScheduledPosts(blogId)
      for (const mp of mcPosts) {
        metricoolPostMap[mp.id] = (mp.status ?? '').toUpperCase()
      }
    } catch (err) {
      console.error(`[sync-status] getScheduledPosts failed for client ${clientId}:`, err)
    }
  }

  let synced = 0
  let failed = 0
  let skipped = 0

  for (const post of posts) {
    const blogId = blogIdMap[post.client_id as string]
    if (!blogId) { skipped++; continue }

    const mcStatus = metricoolPostMap[post.metricool_post_id as string]

    if (mcStatus === 'ERROR' || mcStatus === 'FAILED') {
      await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id)
      failed++
      continue
    }

    if (mcStatus === 'PUBLISHED') {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', post.id)
      synced++
      continue
    }

    // Not found in Metricool scheduler at all — Metricool removes posts after publishing.
    // If scheduled_at is more than 30 min in the past, treat as published.
    if (mcStatus === undefined) {
      const scheduledAt = new Date(post.scheduled_at as string)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
      if (scheduledAt < thirtyMinAgo) {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', post.id)
        synced++
      } else {
        skipped++ // too soon — Metricool may still be processing
      }
      continue
    }

    skipped++ // still SCHEDULED in Metricool, not yet published
  }

  return NextResponse.json({ synced, failed, skipped, total: posts.length })
}
