// ============================================================
// GET /api/studio/trending-content
// 5-Phase Discovery Pipeline:
//   Phase 1 — Seed: 3 parallel country-specific YouTube searches
//   Phase 2 — Chart: YouTube mostPopular regional chart by category
//   Phase 3 — Expand: crawl uploads playlists of top seed channels
//   Phase 4 — Enrich: batch-fetch statistics, tags, duration for all videos
//   Phase 5 — AI Rank: Gemini scores country fit + niche depth, writes insight
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { fetchTikTokVideos, fetchTikTokTrends } from '@/lib/data-providers/tiktok-creative-center'
import { fetchTrendsMcpForced } from '@/lib/data-providers/trendsmcp'
import { geminiJson }           from '@/lib/gemini'
import { generateSearchQueries, getNicheKeywords, ARABIC_REGIONS, INDIAN_EXCLUSIONS } from '@/lib/studio/query-generator'
import { createHash }           from 'crypto'

export const revalidate = 0

export interface TrendingContentItem {
  id:             string
  platform:       'youtube' | 'tiktok' | 'reddit' | 'trendsmcp'
  content_type:   'video' | 'hashtag' | 'post' | 'trend'
  title:          string
  url:            string
  thumbnail_url?: string
  view_count?:    number
  channel?:       string
  hashtag?:       string
  industry:       string
  velocity:       'rising_fast' | 'rising' | 'peaking' | 'stable'
  why_trending:   string
  content_format?: string   // AI-classified: Tutorial, Review, Vlog, etc.
  ai_score?:       number   // 0-10 country+niche fit
  ai_insight?:     string   // 1-sentence explanation from Gemini
  fetched_at:     string
}

// ── Static config maps ────────────────────────────────────────

const REGION_YT: Record<string, { regionCode: string; relevanceLanguage?: string }> = {
  global: { regionCode: 'US'                           },
  US:     { regionCode: 'US', relevanceLanguage: 'en' },
  GB:     { regionCode: 'GB', relevanceLanguage: 'en' },
  AU:     { regionCode: 'AU', relevanceLanguage: 'en' },
  CA:     { regionCode: 'CA', relevanceLanguage: 'en' },
  AE:     { regionCode: 'AE', relevanceLanguage: 'ar' },
  SA:     { regionCode: 'SA', relevanceLanguage: 'ar' },
  EG:     { regionCode: 'EG', relevanceLanguage: 'ar' },
  JO:     { regionCode: 'JO', relevanceLanguage: 'ar' },
  KW:     { regionCode: 'KW', relevanceLanguage: 'ar' },
  QA:     { regionCode: 'QA', relevanceLanguage: 'ar' },
  FR:     { regionCode: 'FR', relevanceLanguage: 'fr' },
  DE:     { regionCode: 'DE', relevanceLanguage: 'de' },
}

// YouTube category ID per niche (for mostPopular chart filtering)
const NICHE_CATEGORY: Record<string, string> = {
  beauty:      '26', // Howto & Style
  fashion:     '26',
  food:        '26',
  fitness:     '17', // Sports
  tech:        '28', // Science & Technology
  finance:     '25', // News & Politics
  travel:      '19', // Travel & Events
  education:   '27', // Education
  real_estate: '25',
}

// ── Search query banks ────────────────────────────────────────

const EN_QUERIES: Record<string, string[]> = {
  beauty:           ['skincare routine tutorial', 'makeup review transformation', 'beauty tips products 2025'],
  tech:             ['tech review gadgets 2025', 'AI software tutorial', 'unboxing comparison tech'],
  food:             ['easy recipe cooking tutorial', 'restaurant food review', 'meal prep healthy 2025'],
  fitness:          ['gym workout training tutorial', 'fitness body transformation before after', 'strength training exercises program'],
  finance:          ['investing money tips 2025', 'personal finance budget', 'stock market guide'],
  fashion:          ['outfit style trends 2025', 'fashion haul try-on', 'styling tips wardrobe'],
  travel:           ['travel vlog destination', 'budget travel tips 2025', 'hidden gems travel guide'],
  education:        ['learn skill tutorial 2025', 'study tips productivity', 'explained for beginners'],
  real_estate:      ['real estate investing 2025', 'property buying guide', 'house tour renovation'],
  marketing:        ['social media marketing strategy 2025', 'content marketing tips creator', 'digital marketing tutorial explained'],
  marketing_agency: ['marketing agency client results', 'how to run marketing agency', 'agency content strategy case study'],
}

const AR_QUERIES: Record<string, Record<string, string[]>> = {
  EG: {
    beauty:      ['جمال مصري مكياج روتين', 'سكن كير عناية بشرة مصر', 'تجميل مصرية منتجات 2025'],
    tech:        ['تقنية مصر تكنولوجيا 2025', 'ريفيو موبايل مصري', 'شرح تطبيقات ذكاء اصطناعي مصر'],
    food:        ['طبخ مصري وصفات سريعة', 'مطبخ مصري تقليدي اكل', 'وصفات مصرية صحية 2025'],
    fitness:     ['رياضة مصر تمارين لياقة', 'دايت مصري تخسيس 2025', 'كمال اجسام مصري جيم'],
    finance:     ['استثمار مصر مال 2025', 'بورصة مصر اقتصاد', 'مشاريع صغيرة مصر ارباح'],
    fashion:     ['موضة مصرية ازياء 2025', 'ستايل مصري لبس ترند', 'ملابس مصر فاشن محجبات'],
    travel:      ['سياحة مصر اماكن 2025', 'رحلات مصرية داخلية', 'اماكن جميلة مصر مجهولة'],
    education:        ['تعليم مصر دراسة 2025', 'شرح درس مصري منهج', 'كورس مجاني مصري اونلاين'],
    real_estate:      ['عقارات مصر شقق 2025', 'مشاريع تمليك مصر استثمار', 'شراء شقة مصر نصايح'],
    marketing:        ['تسويق مصري محتوى سوشيال ميديا', 'تسويق رقمي مصر نصايح 2025', 'كريتور مصري تسويق محتوى'],
    marketing_agency: ['وكالة تسويق مصر عملاء', 'ادارة سوشيال ميديا مصر', 'تسويق رقمي وكالة مصر نتائج'],
  },
  SA: {
    beauty:      ['جمال سعودي مكياج روتين 2025', 'سكن كير عناية بشرة السعودية', 'بيوتي سعودية منتجات ريفيو'],
    tech:        ['تقنية السعودية 2025 رؤية', 'ريفيو جوال سعودي مقارنة', 'تكنولوجيا ذكاء اصطناعي السعودية'],
    food:        ['طبخ سعودي وصفات مطبخ 2025', 'اكل سعودي تقليدي اصيل', 'وصفات سعودية سريعة صحية'],
    fitness:     ['رياضة السعودية لياقة 2025', 'تمارين سعودية جيم ترند', 'دايت سعودي تخسيس نظام'],
    finance:     ['استثمار السعودية 2025 مال', 'تداول اسهم تداول سعودي', 'ريادة اعمال السعودية نجاح'],
    fashion:     ['موضة سعودية عبايات 2025', 'ستايل سعودي خليجي لبس', 'ازياء سعودية فاشن ترند'],
    travel:      ['سياحة السعودية نيوم العلا 2025', 'سفر داخلي السعودية مغامرة', 'اماكن سعودية سياحية جديدة'],
    education:        ['تعليم السعودية 2025 رؤية', 'كورسات سعودية مجانية اونلاين', 'مهارات مستقبل السعودية'],
    real_estate:      ['عقارات السعودية 2025 استثمار', 'شراء شقة الرياض جدة', 'مشاريع عقارية سعودية جديدة'],
    marketing:        ['تسويق سعودي محتوى رقمي 2025', 'سوشيال ميديا السعودية نصايح', 'كريتور سعودي تسويق'],
    marketing_agency: ['وكالة تسويق السعودية عملاء', 'ادارة سوشيال ميديا سعودي', 'تسويق رقمي وكالة السعودية'],
  },
  AE: {
    beauty:      ['جمال اماراتي دبي مكياج 2025', 'سكن كير الامارات بيوتي', 'تجميل خليجي منتجات دبي'],
    tech:        ['تقنية الامارات دبي 2025', 'ستارت اب دبي تقنية ذكاء', 'ريفيو تكنولوجيا الامارات'],
    food:        ['طبخ اماراتي وصفات دبي 2025', 'مطاعم دبي افضل تجربة', 'اكل اماراتي اصيل خليجي'],
    fitness:     ['رياضة دبي لياقة 2025', 'جيم الامارات تمارين ترند', 'لايف ستايل دبي صحة'],
    finance:     ['استثمار دبي 2025 اعمال', 'عملات رقمية الامارات كريبتو', 'ريادة اعمال دبي نجاح'],
    fashion:     ['موضة دبي خليجية لوكس 2025', 'ستايل اماراتي فاشن ترند', 'عبايات دبي فاخرة'],
    travel:      ['سياحة دبي اماكن 2025 جديدة', 'عجائب الامارات سفر رحلات', 'دبي مستقبل سياحة'],
    education:        ['تعليم الامارات 2025 مهارات', 'كورسات دبي اونلاين مجانية', 'ذكاء اصطناعي تعليم الامارات'],
    real_estate:      ['عقارات دبي 2025 استثمار شراء', 'مشاريع اماراتية عقارية جديدة', 'تملك شقة دبي نصايح'],
    marketing:        ['تسويق دبي محتوى رقمي 2025', 'سوشيال ميديا الامارات استراتيجية', 'كريتور دبي تسويق'],
    marketing_agency: ['وكالة تسويق دبي عملاء نتائج', 'ادارة سوشيال ميديا الامارات', 'دبي وكالة تسويق رقمي'],
  },
}

const AR_QUERIES_DEFAULT: Record<string, string[]> = {
  beauty:      ['جمال عربي مكياج روتين 2025', 'سكن كير عناية بشرة خليجي', 'بيوتي عربي منتجات ريفيو'],
  tech:        ['تقنية عربي تكنولوجيا 2025', 'ريفيو تقنية خليجي مقارنة', 'ذكاء اصطناعي عربي'],
  food:        ['طبخ عربي وصفات سريعة', 'مطبخ خليجي تقليدي صحي', 'اكل عربي 2025'],
  fitness:     ['رياضة عربي لياقة 2025', 'تمارين خليجي جيم ترند', 'دايت عربي تخسيس'],
  finance:     ['استثمار عربي مال 2025', 'تداول خليجي اسهم تداول', 'ريادة اعمال عربي'],
  fashion:     ['موضة عربية خليجية 2025', 'ستايل خليجي ازياء ترند', 'فاشن عربي محجبات'],
  travel:      ['سياحة خليجي سفر 2025', 'رحلات عربية اماكن مغامرة', 'اماكن عربية مجهولة'],
  education:        ['تعليم عربي اونلاين 2025', 'كورسات مجانية عربي مهارات', 'شرح عربي مبسط'],
  real_estate:      ['عقارات خليجي 2025 استثمار', 'شراء شقة عربي نصايح', 'عقارات خليجية جديدة'],
  marketing:        ['تسويق عربي محتوى رقمي 2025', 'سوشيال ميديا خليجي نصايح', 'تسويق اونلاين عربي'],
  marketing_agency: ['وكالة تسويق عربي عملاء', 'ادارة سوشيال ميديا خليجي', 'تسويق رقمي وكالة عربي'],
}

// ── Helpers ───────────────────────────────────────────────────

function makeId(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 16)
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0')
}

// ── Phase 1: Seed search ──────────────────────────────────────

interface SeedItem {
  videoId:      string
  channelId:    string
  channelTitle: string
  title:        string
  thumbnails:   { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
}

async function buildQueries(industry: string, region: string): Promise<string[]> {
  const niche = industry.toLowerCase()

  if (ARABIC_REGIONS.has(region)) {
    const byCountry = AR_QUERIES[region]?.[niche] ?? AR_QUERIES_DEFAULT[niche]
    if (byCountry?.length) return byCountry.slice(0, 3)
    // Custom/unknown niche → AI generates Arabic queries
    return generateSearchQueries(industry, region, 'youtube')
  }

  const angles = EN_QUERIES[niche]
  if (angles?.length) {
    const ex = region !== 'global' ? ` ${INDIAN_EXCLUSIONS}` : ''
    return angles.slice(0, 3).map(q => `${q}${ex}`)
  }

  // Custom/unknown niche → AI generates English queries
  const aiQueries = await generateSearchQueries(industry, region, 'youtube')
  const ex = region !== 'global' ? ` ${INDIAN_EXCLUSIONS}` : ''
  return aiQueries.map(q => `${q}${ex}`)
}

async function seedSearch(
  industry: string,
  region: string,
  ytConf: { regionCode: string; relevanceLanguage?: string },
  key: string,
  publishedAfter: string,
): Promise<SeedItem[]> {
  const queries = await buildQueries(industry, region)

  const batches = await Promise.all(queries.map(async q => {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'viewCount')
      url.searchParams.set('q', q)
      url.searchParams.set('publishedAfter', publishedAfter)
      url.searchParams.set('maxResults', '8')
      url.searchParams.set('regionCode', ytConf.regionCode)
      if (ytConf.relevanceLanguage) url.searchParams.set('relevanceLanguage', ytConf.relevanceLanguage)
      url.searchParams.set('key', key)
      const res = await fetch(url.toString())
      if (!res.ok) return []
      const data = await res.json()
      return (data.items ?? []) as Array<{
        id: { videoId?: string }
        snippet: {
          title: string
          channelId: string
          channelTitle: string
          thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
        }
      }>
    } catch { return [] }
  }))

  const seen = new Set<string>()
  const out:  SeedItem[] = []
  for (const batch of batches) {
    for (const item of batch) {
      const vid = item.id?.videoId
      if (!vid || seen.has(vid)) continue
      seen.add(vid)
      out.push({
        videoId:      vid,
        channelId:    item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        title:        item.snippet.title,
        thumbnails:   item.snippet.thumbnails,
      })
    }
  }
  return out
}

// ── Phase 2: Regional chart ───────────────────────────────────

async function regionalChart(
  regionCode: string,
  industry:   string,
  key:        string,
): Promise<string[]> {
  try {
    const categoryId = NICHE_CATEGORY[industry.toLowerCase()]
    const url        = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'id')
    url.searchParams.set('chart', 'mostPopular')
    url.searchParams.set('regionCode', regionCode)
    url.searchParams.set('maxResults', '15')
    if (categoryId) url.searchParams.set('videoCategoryId', categoryId)
    url.searchParams.set('key', key)
    const res  = await fetch(url.toString())
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((i: { id: string }) => i.id).filter(Boolean)
  } catch { return [] }
}

// ── Phase 3: Channel expansion ────────────────────────────────

async function expandFromChannels(channelIds: string[], key: string): Promise<string[]> {
  if (!channelIds.length) return []

  // Get uploads playlist ID for each channel
  const chanUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
  chanUrl.searchParams.set('part', 'contentDetails')
  chanUrl.searchParams.set('id', channelIds.join(','))
  chanUrl.searchParams.set('key', key)

  let playlistIds: string[] = []
  try {
    const res  = await fetch(chanUrl.toString())
    const data = await res.json()
    playlistIds = (data.items ?? [])
      .map((c: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }) =>
        c.contentDetails?.relatedPlaylists?.uploads)
      .filter(Boolean) as string[]
  } catch { return [] }

  // Fetch recent 5 videos from each channel's uploads playlist
  const videoIdBatches = await Promise.all(playlistIds.slice(0, 5).map(async pid => {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      url.searchParams.set('part', 'contentDetails')
      url.searchParams.set('playlistId', pid)
      url.searchParams.set('maxResults', '5')
      url.searchParams.set('key', key)
      const res  = await fetch(url.toString())
      const data = await res.json()
      return (data.items ?? [])
        .map((i: { contentDetails?: { videoId?: string } }) => i.contentDetails?.videoId)
        .filter(Boolean) as string[]
    } catch { return [] }
  }))

  return videoIdBatches.flat()
}

// ── Phase 4: Batch enrichment ─────────────────────────────────

interface EnrichedVideo {
  videoId:      string
  title:        string
  channelTitle: string
  channelId:    string
  thumbnail:    string
  viewCount:    number
  likeCount:    number
  commentCount: number
  duration:     number   // seconds
  tags:         string[]
  categoryId:   string
  description:  string
  publishedAt:  string
}

async function enrichVideos(
  videoIds:  string[],
  seedMap:   Map<string, SeedItem>,
  key:       string,
): Promise<EnrichedVideo[]> {
  if (!videoIds.length) return []

  // YouTube videos.list accepts up to 50 IDs per call
  const chunks: string[][] = []
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50))

  const results: EnrichedVideo[] = []

  await Promise.all(chunks.map(async chunk => {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet,statistics,contentDetails')
      url.searchParams.set('id', chunk.join(','))
      url.searchParams.set('key', key)
      const res  = await fetch(url.toString())
      const data = await res.json()

      for (const item of (data.items ?? []) as Array<{
        id: string
        snippet: {
          title: string; channelId: string; channelTitle: string
          thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
          tags?: string[]; categoryId: string; description: string; publishedAt: string
        }
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
        contentDetails: { duration: string }
      }>) {
        const seed = seedMap.get(item.id)
        results.push({
          videoId:      item.id,
          title:        item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId:    item.snippet.channelId,
          thumbnail:
            item.snippet.thumbnails.high?.url ??
            item.snippet.thumbnails.medium?.url ??
            seed?.thumbnails.high?.url ??
            `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
          viewCount:    parseInt(item.statistics.viewCount    ?? '0', 10),
          likeCount:    parseInt(item.statistics.likeCount    ?? '0', 10),
          commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
          duration:     parseDuration(item.contentDetails.duration),
          tags:         item.snippet.tags ?? [],
          categoryId:   item.snippet.categoryId,
          description:  item.snippet.description.slice(0, 200),
          publishedAt:  item.snippet.publishedAt,
        })
      }
    } catch { /* skip chunk on error */ }
  }))

  return results
}

// ── Niche keyword pre-filter ──────────────────────────────────
// Drops any video where the title + description + tags contain ZERO
// niche-specific keywords. Runs before AI to save Gemini quota and
// guarantee on-topic results.

const KNOWN_NICHE_KEYWORDS: Record<string, string[]> = {
  beauty:            ['skincare', 'makeup', 'beauty', 'skin', 'moisturizer', 'serum', 'glow', 'routine', 'cosmetic', 'foundation', 'lipstick', 'تجميل', 'مكياج', 'بشرة'],
  tech:              ['tech', 'technology', 'software', 'gadget', 'phone', 'laptop', 'computer', 'ai', 'app', 'device', 'تقنية', 'تكنولوجيا'],
  food:              ['recipe', 'cooking', 'food', 'eat', 'meal', 'restaurant', 'chef', 'kitchen', 'bake', 'طبخ', 'وصفة', 'اكل'],
  fitness:           ['workout', 'exercise', 'gym', 'fitness', 'training', 'muscle', 'cardio', 'weight', 'رياضة', 'تمارين', 'جيم'],
  finance:           ['invest', 'money', 'finance', 'stock', 'crypto', 'budget', 'saving', 'wealth', 'استثمار', 'مال', 'تداول'],
  fashion:           ['fashion', 'style', 'outfit', 'clothing', 'wear', 'trend', 'dress', 'موضة', 'ستايل', 'ازياء'],
  travel:            ['travel', 'trip', 'vacation', 'destination', 'flight', 'hotel', 'explore', 'سفر', 'سياحة', 'رحلة'],
  education:         ['learn', 'study', 'education', 'tutorial', 'course', 'skill', 'school', 'تعليم', 'دراسة', 'كورس'],
  real_estate:       ['real estate', 'house', 'property', 'home', 'apartment', 'mortgage', 'عقارات', 'شقة', 'منزل'],
  marketing:         ['marketing', 'brand', 'campaign', 'social media', 'content', 'ads', 'audience', 'strategy', 'تسويق', 'محتوى'],
  marketing_agency:  ['marketing agency', 'agency', 'client', 'campaign', 'branding', 'digital marketing', 'وكالة', 'تسويق رقمي'],
}

function filterByNicheKeywords(videos: EnrichedVideo[], keywords: string[]): EnrichedVideo[] {
  if (!keywords.length) return videos
  return videos.filter(v => {
    const hay = `${v.title} ${v.description} ${v.tags.join(' ')} ${v.channelTitle}`.toLowerCase()
    return keywords.some(kw => hay.includes(kw.toLowerCase()))
  })
}

// ── Indian content filter (pre-AI) ───────────────────────────

const INDIAN_CHANNEL_SIGNALS = [
  'hindi', 'bollywood', 'india', 'indian', 'bharath', 'bharat',
  'desi', 'telugu', 'tamil', 'kannada', 'marathi', 'bengali',
  'punjabi', 'gujarati', 'malayalam', 'bigg boss', 'zee', 'sun tv',
  'star plus', 'colors tv', 'sony liv',
]

function isIndianContent(v: EnrichedVideo): boolean {
  const haystack = `${v.title} ${v.channelTitle} ${v.description} ${v.tags.join(' ')}`.toLowerCase()
  return INDIAN_CHANNEL_SIGNALS.some(sig => haystack.includes(sig))
}

// ── Phase 5: AI ranking ───────────────────────────────────────

interface AIRankedVideo extends EnrichedVideo {
  ai_score:      number
  content_format: string
  ai_insight:    string
}

async function aiRankVideos(
  videos:   EnrichedVideo[],
  industry: string,
  region:   string,
): Promise<AIRankedVideo[]> {
  if (!videos.length || !process.env.GEMINI_API_KEY) {
    return videos.map(v => ({
      ...v,
      ai_score:       5,
      content_format: 'General',
      ai_insight:     '',
    }))
  }

  const isArabic   = ARABIC_REGIONS.has(region)
  const regionName = {
    EG: 'Egypt', SA: 'Saudi Arabia', AE: 'UAE', JO: 'Jordan',
    KW: 'Kuwait', QA: 'Qatar', US: 'United States', GB: 'United Kingdom',
    AU: 'Australia', FR: 'France', DE: 'Germany', global: 'Global',
  }[region] ?? region

  const langNote = isArabic
    ? 'Arabic-language content scores highest. English content targeting Arab audiences scores medium. Generic English scores low.'
    : 'Content in the local language and culturally relevant to this market scores highest.'

  const videoList = videos.map((v, i) => {
    const durationMin = Math.round(v.duration / 60)
    const engagement  = v.viewCount > 0
      ? ((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(1)
      : '0'
    return `${i}. title="${v.title}" channel="${v.channelTitle}" views=${formatCount(v.viewCount)} dur=${durationMin}m engagement=${engagement}% tags=[${v.tags.slice(0, 5).join(',')}]`
  }).join('\n')

  const prompt = `You are a strict content gatekeeper for a social media agency. Your job is to surface only videos that are DIRECTLY about the target niche.

━━━ CONTEXT ━━━
Niche: "${industry}"
Target market: ${regionName}
Language: ${langNote}

━━━ NICHE MATCH — THIS IS THE PRIMARY GATE ━━━
A video is ON-NICHE only if its MAIN TOPIC is "${industry}".
Adjacent topics do not count. Examples:
• Niche = "dental clinic" → ON-NICHE: tooth whitening, dental implants, dentist advice | OFF-NICHE: general health, diet, hospital
• Niche = "fitness" → ON-NICHE: specific workouts, gym exercises, nutrition for athletes | OFF-NICHE: general wellness, mental health, lifestyle vlogs
• Niche = "marketing agency" → ON-NICHE: running a marketing agency, client acquisition, campaign strategies | OFF-NICHE: general entrepreneurship, motivational content

OFF-NICHE videos MUST score 0-2 regardless of view count, virality, or quality. No exceptions.

━━━ SCORING FOR ON-NICHE VIDEOS ━━━
9-10: Directly on-niche, strong structure, could be adapted for ${regionName} — rare, reserve for exceptional
7-8:  Clearly on-niche, good quality, culturally appropriate for ${regionName}
5-6:  On-niche but generic, surface-level, or weak cultural fit
3-4:  Barely on-niche or very poor quality
0-2:  Off-niche OR Indian/Bollywood content OR shock-value content with no adaptable structure

━━━ ADDITIONAL HARD PENALTIES (0-2) ━━━
- Indian regional language content (Hindi, Telugu, Tamil, etc.)
- Not primarily about "${industry}"
- Spam, clickbait with misleading titles

━━━ VIDEOS TO SCORE ━━━
${videoList}

━━━ OUTPUT ━━━
Return ONLY a valid JSON array, same order as input. For the insight field: if OFF-NICHE write why it doesn't fit; if ON-NICHE write specifically how a ${regionName} brand in "${industry}" could adapt this format.
[{"score":8,"format":"Tutorial","insight":"..."},...]

Formats: Tutorial | Review | Educational | Vlog | Transformation | Product Demo | Comparison | Challenge | Entertainment | News | Ranking | General`

  try {
    const ranked = await geminiJson<Array<{ score: number; format: string; insight: string }>>(
      prompt, undefined, { temperature: 0.2, maxOutputTokens: 1500 }
    )

    if (!Array.isArray(ranked) || ranked.length !== videos.length) {
      throw new Error('AI response length mismatch')
    }

    return videos.map((v, i) => ({
      ...v,
      ai_score:       Math.min(10, Math.max(0, ranked[i]?.score ?? 5)),
      content_format: ranked[i]?.format ?? 'General',
      ai_insight:     ranked[i]?.insight ?? '',
    }))
  } catch {
    return videos.map(v => ({
      ...v,
      ai_score:       5,
      content_format: 'General',
      ai_insight:     '',
    }))
  }
}

// ── Full YouTube pipeline ─────────────────────────────────────

async function getYouTubeItems(industry: string, region: string): Promise<TrendingContentItem[]> {
  const KEY = process.env.YOUTUBE_API_KEY
  if (!KEY) return []

  const ytConf        = REGION_YT[region] ?? REGION_YT.US
  const now           = new Date().toISOString()
  const publishedAfter = new Date(Date.now() - 60 * 86_400_000).toISOString() // 60 days

  // Phase 1 + Phase 2 in parallel (independent)
  const [seedItems, chartIds] = await Promise.all([
    seedSearch(industry, region, ytConf, KEY, publishedAfter),
    regionalChart(ytConf.regionCode, industry, KEY),
  ])

  // Phase 3: expand from top seed channels
  const topChannelIds = [...new Set(seedItems.map(s => s.channelId))].slice(0, 5)
  const expandedIds   = await expandFromChannels(topChannelIds, KEY)

  // Merge all video IDs, deduplicate
  const seedMap   = new Map(seedItems.map(s => [s.videoId, s]))
  const allIds    = [...new Set([
    ...seedItems.map(s => s.videoId),
    ...chartIds,
    ...expandedIds,
  ])].slice(0, 50) // cap at 50 to stay within videos.list limit

  // Phase 4: enrich
  const enriched = await enrichVideos(allIds, seedMap, KEY)

  // Pre-filter A: remove Indian content
  const deIndian = enriched.filter(v => !isIndianContent(v))

  // Pre-filter B: niche keyword gate — drop videos with zero niche term matches
  const niche_lower = industry.toLowerCase()
  const nicheKeywords = KNOWN_NICHE_KEYWORDS[niche_lower]
    ?? await getNicheKeywords(industry, region)
  const onNiche = filterByNicheKeywords(deIndian, nicheKeywords)
  // Fallback: if keyword gate removes everything, use de-Indianised pool
  const toRank = onNiche.length >= 3 ? onNiche : deIndian

  // Phase 5: AI rank
  const ranked = await aiRankVideos(toRank, industry, region)

  // Sort by AI score descending, drop low-quality items
  ranked.sort((a, b) => b.ai_score - a.ai_score || b.viewCount - a.viewCount)
  const quality = ranked.filter(v => v.ai_score >= 5)

  return quality.map(v => {
    const url      = `https://www.youtube.com/watch?v=${v.videoId}`
    const views    = v.viewCount
    const velocity: TrendingContentItem['velocity'] =
      v.ai_score >= 8   ? 'rising_fast' :
      v.ai_score >= 6   ? 'rising'      :
      v.ai_score >= 4   ? 'peaking'     : 'stable'

    return {
      id:             makeId(url),
      platform:       'youtube'  as const,
      content_type:   'video'    as const,
      title:          v.title,
      url,
      thumbnail_url:  v.thumbnail,
      view_count:     views || undefined,
      channel:        v.channelTitle,
      industry,
      velocity,
      why_trending:   v.ai_insight || `${v.content_format} performing well in the ${industry} space.`,
      content_format: v.content_format,
      ai_score:       v.ai_score,
      ai_insight:     v.ai_insight,
      fetched_at:     now,
    }
  })
}

// ── TikTok ────────────────────────────────────────────────────

async function getTikTokItems(industry: string, region: string): Promise<TrendingContentItem[]> {
  const now = new Date().toISOString()

  // Primary: real videos via TikWM
  try {
    const videos = await fetchTikTokVideos(industry, region)
    if (videos.length > 0) {
      return videos.map(v => {
        const likeRate = v.play_count > 0 ? v.like_count / v.play_count : 0
        const velocity: TrendingContentItem['velocity'] =
          likeRate > 0.05 && v.play_count > 1_000_000 ? 'rising_fast' :
          likeRate > 0.02 || v.play_count > 500_000   ? 'rising'      :
          v.play_count > 100_000                       ? 'peaking'     : 'stable'

        return {
          id:            makeId(v.url),
          platform:      'tiktok'  as const,
          content_type:  'video'   as const,
          title:         v.title.slice(0, 120),
          url:           v.url,
          thumbnail_url: v.thumbnail_url,
          view_count:    v.play_count || undefined,
          channel:       v.author,
          industry,
          velocity,
          why_trending:  `${formatCount(v.like_count)} likes · ${formatCount(v.share_count)} shares · ${v.duration}s`,
          fetched_at:    now,
        }
      })
    }
  } catch { /* fall through to hashtag fallback */ }

  // Fallback: hashtags from ogohogo if video search fails
  const data = await fetchTikTokTrends(industry)
  return data.trending_hashtags.slice(0, 6).map(h => {
    const tag = h.hashtag.replace(/^#/, '')
    const url = `https://www.tiktok.com/tag/${tag}`
    return {
      id:           makeId(url),
      platform:     'tiktok'  as const,
      content_type: 'hashtag' as const,
      title:        `#${tag} — ${formatCount(h.video_count)} views`,
      url,
      view_count:   h.video_count || undefined,
      hashtag:      tag,
      industry,
      velocity:     'rising' as const,
      why_trending: `Trending TikTok hashtag in the ${industry} category.`,
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
      growthNum > 100 ? 'rising_fast' :
      growthNum > 30  ? 'rising'      :
      growthNum > 0   ? 'peaking'     : 'stable'

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

// ── AI filter (for non-YouTube items) ────────────────────────

async function aiFilterItems(
  items:    TrendingContentItem[],
  industry: string,
  region:   string,
): Promise<{ filtered: TrendingContentItem[]; removedCount: number }> {
  if (!items.length || !process.env.GEMINI_API_KEY) return { filtered: items, removedCount: 0 }

  const isArabic  = ARABIC_REGIONS.has(region)
  const threshold = region === 'global' ? 5 : 6

  const langRule = isArabic
    ? 'Arabic content = 7-10. English content for Arab audiences = 5-7. Generic English = 0-4.'
    : `Content relevant to ${region} market = 7-10. Off-topic or wrong language = 0-4.`

  const prompt = `Filter content for a social media agency.
Niche: ${industry} | Region: ${region}
Rule: ${langRule}

Score each 0-10:
${items.map((it, i) => `${i}. "${it.title}" [${it.platform}]`).join('\n')}

Return ONLY a JSON array of integers. Example: [8,2,7]`

  try {
    const scores = await geminiJson<number[]>(prompt, undefined, { temperature: 0, maxOutputTokens: 100 })
    if (!Array.isArray(scores) || scores.length !== items.length) return { filtered: items, removedCount: 0 }
    const filtered = items.filter((_, i) => (scores[i] ?? 0) >= threshold)
    return { filtered, removedCount: items.length - filtered.length }
  } catch {
    return { filtered: items, removedCount: 0 }
  }
}

// ── GET handler ───────────────────────────────────────────────

const VELOCITY_ORDER: Record<TrendingContentItem['velocity'], number> = {
  rising_fast: 0, rising: 1, peaking: 2, stable: 3,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const industry  = searchParams.get('industry')  ?? 'beauty'
  const platform  = searchParams.get('platform')  ?? 'all'
  const region    = searchParams.get('region')    ?? 'global'
  const aiFilter_ = searchParams.get('ai_filter') === 'true'
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)

  try {
    // Run YouTube pipeline + TikTok + TrendsMCP in parallel where possible
    const [youtubeItems, tiktokItems, trendsmcpItems] = await Promise.all([
      platform === 'all' || platform === 'youtube'   ? getYouTubeItems(industry, region) : Promise.resolve([]),
      platform === 'all' || platform === 'tiktok'    ? getTikTokItems(industry, region)  : Promise.resolve([]),
      platform === 'all' || platform === 'trendsmcp' ? getTrendsMcpItems(industry)       : Promise.resolve([]),
    ])

    // YouTube items are already AI-ranked — insert them first
    const seen  = new Set<string>()
    let nonYT   = [...tiktokItems, ...trendsmcpItems].filter(item => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })

    // AI filter TikTok + TrendsMCP if requested
    let removedCount = 0
    if (aiFilter_) {
      const result = await aiFilterItems(nonYT, industry, region)
      nonYT        = result.filtered
      removedCount = result.removedCount
    }

    // Merge: YouTube (AI-ranked) first, then TikTok/TrendsMCP sorted by velocity
    youtubeItems.forEach(it => seen.add(it.url))
    nonYT.sort((a, b) => VELOCITY_ORDER[a.velocity] - VELOCITY_ORDER[b.velocity])

    const items = [...youtubeItems, ...nonYT].slice(0, limit)

    return NextResponse.json(
      {
        items,
        generated_at:  new Date().toISOString(),
        region,
        ai_filtered:   aiFilter_,
        removed_count: removedCount,
        pipeline:      'v2-5phase',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[trending-content] Error:', err)
    return NextResponse.json(
      { items: [], generated_at: new Date().toISOString(), error: 'Pipeline failed' },
      { status: 500 },
    )
  }
}
