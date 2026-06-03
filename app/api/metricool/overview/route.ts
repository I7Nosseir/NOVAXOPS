import { NextRequest, NextResponse } from 'next/server'
import { getStats } from '@/lib/metricool'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)


/**
 * GET /api/metricool/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Aggregate Metricool analytics across all clients that have a blog ID configured.
 * Used by the dashboard Social Performance section.
 * Falls back to mock data in dev when Metricool / DB not configured.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json(
      { error: 'Metricool or database not configured.' },
      { status: 503 }
    )
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { client_id: string; name: string; reach: number; impressions: number; er: number; posts: number }[] = []
  const errors: string[] = []

  for (const client of clients ?? []) {
    if (!client.metricool_blog_id) continue
    try {
      const stats = await getStats(client.metricool_blog_id, startDate, endDate)
      results.push({
        client_id: client.id,
        name: client.name,
        reach: stats.reach ?? 0,
        impressions: stats.impressions ?? 0,
        er: stats.engagement_rate ?? stats.engagement ?? 0,
        posts: 0,
      })
    } catch (err) {
      errors.push(`${client.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const total_reach       = results.reduce((s, c) => s + c.reach, 0)
  const total_impressions = results.reduce((s, c) => s + c.impressions, 0)
  const avg_er = results.length
    ? parseFloat((results.reduce((s, c) => s + c.er, 0) / results.length).toFixed(2))
    : 0

  return NextResponse.json({
    total_reach,
    total_impressions,
    avg_er,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    clients: results,
    errors: errors.length > 0 ? errors : undefined,
  })
}
