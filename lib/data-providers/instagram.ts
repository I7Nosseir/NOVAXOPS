// ============================================================
// Instagram Data Provider — Apify Instagram Hashtag Scraper
// Actor: apify/instagram-hashtag-scraper (MIT, open source)
// Docs: https://apify.com/apify/instagram-hashtag-scraper
// No OAuth. One API key. Free tier included.
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

// Arabic hashtags for MENA — no spaces in hashtags, underscores or run-together
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

  // Country-specific Arabic hashtags
  if (ARABIC_REGIONS.has(region)) {
    const byCountry = AR_HASHTAGS[region]?.[key]
    if (byCountry?.length) return byCountry.slice(0, 4)
    // Fallback: try generic Arabic for any country
    const anyArabic = Object.values(AR_HASHTAGS).find(m => m[key])?.[key]
    if (anyArabic?.length) return anyArabic.slice(0, 4)
  }

  // English hashtags
  const english = EN_HASHTAGS[key]
  if (english?.length) return english.slice(0, 4)

  // Custom niche: generate hashtags via AI
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
  } catch { /* fallback below */ }

  // Ultimate fallback: use niche words as hashtags
  return [key.replace(/\s+/g, ''), key.replace(/\s+/g, '_')]
}

// ── Apify response shape ──────────────────────────────────────

interface ApifyInstagramPost {
  id:              string
  shortCode:       string
  type:            'Image' | 'Video' | 'Sidecar'
  caption?:        string
  hashtags?:       string[]
  url:             string
  displayUrl?:     string
  images?:         string[]
  videoUrl?:       string
  videoViewCount?: number
  videoPlayCount?: number
  likesCount?:     number
  commentsCount?:  number
  timestamp?:      string
  ownerUsername?:  string
  ownerFullName?:  string
  isSponsored?:    boolean
  productType?:    string   // 'clips' = Reel
  locationName?:  string
}

// ── Indian content filter ─────────────────────────────────────

const INDIAN_SIGNALS = ['hindi', 'bollywood', 'india', 'indian', 'desi', 'telugu', 'tamil', 'kannada', 'bharat']

function isIndianPost(p: ApifyInstagramPost): boolean {
  const hay = `${p.caption ?? ''} ${p.ownerUsername ?? ''} ${p.ownerFullName ?? ''}`.toLowerCase()
  return INDIAN_SIGNALS.some(s => hay.includes(s))
}

// ── Main fetcher ──────────────────────────────────────────────

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
  const key = process.env.APIFY_API_KEY
  if (!key) return []

  const hashtags = await resolveHashtags(niche, region)
  if (!hashtags.length) return []

  try {
    // 25s Apify run timeout + 512MB memory for faster actor startup
    // run-sync-get-dataset-items blocks until run completes or timeout
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${key}&timeout=25&memory=512`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags:          hashtags,
          resultsLimit:      10,
          resultsType:       'posts',
          addParentData:     false,
          isUserReelFeedURL: false,
          isUserTaggedFeedURL: false,
        }),
        signal: AbortSignal.timeout(30_000), // 30s client-side hard timeout
      }
    )

    if (!res.ok) {
      console.error(`[instagram] Apify returned ${res.status} — hashtags: ${hashtags.join(', ')}`)
      return []
    }

    const items = await res.json() as ApifyInstagramPost[]
    if (!Array.isArray(items)) return []

    return items
      .filter(p => p.shortCode && !p.isSponsored && !isIndianPost(p))
      .map(p => {
        const viewCount = p.videoPlayCount ?? p.videoViewCount ?? p.likesCount ?? 0
        const type: InstagramPost['type'] =
          p.productType === 'clips' ? 'reel' :
          p.type === 'Video'        ? 'video' : 'image'

        return {
          id:           p.id ?? p.shortCode,
          shortCode:    p.shortCode,
          type,
          caption:      (p.caption ?? '').slice(0, 150).replace(/\n+/g, ' '),
          thumbnailUrl: p.displayUrl ?? p.images?.[0] ?? '',
          url:          `https://www.instagram.com/p/${p.shortCode}/`,
          likeCount:    p.likesCount ?? 0,
          commentCount: p.commentsCount ?? 0,
          viewCount,
          author:       p.ownerFullName ?? p.ownerUsername ?? '',
          authorHandle: p.ownerUsername ?? '',
          timestamp:    p.timestamp ?? '',
        }
      })
      // Sort: Reels first, then by engagement
      .sort((a, b) => {
        if (a.type === 'reel' && b.type !== 'reel') return -1
        if (b.type === 'reel' && a.type !== 'reel') return 1
        const erA = a.viewCount > 0 ? (a.likeCount + a.commentCount) / a.viewCount : 0
        const erB = b.viewCount > 0 ? (b.likeCount + b.commentCount) / b.viewCount : 0
        return erB - erA || b.likeCount - a.likeCount
      })
      .slice(0, 12)

  } catch (err) {
    console.warn('[instagram] fetch failed:', err)
    return []
  }
}
