import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getScheduledPosts } from '@/lib/metricool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/metricool/sync
 *
 * Pulls post statuses from Metricool for every client that has a blog ID,
 * then updates scheduled_posts in the DB where status has changed.
 *
 * Metricool removes posts from the scheduler after publishing, so we cannot
 * rely on seeing a "published" status — instead, a scheduled post that is no
 * longer in Metricool's scheduler and whose scheduled_at is 30+ min in the
 * past is treated as published. This mirrors the cron logic in sync-status.
 *
 * Returns: { updated: number, errors: string[] }
 */
export async function POST() {
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }

  // All posts still marked 'scheduled' in our DB that have a metricool_post_id
  const { data: dbPosts } = await supabase
    .from('scheduled_posts')
    .select('id, metricool_post_id, client_id, scheduled_at')
    .eq('status', 'scheduled')
    .not('metricool_post_id', 'is', null)

  let updated = 0
  const errors: string[] = []

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)

  for (const client of clients ?? []) {
    try {
      const metricoolPosts = await getScheduledPosts(client.metricool_blog_id)

      // Build a map: metricool_post_id → uppercase status
      const mcStatusMap: Record<string, string> = {}
      for (const mp of metricoolPosts) {
        mcStatusMap[mp.id] = (mp.status ?? '').toUpperCase()
      }

      // Check every DB-scheduled post for this client
      const clientPosts = (dbPosts ?? []).filter(p => p.client_id === client.id)

      for (const post of clientPosts) {
        const mcStatus = mcStatusMap[post.metricool_post_id as string]

        let newStatus: string | null = null
        let publishedAt: string | undefined

        if (mcStatus === 'PUBLISHED' || mcStatus === 'PUBLISHING' || mcStatus === 'SUCCESS') {
          newStatus = 'published'
          publishedAt = new Date().toISOString()
        } else if (mcStatus === 'ERROR' || mcStatus === 'FAILED') {
          newStatus = 'failed'
        } else if (mcStatus === undefined) {
          // Not found in Metricool scheduler — Metricool removes posts after publishing.
          // If the scheduled time is 30+ min in the past, assume it was published.
          const scheduledAt = new Date(post.scheduled_at as string)
          if (scheduledAt < thirtyMinAgo) {
            newStatus = 'published'
            publishedAt = new Date().toISOString()
          }
        }
        // mcStatus is 'SCHEDULED' or similar — not published yet, skip

        if (!newStatus) continue

        const patch: Record<string, string> = { status: newStatus }
        if (publishedAt) patch.published_at = publishedAt

        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update(patch)
          .eq('id', post.id)

        if (updateError) {
          errors.push(`Post ${post.metricool_post_id}: ${updateError.message}`)
        } else {
          updated++
        }
      }
    } catch (err) {
      errors.push(`Client ${client.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ updated, errors })
}
