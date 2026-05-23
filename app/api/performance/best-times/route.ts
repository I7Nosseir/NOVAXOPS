import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Realistic mock heatmap — peaks Tue/Thu mornings and evenings
const MOCK_HEATMAP = [
  { day: 'Tue', hour: 10, avg_er: 8.4, count: 6 },
  { day: 'Thu', hour: 10, avg_er: 7.9, count: 5 },
  { day: 'Sun', hour: 19, avg_er: 7.6, count: 4 },
  { day: 'Wed', hour: 13, avg_er: 7.1, count: 5 },
  { day: 'Fri', hour: 15, avg_er: 6.8, count: 4 },
  { day: 'Tue', hour: 18, avg_er: 6.5, count: 3 },
  { day: 'Thu', hour: 20, avg_er: 6.2, count: 4 },
  { day: 'Sat', hour: 12, avg_er: 5.9, count: 3 },
  { day: 'Mon', hour: 9,  avg_er: 5.4, count: 4 },
  { day: 'Wed', hour: 18, avg_er: 5.1, count: 3 },
  { day: 'Mon', hour: 8,  avg_er: 3.8, count: 3 },
  { day: 'Fri', hour: 8,  avg_er: 3.2, count: 2 },
]

/**
 * GET /api/performance/best-times?client_id=&platform=
 *
 * Computes a 7×24 heatmap of average ER by (day_of_week, hour).
 * Returns: { heatmap: [{ day: 'Mon', hour: 14, avg_er: 6.2, count: 4 }], best: { day, hour, avg_er } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const platform  = searchParams.get('platform')

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB) {
    return NextResponse.json({
      heatmap: MOCK_HEATMAP,
      best: MOCK_HEATMAP[0],
      total_posts: 32,
      _mock: true,
    })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('scheduled_posts')
    .select(`
      scheduled_at,
      post_performance_snapshots ( platform, engagement_rate )
    `)
    .eq('client_id', client_id)
    .eq('status', 'published')
    .not('scheduled_at', 'is', null)

  const { data: posts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type SnapRow = { platform: string; engagement_rate: number }
  type Bucket = { sum: number; count: number }
  const buckets: Record<string, Bucket> = {}

  for (const post of posts ?? []) {
    const snaps = (post.post_performance_snapshots as SnapRow[]) ?? []
    const relevant = platform ? snaps.filter(s => s.platform === platform) : snaps
    if (relevant.length === 0) continue

    const avgER = relevant.reduce((s, p) => s + p.engagement_rate, 0) / relevant.length
    const date = new Date(post.scheduled_at as string)
    const day = DAYS[date.getUTCDay()]
    const hour = date.getUTCHours()
    const key = `${day}_${hour}`

    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 }
    buckets[key].sum += avgER
    buckets[key].count++
  }

  const heatmap = Object.entries(buckets).map(([key, { sum, count }]) => {
    const [day, hourStr] = key.split('_')
    return {
      day,
      hour: Number(hourStr),
      avg_er: parseFloat((sum / count).toFixed(2)),
      count,
    }
  }).sort((a, b) => b.avg_er - a.avg_er)

  const best = heatmap[0] ?? null

  return NextResponse.json({ heatmap, best, total_posts: (posts ?? []).length })
}
