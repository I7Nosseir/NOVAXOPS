import { NextRequest, NextResponse } from 'next/server'

const HAS_DB        = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
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

export interface PlatformSection {
  platform:    string
  post_count:  number
  posts:       RecentPost[]
}

export interface ClientGroup {
  client_id:    string
  client_name:  string
  client_color: string
  total_posts:  number
  platforms:    PlatformSection[]
}

/**
 * GET /api/metricool/recent-posts?perPlatform=8&days=30
 *
 * Returns posts grouped by client → platform, each platform sorted by
 * publish date descending. Handles instagram_reel as a separate Metricool
 * endpoint — reels appear in the Instagram section with post_type='reel'.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const perPlatform = Math.min(Number(searchParams.get('perPlatform') ?? searchParams.get('perClient') ?? searchParams.get('limit') ?? '8'), 30)
  const days        = Math.min(Number(searchParams.get('days') ?? '30'), 90)

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({ posts: [], grouped: [], error: 'Metricool or database not configured.' })
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

  if (error) return NextResponse.json({ posts: [], grouped: [], error: error.message })

  const endDate  = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr  = startDate.toISOString().split('T')[0]
  const endStr    = endDate.toISOString().split('T')[0]

  // Per-client → per-platform map: client_id → platform → posts[]
  const clientMap = new Map<string, { name: string; color: string; byPlatform: Map<string, RecentPost[]> }>()

  for (const client of clients ?? []) {
    if (!client.metricool_blog_id) continue
    try {
      const posts = await fetchPostsList(String(client.metricool_blog_id), startStr, endStr)

      for (const p of posts) {
        const raw = p as typeof p & Record<string, unknown>

        // Thumbnail is already resolved in fetchNetworkPosts
        const thumb = typeof p.thumbnail === 'string' && p.thumbnail.startsWith('http')
          ? p.thumbnail
          : null

        const pubDate = String(p.publishDate ?? raw.publishedAt ?? raw.created_at ?? raw.publishedDate ?? '')
        if (!pubDate) continue   // skip posts with no date — can't sort them

        const er = Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)

        // content_type injected by fetchNetworkPosts from the endpoint name
        const ct = p.content_type ?? 'unknown'
        let post_type: RecentPost['post_type'] =
          ct === 'reel'     ? 'reel'     :
          ct === 'story'    ? 'story'    :
          ct === 'video'    ? 'video'    :
          ct === 'short'    ? 'video'    :
          ct === 'carousel' ? 'carousel' :
          ct === 'post'     ? 'post'     : 'unknown'

        // Secondary inference for cases where content_type is 'post' but raw fields reveal more
        if (post_type === 'post') {
          const rawType = String(raw.type ?? raw.postType ?? raw.contentType ?? '').toLowerCase()
          if (rawType.includes('reel'))                                 post_type = 'reel'
          else if (rawType.includes('carousel') || rawType.includes('album')) post_type = 'carousel'
          else if (rawType.includes('video'))                           post_type = 'video'
        }

        const platform = String(p.network ?? p.platform ?? 'unknown').toLowerCase()

        const post: RecentPost = {
          id:           String(p.id ?? `${client.id}-${pubDate}`),
          client_id:    client.id,
          client_name:  client.name,
          client_color: client.color ?? '#1B3D38',
          platform,
          post_type,
          thumbnail:    thumb,
          caption:      String(p.text ?? p.title ?? '').slice(0, 200),
          published_at: pubDate,
          reach:        Number(p.reach    ?? 0),
          likes:        Number(p.likes    ?? 0),
          comments:     Number(p.comments ?? 0),
          shares:       Number(p.shares   ?? 0),
          er:           parseFloat(er.toFixed(2)),
        }

        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, { name: client.name, color: client.color ?? '#1B3D38', byPlatform: new Map() })
        }
        const entry = clientMap.get(client.id)!
        if (!entry.byPlatform.has(platform)) entry.byPlatform.set(platform, [])
        entry.byPlatform.get(platform)!.push(post)
      }
    } catch (err) {
      console.error(`[recent-posts] ${client.name}:`, err instanceof Error ? err.message : err)
    }
  }

  // Platform display order preference
  const PLATFORM_ORDER = ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'twitter']

  const grouped: ClientGroup[] = []

  for (const [client_id, { name, color, byPlatform }] of clientMap.entries()) {
    const platforms: PlatformSection[] = []

    // Sort platforms: preferred order first, then alphabetical
    const sortedPlatforms = [...byPlatform.keys()].sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a)
      const ib = PLATFORM_ORDER.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    for (const platform of sortedPlatforms) {
      const raw = byPlatform.get(platform)!
      // Sort by publish date descending, take top N
      const sorted = raw
        .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
        .slice(0, perPlatform)
      platforms.push({ platform, post_count: sorted.length, posts: sorted })
    }

    const total_posts = platforms.reduce((s, p) => s + p.post_count, 0)
    if (total_posts === 0) continue

    grouped.push({ client_id, client_name: name, client_color: color, total_posts, platforms })
  }

  // Sort clients by most recent post across all their platforms
  grouped.sort((a, b) => {
    const latestA = a.platforms[0]?.posts[0]?.published_at ?? ''
    const latestB = b.platforms[0]?.posts[0]?.published_at ?? ''
    return new Date(latestB).getTime() - new Date(latestA).getTime()
  })

  const posts = grouped.flatMap(g => g.platforms.flatMap(p => p.posts))
  return NextResponse.json({ posts, grouped })
}
