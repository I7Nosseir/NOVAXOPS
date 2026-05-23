import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)

const BASE = 'https://app.metricool.com/api/v2'

interface MetricoolPostStats {
  reach?: number
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  linkClicks?: number
  clicks?: number
  engagementRate?: number
  engagement?: number
  network?: string
}

async function fetchPostStats(metricoolPostId: string, blogId: string): Promise<MetricoolPostStats | null> {
  const params = new URLSearchParams({
    userId: process.env.METRICOOL_USER_ID!,
    blogId,
  })
  const res = await fetch(`${BASE}/analytics/posts/${metricoolPostId}?${params}`, {
    headers: { Accept: 'application/json', 'X-Mc-Auth': process.env.METRICOOL_API_TOKEN! },
  })
  if (!res.ok) return null
  const data = await res.json() as { data?: MetricoolPostStats }
  return data.data ?? null
}

/**
 * POST /api/performance/sync
 * Body: { client_id: string }
 *
 * On-demand Metricool stats pull for a single client.
 * Mirrors /api/cron/sync-performance but scoped to one client for manual trigger.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({ synced: 0, skipped: 0, errors: [], _mock: true })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', client_id)
    .single()

  if (!client?.metricool_blog_id) {
    return NextResponse.json({ error: 'Client has no Metricool blog ID configured' }, { status: 400 })
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, metricool_post_id, platforms')
    .eq('client_id', client_id)
    .eq('status', 'published')
    .gte('published_at', since)
    .not('metricool_post_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let synced = 0
  let skipped = 0
  const errors: string[] = []

  for (const post of posts ?? []) {
    if (!post.metricool_post_id) { skipped++; continue }

    try {
      await new Promise(r => setTimeout(r, 200))
      const stats = await fetchPostStats(post.metricool_post_id, client.metricool_blog_id)
      if (!stats) { skipped++; continue }

      const platforms = (post.platforms as string[]) ?? []
      const platform = stats.network ?? platforms[0] ?? 'unknown'
      const er = stats.engagementRate ?? stats.engagement ?? 0
      const lc = stats.linkClicks ?? stats.clicks ?? 0

      await supabase.from('post_performance_snapshots').upsert({
        post_id: post.id,
        platform,
        reach: stats.reach ?? 0,
        impressions: stats.impressions ?? 0,
        likes: stats.likes ?? 0,
        comments: stats.comments ?? 0,
        shares: stats.shares ?? 0,
        saves: stats.saves ?? 0,
        link_clicks: lc,
        engagement_rate: er,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'post_id,platform' })

      await supabase.from('scheduled_posts').update({
        performance_data: {
          reach: stats.reach ?? 0,
          impressions: stats.impressions ?? 0,
          engagement_rate: er,
          likes: stats.likes ?? 0,
          comments: stats.comments ?? 0,
          shares: stats.shares ?? 0,
          saves: stats.saves ?? 0,
        },
      }).eq('id', post.id)

      synced++
    } catch (err) {
      errors.push(`${post.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ synced, skipped, errors, total: (posts ?? []).length })
}
