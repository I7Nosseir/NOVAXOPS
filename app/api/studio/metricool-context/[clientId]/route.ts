import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MetricoolContext } from '@/lib/studio-types'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── In-memory cache (4-hour TTL) ─────────────────────────────

interface CacheEntry {
  data: MetricoolContext
  expires_at: number
}

const CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

function getCached(clientId: string): MetricoolContext | null {
  const entry = CACHE.get(clientId)
  if (!entry) return null
  if (Date.now() > entry.expires_at) {
    CACHE.delete(clientId)
    return null
  }
  return entry.data
}

function setCache(clientId: string, data: MetricoolContext): void {
  CACHE.set(clientId, { data, expires_at: Date.now() + CACHE_TTL_MS })
}

// ── Industry benchmarks ───────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, number> = {
  beauty: 3.2,
  tech: 2.1,
  food: 4.1,
  fitness: 3.8,
  finance: 1.9,
  fashion: 3.5,
  travel: 2.8,
  real_estate: 1.7,
  default: 2.5,
}

// ── Metricool API integration ─────────────────────────────────

interface MetricoolPost {
  postId: string
  network: string
  publicationDate: string
  reach?: number
  impressions?: number
  interactions?: number
  saved?: number
  shared?: number
  comments?: number
  engagementRate?: number
  type?: string
}

async function fetchFromMetricool(blogId: string): Promise<MetricoolPost[]> {
  const token = process.env.METRICOOL_API_TOKEN!
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

  const response = await fetch(
    `https://app.metricool.com/api/v2/analytics/posts?blogId=${blogId}&initDate=${startDate}&endDate=${endDate}&maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) throw new Error(`Metricool returned ${response.status}`)

  const data = await response.json()
  return data.data ?? []
}

function classifyHookType(title?: string): string {
  if (!title) return 'unknown'
  const t = title.toLowerCase()
  if (t.startsWith('how') || t.includes('guide') || t.includes('tutorial')) return 'educational'
  if (t.includes('?')) return 'curiosity'
  if (t.includes('never') || t.includes('stop') || t.includes('wrong')) return 'contradiction'
  if (t.includes('why') && t.includes("doesn't")) return 'authority'
  if (t.includes('transformation') || t.includes('before') || t.includes('after')) return 'transformation'
  return 'statement'
}

async function buildContextFromMetricool(clientId: string): Promise<MetricoolContext> {
  // Look up the client's Metricool blogId from DB
  const db = adminSupabase()
  const { data: client } = await db
    .from('clients')
    .select('metricool_blog_id, brand_identity_json')
    .eq('id', clientId)
    .single()

  const blogId: string | null = client?.metricool_blog_id ?? null
  const industry: string = client?.brand_identity_json?.industry?.toLowerCase().split(' ')[0] ?? 'default'

  if (!blogId || !process.env.METRICOOL_API_TOKEN) {
    // Cold start
    return buildColdStartContext(clientId, industry)
  }

  const posts = await fetchFromMetricool(blogId)

  // Filter posts with engagement rate data
  const postsWithER = posts.filter((p) => typeof p.engagementRate === 'number')

  if (postsWithER.length < 7) {
    return buildColdStartContext(clientId, industry, postsWithER.length)
  }

  // Sort by ER
  const sorted = [...postsWithER].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
  const top = sorted.slice(0, 5)
  const worst = sorted.slice(-5).reverse()

  const avgER =
    postsWithER.reduce((sum, p) => sum + (p.engagementRate ?? 0), 0) / postsWithER.length

  // Best format detection
  const formatERMap: Record<string, number[]> = {}
  postsWithER.forEach((p) => {
    const fmt = p.type ?? 'post'
    if (!formatERMap[fmt]) formatERMap[fmt] = []
    formatERMap[fmt].push(p.engagementRate ?? 0)
  })
  const bestFormat = Object.entries(formatERMap)
    .map(([fmt, ers]) => ({ fmt, avg: ers.reduce((s, e) => s + e, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.fmt ?? 'reel'

  // Best posting time detection
  const timeERMap: Record<string, number[]> = {}
  postsWithER.forEach((p) => {
    if (!p.publicationDate) return
    const hour = new Date(p.publicationDate).getHours()
    const slot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
    if (!timeERMap[slot]) timeERMap[slot] = []
    timeERMap[slot].push(p.engagementRate ?? 0)
  })
  const bestTimeSlot = Object.entries(timeERMap)
    .map(([slot, ers]) => ({ slot, avg: ers.reduce((s, e) => s + e, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.slot ?? 'evening'

  // Derive observed pattern
  const topHookTypes = top.map((p) => classifyHookType())
  const dominantType = topHookTypes.reduce(
    (acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )
  const topType = Object.entries(dominantType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'educational'

  const observedPattern = `${topType} hooks on ${bestFormat} format in the ${bestTimeSlot} outperform other combinations for this client`

  const industryAvgER = INDUSTRY_BENCHMARKS[industry] ?? INDUSTRY_BENCHMARKS.default

  return {
    client_id: clientId,
    data_available: true,
    days_of_history: Math.ceil(
      (Date.now() - new Date(postsWithER[postsWithER.length - 1]?.publicationDate ?? Date.now()).getTime()) / 86400000
    ),
    best_format: bestFormat,
    best_posting_time: `${bestTimeSlot} (7–9pm)`,
    avg_engagement_rate: Math.round(avgER * 100) / 100,
    industry_avg_er: industryAvgER,
    top_posts: top.map((p) => ({
      post_id: p.postId,
      format: p.type ?? 'post',
      hook_type: classifyHookType(),
      er: Math.round((p.engagementRate ?? 0) * 100) / 100,
      posted_at: p.publicationDate,
    })),
    worst_posts: worst.map((p) => ({
      post_id: p.postId,
      format: p.type ?? 'post',
      hook_type: classifyHookType(),
      er: Math.round((p.engagementRate ?? 0) * 100) / 100,
      posted_at: p.publicationDate,
    })),
    observed_pattern: observedPattern,
    cold_start: false,
    cache_hit: false,
    fetched_at: new Date().toISOString(),
  }
}

function buildColdStartContext(clientId: string, industry = 'default', existingDays = 0): MetricoolContext {
  const industryAvgER = INDUSTRY_BENCHMARKS[industry] ?? INDUSTRY_BENCHMARKS.default
  return {
    client_id: clientId,
    data_available: false,
    days_of_history: existingDays,
    best_format: 'reel',
    best_posting_time: 'Thursday 7–9pm (industry benchmark)',
    avg_engagement_rate: 0,
    industry_avg_er: industryAvgER,
    top_posts: [],
    worst_posts: [],
    observed_pattern:
      `No performance history available. All recommendations below are based on ${industry} industry benchmarks, not this client's own data.`,
    cold_start: true,
    cache_hit: false,
    fetched_at: new Date().toISOString(),
  }
}

// ── Rich mock context ─────────────────────────────────────────

function buildMockContext(clientId: string): MetricoolContext {
  const now = new Date().toISOString()
  return {
    client_id: clientId,
    data_available: true,
    days_of_history: 90,
    best_format: 'reel',
    best_posting_time: 'Thursday 7pm',
    avg_engagement_rate: 5.2,
    industry_avg_er: 3.2,
    top_posts: [
      { post_id: 'mock-post-1', format: 'reel', hook_type: 'curiosity', er: 8.4, posted_at: '2026-05-15T19:00:00Z' },
      { post_id: 'mock-post-2', format: 'reel', hook_type: 'contradiction', er: 7.1, posted_at: '2026-05-08T19:00:00Z' },
      { post_id: 'mock-post-3', format: 'carousel', hook_type: 'educational', er: 6.8, posted_at: '2026-05-01T19:00:00Z' },
      { post_id: 'mock-post-4', format: 'reel', hook_type: 'curiosity', er: 6.2, posted_at: '2026-04-24T19:00:00Z' },
      { post_id: 'mock-post-5', format: 'reel', hook_type: 'transformation', er: 5.9, posted_at: '2026-04-17T19:00:00Z' },
    ],
    worst_posts: [
      { post_id: 'mock-post-18', format: 'static', hook_type: 'authority', er: 1.2, posted_at: '2026-04-20T10:00:00Z' },
      { post_id: 'mock-post-17', format: 'static', hook_type: 'authority', er: 1.5, posted_at: '2026-04-13T10:00:00Z' },
      { post_id: 'mock-post-16', format: 'carousel', hook_type: 'authority', er: 1.8, posted_at: '2026-04-06T11:00:00Z' },
      { post_id: 'mock-post-15', format: 'static', hook_type: 'statement', er: 2.1, posted_at: '2026-03-30T09:00:00Z' },
      { post_id: 'mock-post-14', format: 'static', hook_type: 'statement', er: 2.3, posted_at: '2026-03-23T09:00:00Z' },
    ],
    observed_pattern:
      'Curiosity and contradiction hooks on Reel format outperform static posts with authority hooks 3.1x for this client. Thursday 7pm is the consistent peak window.',
    cold_start: false,
    cache_hit: false,
    fetched_at: now,
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  // Cache hit
  const cached = getCached(clientId)
  if (cached) {
    return NextResponse.json({ ...cached, cache_hit: true })
  }

  if (!HAS_DB) {
    const mock = buildMockContext(clientId)
    setCache(clientId, mock)
    return NextResponse.json({ ...mock, _mock: true })
  }

  try {
    const context = await buildContextFromMetricool(clientId)
    setCache(clientId, context)
    return NextResponse.json(context)
  } catch (err) {
    console.error('[metricool-context] Error:', err)
    const fallback = buildMockContext(clientId)
    return NextResponse.json({ ...fallback, _error: 'fetch_failed', _mock: true })
  }
}
