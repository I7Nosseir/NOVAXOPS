import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)

// Realistic mock analytics returned when Metricool / DB not configured
const MOCK_STATS = {
  reach: 284500,
  impressions: 412000,
  engagement_rate: 5.8,
  likes: 18200,
  comments: 6840,
  shares: 12400,
  saves: 18400,
  followers: 2840,
  clicks: 8400,
}

/**
 * GET /api/metricool/analytics?client_id=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Pulls aggregate performance data from Metricool for a specific client.
 * Falls back to mock data in dev when Metricool / DB not configured.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const startDate  = searchParams.get('startDate')
  const endDate    = searchParams.get('endDate')

  if (!client_id || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'client_id, startDate, and endDate are required' },
      { status: 400 }
    )
  }

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({ client_id, startDate, endDate, stats: MOCK_STATS, _mock: true })
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

  try {
    const stats = await getStats(client.metricool_blog_id, startDate, endDate)
    return NextResponse.json({ client_id, startDate, endDate, stats })
  } catch {
    // Metricool API unavailable — return mock stats so UI stays functional
    return NextResponse.json({ client_id, startDate, endDate, stats: MOCK_STATS, _mock: true })
  }
}
