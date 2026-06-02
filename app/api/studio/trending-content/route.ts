// ============================================================
// GET /api/studio/trending-content
// Query params:
//   industry  – beauty | tech | food | fitness | finance | fashion | travel | education | real_estate | <custom>
//   platform  – all | youtube | tiktok | trendsmcp
//   region    – global | US | GB | AE | SA | EG | JO | KW | QA | FR | DE | AU
//   language  – any | en | ar
//   ai_filter – true | false  (Gemini relevance scoring, removes off-topic/wrong-language items)
//   limit     – max 50
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { fetchTikTokTrends }    from '@/lib/data-providers/tiktok-creative-center'
import { fetchTrendsMcpForced } from '@/lib/data-providers/trendsmcp'
import { geminiJson }           from '@/lib/gemini'
import { createHash }           from 'crypto'

export const revalidate = 0

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

// ── Maps ──────────────────────────────────────────────────────

const ARABIC_REGIONS = new Set(['AE', 'SA', 'EG', 'JO', 'KW', 'QA'])

// YouTube regionCode + relevanceLanguage per region
const REGION_YT: Record<string, { regionCode: string; relevanceLanguage?: string }> = {
  global: { regionCode: 'US'                              },
  US:     { regionCode: 'US', relevanceLanguage: 'en'    },
  GB:     { regionCode: 'GB', relevanceLanguage: 'en'    },
  AU:     { regionCode: 'AU', relevanceLanguage: 'en'    },
  CA:     { regionCode: 'CA', relevanceLanguage: 'en'    },
  AE:     { regionCode: 'AE', relevanceLanguage: 'ar'    },
  SA:     { regionCode: 'SA', relevanceLanguage: 'ar'    },
  EG:     { regionCode: 'EG', relevanceLanguage: 'ar'    },
  JO:     { regionCode: 'JO', relevanceLanguage: 'ar'    },
  KW:     { regionCode: 'KW', relevanceLanguage: 'ar'    },
  QA:     { regionCode: 'QA', relevanceLanguage: 'ar'    },
  FR:     { regionCode: 'FR', relevanceLanguage: 'fr'    },
  DE:     { regionCode: 'DE', relevanceLanguage: 'de'    },
}

// Arabic search terms per niche — used instead of English for MENA regions
const ARABIC_NICHE: Record<string, string> = {
  beauty:      'جمال سكن كير مكياج',
  tech:        'تقنية تكنولوجيا ذكاء اصطناعي',
  food:        'طبخ وصفات اكل',
  fitness:     'لياقة رياضة تمارين',
  finance:     'استثمار مال اقتصاد',
  fashion:     'موضة ازياء',
  travel:      'سفر سياحة',
  education:   'تعليم دراسة',
  real_estate: 'عقارات شقق',
}

// Google Trends geo code per region
const REGION_GT: Record<string, string> = {
  global: '',
  US: 'US', GB: 'GB', AU: 'AU', CA: 'CA',
  AE: 'AE', SA: 'SA', EG: 'EG', JO: 'JO', KW: 'KW', QA: 'QA',
  FR: 'FR', DE: 'DE',
}

const VELOCITY_ORDER: Record<TrendingContentItem['velocity'], number> = {
  rising_fast: 0,
  rising:      1,
  peaking:     2,
  stable:      3,
}

function makeId(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 16)
}

// ── YouTube ───────────────────────────────────────────────────

function classifyTitle(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('vs') || t.includes('comparison'))                        return 'Comparison'
  if (t.includes('how to') || t.includes('tutorial') || t.includes('guide')) return 'Tutorial'
  if (t.includes('review') || t.includes('tested') || t.includes('honest')) return 'Review / Test'
  if (t.includes('days') || t.includes('week') || t.includes('month'))    return 'Long-term experiment'
  if (t.includes('explained') || t.includes('beginners'))                 return 'Educational deep-dive'
  if (t.includes('secret') || t.includes('hack') || t.includes('tip'))    return 'Tips & tricks'
  if (t.includes('best') || t.includes('top') || t.includes('worst'))     return 'Ranking / List'
  return 'General'
}

async function getYouTubeItems(industry: string, region: string): Promise<TrendingContentItem[]> {
  const KEY = process.env.YOUTUBE_API_KEY
  if (!KEY) return []

  const ytConf = REGION_YT[region] ?? REGION_YT.US
  const now    = new Date().toISOString()
  const year   = new Date().getFullYear()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // For MENA regions: search in Arabic so results are actually from Arabic creators
  // For other non-global regions: exclude Indian-language content
  const INDIAN_EXCLUSIONS = '-hindi -telugu -tamil -kannada -marathi -bollywood'
  const arabicTerm = ARABIC_NICHE[industry.toLowerCase()]
  const query = ARABIC_REGIONS.has(region)
    ? `${arabicTerm ?? industry} ${year}`                                        // Arabic search
    : region !== 'global'
    ? `${industry} ${year} ${INDIAN_EXCLUSIONS}`                                 // English + exclusions
    : `${industry} ${year}`                                                      // global

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('order', 'viewCount')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('publishedAfter', thirtyDaysAgo)
    searchUrl.searchParams.set('maxResults', '10')
    searchUrl.searchParams.set('regionCode', ytConf.regionCode)
    if (ytConf.relevanceLanguage) {
      searchUrl.searchParams.set('relevanceLanguage', ytConf.relevanceLanguage)
    }
    searchUrl.searchParams.set('key', KEY)

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) return []

    const searchData = await searchRes.json()
    const items: Array<{
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
      }
    }> = (searchData.items ?? []).filter((i: { id?: { videoId?: string } }) => !!i.id?.videoId)

    if (!items.length) return []

    // Fetch view counts
    const videoIds = items.map(i => i.id.videoId).join(',')
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    statsUrl.searchParams.set('part', 'statistics')
    statsUrl.searchParams.set('id', videoIds)
    statsUrl.searchParams.set('key', KEY)

    const statsRes  = await fetch(statsUrl.toString())
    const statsData = statsRes.ok ? await statsRes.json() : { items: [] }
    const viewMap   = new Map<string, number>()
    for (const v of (statsData.items ?? []) as Array<{ id: string; statistics?: { viewCount?: string } }>) {
      viewMap.set(v.id, parseInt(v.statistics?.viewCount ?? '0', 10))
    }

    return items.map(item => {
      const videoId   = item.id.videoId
      const thumbnail =
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      const url    = `https://www.youtube.com/watch?v=${videoId}`
      const views  = viewMap.get(videoId) ?? 0
      const format = classifyTitle(item.snippet.title)
      const velocity: TrendingContentItem['velocity'] =
        views > 5_000_000 ? 'rising_fast' : views > 1_000_000 ? 'rising' : 'peaking'

      return {
        id:            makeId(url),
        platform:      'youtube' as const,
        content_type:  'video'   as const,
        title:         item.snippet.title,
        url,
        thumbnail_url: thumbnail,
        view_count:    views || undefined,
        channel:       item.snippet.channelTitle,
        industry,
        velocity,
        why_trending:  `${format} — gaining traction in the ${industry} space.`,
        fetched_at:    now,
      }
    })
  } catch {
    return []
  }
}

// ── TikTok ────────────────────────────────────────────────────

async function getTikTokItems(industry: string): Promise<TrendingContentItem[]> {
  const data = await fetchTikTokTrends(industry)
  return data.trending_hashtags.slice(0, 8).map(h => {
    const cleanTag = h.hashtag.replace(/^#/, '')
    const url      = `https://www.tiktok.com/tag/${cleanTag}`
    const velocity: TrendingContentItem['velocity'] =
      h.trend_direction === 'rising' && h.video_count > 500_000_000
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
      title:        `#${cleanTag} — ${formatCount(h.video_count)} views`,
      url,
      view_count:   h.video_count || undefined,
      hashtag:      cleanTag,
      industry,
      velocity,
      why_trending: `Trending TikTok hashtag active in the ${industry} category.`,
      fetched_at:   data.fetched_at,
    }
  })
}

// ── TrendsMCP ─────────────────────────────────────────────────

async function getTrendsMcpItems(industry: string): Promise<TrendingContentItem[]> {
  const data = await fetchTrendsMcpForced(industry)
  if (!data.topics.length) return []

  const now = new Date().toISOString()
  return data.topics.slice(0, 6).map(t => {
    const url      = `https://www.youtube.com/results?search_query=${encodeURIComponent(t.topic)}`
    const growthNum = parseFloat(String(t.growth).replace('%', ''))
    const velocity: TrendingContentItem['velocity'] =
      growthNum > 100  ? 'rising_fast'
      : growthNum > 30 ? 'rising'
      : growthNum > 0  ? 'peaking'
      : 'stable'

    return {
      id:           makeId(url),
      platform:     'trendsmcp' as const,
      content_type: 'trend'     as const,
      title:        t.topic,
      url,
      industry,
      velocity,
      why_trending: `Cross-platform trend (${t.source}). Growth: ${t.growth}.`,
      fetched_at:   now,
    }
  })
}

// ── AI relevance filter ───────────────────────────────────────

async function aiFilter(
  items: TrendingContentItem[],
  industry: string,
  region: string,
): Promise<{ filtered: TrendingContentItem[]; removedCount: number }> {
  if (!items.length || !process.env.GEMINI_API_KEY) {
    return { filtered: items, removedCount: 0 }
  }

  const isArabic  = ARABIC_REGIONS.has(region)
  const isGlobal  = region === 'global'
  const threshold = isGlobal ? 5 : 6   // stricter for specific regions

  const regionLabel = isArabic
    ? `${region} (Arabic-speaking market — content must be in Arabic OR be specifically made for Arab audiences)`
    : isGlobal
    ? 'Global'
    : region

  const langRule = isArabic
    ? 'Content in Arabic = 7-10. Content in English but made for Arab audiences = 6-8. Generic global English content not targeted at Arabs = 0-4.'
    : `Content in the dominant language of ${region} or relevant to that market = 7-10. Off-topic, wrong language, or irrelevant content = 0-4.`

  const prompt = `You are a strict content relevance filter for a social media agency.

Niche: ${industry}
Target market: ${regionLabel}

Scoring rule: ${langRule}
Also score 0-2 for: spam, unrelated topics, very low quality.

Score each item 0–10:
${items.map((item, i) => `${i}. "${item.title}" [${item.platform}${item.channel ? `, ch: ${item.channel}` : ''}]`).join('\n')}

Return ONLY a JSON array of integers, one per item. Example: [8,2,9,1,7]`

  try {
    const scores = await geminiJson<number[]>(prompt, undefined, {
      temperature: 0,
      maxOutputTokens: 150,
    })
    if (!Array.isArray(scores) || scores.length !== items.length) {
      return { filtered: items, removedCount: 0 }
    }
    const filtered = items.filter((_, i) => (scores[i] ?? 0) >= threshold)
    return { filtered, removedCount: items.length - filtered.length }
  } catch {
    return { filtered: items, removedCount: 0 }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── GET handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const industry  = searchParams.get('industry')  ?? 'beauty'
  const platform  = searchParams.get('platform')  ?? 'all'
  const region    = searchParams.get('region')    ?? 'global'
  const aiFilter_ = searchParams.get('ai_filter') === 'true'
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  try {
    const [youtubeItems, tiktokItems, trendsmcpItems] = await Promise.all([
      platform === 'all' || platform === 'youtube'   ? getYouTubeItems(industry, region)  : Promise.resolve([]),
      platform === 'all' || platform === 'tiktok'    ? getTikTokItems(industry)            : Promise.resolve([]),
      platform === 'all' || platform === 'trendsmcp' ? getTrendsMcpItems(industry)         : Promise.resolve([]),
    ])

    const seen  = new Set<string>()
    let items = [...youtubeItems, ...tiktokItems, ...trendsmcpItems]
      .filter(item => {
        if (seen.has(item.url)) return false
        seen.add(item.url)
        return true
      })
      .sort((a, b) => VELOCITY_ORDER[a.velocity] - VELOCITY_ORDER[b.velocity])

    let removedCount = 0
    if (aiFilter_) {
      const result = await aiFilter(items, industry, region)
      items        = result.filtered
      removedCount = result.removedCount
    }

    items = items.slice(0, limit)

    return NextResponse.json(
      { items, generated_at: new Date().toISOString(), region, ai_filtered: aiFilter_, removed_count: removedCount },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[trending-content] Error:', err)
    return NextResponse.json(
      { items: [], generated_at: new Date().toISOString(), error: 'Failed to fetch' },
      { status: 500 },
    )
  }
}
