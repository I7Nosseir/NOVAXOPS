import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Runs nightly at 04:00 UTC (after sync-performance at 03:00).
// Reads post_performance_snapshots from the last 30 days, computes per-client
// averages, and writes Performance Win / Performance Loss entries to
// client_context_bank so AI prompts know what actually worked.
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Expire stale learning-loop entries ───────────────────────────────────
  await db
    .from('client_context_bank')
    .update({ is_active: false })
    .eq('source', 'learning_loop')
    .lt('expires_at', new Date().toISOString())

  // ── 2. Fetch all clients ────────────────────────────────────────────────────
  const { data: clients, error: clientErr } = await db
    .from('clients')
    .select('id, name')
    .eq('is_active', true)

  if (clientErr || !clients?.length) {
    return NextResponse.json({ error: clientErr?.message ?? 'No clients', inserted: 0 })
  }

  let totalInserted = 0
  let totalClients = 0

  for (const client of clients) {
    try {
      // ── 3. Fetch recent posts for this client ───────────────────────────────
      const { data: posts } = await db
        .from('scheduled_posts')
        .select('id, caption, platform, post_type, platforms')
        .eq('client_id', client.id)
        .eq('status', 'published')

      if (!posts?.length) continue

      const postIds = posts.map(p => p.id as string)

      // ── 4. Fetch snapshots for those posts ──────────────────────────────────
      const { data: snaps } = await db
        .from('post_performance_snapshots')
        .select('post_id, platform, engagement_rate, captured_at')
        .in('post_id', postIds)
        .gte('captured_at', cutoff)
        .gt('engagement_rate', 0)

      if (!snaps?.length) continue

      // ── 5. Compute per-client average ER ───────────────────────────────────
      type Snap = { post_id: string; platform: string; engagement_rate: number; captured_at: string }
      const snapList = snaps as Snap[]
      const avgEr = snapList.reduce((acc, s) => acc + s.engagement_rate, 0) / snapList.length

      if (avgEr <= 0) continue

      // ── 6. Identify high and low performers ────────────────────────────────
      const high = snapList.filter(s => s.engagement_rate >= avgEr * 2)
      const low  = snapList.filter(s => s.engagement_rate <= avgEr * 0.5)

      // ── 7. Fetch already-logged post IDs to avoid duplicates ───────────────
      const { data: existing } = await db
        .from('client_context_bank')
        .select('full_text')
        .eq('client_id', client.id)
        .eq('source', 'learning_loop')
        .eq('is_active', true)

      const loggedPostIds = new Set(
        (existing ?? []).map(e => (e.full_text as string | null)?.split('::')[0] ?? '')
      )

      const toInsert: object[] = []

      for (const snap of high) {
        const key = `${snap.post_id}::win`
        if (loggedPostIds.has(key)) continue

        const post = posts.find(p => p.id === snap.post_id)
        if (!post) continue

        const platform = snap.platform || (post.platforms as string[])?.[0] || 'unknown'
        const hook = ((post.caption as string) ?? '').slice(0, 120)
        const erFormatted = snap.engagement_rate.toFixed(2)
        const avgFormatted = avgEr.toFixed(2)
        const multiplier   = (snap.engagement_rate / avgEr).toFixed(1)

        toInsert.push({
          client_id:        client.id,
          category:         'Performance Win',
          summary:          `High performer on ${platform} (${post.post_type ?? 'post'}): "${hook}" — ${erFormatted}% ER (${multiplier}× client avg of ${avgFormatted}%)`,
          full_text:        key,
          source:           'learning_loop',
          confidence_score: 1,
          is_active:        true,
          expires_at:       expiry,
        })
      }

      for (const snap of low) {
        const key = `${snap.post_id}::loss`
        if (loggedPostIds.has(key)) continue

        const post = posts.find(p => p.id === snap.post_id)
        if (!post) continue

        const platform = snap.platform || (post.platforms as string[])?.[0] || 'unknown'
        const hook = ((post.caption as string) ?? '').slice(0, 100)
        const erFormatted = snap.engagement_rate.toFixed(2)

        toInsert.push({
          client_id:        client.id,
          category:         'Performance Loss',
          summary:          `Underperformer on ${platform} (${post.post_type ?? 'post'}): "${hook}" — only ${erFormatted}% ER. Avoid similar approach.`,
          full_text:        key,
          source:           'learning_loop',
          confidence_score: 1,
          is_active:        true,
          expires_at:       expiry,
        })
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await db
          .from('client_context_bank')
          .insert(toInsert)

        if (insertErr) {
          console.error(`[learning-loop] insert failed for client ${client.id}:`, insertErr.message)
        } else {
          totalInserted += toInsert.length
          totalClients++
        }
      }
    } catch (err) {
      console.error(`[learning-loop] error processing client ${client.id}:`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    clients_processed: totalClients,
    entries_inserted:  totalInserted,
  })
}
