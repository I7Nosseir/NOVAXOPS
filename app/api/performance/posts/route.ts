import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/**
 * GET /api/performance/posts?client_id=&start=&end=&platform=
 *
 * Returns published posts with their performance snapshots, sorted by ER desc.
 * Gracefully falls back to posts-only (zero metrics) if snapshot table is unavailable.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const start     = searchParams.get('start')
  const end       = searchParams.get('end')
  const platform  = searchParams.get('platform')

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Build base post query
  let baseQuery = supabase
    .from('scheduled_posts')
    .select('id, caption, media_urls, platforms, scheduled_at, published_at, client_id')
    .eq('client_id', client_id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (start) baseQuery = baseQuery.gte('published_at', start)
  if (end)   baseQuery = baseQuery.lte('published_at', end)

  // Try the join with snapshots first
  let joinQuery = supabase
    .from('scheduled_posts')
    .select(`
      id, caption, media_urls, platforms, scheduled_at, published_at, client_id,
      post_performance_snapshots (
        platform, reach, impressions, likes, comments, shares, saves, link_clicks, engagement_rate, captured_at
      )
    `)
    .eq('client_id', client_id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (start) joinQuery = joinQuery.gte('published_at', start)
  if (end)   joinQuery = joinQuery.lte('published_at', end)

  const { data: postsWithSnaps, error: joinError } = await joinQuery

  type SnapRow = {
    platform: string; reach: number; impressions: number; likes: number;
    comments: number; shares: number; saves: number; link_clicks: number;
    engagement_rate: number; captured_at: string
  }

  // If join succeeded, use it
  if (!joinError && postsWithSnaps) {
    const enriched = postsWithSnaps.flatMap(post => {
      const snaps = (post.post_performance_snapshots as SnapRow[]) ?? []
      const relevant = platform ? snaps.filter(s => s.platform === platform) : snaps

      if (relevant.length === 0) {
        return [{
          id: post.id,
          caption: post.caption as string,
          media_url: ((post.media_urls as string[]) ?? [])[0] ?? null,
          platforms: post.platforms as string[],
          published_at: post.published_at as string,
          platform: ((post.platforms as string[]) ?? [])[0] ?? 'unknown',
          reach: 0, impressions: 0, likes: 0, comments: 0,
          shares: 0, saves: 0, link_clicks: 0, engagement_rate: 0,
        }]
      }

      return relevant.map(snap => ({
        id: post.id,
        caption: post.caption as string,
        media_url: ((post.media_urls as string[]) ?? [])[0] ?? null,
        platforms: post.platforms as string[],
        published_at: post.published_at as string,
        platform: snap.platform,
        reach: snap.reach,
        impressions: snap.impressions,
        likes: snap.likes,
        comments: snap.comments,
        shares: snap.shares,
        saves: snap.saves,
        link_clicks: snap.link_clicks,
        engagement_rate: snap.engagement_rate,
      }))
    })

    enriched.sort((a, b) => b.engagement_rate - a.engagement_rate)
    return NextResponse.json({ posts: enriched, total: enriched.length })
  }

  // Fallback: snapshots table missing or join failed — return posts with zero metrics
  console.warn('[performance/posts] Snapshot join failed, falling back to posts-only:', joinError?.message)
  const { data: posts, error: postsError } = await baseQuery
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 })

  const enriched = (posts ?? []).map(post => ({
    id: post.id,
    caption: post.caption as string,
    media_url: ((post.media_urls as string[]) ?? [])[0] ?? null,
    platforms: post.platforms as string[],
    published_at: post.published_at as string,
    platform: ((post.platforms as string[]) ?? [])[0] ?? 'unknown',
    reach: 0, impressions: 0, likes: 0, comments: 0,
    shares: 0, saves: 0, link_clicks: 0, engagement_rate: 0,
  }))

  return NextResponse.json({ posts: enriched, total: enriched.length, _missing_snapshots: true })
}
