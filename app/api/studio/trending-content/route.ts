// ============================================================
// GET /api/studio/trending-content
// Returns a unified feed of trending content with real links.
// Query params: industry, platform (all|youtube|tiktok|trendsmcp), limit
// Cached for 1 hour via Next.js revalidate.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { fetchTikTokTrends }  from '@/lib/data-providers/tiktok-creative-center'
import { fetchTrendsMcpForced } from '@/lib/data-providers/trendsmcp'
import { createHash } from 'crypto'

// No cache in dev so new API keys are picked up immediately
export const revalidate = process.env.NODE_ENV === 'production' ? 3600 : 0

export interface TrendingContentItem {
  id: string
  platform: 'youtube' | 'tiktok' | 'reddit' | 'trendsmcp'
  content_type: 'video' | 'hashtag' | 'post' | 'trend'
  title: string
  url: string
  thumbnail_url?: string
  view_count?: number
  channel?: string
  hashtag?: string
  industry: string
  velocity: 'rising_fast' | 'rising' | 'peaking' | 'stable'
  why_trending: string
  fetched_at: string
}

// ── Velocity order for sorting ────────────────────────────────

const VELOCITY_ORDER: Record<TrendingContentItem['velocity'], number> = {
  rising_fast: 0,
  rising:      1,
  peaking:     2,
  stable:      3,
}

// ── Deterministic ID from URL ─────────────────────────────────

function makeId(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 16)
}

// ── YouTube items ─────────────────────────────────────────────

async function getYouTubeItems(industry: string): Promise<TrendingContentItem[]> {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
  if (!YOUTUBE_API_KEY) return []

  const now   = new Date().toISOString()
  const year  = new Date().getFullYear()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('order', 'viewCount')
    searchUrl.searchParams.set('q', `${industry} ${year}`)
    searchUrl.searchParams.set('publishedAfter', thirtyDaysAgo)
    searchUrl.searchParams.set('maxResults', '8')
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) return []

    const searchData = await searchRes.json()
    const items: Array<{
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        thumbnails: { medium?: { url: string }; default?: { url: string } }
        publishedAt: string
      }
    }> = searchData.items ?? []

    return items.map((item) => {
      const videoId = item.id.videoId
      const thumbnail =
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url
      const url = `https://www.youtube.com/watch?v=${videoId}`
      return {
        id:            makeId(url),
        platform:      'youtube' as const,
        content_type:  'video'   as const,
        title:         item.snippet.title,
        url,
        thumbnail_url: thumbnail,
        channel:       item.snippet.channelTitle,
        industry,
        velocity:      'rising'  as const,
        why_trending:  'High view count in the last 30 days for this industry segment.',
        fetched_at:    now,
      }
    })
  } catch {
    return []
  }
}

// ── TikTok items ──────────────────────────────────────────────

async function getTikTokItems(industry: string): Promise<TrendingContentItem[]> {
  const data = await fetchTikTokTrends(industry)
  return data.trending_hashtags.slice(0, 8).map((h) => {
    const cleanTag = h.hashtag.replace(/^#/, '')
    const url      = `https://www.tiktok.com/tag/${cleanTag}`
    const velocity: TrendingContentItem['velocity'] =
      h.trend_direction === 'rising' && h.video_count > 20_000_000
        ? 'rising_fast'
        : h.trend_direction === 'rising'
        ? 'rising'
        : h.trend_direction === 'stable'
        ? 'stable'
        : 'peaking'

    return {
      id:           makeId(url),
      platform:     'tiktok'  as const,
      content_type: 'hashtag' as const,
      title:        `#${cleanTag} — ${formatCount(h.video_count)} videos`,
      url,
      view_count:   h.video_count,
      hashtag:      cleanTag,
      industry,
      velocity,
      why_trending: `${h.trend_direction === 'rising' ? 'Rising' : 'Active'} TikTok hashtag with strong video volume in the ${industry} category.`,
      fetched_at:   data.fetched_at,
    }
  })
}

// ── TrendsMCP items ───────────────────────────────────────────

async function getTrendsMcpItems(industry: string): Promise<TrendingContentItem[]> {
  const data = await fetchTrendsMcpForced(industry)
  if (!data.topics.length) return []

  const now = new Date().toISOString()
  return data.topics.slice(0, 6).map((t) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(t.topic)}&tbm=vid`
    const growthNum = parseFloat(String(t.growth).replace('%', ''))
    const velocity: TrendingContentItem['velocity'] =
      growthNum > 100  ? 'rising_fast'
      : growthNum > 30 ? 'rising'
      : growthNum > 0  ? 'peaking'
      : 'stable'

    return {
      id:           makeId(searchUrl),
      platform:     'trendsmcp' as const,
      content_type: 'trend'     as const,
      title:        t.topic,
      url:          searchUrl,
      industry,
      velocity,
      why_trending: `Cross-platform trend signal (${t.source}). Growth: ${t.growth}.`,
      fetched_at:   now,
    }
  })
}

// ── Format helpers ────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── GET handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const industry = searchParams.get('industry') ?? 'beauty'
  const platform = searchParams.get('platform') ?? 'all'
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  try {
    const [youtubeItems, tiktokItems, trendsmcpItems] = await Promise.all([
      platform === 'all' || platform === 'youtube'   ? getYouTubeItems(industry)   : Promise.resolve([]),
      platform === 'all' || platform === 'tiktok'    ? getTikTokItems(industry)    : Promise.resolve([]),
      platform === 'all' || platform === 'trendsmcp' ? getTrendsMcpItems(industry) : Promise.resolve([]),
    ])

    // Combine, deduplicate by URL, sort by velocity
    const seen  = new Set<string>()
    const items = [...youtubeItems, ...tiktokItems, ...trendsmcpItems]
      .filter((item) => {
        if (seen.has(item.url)) return false
        seen.add(item.url)
        return true
      })
      .sort((a, b) => VELOCITY_ORDER[a.velocity] - VELOCITY_ORDER[b.velocity])
      .slice(0, limit)

    return NextResponse.json(
      { items, generated_at: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      },
    )
  } catch (err) {
    console.error('[trending-content] Error:', err)
    return NextResponse.json(
      { items: [], generated_at: new Date().toISOString(), error: 'Failed to fetch trending content' },
      { status: 500 },
    )
  }
}
