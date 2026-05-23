import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// Dev-mode mock posts — realistic spread of ER tiers across platforms
const MOCK_POSTS = [
  { id: 'm1', caption: 'Behind the scenes of our latest campaign shoot — natural light, zero filters.', media_url: null, platforms: ['instagram'], published_at: new Date(Date.now() - 2 * 86400000).toISOString(), platform: 'instagram', reach: 18400, impressions: 24100, likes: 1240, comments: 87, shares: 134, saves: 392, link_clicks: 44, engagement_rate: 8.4 },
  { id: 'm2', caption: 'Your skin deserves the best. Introducing our new serum — 72h hydration guaranteed.', media_url: null, platforms: ['instagram'], published_at: new Date(Date.now() - 5 * 86400000).toISOString(), platform: 'instagram', reach: 22100, impressions: 31000, likes: 980, comments: 64, shares: 88, saves: 210, link_clicks: 72, engagement_rate: 5.2 },
  { id: 'm3', caption: 'We asked. You answered. Here are the 3 products you told us you can\'t live without.', media_url: null, platforms: ['instagram'], published_at: new Date(Date.now() - 8 * 86400000).toISOString(), platform: 'instagram', reach: 31200, impressions: 44000, likes: 2100, comments: 312, shares: 445, saves: 680, link_clicks: 98, engagement_rate: 11.3 },
  { id: 'm4', caption: 'Industry insight: Why micro-influencers outperform mega-influencers by 3× in conversion.', media_url: null, platforms: ['linkedin'], published_at: new Date(Date.now() - 10 * 86400000).toISOString(), platform: 'linkedin', reach: 8900, impressions: 11200, likes: 342, comments: 56, shares: 98, saves: 0, link_clicks: 210, engagement_rate: 6.2 },
  { id: 'm5', caption: 'Monday motivation — what separates the brands that grow from the ones that stall.', media_url: null, platforms: ['linkedin'], published_at: new Date(Date.now() - 14 * 86400000).toISOString(), platform: 'linkedin', reach: 5400, impressions: 7100, likes: 88, comments: 12, shares: 24, saves: 0, link_clicks: 44, engagement_rate: 2.4 },
  { id: 'm6', caption: 'Swipe to see the 30-day transformation — before and after using the full routine.', media_url: null, platforms: ['instagram'], published_at: new Date(Date.now() - 16 * 86400000).toISOString(), platform: 'instagram', reach: 27800, impressions: 38400, likes: 1840, comments: 220, shares: 310, saves: 520, link_clicks: 66, engagement_rate: 9.7 },
  { id: 'm7', caption: 'New drop this Friday. Set your reminder. You\'ve been asking for this one.', media_url: null, platforms: ['instagram'], published_at: new Date(Date.now() - 20 * 86400000).toISOString(), platform: 'instagram', reach: 14200, impressions: 18900, likes: 430, comments: 38, shares: 55, saves: 88, link_clicks: 22, engagement_rate: 3.1 },
  { id: 'm8', caption: 'Meet the team behind the brand — the people who obsess over every detail so you don\'t have to.', media_url: null, platforms: ['facebook'], published_at: new Date(Date.now() - 23 * 86400000).toISOString(), platform: 'facebook', reach: 9600, impressions: 12400, likes: 210, comments: 44, shares: 62, saves: 0, link_clicks: 38, engagement_rate: 3.7 },
  { id: 'm9', caption: 'Our commitment to sustainability — packaging redesign reduces plastic by 60%.', media_url: null, platforms: ['facebook'], published_at: new Date(Date.now() - 27 * 86400000).toISOString(), platform: 'facebook', reach: 6800, impressions: 9100, likes: 124, comments: 18, shares: 41, saves: 0, link_clicks: 28, engagement_rate: 2.1 },
  { id: 'm10', caption: '5 skincare myths debunked by our lead dermatologist — thread.', media_url: null, platforms: ['twitter'], published_at: new Date(Date.now() - 30 * 86400000).toISOString(), platform: 'twitter', reach: 12400, impressions: 18700, likes: 560, comments: 88, shares: 320, saves: 0, link_clicks: 140, engagement_rate: 7.8 },
]

/**
 * GET /api/performance/posts?client_id=&start=&end=&platform=
 *
 * Returns published posts with their performance snapshots, sorted by ER desc.
 * Falls back to mock data in dev when Supabase is not configured.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const start     = searchParams.get('start')
  const end       = searchParams.get('end')
  const platform  = searchParams.get('platform')

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB) {
    const filtered = MOCK_POSTS.filter(p => {
      if (platform && p.platform !== platform) return false
      if (start && p.published_at < start) return false
      if (end && p.published_at > end) return false
      return true
    }).sort((a, b) => b.engagement_rate - a.engagement_rate)
    return NextResponse.json({ posts: filtered, total: filtered.length, _mock: true })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
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

  if (start) query = query.gte('published_at', start)
  if (end)   query = query.lte('published_at', end)

  const { data: posts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type SnapRow = { platform: string; reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; link_clicks: number; engagement_rate: number; captured_at: string }

  const enriched = (posts ?? []).flatMap(post => {
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

  // Fall back to mock data if DB is connected but no posts exist yet
  if (enriched.length === 0) {
    const filtered = MOCK_POSTS.filter(p => {
      if (platform && p.platform !== platform) return false
      if (start && p.published_at < start) return false
      if (end && p.published_at > end) return false
      return true
    }).sort((a, b) => b.engagement_rate - a.engagement_rate)
    return NextResponse.json({ posts: filtered, total: filtered.length, _mock: true })
  }

  return NextResponse.json({ posts: enriched, total: enriched.length })
}
