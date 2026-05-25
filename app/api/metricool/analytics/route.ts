import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)

const MOCK_STATS = {
  reach: 284500, impressions: 412000, engagement_rate: 5.8,
  likes: 18200, comments: 6840, shares: 12400, saves: 18400,
  followers: 2840, clicks: 8400,
}

const MOCK_PLATFORMS = [
  { platform: 'instagram', reach: 168000, impressions: 243000, likes: 11400, comments: 4200, shares: 7100, saves: 12300, posts: 18, engagement_rate: 6.8 },
  { platform: 'tiktok',    reach: 71000,  impressions: 98000,  likes: 4800,  comments: 1800, shares: 3600, saves: 4200,  posts: 7,  engagement_rate: 9.1 },
  { platform: 'facebook',  reach: 28200,  impressions: 41000,  likes: 1400,  comments: 520,  shares: 980,  saves: 800,   posts: 6,  engagement_rate: 3.4 },
  { platform: 'linkedin',  reach: 17300,  impressions: 30000,  likes: 600,   comments: 320,  shares: 720,  saves: 1100,  posts: 3,  engagement_rate: 4.2 },
]

const MOCK_TREND = [
  { month: 'Jan', reach: 182000, impressions: 264000, er: 4.8 },
  { month: 'Feb', reach: 198000, impressions: 287000, er: 5.1 },
  { month: 'Mar', reach: 224000, impressions: 326000, er: 5.4 },
  { month: 'Apr', reach: 241000, impressions: 349000, er: 5.0 },
  { month: 'May', reach: 284500, impressions: 412000, er: 5.8 },
]

/**
 * GET /api/metricool/analytics
 * Query: client_id, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 * Optional: trend=true — fetches 5-month trend by making one call per month
 *
 * Returns: { stats, platforms, trend?, _mock? }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const startDate  = searchParams.get('startDate')
  const endDate    = searchParams.get('endDate')
  const withTrend  = searchParams.get('trend') === 'true'

  if (!client_id || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'client_id, startDate, and endDate are required' },
      { status: 400 }
    )
  }

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({
      client_id, startDate, endDate,
      stats: MOCK_STATS,
      platforms: MOCK_PLATFORMS,
      trend: withTrend ? MOCK_TREND : undefined,
      _mock: true,
    })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { getStats } = await import('@/lib/metricool')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client, error } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', client_id)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!client.metricool_blog_id) {
    return NextResponse.json(
      { error: `"${client.name as string}" has no Metricool blog ID configured.` },
      { status: 400 }
    )
  }

  const blogId = client.metricool_blog_id as string

  try {
    const stats = await getStats(blogId, startDate, endDate)

    // Build per-platform breakdown from individual platform stats if available
    let platforms: typeof MOCK_PLATFORMS = []
    try {
      const BASE = 'https://app.metricool.com/api/v2'
      const token = process.env.METRICOOL_API_TOKEN!
      const userId = process.env.METRICOOL_USER_ID!
      const platformList = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']
      const results = await Promise.allSettled(
        platformList.map(async (p) => {
          const res = await fetch(
            `${BASE}/analytics/summary?userId=${userId}&blogId=${blogId}&startDate=${startDate}&endDate=${endDate}&network=${p}`,
            { headers: { 'X-Mc-Auth': token, Accept: 'application/json' } }
          )
          if (!res.ok) return null
          const raw = await res.json() as Record<string, unknown>
          const d = (raw.data ?? raw[p] ?? raw) as Record<string, number>
          const reach = (d.reach ?? 0) as number
          const impressions = (d.impressions ?? 0) as number
          const likes = (d.likes ?? 0) as number
          const comments = (d.comments ?? 0) as number
          const shares = (d.shares ?? 0) as number
          const saves = (d.saves ?? 0) as number
          const posts = (d.posts ?? d.postsCount ?? 0) as number
          const er = (d.engagement_rate ?? d.engagement ?? 0) as number
          if (!reach && !impressions) return null
          return { platform: p, reach, impressions, likes, comments, shares, saves, posts, engagement_rate: er }
        })
      )
      platforms = results
        .filter((r): r is PromiseFulfilledResult<typeof MOCK_PLATFORMS[0]> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
    } catch { /* fallback: no platform breakdown */ }

    // Build 5-month trend if requested
    let trend: typeof MOCK_TREND | undefined
    if (withTrend) {
      try {
        const months: typeof MOCK_TREND = []
        const endDt  = new Date(endDate)
        for (let i = 4; i >= 0; i--) {
          const d  = new Date(endDt.getFullYear(), endDt.getMonth() - i, 1)
          const y  = d.getFullYear()
          const m  = d.getMonth()
          const s  = `${y}-${String(m + 1).padStart(2, '0')}-01`
          const e  = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
          const ms = await getStats(blogId, s, e).catch(() => null)
          months.push({
            month: d.toLocaleString('en', { month: 'short' }),
            reach: ms?.reach ?? 0,
            impressions: ms?.impressions ?? 0,
            er: ms?.engagement_rate ?? 0,
          })
        }
        trend = months
      } catch { /* skip trend */ }
    }

    return NextResponse.json({ client_id, startDate, endDate, stats, platforms, trend })
  } catch {
    return NextResponse.json({
      client_id, startDate, endDate,
      stats: MOCK_STATS,
      platforms: MOCK_PLATFORMS,
      trend: withTrend ? MOCK_TREND : undefined,
      _mock: true,
    })
  }
}
