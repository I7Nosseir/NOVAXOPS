// ============================================================
// Instagram Data Provider — Direct Instagram Mobile API
//
// Uses Instagram's own internal mobile API endpoints.
// This is identical to what Apify actors do under the hood.
//
// Requirements:
//   INSTAGRAM_SESSION_ID — cookie from one test/bot IG account
//   (Log in on the web → DevTools → Application → Cookies → sessionid)
//   Session IDs are stable for months unless you explicitly log out.
//
// Fallback: if sessionid not set, tries the public (unauthenticated)
//   endpoint — works on some content but may be rate-limited on Vercel IPs.
//
// Rate limits: ~200 requests/hour per session. More than enough.
// ============================================================

import { ARABIC_REGIONS } from '@/lib/studio/query-generator'

// ── Niche → hashtag banks ─────────────────────────────────────

const EN_HASHTAGS: Record<string, string[]> = {
  beauty:           ['skincare', 'makeup', 'beautycare', 'skincareaddict', 'beautytips'],
  skincare:         ['skincare', 'skincareroutine', 'skincareobsessed', 'glowskin', 'skincaretips'],
  makeup:           ['makeup', 'makeuptutorial', 'makeuplook', 'makeupoftheday', 'makeupartist'],
  'hair care':      ['haircare', 'hairtransformation', 'hairroutine', 'healthyhair', 'hairtips'],
  tech:             ['tech', 'technology', 'gadgets', 'techtips', 'innovation'],
  'AI tools':       ['aitools', 'artificialintelligence', 'chatgpt', 'aicontent', 'techtrends'],
  food:             ['foodie', 'recipe', 'cooking', 'homecooking', 'foodphotography'],
  'food recipes':   ['recipe', 'easyrecipe', 'mealprep', 'homecooking', 'foodblog'],
  restaurants:      ['restaurant', 'foodreview', 'foodblogger', 'restaurantreview', 'foodies'],
  fitness:          ['gym', 'workout', 'fitness', 'gymlife', 'fitnessmotivation'],
  'gym workout':    ['gym', 'workout', 'weightlifting', 'gymlife', 'bodybuilding'],
  'yoga pilates':   ['yoga', 'pilates', 'yogalife', 'pilatesworkout', 'mindandbody'],
  'nutrition diet': ['nutrition', 'healthyeating', 'diet', 'cleaneating', 'weightloss'],
  finance:          ['personalfinance', 'investing', 'moneytips', 'financialfreedom', 'wealth'],
  'personal finance': ['personalfinance', 'moneytips', 'budgeting', 'savingmoney', 'debtfree'],
  entrepreneurship: ['entrepreneur', 'startup', 'business', 'entrepreneurship', 'hustle'],
  fashion:          ['fashion', 'style', 'ootd', 'outfitoftheday', 'fashionista'],
  'luxury fashion': ['luxuryfashion', 'luxury', 'designer', 'highfashion', 'couture'],
  travel:           ['travel', 'travelgram', 'wanderlust', 'travelphotography', 'explore'],
  'travel MENA':    ['travelarabia', 'arabtravel', 'middleeast', 'dubai', 'egypt'],
  education:        ['education', 'learning', 'studygram', 'onlinelearning', 'knowledge'],
  'online courses': ['onlinecourse', 'elearning', 'skillshare', 'udemy', 'learneveryday'],
  'real estate':    ['realestate', 'property', 'realestateagent', 'homeforsale', 'realestateinvesting'],
  marketing:        ['digitalmarketing', 'socialmediamarketing', 'contentmarketing', 'marketingtips', 'marketing'],
  'marketing agency': ['marketingagency', 'agencylife', 'digitalagency', 'brandstrategy', 'marketingdigital'],
  'social media tips': ['socialmediatips', 'socialmediamanager', 'contentcreator', 'instagram', 'socialmedia'],
  'dental clinic':  ['dentist', 'dentalcare', 'smilemakeover', 'teethwhitening', 'dentalhealth'],
  'law firm':       ['lawyer', 'lawfirm', 'legaladvice', 'attorney', 'law'],
  'interior design': ['interiordesign', 'homedecor', 'interior', 'interiors', 'homedesign'],
  photography:      ['photography', 'photographer', 'photooftheday', 'portrait', 'photoshoot'],
}

const AR_HASHTAGS: Record<string, Record<string, string[]>> = {
  EG: {
    beauty:        ['جمال', 'مكياج', 'سكن_كير', 'تجميل_مصر', 'عناية_بشرة'],
    skincare:      ['سكن_كير', 'عناية_بشرة', 'بشرة_نظيفة', 'تجميل', 'روتين_بشرة'],
    makeup:        ['مكياج', 'ميكاب', 'تجميل', 'مكياج_مصر', 'ميكاب_عربي'],
    food:          ['طبخ', 'وصفات', 'اكل_مصري', 'مطبخ_مصري', 'طبخ_مصري'],
    fitness:       ['رياضة', 'جيم', 'تمارين', 'لياقة', 'كمال_اجسام'],
    marketing:     ['تسويق_رقمي', 'سوشيال_ميديا', 'محتوى', 'تسويق_مصر', 'كريتور'],
    'marketing agency': ['وكالة_تسويق', 'تسويق_رقمي', 'ادارة_سوشيال', 'مصر_ماركتينج'],
    travel:        ['سياحة_مصر', 'سفر', 'مصر', 'اماكن_مصر', 'رحلات_مصر'],
    'real estate': ['عقارات_مصر', 'شقق_مصر', 'عقارات', 'مشاريع_عقارية', 'استثمار_عقاري'],
    'dental clinic': ['طب_اسنان', 'عيادة_اسنان', 'تجميل_اسنان', 'اسنان', 'ابتسامة'],
    fashion:       ['موضة', 'ستايل_مصري', 'ازياء', 'لبس_مصر', 'فاشن'],
    finance:       ['استثمار', 'مال', 'اقتصاد_مصر', 'بورصة_مصر', 'ادخار'],
  },
  SA: {
    beauty:        ['جمال_سعودي', 'مكياج_سعودي', 'سكن_كير', 'تجميل_سعودية', 'عناية_بشرة'],
    skincare:      ['سكن_كير', 'عناية_بشرة_السعودية', 'روتين_بشرة', 'بيوتي_سعودي'],
    makeup:        ['مكياج_سعودي', 'ميكاب_سعودية', 'تجميل_سعودية', 'بيوتي_خليجي'],
    food:          ['طبخ_سعودي', 'وصفات_سعودية', 'اكل_سعودي', 'مطبخ_سعودي'],
    fitness:       ['رياضة_السعودية', 'جيم_سعودي', 'لياقة_بدنية', 'كمال_اجسام'],
    marketing:     ['تسويق_سعودي', 'سوشيال_ميديا_السعودية', 'محتوى_سعودي', 'كريتور_سعودي'],
    'marketing agency': ['وكالة_تسويق_سعودية', 'تسويق_رقمي_السعودية', 'ادارة_سوشيال_ميديا'],
    travel:        ['سياحة_السعودية', 'سفر_سعودي', 'العلا', 'نيوم', 'اماكن_سعودية'],
    'real estate': ['عقارات_السعودية', 'شقق_الرياض', 'استثمار_عقاري', 'عقارات_جدة'],
    fashion:       ['موضة_سعودية', 'عبايات_سعودية', 'ستايل_خليجي', 'ازياء_سعودية'],
    finance:       ['استثمار_سعودي', 'تداول', 'ريادة_اعمال_السعودية', 'مال_السعودية'],
  },
  AE: {
    beauty:        ['جمال_دبي', 'بيوتي_دبي', 'سكن_كير_دبي', 'تجميل_امارات'],
    skincare:      ['سكن_كير_دبي', 'عناية_بشرة_دبي', 'بيوتي_اماراتي'],
    makeup:        ['مكياج_دبي', 'بيوتي_خليجي', 'ميكاب_دبي', 'تجميل_دبي'],
    food:          ['اكل_دبي', 'مطاعم_دبي', 'طبخ_اماراتي', 'فوود_دبي'],
    fitness:       ['جيم_دبي', 'رياضة_دبي', 'لايف_ستايل_دبي', 'فتنس_دبي'],
    marketing:     ['تسويق_دبي', 'ديجيتال_ماركتينج_دبي', 'كريتور_دبي', 'محتوى_دبي'],
    'marketing agency': ['وكالة_تسويق_دبي', 'ادارة_سوشيال_دبي', 'ماركتينج_دبي'],
    travel:        ['دبي', 'سياحة_دبي', 'اماكن_دبي', 'سفر_دبي'],
    'real estate': ['عقارات_دبي', 'شراء_شقة_دبي', 'استثمار_عقاري_دبي'],
    fashion:       ['موضة_دبي', 'فاشن_دبي', 'ستايل_اماراتي', 'لوكس_دبي'],
    finance:       ['استثمار_دبي', 'كريبتو_دبي', 'ريادة_اعمال_دبي'],
  },
}

// ── Hashtag resolver ──────────────────────────────────────────

async function resolveHashtags(niche: string, region: string): Promise<string[]> {
  const key = niche.toLowerCase().trim()

  if (ARABIC_REGIONS.has(region)) {
    const byCountry = AR_HASHTAGS[region]?.[key]
    if (byCountry?.length) return byCountry.slice(0, 4)
    const anyArabic = Object.values(AR_HASHTAGS).find(m => m[key])?.[key]
    if (anyArabic?.length) return anyArabic.slice(0, 4)
  }

  const english = EN_HASHTAGS[key]
  if (english?.length) return english.slice(0, 4)

  try {
    const { geminiJson } = await import('@/lib/gemini')
    const isArabic = ARABIC_REGIONS.has(region)
    const prompt = `Generate 5 Instagram hashtags for the niche: "${niche}"
${isArabic ? 'Return Arabic hashtags without the # symbol, using underscore for spaces.' : 'Return English hashtags without the # symbol, no spaces.'}
Return ONLY a JSON array of 5 strings. No # symbols, no spaces (use underscores). Example: ["hashtag1","hashtag_two","tag3"]`
    const tags = await geminiJson<string[]>(prompt, undefined, { temperature: 0.2, maxOutputTokens: 150 })
    if (Array.isArray(tags) && tags.length > 0) {
      return tags.map(t => t.replace(/^#/, '').replace(/\s+/g, '_')).slice(0, 4)
    }
  } catch { /* fall through */ }

  return [key.replace(/\s+/g, ''), key.replace(/\s+/g, '_')]
}

// ── Instagram Mobile API headers ──────────────────────────────

function igHeaders(): Record<string, string> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID ?? ''
  const headers: Record<string, string> = {
    'User-Agent': 'Instagram 269.0.0.18.75 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; ONEPLUS A3010; OnePlus3T; qcom; en_US; 314665256)',
    'x-ig-app-id': '936619743392459',
    'x-ig-capabilities': '3brTBw==',
    'Accept-Language': 'en-US',
    'Accept': '*/*',
  }
  if (sessionId) {
    headers['Cookie'] = `sessionid=${sessionId}; ds_user_id=0`
  }
  return headers
}

// ── Instagram API response shapes ────────────────────────────

interface IGMedia {
  pk: string
  code: string              // shortCode
  media_type: 1 | 2 | 8    // 1=photo, 2=video/reel, 8=carousel
  product_type?: string     // 'clips' = Reel
  caption?: { text: string }
  image_versions2?: { candidates: Array<{ url: string }> }
  video_duration?: number
  play_count?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  taken_at?: number
  user?: { username: string; full_name: string }
}

interface IGHashtagResponse {
  sections?: Array<{
    layout_content?: {
      medias?: Array<{ media: IGMedia }>
      fill_items?: Array<{ media: IGMedia }>
    }
  }>
}

// ── Indian content filter ─────────────────────────────────────

const INDIAN_SIGNALS = ['hindi', 'bollywood', 'india', 'indian', 'desi', 'telugu', 'tamil', 'kannada']

function isIndianPost(caption: string, author: string): boolean {
  const hay = `${caption} ${author}`.toLowerCase()
  return INDIAN_SIGNALS.some(s => hay.includes(s))
}

// ── Public interface ──────────────────────────────────────────

export interface InstagramPost {
  id:            string
  shortCode:     string
  type:          'image' | 'video' | 'reel'
  caption:       string
  thumbnailUrl:  string
  url:           string
  likeCount:     number
  commentCount:  number
  viewCount:     number
  author:        string
  authorHandle:  string
  timestamp:     string
}

export async function fetchInstagramPosts(
  niche:  string,
  region: string,
): Promise<InstagramPost[]> {
  const hashtags = await resolveHashtags(niche, region)
  if (!hashtags.length) return []

  const results: InstagramPost[] = []

  for (const tag of hashtags.slice(0, 2)) {
    try {
      const url = `https://i.instagram.com/api/v1/tags/${encodeURIComponent(tag)}/sections/?count=18&tab=recent&include_reel=true`
      const res = await fetch(url, {
        headers: igHeaders(),
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        console.error(`[instagram] hashtag "${tag}" returned HTTP ${res.status}`)
        continue
      }

      const data = await res.json() as IGHashtagResponse

      const medias: IGMedia[] = []
      for (const section of data.sections ?? []) {
        const content = section.layout_content
        for (const item of content?.medias ?? []) medias.push(item.media)
        for (const item of content?.fill_items ?? []) medias.push(item.media)
      }

      for (const m of medias) {
        if (!m.code) continue
        const caption = m.caption?.text ?? ''
        const author  = m.user?.username ?? ''
        if (isIndianPost(caption, author)) continue

        const type: InstagramPost['type'] =
          m.product_type === 'clips' ? 'reel' :
          m.media_type === 2         ? 'video' : 'image'

        const viewCount = m.play_count ?? m.view_count ?? m.like_count ?? 0

        results.push({
          id:           m.pk ?? m.code,
          shortCode:    m.code,
          type,
          caption:      caption.slice(0, 150).replace(/\n+/g, ' '),
          thumbnailUrl: m.image_versions2?.candidates?.[0]?.url ?? '',
          url:          `https://www.instagram.com/p/${m.code}/`,
          likeCount:    m.like_count ?? 0,
          commentCount: m.comment_count ?? 0,
          viewCount,
          author:       m.user?.full_name ?? author,
          authorHandle: author,
          timestamp:    m.taken_at ? new Date(m.taken_at * 1000).toISOString() : '',
        })
      }
    } catch (err) {
      console.error(`[instagram] fetch error for hashtag "${tag}":`, err)
    }
  }

  return results
    .sort((a, b) => {
      if (a.type === 'reel' && b.type !== 'reel') return -1
      if (b.type === 'reel' && a.type !== 'reel') return 1
      const erA = a.viewCount > 0 ? (a.likeCount + a.commentCount) / a.viewCount : 0
      const erB = b.viewCount > 0 ? (b.likeCount + b.commentCount) / b.viewCount : 0
      return erB - erA || b.likeCount - a.likeCount
    })
    .slice(0, 25)
}

// ── Profile scraper (used by competitor tracking) ─────────────

export interface InstagramProfile {
  username:          string
  fullName:          string
  followers:         number
  following:         number
  postCount:         number
  avgLikes:          number
  avgComments:       number
  avgViews:          number
  avgEngagementRate: number
  postingFreqPerWeek: number
  topContentTypes:   Record<string, number>
}

interface IGProfileResponse {
  data?: {
    user?: {
      edge_followed_by?: { count: number }
      edge_follow?:      { count: number }
      edge_owner_to_timeline_media?: {
        count?: number
        edges?: Array<{
          node: {
            __typename:       string
            is_video:         boolean
            shortcode:        string
            taken_at_timestamp: number
            edge_liked_by?:   { count: number }
            edge_media_to_comment?: { count: number }
            video_view_count?: number
            product_type?:    string
          }
        }>
      }
    }
  }
}

export async function fetchInstagramProfile(handle: string): Promise<InstagramProfile | null> {
  const username = handle.replace('@', '').trim()
  try {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`
    const res = await fetch(url, {
      headers: igHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error(`[instagram-profile] HTTP ${res.status} for @${username}`)
      return null
    }

    const data = await res.json() as IGProfileResponse
    const user = data.data?.user
    if (!user) return null

    const followers = user.edge_followed_by?.count ?? 0
    const postCount = user.edge_owner_to_timeline_media?.count ?? 0
    const edges     = user.edge_owner_to_timeline_media?.edges ?? []

    let totalLikes = 0, totalComments = 0, totalViews = 0
    const contentTypes: Record<string, number> = {}
    let recentCount = 0
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    for (const { node } of edges) {
      totalLikes    += node.edge_liked_by?.count ?? 0
      totalComments += node.edge_media_to_comment?.count ?? 0
      totalViews    += node.video_view_count ?? 0

      const type = node.product_type === 'clips' ? 'reel' : node.is_video ? 'video' : 'image'
      contentTypes[type] = (contentTypes[type] ?? 0) + 1

      if (node.taken_at_timestamp * 1000 > thirtyDaysAgo) recentCount++
    }

    const n = edges.length || 1
    const avgLikes    = Math.round(totalLikes / n)
    const avgComments = Math.round(totalComments / n)
    const avgViews    = Math.round(totalViews / n)
    const avgEr       = followers > 0
      ? parseFloat(((totalLikes + totalComments) / n / followers * 100).toFixed(2))
      : 0
    const freqPerWeek = parseFloat((recentCount / 4.3).toFixed(1))

    return {
      username,
      fullName:           '',
      followers,
      following:          user.edge_follow?.count ?? 0,
      postCount,
      avgLikes,
      avgComments,
      avgViews,
      avgEngagementRate:  avgEr,
      postingFreqPerWeek: freqPerWeek,
      topContentTypes:    contentTypes,
    }
  } catch (err) {
    console.error(`[instagram-profile] error for @${username}:`, err)
    return null
  }
}
