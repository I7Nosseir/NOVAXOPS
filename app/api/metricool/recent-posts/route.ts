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

// Canonical display order for platforms
const PLATFORM_ORDER = ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'twitter']

/**
 * GET /api/metricool/recent-posts?perPlatform=8&days=60
 *
 * Returns posts grouped by client → platform (sorted newest-first).
 * Connected platforms that returned 0 posts still appear as empty sections.
 * Handles instagram_reel / facebook_reel as sub-types of instagram / facebook.
 * Deduplicates by post ID to prevent double-counting across endpoint variants.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const perPlatform = Math.min(Number(searchParams.get('perPlatform') ?? searchParams.get('perClient') ?? searchParams.get('limit') ?? '8'), 30)
  const days        = Math.min(Number(searchParams.get('days') ?? '60'), 90)

  if (!HAS_METRICOOL || !HAS_DB) {
    return NextResponse.json({ posts: [], grouped: [], error: 'Metricool or database not configured.' })
  }

  const { createClient }               = await import('@supabase/supabase-js')
  const { fetchPostsList, getConnectedNetworks, resolveNetworkToBase } = await import('@/lib/metricool')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, color, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)

  if (error) return NextResponse.json({ posts: [], grouped: [], error: error.message })

  const endDate   = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr  = startDate.toISOString().split('T')[0]
  const endStr    = endDate.toISOString().split('T')[0]

  const grouped: ClientGroup[] = []

  await Promise.all((clients ?? []).map(async (client) => {
    if (!client.metricool_blog_id) return
    const blogId = String(client.metricool_blog_id)

    // Fetch posts and connected networks in parallel
    const [rawPosts, connectedNetworks] = await Promise.allSettled([
      fetchPostsList(blogId, startStr, endStr),
      getConnectedNetworks(blogId),
    ])

    const posts    = rawPosts.status        === 'fulfilled' ? rawPosts.value        : []
    const networks = connectedNetworks.status === 'fulfilled' ? connectedNetworks.value : []

    // Derive connected base platforms from network names (instagram_reel → instagram)
    const connectedPlatforms = new Set<string>()
    for (const net of networks) {
      const base = typeof resolveNetworkToBase === 'function' ? resolveNetworkToBase(net) : net.replace(/_reel$|_story$|_short$/, '')
      connectedPlatforms.add(base)
    }

    // Build platform→posts map; deduplicate posts by ID
    const byPlatform = new Map<string, RecentPost[]>()
    const seenIds    = new Set<string>()

    // Pre-seed with connected platforms so they show even with 0 posts
    for (const plt of connectedPlatforms) byPlatform.set(plt, [])

    for (const p of posts) {
      const raw = p as typeof p & Record<string, unknown>

      // Resolve publish date — supports ISO string, numeric ms timestamp, and many field names
      const rawDate = p.publishDate ?? raw.postedAt ?? raw.publishedAt ?? raw.created_at ?? raw.createdAt ?? raw.date ?? raw.timestamp
      let published_at: string | null = null
      if (typeof rawDate === 'number' && rawDate > 0) {
        published_at = new Date(rawDate).toISOString()
      } else if (typeof rawDate === 'string' && rawDate.length > 0 && rawDate !== 'undefined') {
        published_at = rawDate
      }
      // Allow posts with no date — they sort to the end

      const er = Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)

      // content_type is now set by fetchNetworkPosts via detectContentType (mediaType-aware)
      const ct = p.content_type ?? 'unknown'
      const post_type: RecentPost['post_type'] =
        ct === 'reel'     ? 'reel'     :
        ct === 'story'    ? 'story'    :
        ct === 'video'    ? 'video'    :
        ct === 'short'    ? 'video'    :
        ct === 'carousel' ? 'carousel' :
        ct === 'post'     ? 'post'     : 'unknown'

      const platform = String(p.network ?? p.platform ?? 'unknown').toLowerCase()
      const postId   = String(p.id ?? `${client.id}-${platform}-${published_at ?? Math.random()}`)

      // Deduplicate: same post can come from both 'instagram' and 'instagram_reel' endpoints
      if (seenIds.has(postId)) continue
      seenIds.add(postId)

      const thumb = typeof p.thumbnail === 'string' && p.thumbnail.startsWith('http') ? p.thumbnail : null

      const post: RecentPost = {
        id:           postId,
        client_id:    client.id,
        client_name:  client.name,
        client_color: client.color ?? '#1B3D38',
        platform,
        post_type,
        thumbnail:    thumb,
        caption:      String(p.text ?? p.title ?? '').slice(0, 200),
        published_at,
        reach:        Number(p.reach    ?? 0),
        likes:        Number(p.likes    ?? 0),
        comments:     Number(p.comments ?? 0),
        shares:       Number(p.shares   ?? 0),
        er:           parseFloat(er.toFixed(2)),
      }

      if (!byPlatform.has(platform)) byPlatform.set(platform, [])
      byPlatform.get(platform)!.push(post)
    }

    // Sort platforms: preferred order first, then alphabetical
    const sortedPlatforms = [...byPlatform.keys()].sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a)
      const ib = PLATFORM_ORDER.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    const platforms: PlatformSection[] = sortedPlatforms.map(platform => {
      const raw = byPlatform.get(platform)!
      // Sort by date descending; posts with no date go to the end
      const sorted = raw.sort((a, b) => {
        if (!a.published_at && !b.published_at) return 0
        if (!a.published_at) return 1
        if (!b.published_at) return -1
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      }).slice(0, perPlatform)
      return { platform, post_count: sorted.length, posts: sorted }
    })

    // Only include this client if it has at least one connected platform
    if (platforms.length === 0) return

    const total_posts = platforms.reduce((s, p) => s + p.post_count, 0)

    grouped.push({
      client_id:    client.id,
      client_name:  client.name,
      client_color: client.color ?? '#1B3D38',
      total_posts,
      platforms,
    })
  }))

  // Sort clients by most recent post across all their platforms
  grouped.sort((a, b) => {
    const latestA = a.platforms.find(p => p.posts[0]?.published_at)?.posts[0]?.published_at ?? ''
    const latestB = b.platforms.find(p => p.posts[0]?.published_at)?.posts[0]?.published_at ?? ''
    return new Date(latestB).getTime() - new Date(latestA).getTime()
  })

  const posts = grouped.flatMap(g => g.platforms.flatMap(p => p.posts))
  return NextResponse.json({ posts, grouped })
}
