// ============================================================
// TrendsMCP Data Provider
// Source: trendsmcp.ai — covers Google, TikTok, YouTube, Reddit
// and 12+ other platforms in one call.
// Free tier: 100 requests/month. Used as gap-filler only.
// Only called when primary free sources return thin data.
// ============================================================

export interface TrendsMcpData {
  topics: Array<{
    topic: string
    source: string
    growth: string
    category: string
  }>
  raw_count: number
  source: 'trendsmcp' | 'skipped' | 'failed'
  fetched_at: string
}

// ── trendsmcp HTTP API ────────────────────────────────────────
// API docs: https://github.com/trendsmcp/trends-mcp

const BASE_URL = 'https://api.trendsmcp.ai/v1'

interface TrendsMcpTopTrendsResponse {
  trends?: Array<{
    topic?: string
    title?: string
    source?: string
    platform?: string
    growth?: string | number
    category?: string
    volume?: number
  }>
  data?: Array<{
    topic?: string
    title?: string
    source?: string
    growth?: string | number
  }>
  results?: Array<{
    topic?: string
    name?: string
    platform?: string
    growth?: string | number
  }>
}

// ── Industry-to-query map ─────────────────────────────────────
// trendsmcp supports querying by keyword or category

const INDUSTRY_QUERY: Record<string, string> = {
  beauty:      'skincare beauty makeup',
  tech:        'technology AI software',
  food:        'food recipes cooking',
  fitness:     'fitness workout gym',
  finance:     'personal finance investing money',
  fashion:     'fashion style clothing',
  travel:      'travel destinations tourism',
  education:   'education learning online courses',
  real_estate: 'real estate housing property',
  general:     'trending viral social media',
}

// ── Fetch from trendsmcp ──────────────────────────────────────

async function fetchTopTrends(industry: string, limit = 15): Promise<TrendsMcpData> {
  const apiKey = process.env.TRENDSMCP_API_KEY
  if (!apiKey) {
    return { topics: [], raw_count: 0, source: 'skipped', fetched_at: new Date().toISOString() }
  }

  const query = INDUSTRY_QUERY[industry.toLowerCase()] ?? INDUSTRY_QUERY.general

  // Try get_top_trends endpoint first
  const res = await fetch(`${BASE_URL}/top_trends?query=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    throw new Error(`trendsmcp returned ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const json = await res.json() as TrendsMcpTopTrendsResponse

  // Normalise across possible response shapes
  const rawItems = json.trends ?? json.data ?? json.results ?? []

  const topics = rawItems.slice(0, limit).map(item => ({
    topic:    item.topic ?? item.title ?? item.name ?? 'Unknown',
    source:   item.source ?? item.platform ?? 'trendsmcp',
    growth:   String(item.growth ?? 'trending'),
    category: item.category ?? industry,
  }))

  return {
    topics,
    raw_count: topics.length,
    source: 'trendsmcp',
    fetched_at: new Date().toISOString(),
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Call trendsmcp for additional trend signals.
 * Only called as a supplement — primary sources (Google RSS + TikTok JSON)
 * run first. This saves monthly quota.
 *
 * @param industry Industry category string
 * @param onlyIfSparse If true, only call if primary data is thin (< minTopics topics)
 * @param minTopics Minimum topics threshold before calling trendsmcp
 */
export async function fetchTrendsMcp(
  industry: string,
  onlyIfSparse = true,
  primaryTopicsCount = 5,
  minTopics = 4,
): Promise<TrendsMcpData> {
  // Skip if primary data is already sufficient
  if (onlyIfSparse && primaryTopicsCount >= minTopics) {
    return {
      topics: [],
      raw_count: 0,
      source: 'skipped',
      fetched_at: new Date().toISOString(),
    }
  }

  try {
    return await fetchTopTrends(industry)
  } catch (err) {
    console.warn('[trendsmcp] Fetch failed:', err)
    return {
      topics: [],
      raw_count: 0,
      source: 'failed',
      fetched_at: new Date().toISOString(),
    }
  }
}

/**
 * Force call trendsmcp regardless of primary data sufficiency.
 * Used for the 3rd daily call slot when we want cross-platform validation.
 */
export async function fetchTrendsMcpForced(industry: string): Promise<TrendsMcpData> {
  return fetchTrendsMcp(industry, false, 0, 0)
}
