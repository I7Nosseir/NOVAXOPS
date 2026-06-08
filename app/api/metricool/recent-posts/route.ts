import { NextRequest, NextResponse } from 'next/server'

const HAS_DB       = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)

export interface RecentPost {
  id:         string
  client_id:  string
  client_name: string
  client_color: string
  platform:   string
  thumbnail:  string | null
  caption:    string
  published_at: string | null
  reach:      number
  likes:      number
  comments:   number
  shares:     number
  er:         number
}

/**
 * GET /api/metricool/recent-posts?limit=12&days=30
 *
 * Fetches the most recent published posts across all clients that have a
 * Metricool blog ID configured. Returns posts with thumbnails for the dashboard
 * visual feed. Sorted by publishDate descending.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '12'), 30)
  const days  = Math.min(Number(searchParams.get('days')  ?? '30'), 90)

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({ posts: [], error: 'Metricool or database not configured.' })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { fetchPostsList } = await import('@/lib/metricool')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, color, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)

  if (error) return NextResponse.json({ posts: [], error: error.message })

  const endDate   = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr  = startDate.toISOString().split('T')[0]
  const endStr    = endDate.toISOString().split('T')[0]

  const allPosts: RecentPost[] = []

  for (const client of clients ?? []) {
    if (!client.metricool_blog_id) continue
    try {
      const posts = await fetchPostsList(String(client.metricool_blog_id), startStr, endStr)
      for (const p of posts) {
        const raw = p as typeof p & Record<string, unknown>
        // Thumbnail: Metricool returns it as 'thumbnail', 'imageUrl', 'media', or 'image'
        const thumb = String(
          raw.thumbnail ?? raw.imageUrl ?? raw.thumbnailUrl ?? raw.image ?? raw.media ?? ''
        )
        const pubDate = String(p.publishDate ?? raw.publishedAt ?? raw.created_at ?? '')
        const er = Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)
        allPosts.push({
          id:           String(p.id ?? `${client.id}-${pubDate}`),
          client_id:    client.id,
          client_name:  client.name,
          client_color: client.color ?? '#1B3D38',
          platform:     String(p.network ?? p.platform ?? 'unknown').toLowerCase(),
          thumbnail:    thumb.startsWith('http') ? thumb : null,
          caption:      String(p.text ?? p.title ?? '').slice(0, 200),
          published_at: pubDate || null,
          reach:        Number(p.reach        ?? 0),
          likes:        Number(p.likes        ?? 0),
          comments:     Number(p.comments     ?? 0),
          shares:       Number(p.shares       ?? 0),
          er:           parseFloat(er.toFixed(2)),
        })
      }
    } catch (err) {
      console.error(`[recent-posts] ${client.name}:`, err instanceof Error ? err.message : err)
    }
  }

  // Sort by publish date descending, then take top N
  const sorted = allPosts
    .filter(p => p.published_at)
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
    .slice(0, limit)

  return NextResponse.json({ posts: sorted })
}
