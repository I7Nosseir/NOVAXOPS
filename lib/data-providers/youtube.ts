// ============================================================
// YouTube Data API v3 Provider
// Uses YOUTUBE_API_KEY if set, otherwise rich mock fallback.
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

// ── Industry mock data ────────────────────────────────────────

interface MockEntry {
  trending_videos: YouTubeData['trending_videos']
  trending_formats: YouTubeData['trending_formats']
}

const MOCK_DATA: Record<string, MockEntry> = {
  beauty: {
    trending_videos: [
      {
        title: 'I tested EVERY viral skincare ingredient — here is what actually works',
        view_count: 4_820_000,
        channel: 'Hyram',
        published_at: '2026-05-28T14:00:00Z',
        format_type: 'Educational deep-dive',
      },
      {
        title: 'The skincare routine dermatologists actually use on themselves',
        view_count: 3_140_000,
        channel: 'Dr. Dray',
        published_at: '2026-05-25T16:00:00Z',
        format_type: 'Authority interview',
      },
      {
        title: '6 months of skin cycling — honest unsponsored results',
        view_count: 2_670_000,
        channel: 'Doctorly',
        published_at: '2026-05-22T12:00:00Z',
        format_type: 'Long-term experiment',
      },
      {
        title: 'I built a complete skincare routine for under $30 and it outperformed my luxury stash',
        view_count: 2_210_000,
        channel: 'Cassandra Bankson',
        published_at: '2026-05-20T14:00:00Z',
        format_type: 'Budget challenge',
      },
    ],
    trending_formats: [
      {
        format: 'Ingredient science breakdown (8-15 min)',
        avg_view_count: 2_400_000,
        why_working: 'Audiences want evidence-based reasons to justify purchases — authority + education satisfies both',
      },
      {
        format: 'Long-term before/after experiment (30-90 days)',
        avg_view_count: 1_980_000,
        why_working: 'Commitment content builds trust and follow-through watch time — retention above 70%',
      },
      {
        format: 'Duet/response to viral claim',
        avg_view_count: 1_650_000,
        why_working: 'Rides existing viral traffic while positioning creator as the authoritative corrective voice',
      },
    ],
  },
  tech: {
    trending_videos: [
      {
        title: 'I replaced my $4,000 MacBook Pro with a $600 Windows laptop — 90-day honest verdict',
        view_count: 6_340_000,
        channel: 'Linus Tech Tips',
        published_at: '2026-05-29T18:00:00Z',
        format_type: 'Long-term comparison experiment',
      },
      {
        title: 'The 10 AI tools that actually replaced human tasks in my workflow',
        view_count: 4_980_000,
        channel: 'MKBHD',
        published_at: '2026-05-26T14:00:00Z',
        format_type: 'Practical AI showcase',
      },
      {
        title: 'I built my entire home office for under $800 — everything I bought and why',
        view_count: 3_760_000,
        channel: 'Ali Abdaal',
        published_at: '2026-05-24T12:00:00Z',
        format_type: 'Setup guide with pricing',
      },
    ],
    trending_formats: [
      {
        format: 'Long-term product experiment (90+ days)',
        avg_view_count: 4_200_000,
        why_working: 'Viewers want buying confidence — real-world testing over time delivers it better than any review',
      },
      {
        format: '"I switched to X for 30 days" challenge',
        avg_view_count: 3_100_000,
        why_working: 'Natural narrative arc drives completion rate — audiences follow to see if the creator survives',
      },
      {
        format: 'Workflow showcase with screen recording',
        avg_view_count: 2_400_000,
        why_working: 'Practical applicability signals — viewers immediately see themselves using the same setup',
      },
    ],
  },
  food: {
    trending_videos: [
      {
        title: 'I tested every method for the perfect smash burger — the winner surprised me',
        view_count: 5_120_000,
        channel: 'Joshua Weissman',
        published_at: '2026-05-27T16:00:00Z',
        format_type: 'Method comparison',
      },
      {
        title: 'High protein meal prep for the entire week — 150g protein every day',
        view_count: 3_870_000,
        channel: 'Ethan Chlebowski',
        published_at: '2026-05-24T14:00:00Z',
        format_type: 'Practical meal prep guide',
      },
      {
        title: 'I ate like a French person for 30 days — what happened to my weight and energy',
        view_count: 2_940_000,
        channel: 'Sorted Food',
        published_at: '2026-05-21T12:00:00Z',
        format_type: 'Cultural experiment',
      },
    ],
    trending_formats: [
      {
        format: 'Science-based cooking explanation (why not just how)',
        avg_view_count: 3_600_000,
        why_working: 'Teaching the underlying principle creates skill transfer — viewers trust the creator beyond the single recipe',
      },
      {
        format: 'Budget challenge (X meals for $Y)',
        avg_view_count: 2_800_000,
        why_working: 'Economic pressure is universal — budget constraints create both problem-solution tension and immediate relatability',
      },
      {
        format: 'Cross-cultural comparison (same dish, different countries)',
        avg_view_count: 2_200_000,
        why_working: 'Conflict + curiosity loop — audiences debate which version is correct in comments, driving engagement',
      },
    ],
  },
  fitness: {
    trending_videos: [
      {
        title: 'I trained exactly like a Navy SEAL for 30 days — here is what broke me',
        view_count: 7_240_000,
        channel: 'David Goggins Official',
        published_at: '2026-05-28T16:00:00Z',
        format_type: 'Extreme challenge documentary',
      },
      {
        title: 'The only 5 exercises you need — everything else is optional according to science',
        view_count: 4_380_000,
        channel: 'Jeff Nippard',
        published_at: '2026-05-25T14:00:00Z',
        format_type: 'Science-based simplification',
      },
      {
        title: 'Why 90% of gym-goers are wasting their time (and what to do instead)',
        view_count: 3_960_000,
        channel: 'Renaissance Periodization',
        published_at: '2026-05-22T12:00:00Z',
        format_type: 'Contrarian authority piece',
      },
    ],
    trending_formats: [
      {
        format: 'Science simplified (research → practical application)',
        avg_view_count: 3_800_000,
        why_working: 'Credibility + accessibility combination — audiences feel smart and empowered by actionable science',
      },
      {
        format: 'Extreme experiment (train like elite athlete)',
        avg_view_count: 5_200_000,
        why_working: 'Vicarious experience — viewers get the story without the pain, completion rates are highest in this format',
      },
      {
        format: 'Common mistake breakdown with fixes',
        avg_view_count: 2_900_000,
        why_working: 'Everyone watching suspects they are doing something wrong — confirmation + solution is an irresistible hook',
      },
    ],
  },
  finance: {
    trending_videos: [
      {
        title: 'I gave myself 90 days to fix my finances — full honest breakdown of what changed',
        view_count: 4_610_000,
        channel: 'Graham Stephan',
        published_at: '2026-05-29T18:00:00Z',
        format_type: 'Personal challenge documentary',
      },
      {
        title: 'Index funds explained in 8 minutes — why 99% of professional fund managers lose to them',
        view_count: 3_420_000,
        channel: 'Andrei Jikh',
        published_at: '2026-05-26T14:00:00Z',
        format_type: 'Concept simplification with data',
      },
      {
        title: 'My net worth journey from $0 to $1M — every mistake and every turning point',
        view_count: 2_890_000,
        channel: 'Financial Tortoise',
        published_at: '2026-05-23T12:00:00Z',
        format_type: 'Journey documentary',
      },
    ],
    trending_formats: [
      {
        format: 'Personal journey with data and milestones',
        avg_view_count: 3_200_000,
        why_working: 'Social proof meets aspiration — real numbers from a real person create believable inspiration',
      },
      {
        format: 'Counter-narrative (why conventional advice is wrong)',
        avg_view_count: 2_700_000,
        why_working: 'Financial misinformation is rampant — audiences actively seek the corrective take',
      },
      {
        format: 'Concept simplified with visual aids',
        avg_view_count: 2_100_000,
        why_working: 'Financial concepts feel inaccessible — simplification + visual metaphor reduces perceived complexity',
      },
    ],
  },
  real_estate: {
    trending_videos: [
      {
        title: 'I bought my first investment property at 24 — everything that went wrong',
        view_count: 5_890_000,
        channel: 'Graham Stephan',
        published_at: '2026-05-27T16:00:00Z',
        format_type: 'Personal story with lessons',
      },
      {
        title: 'What $1M buys you in 10 different cities right now',
        view_count: 4_230_000,
        channel: 'Meet Kevin',
        published_at: '2026-05-24T14:00:00Z',
        format_type: 'Comparison showcase',
      },
      {
        title: 'The truth about real estate agents — what they are incentivized to hide',
        view_count: 3_140_000,
        channel: 'Bigger Pockets',
        published_at: '2026-05-21T12:00:00Z',
        format_type: 'Industry exposé',
      },
    ],
    trending_formats: [
      {
        format: 'Market comparison (same budget, different cities/countries)',
        avg_view_count: 3_800_000,
        why_working: 'Immediate relatability and curiosity — viewers always compare to their own market and debate in comments',
      },
      {
        format: 'Honest mistake retrospective',
        avg_view_count: 3_200_000,
        why_working: 'Admission of failure is rare in wealth content — it creates trust and high completion rates',
      },
      {
        format: 'Process walkthrough (buying step-by-step with real costs)',
        avg_view_count: 2_600_000,
        why_working: 'High-stakes process anxiety is universal — complete information reduces fear and builds credibility',
      },
    ],
  },
}

const DEFAULT_MOCK = MOCK_DATA.beauty

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

  const mockEntry = MOCK_DATA[industry.toLowerCase()] ?? DEFAULT_MOCK

  const trending_formats: YouTubeData['trending_formats'] = Object.entries(formatCounts)
    .sort((a, b) => b[1].total_views / b[1].count - a[1].total_views / a[1].count)
    .slice(0, 3)
    .map(([format, stats]) => ({
      format,
      avg_view_count: Math.round(stats.total_views / stats.count),
      why_working: mockEntry.trending_formats.find((f) => f.format.toLowerCase().includes(format.toLowerCase()))?.why_working
        ?? 'High audience retention and engagement signals from platform algorithm data',
    }))

  return {
    trending_videos: trending_videos.slice(0, 4),
    trending_formats: trending_formats.length ? trending_formats : mockEntry.trending_formats,
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
      console.warn('[youtube] API fetch failed, using fallback:', err)
    }
  }

  const mock = MOCK_DATA[industry.toLowerCase()] ?? DEFAULT_MOCK
  return {
    ...mock,
    source: 'fallback',
    fetched_at: new Date().toISOString(),
  }
}
