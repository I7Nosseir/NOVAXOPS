import { NextRequest, NextResponse } from 'next/server'

const HAS_DB       = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)

export interface RecentPost {
  id:           string
  client_id:    string
  client_name:  string
  client_color: string
  platform:     string
  post_type:    'reel' | 'post' | 'story' | 'video' | 'carousel' | 'unknown'
  thumbnail:    string | null
  caption:      string
  published_at: string | null
  reach:        number
  likes:        number
  comments:     number
  shares:       number
  er:           number
}

/**
 * GET /api/metricool/recent-posts?perClient=6&days=30
 *
 * Fetches the most recent published posts per client that have a
 * Metricool blog ID configured. Returns posts grouped by client for the
 * dashboard visual feed. Each client gets its own section with up to perClient posts.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Legacy: if 'limit' is passed treat it as perClient
  const perClient = Math.min(Number(searchParams.get('perClient') ?? searchParams.get('limit') ?? '6'), 20)
  const days       = Math.min(Number(searchParams.get('days') ?? '30'), 90)

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

        // Thumbnail: Metricool uses different fields per content type.
        // Reels/videos: thumbnailUrl, coverImageUrl, posterUrl, videoThumbnailUrl
        // Images/carousels: imageUrl, image
        // All types may also use: thumbnail, media
        const thumbRaw = String(
          raw.thumbnailUrl       ??
          raw.coverImageUrl      ??
          raw.posterUrl          ??
          raw.videoThumbnailUrl  ??
          raw.thumbnail          ??
          raw.imageUrl           ??
          raw.image              ??
          raw.mediaUrl           ??
          raw.media              ??
          ''
        )
        const thumb = thumbRaw.startsWith('http') ? thumbRaw : null

        const pubDate = String(p.publishDate ?? raw.publishedAt ?? raw.created_at ?? raw.publishedDate ?? '')
        const er = Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)

        // Detect post type from Metricool's `type` field or `postType`, or infer from content
        const rawType = String(raw.type ?? raw.postType ?? raw.contentType ?? '').toLowerCase()
        let post_type: RecentPost['post_type'] = 'unknown'
        if (rawType.includes('reel'))       post_type = 'reel'
        else if (rawType.includes('story')) post_type = 'story'
        else if (rawType.includes('video') || (p as typeof p & { views?: number }).views) post_type = 'video'
        else if (rawType.includes('carousel') || rawType.includes('album')) post_type = 'carousel'
        else if (rawType.includes('post') || rawType.includes('image')) post_type = 'post'

        allPosts.push({
          id:           String(p.id ?? `${client.id}-${pubDate}`),
          client_id:    client.id,
          client_name:  client.name,
          client_color: client.color ?? '#1B3D38',
          platform:     String(p.network ?? p.platform ?? 'unknown').toLowerCase(),
          post_type,
          thumbnail:    thumb,
          caption:      String(p.text ?? p.title ?? '').slice(0, 200),
          published_at: pubDate || null,
          reach:        Number(p.reach    ?? 0),
          likes:        Number(p.likes    ?? 0),
          comments:     Number(p.comments ?? 0),
          shares:       Number(p.shares   ?? 0),
          er:           parseFloat(er.toFixed(2)),
        })
      }
    } catch (err) {
      console.error(`[recent-posts] ${client.name}:`, err instanceof Error ? err.message : err)
    }
  }

  // Group per client: sort each client's posts by date desc, take top perClient
  const byClient = new Map<string, RecentPost[]>()
  for (const post of allPosts) {
    if (!post.published_at) continue
    if (!byClient.has(post.client_id)) byClient.set(post.client_id, [])
    byClient.get(post.client_id)!.push(post)
  }
  const grouped: { client_id: string; client_name: string; client_color: string; posts: RecentPost[] }[] = []
  for (const [client_id, clientPosts] of byClient.entries()) {
    const sorted = clientPosts
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
      .slice(0, perClient)
    const first = sorted[0]
    grouped.push({ client_id, client_name: first.client_name, client_color: first.client_color, posts: sorted })
  }

  // Sort groups by the most recent post date across all clients
  grouped.sort((a, b) =>
    new Date(b.posts[0]?.published_at ?? 0).getTime() - new Date(a.posts[0]?.published_at ?? 0).getTime()
  )

  // Also return a flat list for backwards-compat
  const posts = grouped.flatMap(g => g.posts)
  return NextResponse.json({ posts, grouped })
}
