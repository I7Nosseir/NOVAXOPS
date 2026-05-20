import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStats } from '@/lib/metricool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/metricool/analytics?client_id=...&startDate=2026-05-01&endDate=2026-05-31
 *
 * Pulls real performance data from Metricool for a specific client.
 * Note: the analytics endpoint path may need adjustment once the correct Metricool
 * analytics URL is confirmed (current attempt: /analytics/summary).
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
      { error: `"${client.name}" has no Metricool blog ID configured.` },
      { status: 400 }
    )
  }

  try {
    const stats = await getStats(client.metricool_blog_id, startDate, endDate)
    return NextResponse.json({ client_id, startDate, endDate, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
