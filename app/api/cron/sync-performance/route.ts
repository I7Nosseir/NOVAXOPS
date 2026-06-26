import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://app.metricool.com/api/v2'

function requireToken() {
  const t = process.env.METRICOOL_API_TOKEN
  if (!t) throw new Error('METRICOOL_API_TOKEN not configured')
  return t
}
function requireUserId() {
  const u = process.env.METRICOOL_USER_ID
  if (!u) throw new Error('METRICOOL_USER_ID not configured')
  return u
}

interface MetricoolPostStats {
  id?: string
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
  const params = new URLSearchParams({ userId: requireUserId(), blogId })
  const res = await fetch(`${BASE}/analytics/posts/${metricoolPostId}?${params}`, {
    headers: {
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
    },
  })
  if (!res.ok) return null
  const data = await res.json() as { data?: MetricoolPostStats }
  return data.data ?? null
}

/**
 * GET /api/cron/sync-performance
 *
 * Vercel Cron: runs daily at 07:00 UTC (see vercel.json).
 * Pulls stats for all posts published in the last 30 days and upserts snapshots.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, metricool_post_id, platforms, client_id')
    .eq('status', 'published')
    .gte('published_at', since)
    .not('metricool_post_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get blog IDs keyed by client_id
  const clientIds = [...new Set((posts ?? []).map(p => p.client_id as string))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .in('id', clientIds)

  const blogIdMap: Record<string, string> = {}
  for (const c of clients ?? []) {
    if (c.metricool_blog_id) blogIdMap[c.id] = c.metricool_blog_id
  }

  let synced = 0
  let skipped = 0
  const errors: string[] = []

  for (const post of posts ?? []) {
    const blogId = blogIdMap[post.client_id as string]
    if (!blogId || !post.metricool_post_id) { skipped++; continue }

    try {
      // 200ms back-off to respect undocumented Metricool rate limits
      await new Promise(r => setTimeout(r, 200))
      const stats = await fetchPostStats(post.metricool_post_id as string, blogId)
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

      synced++
    } catch (err) {
      errors.push(`${post.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ synced, skipped, errors, total: (posts ?? []).length })
}
