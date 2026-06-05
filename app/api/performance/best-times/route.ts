import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const query = supabase
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
