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

  return {
    trending_hashtags: parsed.trending_hashtags,
    trending_sounds:   parsed.trending_sounds,
    trending_formats:  parsed.trending_formats.length ? parsed.trending_formats : [
      'Short-form video (15-30s) with text overlay',
      'Tutorial rapid-fire format',
    ],
    source:     'github_json',
    fetched_at: new Date().toISOString(),
  }
}

// ── Public API ────────────────────────────────────────────────

export async function fetchTikTokTrends(industry: string): Promise<TikTokData> {
  try {
    return await fetchFromGithub(industry)
  } catch (err) {
    console.warn('[tiktok] GitHub JSON fetch failed:', err)
    return { trending_hashtags: [], trending_sounds: [], trending_formats: [], source: 'fallback', fetched_at: new Date().toISOString() }
  }
}
