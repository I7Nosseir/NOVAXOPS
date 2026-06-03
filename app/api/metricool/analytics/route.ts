import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/metricool/analytics
 * Query: client_id, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 * Optional: trend=true — fetches 5-month trend by making one call per month
 *
 * Returns: { stats, platforms, trend? }
 * All data is live from Metricool — no mock fallback.
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

  if (!process.env.METRICOOL_API_TOKEN || !process.env.METRICOOL_USER_ID) {
    return NextResponse.json(
      { error: 'Metricool not configured — add METRICOOL_API_TOKEN and METRICOOL_USER_ID.' },
      { status: 503 }
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { getStats } = await import('@/lib/metricool')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: client, error: dbError } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', client_id)
    .single()

  if (dbError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!client.metricool_blog_id) {
    return NextResponse.json(
      { error: `"${client.name as string}" has no Metricool blog ID — set it in Settings → Integrations.` },
      { status: 400 }
    )
  }

  const blogId = String(client.metricool_blog_id)
  const token  = process.env.METRICOOL_API_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  const BASE   = 'https://app.metricool.com/api/v2'

  try {
    const stats = await getStats(blogId, startDate, endDate)

    // Per-platform breakdown — only include platforms that actually have data
    const platformList = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']
    type PRow = { platform: string; reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; posts: number; engagement_rate: number }
    const platformResults = await Promise.allSettled(
      platformList.map(async (p): Promise<PRow | null> => {
        const res = await fetch(
          `${BASE}/analytics/summary?userId=${userId}&blogId=${blogId}&startDate=${startDate}&endDate=${endDate}&network=${p}`,
          { headers: { 'X-Mc-Auth': token, Accept: 'application/json' }, cache: 'no-store' }
        )
        if (!res.ok) return null
        const raw = await res.json() as Record<string, unknown>
        const d = (raw.data ?? raw[p] ?? raw) as Record<string, number>
        const reach       = Number(d.reach ?? 0)
        const impressions = Number(d.impressions ?? 0)
        if (!reach && !impressions) return null
        return {
          platform: p, reach, impressions,
          likes:           Number(d.likes ?? 0),
          comments:        Number(d.comments ?? 0),
          shares:          Number(d.shares ?? 0),
          saves:           Number(d.saves ?? 0),
          posts:           Number(d.posts ?? d.postsCount ?? 0),
          engagement_rate: Number(d.engagement_rate ?? d.engagement ?? 0),
        }
      })
    )
    const platforms: PRow[] = platformResults
      .filter((r): r is PromiseFulfilledResult<PRow> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    // Optional 5-month trend
    let trend: { month: string; reach: number; impressions: number; er: number }[] | undefined
    if (withTrend) {
      const months: typeof trend = []
      const endDt = new Date(endDate)
      for (let i = 4; i >= 0; i--) {
        const d = new Date(endDt.getFullYear(), endDt.getMonth() - i, 1)
        const y = d.getFullYear()
        const m = d.getMonth()
        const s = `${y}-${String(m + 1).padStart(2, '0')}-01`
        const e = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
        const ms = await getStats(blogId, s, e).catch(() => null)
        months.push({
          month:       d.toLocaleString('en', { month: 'short' }),
          reach:       Number(ms?.reach ?? 0),
          impressions: Number(ms?.impressions ?? 0),
          er:          Number(ms?.engagement_rate ?? 0),
        })
      }
      trend = months
    }

    return NextResponse.json({ client_id, startDate, endDate, stats, platforms, trend })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Metricool fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
