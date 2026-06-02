// ============================================================
// TikTok Trend Data Provider
// Source: ogohogo/tiktok-trending-data-api (GitHub, hourly updates)
// No API key required. Completely free.
// https://github.com/ogohogo/tiktok-trending-data-api
// ============================================================

export interface TikTokData {
  trending_hashtags: Array<{
    hashtag: string
    video_count: number
    trend_direction: 'rising' | 'stable' | 'falling'
  }>
  trending_sounds: string[]
  trending_formats: string[]
  source: 'github_json' | 'fallback'
  fetched_at: string
}

// ── Raw JSON shape from ogohogo repo ─────────────────────────

interface OgohogoItem {
  title?: string
  desc?: string
  stats?: { videoCount?: number; viewCount?: number }
  hashtag_name?: string
  music_title?: string
  author?: { nickname?: string }
  challengeInfo?: { challengeAnnex?: { hashtagName?: string }; stats?: { videoCount?: number } }
  musicInfo?: { music?: { title?: string } }
}

// ── Industry keyword filters ──────────────────────────────────

const INDUSTRY_HASHTAGS: Record<string, string[]> = {
  beauty:      ['skin', 'beauty', 'makeup', 'hair', 'skincare', 'glow', 'routine', 'spf', 'moistur', 'foundation', 'lipstick', 'nail', 'face', 'eye', 'serum', 'toner'],
  tech:        ['tech', 'ai', 'coding', 'software', 'app', 'gadget', 'phone', 'laptop', 'productivity', 'developer', 'chatgpt', 'openai', 'robot', 'digital', 'computer'],
  food:        ['food', 'recipe', 'cook', 'eat', 'meal', 'kitchen', 'restaurant', 'bake', 'lunch', 'dinner', 'breakfast', 'snack', 'drink', 'coffee', 'foodtok', 'chef'],
  fitness:     ['fitness', 'gym', 'workout', 'exercise', 'run', 'yoga', 'pilates', 'muscle', 'cardio', 'training', 'health', 'strong', 'lift', 'sport', 'gymtok'],
  finance:     ['money', 'invest', 'finance', 'stock', 'crypto', 'budget', 'saving', 'wealth', 'rich', 'financial', 'debt', 'credit', 'bank', 'retire', 'income'],
  fashion:     ['fashion', 'style', 'outfit', 'ootd', 'clothes', 'wear', 'brand', 'luxury', 'trend', 'look', 'dress', 'shoe', 'bag', 'designer', 'thrift'],
  travel:      ['travel', 'trip', 'vacation', 'flight', 'hotel', 'explore', 'adventure', 'tour', 'beach', 'destination', 'wanderlust', 'passport', 'nomad'],
  education:   ['learn', 'study', 'school', 'education', 'course', 'skill', 'knowledge', 'student', 'teacher', 'tutorial', 'howto', 'tip', 'guide', 'hack'],
  real_estate: ['realestate', 'house', 'home', 'property', 'mortgage', 'rent', 'invest', 'landlord', 'apartment', 'realtor', 'listing', 'housing'],
  general:     [],
}

// ── Industry mock fallback ────────────────────────────────────

const MOCK_DATA: Record<string, Omit<TikTokData, 'source' | 'fetched_at'>> = {
  beauty: {
    trending_hashtags: [
      { hashtag: 'skintok',          video_count: 48_200_000,  trend_direction: 'rising'  },
      { hashtag: 'skincare',         video_count: 312_000_000, trend_direction: 'stable'  },
      { hashtag: 'glasskin',         video_count: 18_700_000,  trend_direction: 'rising'  },
      { hashtag: 'barrierrepair',    video_count: 4_200_000,   trend_direction: 'rising'  },
      { hashtag: 'skincareroutine',  video_count: 87_400_000,  trend_direction: 'stable'  },
      { hashtag: 'dermatologist',    video_count: 14_600_000,  trend_direction: 'rising'  },
    ],
    trending_sounds: [
      'Slowed and reverb lofi — beauty routine aesthetic',
      '"Espresso" by Sabrina Carpenter — transformation overlay',
      'ASMR skincare sounds compilation',
      'Ambient spa music — wellness aesthetic',
    ],
    trending_formats: [
      'Before/After split-screen transformation (15-30s)',
      'Ingredient deep-dive with on-screen text captions',
      'Morning routine speed-up with product overlays',
      'Myth vs Fact debunk — rapid-fire bold text format',
    ],
  },
  tech: {
    trending_hashtags: [
      { hashtag: 'techtok',           video_count: 42_800_000,  trend_direction: 'stable'  },
      { hashtag: 'aitools',           video_count: 31_500_000,  trend_direction: 'rising'  },
      { hashtag: 'productivity',      video_count: 156_000_000, trend_direction: 'stable'  },
      { hashtag: 'claudeai',          video_count: 6_400_000,   trend_direction: 'rising'  },
      { hashtag: 'softwareengineer',  video_count: 18_200_000,  trend_direction: 'stable'  },
      { hashtag: 'gadgets',           video_count: 67_200_000,  trend_direction: 'stable'  },
    ],
    trending_sounds: [
      'Phonk remix — fast-paced setup montage',
      'Keyboard ASMR original sound',
      'Cyberpunk ambient electronic background',
      '"Level Up" motivational — productivity overlay',
    ],
    trending_formats: [
      '"5 AI tools that changed how I work" rapid-list',
      'Screen recording with voiceover explanation',
      'Tech setup tour with price overlays',
      'Comparison side-by-side with live testing',
    ],
  },
  food: {
    trending_hashtags: [
      { hashtag: 'foodtok',      video_count: 238_000_000, trend_direction: 'stable'  },
      { hashtag: 'mealprep',     video_count: 94_700_000,  trend_direction: 'stable'  },
      { hashtag: 'easyrecipes',  video_count: 312_000_000, trend_direction: 'rising'  },
      { hashtag: 'smashburger',  video_count: 8_400_000,   trend_direction: 'rising'  },
      { hashtag: 'highprotein',  video_count: 41_200_000,  trend_direction: 'rising'  },
      { hashtag: 'viralrecipe',  video_count: 22_800_000,  trend_direction: 'stable'  },
    ],
    trending_sounds: [
      'Sizzle and crunch ASMR food compilation',
      'Upbeat acoustic cooking music',
      'Lofi hip hop — calm meal prep montage',
    ],
    trending_formats: [
      'POV: cooking a viral recipe for the first time',
      'Meal prep with calorie and macro overlays',
      'Speed cooking with satisfying plating reveal',
      '"Would a chef approve this?" honest reaction',
    ],
  },
  fitness: {
    trending_hashtags: [
      { hashtag: 'gymtok',             video_count: 76_400_000,  trend_direction: 'stable'  },
      { hashtag: 'pilates',            video_count: 67_800_000,  trend_direction: 'rising'  },
      { hashtag: 'zone2cardio',        video_count: 3_200_000,   trend_direction: 'rising'  },
      { hashtag: 'hybridathlete',      video_count: 5_800_000,   trend_direction: 'rising'  },
      { hashtag: 'fitnessmotivation',  video_count: 189_000_000, trend_direction: 'stable'  },
      { hashtag: 'formcheck',          video_count: 9_700_000,   trend_direction: 'stable'  },
    ],
    trending_sounds: [
      'Hard phonk — gym warmup energy',
      'Motivational speech remix — training montage',
      'Electronic drop — PR moment reveal',
    ],
    trending_formats: [
      'Form guide with mistake/correction split',
      '"I trained like [athlete] for 30 days" experiment',
      'Progress transformation with training data overlay',
      '"Things I wish I knew before lifting" rapid-list',
    ],
  },
  finance: {
    trending_hashtags: [
      { hashtag: 'personalfinance',    video_count: 98_200_000,  trend_direction: 'stable'  },
      { hashtag: 'moneytips',         video_count: 64_700_000,  trend_direction: 'rising'  },
      { hashtag: 'financialliteracy', video_count: 34_600_000,  trend_direction: 'rising'  },
      { hashtag: 'savingmoney',       video_count: 118_000_000, trend_direction: 'stable'  },
      { hashtag: 'investing',         video_count: 87_400_000,  trend_direction: 'stable'  },
      { hashtag: 'debtfreejourney',   video_count: 21_800_000,  trend_direction: 'stable'  },
    ],
    trending_sounds: [
      'Cinematic orchestral — wealth visualization',
      'Ambient focus music — financial education format',
      '"Rich Girl" — money aesthetic montage',
    ],
    trending_formats: [
      '"Explain like I am 5" complex concept breakdown',
      'Paycheck breakdown with spending visualization',
      '"Things your bank does not want you to know" exposé',
      'Side-by-side: broke habits vs wealthy habits',
    ],
  },
  general: {
    trending_hashtags: [
      { hashtag: 'viral',   video_count: 500_000_000, trend_direction: 'stable' },
      { hashtag: 'trending',video_count: 300_000_000, trend_direction: 'stable' },
      { hashtag: 'fyp',     video_count: 900_000_000, trend_direction: 'stable' },
    ],
    trending_sounds: ['Trending audio — week of ' + new Date().toDateString()],
    trending_formats: ['Short-form rapid content', 'POV storytelling format', 'Before/After reveal'],
  },
}

// ── Parse ogohogo JSON ────────────────────────────────────────

function parseOgohogoJson(data: OgohogoItem[], industry: string): Omit<TikTokData, 'source' | 'fetched_at'> {
  const industryKeys = INDUSTRY_HASHTAGS[industry.toLowerCase()] ?? []

  // Extract hashtags from the raw data
  const allHashtags: TikTokData['trending_hashtags'] = data
    .filter(item => item.title ?? item.hashtag_name ?? item.challengeInfo?.challengeAnnex?.hashtagName)
    .map(item => ({
      hashtag: (item.hashtag_name ?? item.challengeInfo?.challengeAnnex?.hashtagName ?? item.title ?? '').toLowerCase().replace(/\s+/g, ''),
      video_count: item.stats?.videoCount ?? item.challengeInfo?.stats?.videoCount ?? 0,
      trend_direction: 'rising' as const,
    }))
    .filter(h => h.hashtag.length > 0)

  // Filter to industry-relevant
  const relevant = industryKeys.length > 0
    ? allHashtags.filter(h => industryKeys.some(k => h.hashtag.includes(k)))
    : allHashtags

  const trending_hashtags = relevant.length >= 3
    ? relevant.slice(0, 6)
    : allHashtags.slice(0, 6)

  // Extract sounds
  const trending_sounds = data
    .filter(item => item.musicInfo?.music?.title ?? item.music_title)
    .slice(0, 4)
    .map(item => item.musicInfo?.music?.title ?? item.music_title ?? '')
    .filter(Boolean)

  const trending_formats = [
    'Short-form video (15-30s) with text overlay',
    'POV storytelling format',
    'Reaction + commentary split screen',
    'Tutorial rapid-fire format',
  ]

  return { trending_hashtags, trending_sounds, trending_formats }
}

// ── Fetch from ogohogo GitHub ─────────────────────────────────

async function fetchFromGithub(industry: string): Promise<TikTokData> {
  const url = 'https://raw.githubusercontent.com/ogohogo/tiktok-trending-data-api/main/t.json'

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NOVAXOps/1.0)' },
    next: { revalidate: 3600 }, // cache 1h
  })

  if (!res.ok) throw new Error(`ogohogo GitHub returned ${res.status}`)

  const data: OgohogoItem[] = await res.json()
  const parsed = parseOgohogoJson(data, industry)
  const mock   = MOCK_DATA[industry.toLowerCase()] ?? MOCK_DATA.general

  return {
    trending_hashtags: parsed.trending_hashtags.length  ? parsed.trending_hashtags  : mock.trending_hashtags,
    trending_sounds:   parsed.trending_sounds.length    ? parsed.trending_sounds    : mock.trending_sounds,
    trending_formats:  mock.trending_formats, // always use curated formats
    source:            'github_json',
    fetched_at:        new Date().toISOString(),
  }
}

// ── Public API ────────────────────────────────────────────────

export async function fetchTikTokTrends(industry: string): Promise<TikTokData> {
  try {
    return await fetchFromGithub(industry)
  } catch (err) {
    console.warn('[tiktok] GitHub JSON fetch failed, using fallback:', err)
    const mock = MOCK_DATA[industry.toLowerCase()] ?? MOCK_DATA.general
    return { ...mock, source: 'fallback', fetched_at: new Date().toISOString() }
  }
}
