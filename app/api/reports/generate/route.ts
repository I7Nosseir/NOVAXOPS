import { NextRequest, NextResponse } from 'next/server'
import { buildReportPrompt } from '@/lib/report-prompts'
import { CLIENTS } from '@/lib/mock-data'

const GEMINI_MODEL = 'gemini-3-flash-preview'
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)
const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_STATS: Record<string, number> = {
  reach: 284500, impressions: 412000, engagement_rate: 5.8,
  likes: 18200, comments: 6840, shares: 12400, saves: 18400,
  followers: 2840, clicks: 8400, posts: 34,
}

const MOCK_PLATFORMS = [
  { platform: 'instagram', reach: 168000, impressions: 243000, likes: 11400, comments: 4200, shares: 7100, saves: 12300, posts: 18, engagement_rate: 6.8 },
  { platform: 'tiktok',    reach: 71000,  impressions: 98000,  likes: 4800,  comments: 1800, shares: 3600, saves: 4200,  posts: 7,  engagement_rate: 9.1 },
  { platform: 'facebook',  reach: 28200,  impressions: 41000,  likes: 1400,  comments: 520,  shares: 980,  saves: 800,   posts: 6,  engagement_rate: 3.4 },
  { platform: 'linkedin',  reach: 17300,  impressions: 30000,  likes: 600,   comments: 320,  shares: 720,  saves: 1100,  posts: 3,  engagement_rate: 4.2 },
]

const MOCK_TREND = [
  { month: 'Jan', reach: 182000, impressions: 264000, er: 4.8 },
  { month: 'Feb', reach: 198000, impressions: 287000, er: 5.1 },
  { month: 'Mar', reach: 224000, impressions: 326000, er: 5.4 },
  { month: 'Apr', reach: 241000, impressions: 349000, er: 5.0 },
  { month: 'May', reach: 284500, impressions: 412000, er: 5.8 },
]

// ─── Metricool data fetcher ───────────────────────────────────────────────────

type MetricoolData = {
  stats: Record<string, number>
  platforms: typeof MOCK_PLATFORMS
  trend: typeof MOCK_TREND
  isMock: boolean
}

async function fetchMetricoolData(
  blogId: string,
  startDate: string,
  endDate: string
): Promise<MetricoolData> {
  if (!HAS_METRICOOL) {
    return { stats: MOCK_STATS, platforms: MOCK_PLATFORMS, trend: MOCK_TREND, isMock: true }
  }

  const { getStats } = await import('@/lib/metricool')
  const token  = process.env.METRICOOL_API_TOKEN!
  const userId = process.env.METRICOOL_USER_ID!
  const BASE   = 'https://app.metricool.com/api/v2'

  try {
    const stats = await getStats(blogId, startDate, endDate) as Record<string, number>

    // Per-platform breakdown
    let platforms: typeof MOCK_PLATFORMS = []
    const platformList = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']
    const platformResults = await Promise.allSettled(
      platformList.map(async (p) => {
        const res = await fetch(
          `${BASE}/analytics/summary?userId=${userId}&blogId=${blogId}&startDate=${startDate}&endDate=${endDate}&network=${p}`,
          { headers: { 'X-Mc-Auth': token, Accept: 'application/json' } }
        )
        if (!res.ok) return null
        const raw = await res.json() as Record<string, unknown>
        const d = (raw.data ?? raw[p] ?? raw) as Record<string, number>
        const reach = (d.reach ?? 0) as number
        const impressions = (d.impressions ?? 0) as number
        if (!reach && !impressions) return null
        return {
          platform: p,
          reach,
          impressions,
          likes: (d.likes ?? 0) as number,
          comments: (d.comments ?? 0) as number,
          shares: (d.shares ?? 0) as number,
          saves: (d.saves ?? 0) as number,
          posts: (d.posts ?? d.postsCount ?? 0) as number,
          engagement_rate: (d.engagement_rate ?? d.engagement ?? 0) as number,
        }
      })
    )
    platforms = platformResults
      .filter((r): r is PromiseFulfilledResult<(typeof MOCK_PLATFORMS)[0]> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value)

    // 5-month trend — one call per month, most recent 5 months
    const trend: typeof MOCK_TREND = []
    const endDt = new Date(endDate)
    for (let i = 4; i >= 0; i--) {
      const d = new Date(endDt.getFullYear(), endDt.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const s = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const e = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
      const ms = await getStats(blogId, s, e).catch(() => null) as Record<string, number> | null
      trend.push({
        month: d.toLocaleString('en', { month: 'short' }),
        reach: ms?.reach ?? 0,
        impressions: ms?.impressions ?? 0,
        er: ms?.engagement_rate ?? 0,
      })
    }

    return { stats, platforms, trend, isMock: false }
  } catch {
    return { stats: MOCK_STATS, platforms: MOCK_PLATFORMS, trend: MOCK_TREND, isMock: true }
  }
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Gemini ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ─── Section parser ───────────────────────────────────────────────────────────
// Maps Gemini ### Header names to narrative keys used by the frontend.

const SECTION_KEY_MAP: Record<string, string> = {
  'executive summary':            'executive',
  'reach & impressions analysis': 'reach',
  'reach and impressions analysis': 'reach',
  'engagement analysis':          'engagement',
  'platform performance':         'platform',
  'trend analysis':               'trend',
  'audience insights':            'audience',
  'follower growth & reach':      'follower',
  'follower growth and reach':    'follower',
  'content performance patterns': 'formats',
  'format performance':           'formats',
  'organic reach & efficiency':   'reach',
  'organic reach and efficiency': 'reach',
  'engagement quality':           'engagement',
  'platform distribution':        'platform',
  'channel mix analysis':         'channel',
  'paid vs organic synergy':      'synergy',
  'paid vs organic':              'synergy',
  'organic performance analysis': 'reach',
  'quarterly performance overview': 'quarterly_overview',
  'month-by-month analysis':      'monthly_breakdown',
  'growth analysis':              'trend',
  'portfolio overview':           'portfolio',
  'performance highlights':       'highlights',
  'audience & engagement quality': 'audience',
  'audience and engagement quality': 'audience',
  'campaign analysis':            'channel',
  'spend & efficiency':           'efficiency',
  'spend and efficiency':         'efficiency',
  'creative performance':         'creative',
}

function parseSections(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  // Split on lines starting with ###
  const parts = text.split(/\n(?=###\s)/)
  for (const part of parts) {
    const firstLine = part.split('\n')[0].replace(/^###\s*/, '').trim()
    const body = part.split('\n').slice(1).join('\n').trim()
    if (!firstLine || !body) continue
    const normalised = firstLine.toLowerCase().replace(/\*/g, '').trim()
    // Exact key lookup first
    const key = SECTION_KEY_MAP[normalised]
    if (key) {
      result[key] = body
    } else {
      // Partial match — find first map key that the normalised header contains or starts with
      for (const [mapKey, mapVal] of Object.entries(SECTION_KEY_MAP)) {
        if (normalised.includes(mapKey) || mapKey.includes(normalised)) {
          result[mapVal] = body
          break
        }
      }
    }
  }
  return result
}

// ─── Client resolver ──────────────────────────────────────────────────────────

async function resolveClient(clientId: string): Promise<{
  name: string
  metricoolBlogId: string | null
  brand?: { industry?: string; tone?: string }
}> {
  if (HAS_DB) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: client } = await supabase
        .from('clients')
        .select('name, metricool_blog_id, brand_identity_json')
        .eq('id', clientId)
        .single()
      if (client) {
        const brand = (client.brand_identity_json as Record<string, unknown> | null) ?? {}
        return {
          name: client.name as string,
          metricoolBlogId: (client.metricool_blog_id as string | null) ?? null,
          brand: {
            industry: brand.industry as string | undefined,
            tone:     (brand.tone ?? brand.brand_voice) as string | undefined,
          },
        }
      }
    } catch { /* fall through to mock lookup */ }
  }

  // Mock data fallback
  const mock = CLIENTS.find(c => c.id === clientId)
  if (mock) {
    return {
      name: mock.name,
      metricoolBlogId: (mock as unknown as Record<string, unknown>).metricool_blog_id as string | null ?? null,
      brand: {
        industry: mock.brand_identity?.industry,
        tone:     mock.brand_identity?.tone_of_voice,
      },
    }
  }

  return { name: 'Client', metricoolBlogId: null }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { clientId?: string; reportType?: string; startDate?: string; endDate?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { clientId, reportType = 'monthly', startDate, endDate } = body

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'clientId, startDate, and endDate are required.' },
      { status: 400 }
    )
  }

  // 1. Resolve client info
  const client = await resolveClient(clientId)

  // 2. Determine blog ID — use client's metricoolBlogId if available
  const blogId = client.metricoolBlogId ?? clientId

  // 3. Fetch Metricool data
  const metricoolData = await fetchMetricoolData(blogId, startDate, endDate)

  // 4. Build and run Gemini prompt (if API key configured)
  let narrative: Record<string, string> = {}
  let geminiError: string | null = null

  if (process.env.GEMINI_API_KEY) {
    try {
      const period = `${startDate} to ${endDate}`
      const prompt = buildReportPrompt(
        reportType,
        metricoolData,
        client.name,
        period,
        client.brand
      )
      const raw = await callGemini(prompt)
      narrative = parseSections(raw)
    } catch (err) {
      geminiError = err instanceof Error ? err.message : 'AI generation failed'
    }
  } else {
    geminiError = 'GEMINI_API_KEY not configured — showing data without AI narrative'
  }

  return NextResponse.json({
    narrative,
    stats: metricoolData.stats,
    platforms: metricoolData.platforms,
    trend: metricoolData.trend,
    meta: {
      period: `${startDate} to ${endDate}`,
      clientName: client.name,
      reportType,
      generatedAt: new Date().toISOString(),
      isMock: metricoolData.isMock,
    },
    _mock: metricoolData.isMock,
    _geminiError: geminiError ?? undefined,
  })
}
