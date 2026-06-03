import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/metricool/analytics
 * Query: client_id, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 * Optional: trend=true
 *
 * Uses /analytics/posts (confirmed working endpoint).
 * No mock fallback — returns real errors.
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
  const { getStats, getPlatformStats } = await import('@/lib/metricool')

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

  try {
    const [stats, platforms] = await Promise.all([
      getStats(blogId, startDate, endDate),
      getPlatformStats(blogId, startDate, endDate),
    ])

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
