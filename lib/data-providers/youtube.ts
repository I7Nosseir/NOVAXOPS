// ============================================================
// YouTube Data API v3 Provider
// Uses YOUTUBE_API_KEY if set, otherwise returns empty data.
// ============================================================

export interface YouTubeData {
  trending_videos: Array<{
    title: string
    view_count: number
    channel: string
    published_at: string
    format_type: string
  }>
  trending_formats: Array<{
    format: string
    avg_view_count: number
    why_working: string
  }>
  source: 'youtube_api' | 'fallback'
  fetched_at: string
}

// ── Industry → YouTube category / search query map ───────────

const CATEGORY_MAP: Record<string, { categoryId: string; query: string }> = {
  beauty:      { categoryId: '26', query: 'skincare routine 2026' },
  tech:        { categoryId: '28', query: 'tech review 2026' },
  food:        { categoryId: '26', query: 'recipe cooking viral 2026' },
  fitness:     { categoryId: '17', query: 'workout training 2026' },
  finance:     { categoryId: '27', query: 'personal finance investing 2026' },
  fashion:     { categoryId: '26', query: 'fashion style outfit 2026' },
  travel:      { categoryId: '19', query: 'travel vlog 2026' },
  education:   { categoryId: '27', query: 'how to learn study tips 2026' },
  real_estate: { categoryId: '27', query: 'real estate investing property 2026' },
}

// ── Classify format from video title ─────────────────────────

function classifyFormat(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('vs') || t.includes('comparison') || t.includes('compared')) return 'Comparison'
  if (t.includes('how to') || t.includes('tutorial') || t.includes('guide')) return 'Tutorial'
  if (t.includes('review') || t.includes('tested') || t.includes('honest')) return 'Review / Test'
  if (t.includes('days') || t.includes('week') || t.includes('months') || t.includes('year')) return 'Long-form experiment'
  if (t.includes('explained') || t.includes('simple') || t.includes('beginners')) return 'Educational simplification'
  if (t.includes('everything') || t.includes('complete') || t.includes('ultimate')) return 'Comprehensive guide'
  return 'General'
}

// ── YouTube Data API fetch ────────────────────────────────────

async function fetchViaYouTubeApi(industry: string): Promise<YouTubeData> {
  const apiKey = process.env.YOUTUBE_API_KEY!
  const config = CATEGORY_MAP[industry.toLowerCase()] ?? { categoryId: '26', query: `${industry} tips 2026` }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('order', 'viewCount')
  searchUrl.searchParams.set('q', config.query)
  searchUrl.searchParams.set('publishedAfter', new Date(Date.now() - 30 * 86400000).toISOString())
  searchUrl.searchParams.set('maxResults', '10')
  searchUrl.searchParams.set('key', apiKey)

  const searchResponse = await fetch(searchUrl.toString())
  if (!searchResponse.ok) throw new Error(`YouTube search returned ${searchResponse.status}`)

  const searchData = await searchResponse.json()
  const videoIds: string[] = (searchData.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId)

  if (!videoIds.length) throw new Error('No videos found')

  // Fetch statistics
  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('part', 'snippet,statistics')
  statsUrl.searchParams.set('id', videoIds.join(','))
  statsUrl.searchParams.set('key', apiKey)

  const statsResponse = await fetch(statsUrl.toString())
  if (!statsResponse.ok) throw new Error(`YouTube stats returned ${statsResponse.status}`)

  const statsData = await statsResponse.json()

  const trending_videos: YouTubeData['trending_videos'] = (statsData.items ?? []).map((item: {
    snippet: { title: string; channelTitle: string; publishedAt: string }
    statistics: { viewCount?: string }
  }) => ({
    title: item.snippet.title,
    view_count: parseInt(item.statistics.viewCount ?? '0', 10),
    channel: item.snippet.channelTitle,
    published_at: item.snippet.publishedAt,
    format_type: classifyFormat(item.snippet.title),
  }))

  // Derive trending formats from the retrieved videos
  const formatCounts: Record<string, { total_views: number; count: number }> = {}
  for (const v of trending_videos) {
    if (!formatCounts[v.format_type]) formatCounts[v.format_type] = { total_views: 0, count: 0 }
    formatCounts[v.format_type].total_views += v.view_count
    formatCounts[v.format_type].count += 1
  }

  const trending_formats: YouTubeData['trending_formats'] = Object.entries(formatCounts)
    .sort((a, b) => b[1].total_views / b[1].count - a[1].total_views / a[1].count)
    .slice(0, 3)
    .map(([format, stats]) => ({
      format,
      avg_view_count: Math.round(stats.total_views / stats.count),
      why_working: 'High audience retention and engagement signals from platform algorithm data',
    }))

  return {
    trending_videos: trending_videos.slice(0, 4),
    trending_formats,
    source: 'youtube_api',
    fetched_at: new Date().toISOString(),
  }
}

// ── Public API ────────────────────────────────────────────────

export async function fetchYouTubeTrends(industry: string): Promise<YouTubeData> {
  if (process.env.YOUTUBE_API_KEY) {
    try {
      return await fetchViaYouTubeApi(industry)
    } catch (err) {
      console.warn('[youtube] API fetch failed:', err)
    }
  }
  return { trending_videos: [], trending_formats: [], source: 'fallback', fetched_at: new Date().toISOString() }
}
