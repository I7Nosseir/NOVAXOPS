// ============================================================
// TikTok Data Provider
// Video search: TikWM public API (free, no auth)
// Hashtag fallback: ogohogo GitHub JSON
// ============================================================

export interface TikTokVideoItem {
  video_id:      string
  title:         string
  author:        string
  author_handle: string
  thumbnail_url: string
  play_count:    number
  like_count:    number
  comment_count: number
  share_count:   number
  duration:      number
  url:           string
}

export interface TikTokData {
  trending_hashtags: Array<{
    hashtag:         string
    video_count:     number
    trend_direction: 'rising' | 'stable' | 'falling'
  }>
  trending_sounds: string[]
  trending_formats: string[]
  source:     'github_json' | 'fallback'
  fetched_at: string
}

// ── TikWM video search ────────────────────────────────────────

const TIKWM_BASE = 'https://www.tikwm.com/api/feed/search'

// Country-specific TikTok search queries (mirrors YouTube strategy)
const TIKTOK_QUERIES: Record<string, Record<string, string[]>> = {
  EG: {
    beauty:      ['جمال مصري مكياج', 'سكن كير مصر', 'روتين تجميل مصري'],
    tech:        ['تكنولوجيا مصر', 'ريفيو موبايل مصري', 'ذكاء اصطناعي مصر'],
    food:        ['طبخ مصري', 'وصفات مصرية', 'اكل مصري سريع'],
    fitness:     ['رياضة مصر', 'تمارين مصري', 'دايت مصر'],
    finance:     ['استثمار مصر', 'مشاريع صغيرة مصر', 'مال مصر'],
    fashion:     ['موضة مصرية', 'ستايل مصري', 'لبس مصر'],
    travel:      ['سياحة مصر', 'اماكن مصر', 'رحلات مصرية'],
    education:   ['تعليم مصر', 'كورس مجاني مصر', 'شرح مصري'],
    real_estate: ['عقارات مصر', 'شقق مصر', 'استثمار عقاري مصر'],
  },
  SA: {
    beauty:      ['جمال سعودي مكياج', 'سكن كير السعودية', 'بيوتي سعودي'],
    tech:        ['تكنولوجيا السعودية', 'ريفيو جوال سعودي', 'رؤية 2030 تقنية'],
    food:        ['طبخ سعودي', 'وصفات سعودية', 'اكل سعودي'],
    fitness:     ['رياضة السعودية', 'جيم سعودي', 'دايت سعودي'],
    finance:     ['استثمار السعودية', 'تداول سعودي', 'ريادة اعمال السعودية'],
    fashion:     ['موضة سعودية', 'عبايات سعودية', 'ستايل خليجي'],
    travel:      ['سياحة السعودية', 'العلا نيوم', 'سفر سعودي'],
    education:   ['تعليم السعودية', 'مهارات سعودية', 'كورسات سعودية'],
    real_estate: ['عقارات السعودية', 'شقق الرياض', 'استثمار عقاري سعودي'],
  },
  AE: {
    beauty:      ['جمال دبي مكياج', 'بيوتي الامارات', 'سكن كير دبي'],
    tech:        ['تكنولوجيا دبي', 'ستارت اب دبي', 'ذكاء اصطناعي الامارات'],
    food:        ['طبخ اماراتي', 'مطاعم دبي', 'اكل دبي'],
    fitness:     ['جيم دبي', 'رياضة الامارات', 'لايف ستايل دبي'],
    finance:     ['استثمار دبي', 'كريبتو الامارات', 'ريادة اعمال دبي'],
    fashion:     ['موضة دبي', 'لوكس دبي', 'ستايل اماراتي'],
    travel:      ['سياحة دبي', 'اماكن دبي', 'سفر الامارات'],
    education:   ['تعليم دبي', 'كورسات اماراتية', 'مهارات الامارات'],
    real_estate: ['عقارات دبي', 'تملك شقة دبي', 'استثمار اماراتي'],
  },
}

const EN_TIKTOK_QUERIES: Record<string, string[]> = {
  beauty:      ['skincare routine', 'makeup tutorial viral', 'beauty transformation'],
  tech:        ['tech review', 'AI gadget', 'software tutorial'],
  food:        ['recipe cooking', 'food asmr', 'meal prep'],
  fitness:     ['workout transformation', 'gym motivation', 'fitness tips'],
  finance:     ['money tips', 'investing beginner', 'personal finance'],
  fashion:     ['outfit ideas', 'fashion haul', 'style tips'],
  travel:      ['travel vlog', 'hidden gems', 'travel tips'],
  education:   ['learn skill', 'study tips', 'education explained'],
  real_estate: ['real estate tips', 'property investing', 'house tour'],
}

const ARABIC_REGIONS = new Set(['AE', 'SA', 'EG', 'JO', 'KW', 'QA'])

const INDIAN_SIGNALS = [
  'hindi', 'bollywood', 'india', 'indian', 'desi', 'telugu', 'tamil',
  'kannada', 'marathi', 'bengali', 'punjabi', 'bigg boss', 'bharat',
]

function isIndianTikTok(item: TikWMVideoRaw): boolean {
  const hay = `${item.title} ${item.author?.nickname ?? ''} ${(item.content_desc ?? []).join(' ')}`.toLowerCase()
  return INDIAN_SIGNALS.some(s => hay.includes(s))
}

interface TikWMVideoRaw {
  video_id:      string
  title:         string
  cover:         string
  duration:      number
  play_count:    number
  digg_count:    number
  comment_count: number
  share_count:   number
  is_ad:         boolean
  region:        string
  content_desc?: string[]
  author: {
    unique_id: string
    nickname:  string
  }
}

async function searchTikWM(query: string, count = 8): Promise<TikWMVideoRaw[]> {
  try {
    const url = new URL(TIKWM_BASE)
    url.searchParams.set('keywords', query)
    url.searchParams.set('count', String(count))
    url.searchParams.set('cursor', '0')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NOVAXOps/1.0)' },
    })
    if (!res.ok) return []
    const data = await res.json() as { code: number; data?: { videos?: TikWMVideoRaw[] } }
    if (data.code !== 0) return []
    return data.data?.videos ?? []
  } catch {
    return []
  }
}

export async function fetchTikTokVideos(
  industry: string,
  region:   string,
): Promise<TikTokVideoItem[]> {
  const niche     = industry.toLowerCase()
  const isArabic  = ARABIC_REGIONS.has(region)

  // Pick search queries
  const queries = isArabic
    ? (TIKTOK_QUERIES[region]?.[niche] ?? TIKTOK_QUERIES.SA[niche] ?? [`${niche} عربي`]).slice(0, 2)
    : (EN_TIKTOK_QUERIES[niche] ?? [`${niche} viral`, `${niche} tutorial`]).slice(0, 2)

  // Run queries in parallel
  const batches = await Promise.all(queries.map(q => searchTikWM(q, 8)))

  // Deduplicate, filter ads + Indian + very short
  const seen  = new Set<string>()
  const items: TikTokVideoItem[] = []

  for (const batch of batches) {
    for (const v of batch) {
      if (!v.video_id || seen.has(v.video_id)) continue
      if (v.is_ad) continue
      if (v.duration < 10) continue
      if (isIndianTikTok(v)) continue
      seen.add(v.video_id)

      items.push({
        video_id:      v.video_id,
        title:         v.title || v.content_desc?.[0] || 'TikTok video',
        author:        v.author?.nickname ?? '',
        author_handle: v.author?.unique_id ?? '',
        thumbnail_url: v.cover,
        play_count:    v.play_count ?? 0,
        like_count:    v.digg_count ?? 0,
        comment_count: v.comment_count ?? 0,
        share_count:   v.share_count ?? 0,
        duration:      v.duration ?? 0,
        url:           `https://www.tiktok.com/@${v.author?.unique_id ?? 'user'}/video/${v.video_id}`,
      })
    }
  }

  // Sort by engagement ratio (likes / plays), then absolute plays
  return items
    .sort((a, b) => {
      const erA = a.play_count > 0 ? a.like_count / a.play_count : 0
      const erB = b.play_count > 0 ? b.like_count / b.play_count : 0
      return erB - erA || b.play_count - a.play_count
    })
    .slice(0, 10)
}

// ── Hashtag fallback (ogohogo GitHub) ─────────────────────────

interface OgohogoHashtag {
  name?:  string
  stats?: { views?: number }
}
interface OgohogoMusic {
  musicInfo?: { music?: { title?: string } }
  music_title?: string
}

const INDUSTRY_HASHTAGS: Record<string, string[]> = {
  beauty:      ['skin', 'beauty', 'makeup', 'hair', 'skincare', 'glow', 'routine', 'serum'],
  tech:        ['tech', 'ai', 'coding', 'software', 'app', 'gadget', 'phone', 'laptop'],
  food:        ['food', 'recipe', 'cook', 'eat', 'meal', 'kitchen', 'restaurant', 'bake'],
  fitness:     ['fitness', 'gym', 'workout', 'exercise', 'run', 'yoga', 'pilates', 'muscle'],
  finance:     ['money', 'invest', 'finance', 'stock', 'crypto', 'budget', 'saving'],
  fashion:     ['fashion', 'style', 'outfit', 'ootd', 'clothes', 'wear', 'brand', 'luxury'],
  travel:      ['travel', 'trip', 'vacation', 'flight', 'hotel', 'explore', 'adventure'],
  education:   ['learn', 'study', 'school', 'education', 'course', 'skill', 'knowledge'],
  real_estate: ['realestate', 'house', 'home', 'property', 'mortgage', 'rent', 'invest'],
  general:     [],
}

async function fetchHashtagsFromGithub(industry: string): Promise<TikTokData> {
  const url = 'https://raw.githubusercontent.com/ogohogo/tiktok-trending-data-api/main/t.json'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NOVAXOps/1.0)' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`ogohogo returned ${res.status}`)

  const raw = await res.json() as { hashtag?: OgohogoHashtag[]; music?: OgohogoMusic[] }
  const industryKeys = INDUSTRY_HASHTAGS[industry.toLowerCase()] ?? []

  const allHashtags = (raw.hashtag ?? [])
    .map(item => ({
      hashtag:         (item.name ?? '').replace(/^#/, '').toLowerCase().trim(),
      video_count:     item.stats?.views ?? 0,
      trend_direction: 'rising' as const,
    }))
    .filter(h => h.hashtag.length > 0)

  const relevant = industryKeys.length > 0
    ? allHashtags.filter(h => industryKeys.some(k => h.hashtag.includes(k)))
    : allHashtags

  const trending_hashtags = (relevant.length >= 3 ? relevant : allHashtags).slice(0, 8)
  const trending_sounds = (raw.music ?? [])
    .map(m => m.musicInfo?.music?.title ?? m.music_title ?? '')
    .filter(Boolean)
    .slice(0, 4)

  return {
    trending_hashtags,
    trending_sounds,
    trending_formats: ['Short-form video (15-30s) with text overlay', 'Tutorial rapid-fire format'],
    source:     'github_json',
    fetched_at: new Date().toISOString(),
  }
}

export async function fetchTikTokTrends(industry: string): Promise<TikTokData> {
  try {
    return await fetchHashtagsFromGithub(industry)
  } catch (err) {
    console.warn('[tiktok] hashtag fetch failed:', err)
    return {
      trending_hashtags: [],
      trending_sounds:   [],
      trending_formats:  [],
      source:            'fallback',
      fetched_at:        new Date().toISOString(),
    }
  }
}
