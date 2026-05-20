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
 * Call this manually from the publishing page when Metricool shows a post
 * as published but the app hasn't caught up (i.e. the webhook hasn't fired).
 *
 * Returns: { updated: number, errors: string[] }
 */
export async function POST() {
  // Get all clients with a Metricool blog ID
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }

  let updated = 0
  const errors: string[] = []

  for (const client of clients ?? []) {
    try {
      const metricoolPosts = await getScheduledPosts(client.metricool_blog_id)

      for (const mp of metricoolPosts) {
        const metricoolStatus = (mp.status ?? '').toLowerCase()

        // Map Metricool statuses → our DB statuses
        let newStatus: string | null = null
        if (metricoolStatus === 'published' || metricoolStatus === 'success') {
          newStatus = 'published'
        } else if (metricoolStatus === 'failed' || metricoolStatus === 'error') {
          newStatus = 'failed'
        }

        if (!newStatus) continue

        const { data: post } = await supabase
          .from('scheduled_posts')
          .select('id, status')
          .eq('metricool_post_id', mp.id)
          .single()

        if (!post || post.status === newStatus) continue

        const patch: Record<string, string> = { status: newStatus }
        if (newStatus === 'published') {
          patch.published_at = new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update(patch)
          .eq('id', post.id)

        if (updateError) {
          errors.push(`Post ${mp.id}: ${updateError.message}`)
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
