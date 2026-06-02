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

// ── Multi-query search terms ──────────────────────────────────
// 3 angle queries per niche per region — run in parallel for variety

// English query angles (global / US / GB / etc.)
const EN_QUERIES: Record<string, string[]> = {
  beauty:      ['skincare routine tutorial', 'makeup review products 2025', 'beauty tips transformation'],
  tech:        ['tech review gadgets 2025', 'AI software tutorial productivity', 'tech unboxing comparison'],
  food:        ['easy recipe cooking tutorial', 'food review restaurant', 'meal prep healthy cooking'],
  fitness:     ['full body workout tutorial', 'fitness transformation tips', 'gym training exercises 2025'],
  finance:     ['investing money tips 2025', 'personal finance budget savings', 'stock market crypto guide'],
  fashion:     ['outfit ideas style trends 2025', 'fashion haul try-on', 'styling tips wardrobe'],
  travel:      ['travel vlog destination guide', 'budget travel tips 2025', 'hidden gems travel'],
  education:   ['learn skill online tutorial', 'study tips productivity 2025', 'education explained beginner'],
  real_estate: ['real estate investing 2025', 'property buying guide tips', 'house tour renovation'],
}

// Country-specific Arabic query angles — different per country
const AR_QUERIES: Record<string, Record<string, string[]>> = {
  EG: {
    beauty:      ['جمال مصري مكياج روتين', 'سكن كير عناية بشرة مصر', 'تجميل مصرية منتجات'],
    tech:        ['تقنية مصر تكنولوجيا 2025', 'ريفيو موبايل مصري', 'شرح تطبيقات مصر'],
    food:        ['طبخ مصري وصفات اكل', 'مطبخ مصري تقليدي', 'اكلات مصرية سريعة'],
    fitness:     ['رياضة مصر تمارين لياقة', 'دايت مصري تخسيس', 'كمال اجسام مصر'],
    finance:     ['استثمار مصر مال 2025', 'بورصة مصر اقتصاد', 'ادخار مصري نصايح'],
    fashion:     ['موضة مصرية ازياء 2025', 'ستايل مصري لبس', 'ملابس مصر ترند'],
    travel:      ['سياحة مصر اماكن', 'سفر مصري رحلات', 'اماكن جميلة مصر'],
    education:   ['تعليم مصر دراسة 2025', 'شرح درس مصري', 'كورس مجاني مصر'],
    real_estate: ['عقارات مصر شقق 2025', 'مشاريع تمليك مصر', 'استثمار عقاري مصر'],
  },
  SA: {
    beauty:      ['جمال سعودي مكياج روتين', 'سكن كير عناية السعودية', 'بيوتي سعودية منتجات'],
    tech:        ['تقنية السعودية 2025 تقنية', 'ريفيو جوال سعودي', 'تكنولوجيا رؤية 2030'],
    food:        ['طبخ سعودي وصفات مطبخ', 'اكل سعودي تقليدي', 'وصفات سعودية سريعة'],
    fitness:     ['رياضة السعودية لياقة', 'تمارين سعودية جيم', 'دايت سعودي تخسيس'],
    finance:     ['استثمار السعودية 2025', 'تداول اسهم سعودي', 'ريادة اعمال السعودية'],
    fashion:     ['موضة سعودية عبايات 2025', 'ستايل سعودي لبس', 'ازياء خليجية سعودية'],
    travel:      ['سياحة السعودية نيوم', 'سفر داخلي السعودية', 'اماكن سعودية سياحية'],
    education:   ['تعليم السعودية 2025', 'كورسات سعودية مجانية', 'شرح منهج سعودي'],
    real_estate: ['عقارات السعودية 2025', 'شراء شقة الرياض', 'استثمار عقاري السعودية'],
  },
  AE: {
    beauty:      ['جمال اماراتي مكياج دبي', 'سكن كير الامارات بيوتي', 'تجميل خليجي منتجات'],
    tech:        ['تقنية الامارات دبي 2025', 'ستارت اب دبي تقنية', 'ريفيو تكنولوجيا الامارات'],
    food:        ['طبخ اماراتي وصفات دبي', 'مطاعم دبي افضل', 'اكل اماراتي تقليدي'],
    fitness:     ['رياضة دبي لياقة', 'جيم الامارات تمارين', 'لايف ستايل دبي صحة'],
    finance:     ['استثمار دبي 2025 اعمال', 'عملات رقمية الامارات', 'ريادة اعمال دبي'],
    fashion:     ['موضة دبي خليجية 2025', 'ستايل اماراتي فاشن', 'لوكس دبي موضة'],
    travel:      ['سياحة دبي اماكن 2025', 'سفر الامارات رحلات', 'دبي مول اماكن ترفيه'],
    education:   ['تعليم الامارات 2025', 'كورسات دبي اونلاين', 'مهارات الامارات'],
    real_estate: ['عقارات دبي 2025 شراء', 'استثمار اماراتي عقاري', 'تملك شقة دبي'],
  },
}

// Fallback Arabic queries for JO/KW/QA — generic pan-Arab
const AR_QUERIES_DEFAULT: Record<string, string[]> = {
  beauty:      ['جمال عربي مكياج روتين', 'سكن كير عناية بشرة خليجي', 'بيوتي عربي 2025'],
  tech:        ['تقنية عربي تكنولوجيا 2025', 'ريفيو تقنية خليجي', 'تطبيقات عربية'],
  food:        ['طبخ عربي وصفات', 'مطبخ خليجي تقليدي', 'اكل عربي سريع'],
  fitness:     ['رياضة عربي لياقة 2025', 'تمارين خليجي جيم', 'دايت عربي'],
  finance:     ['استثمار عربي مال 2025', 'تداول خليجي اسهم', 'ريادة اعمال عربي'],
  fashion:     ['موضة عربية خليجية 2025', 'ستايل خليجي ازياء', 'فاشن عربي'],
  travel:      ['سياحة خليجي سفر', 'رحلات عربية اماكن', 'سفر خليجي 2025'],
  education:   ['تعليم عربي اونلاين 2025', 'كورسات مجانية عربي', 'شرح عربي'],
  real_estate: ['عقارات خليجي 2025', 'استثمار عقاري عربي', 'شراء شقة خليجي'],
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

// ── YouTube search helpers ────────────────────────────────────

type RawSearchItem = {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
  }
}

function buildQueries(industry: string, region: string): string[] {
  const niche = industry.toLowerCase()
  const INDIAN_EX = '-hindi -telugu -tamil -kannada -marathi -bollywood'

  if (ARABIC_REGIONS.has(region)) {
    // Country-specific Arabic queries, fall back to generic Arab queries
    const byCountry = AR_QUERIES[region]?.[niche] ?? AR_QUERIES_DEFAULT[niche]
    if (byCountry) return byCountry.slice(0, 3)
    return [`${niche} عربي 2025`, `${niche} خليجي`]
  }

  const englishAngles = EN_QUERIES[niche]
  if (englishAngles) {
    const ex = region !== 'global' ? ` ${INDIAN_EX}` : ''
    return englishAngles.slice(0, 3).map(q => `${q}${ex}`)
  }

  const ex = region !== 'global' ? ` ${INDIAN_EX}` : ''
  return [`${niche} tutorial 2025${ex}`, `${niche} tips review${ex}`]
}

async function runYouTubeSearch(
  query: string,
  ytConf: { regionCode: string; relevanceLanguage?: string },
  key: string,
  thirtyDaysAgo: string,
): Promise<RawSearchItem[]> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('order', 'viewCount')
    url.searchParams.set('q', query)
    url.searchParams.set('publishedAfter', thirtyDaysAgo)
    url.searchParams.set('maxResults', '8')
    url.searchParams.set('regionCode', ytConf.regionCode)
    if (ytConf.relevanceLanguage) url.searchParams.set('relevanceLanguage', ytConf.relevanceLanguage)
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as RawSearchItem[]).filter(i => !!i.id?.videoId)
  } catch {
    return []
  }
}

async function getYouTubeItems(industry: string, region: string): Promise<TrendingContentItem[]> {
  const KEY = process.env.YOUTUBE_API_KEY
  if (!KEY) return []

  const ytConf       = REGION_YT[region] ?? REGION_YT.US
  const now          = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const queries      = buildQueries(industry, region)

  // Run all queries in parallel
  const batches = await Promise.all(
    queries.map(q => runYouTubeSearch(q, ytConf, KEY, thirtyDaysAgo))
  )

  // Deduplicate by videoId, preserving order (first-seen wins)
  const seen  = new Set<string>()
  const items: RawSearchItem[] = []
  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.id.videoId)) {
        seen.add(item.id.videoId)
        items.push(item)
      }
    }
  }

  if (!items.length) return []

  // Fetch view counts for all unique videos in one call
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
