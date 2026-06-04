import { NextRequest, NextResponse } from 'next/server'
import { buildReportPrompt } from '@/lib/report-prompts'
import { CLIENTS } from '@/lib/mock-data'

const GEMINI_MODEL = 'gemini-3-flash-preview'
const HAS_METRICOOL = !!(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID)
const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Metricool data fetcher ───────────────────────────────────────────────────

type PlatformRow = {
  platform: string; reach: number; impressions: number; likes: number
  comments: number; shares: number; saves: number; posts: number; engagement_rate: number
}
type TrendPoint = { month: string; reach: number; impressions: number; er: number }

type MetricoolData = {
  stats: Record<string, number>
  platforms: PlatformRow[]
  trend: TrendPoint[]
  isMock: boolean
  error?: string
}

const EMPTY: MetricoolData = { stats: {}, platforms: [], trend: [], isMock: false }

type TopPost = {
  id?: string
  network?: string
  publishDate?: string
  url?: string
  text?: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
}

async function fetchMetricoolData(
  blogId: string,
  startDate: string,
  endDate: string,
  networks?: string[]
): Promise<MetricoolData> {
  if (!HAS_METRICOOL) {
    return { ...EMPTY, isMock: true, error: 'Metricool not configured — add METRICOOL_API_TOKEN and METRICOOL_USER_ID in Settings.' }
  }

  const { getStats, getPlatformStats } = await import('@/lib/metricool')

  try {
    const [stats, platforms] = await Promise.all([
      getStats(blogId, startDate, endDate, networks) as Promise<Record<string, number>>,
      getPlatformStats(blogId, startDate, endDate, networks),
    ])

    // 5-month trend — sequential to respect Metricool rate limits
    const trend: TrendPoint[] = []
    const endDt = new Date(endDate)
    for (let i = 4; i >= 0; i--) {
      const d = new Date(endDt.getFullYear(), endDt.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const s = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const e = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
      const ms = await getStats(blogId, s, e, networks).catch(() => null) as Record<string, number> | null
      trend.push({
        month:       d.toLocaleString('en', { month: 'short' }),
        reach:       Number(ms?.reach ?? 0),
        impressions: Number(ms?.impressions ?? 0),
        er:          Number(ms?.engagement_rate ?? 0),
      })
    }

    return { stats, platforms, trend, isMock: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Metricool fetch failed'
    return { ...EMPTY, isMock: false, error: msg }
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

function prevPeriodDates(startDate: string, endDate: string, reportType: string): { prevStart: string; prevEnd: string } {
  const sd = new Date(startDate)
  const ed = new Date(endDate)
  const diffDays = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1
  // For monthly/platform/paid/combined/executive: go back one month
  // For quarterly: go back 3 months (same number of days in range)
  const isQuarterly = reportType === 'quarterly'
  const shiftMonths = isQuarterly ? 3 : 1
  const ps = new Date(sd.getFullYear(), sd.getMonth() - shiftMonths, sd.getDate())
  const pe = new Date(ed.getFullYear(), ed.getMonth() - shiftMonths, ed.getDate())
  // Clamp day to last day of month if shifted date overflows (e.g. May 31 → Feb 28)
  const psLast = new Date(ps.getFullYear(), ps.getMonth() + 1, 0).getDate()
  const peLast = new Date(pe.getFullYear(), pe.getMonth() + 1, 0).getDate()
  const psDay = Math.min(ps.getDate(), psLast)
  const peDay = Math.min(pe.getDate(), peLast)
  void diffDays
  return {
    prevStart: `${ps.getFullYear()}-${String(ps.getMonth() + 1).padStart(2, '0')}-${String(psDay).padStart(2, '0')}`,
    prevEnd:   `${pe.getFullYear()}-${String(pe.getMonth() + 1).padStart(2, '0')}-${String(peDay).padStart(2, '0')}`,
  }
}

export async function POST(req: NextRequest) {
  let body: { clientId?: string; reportType?: string; startDate?: string; endDate?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { clientId, reportType = 'monthly', startDate, endDate, platforms } = body as typeof body & { platforms?: string[] }

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'clientId, startDate, and endDate are required.' },
      { status: 400 }
    )
  }

  // 1. Resolve client info
  const client = await resolveClient(clientId)

  // 2. Determine blog ID
  const blogId = client.metricoolBlogId ?? clientId

  // 3. Fetch current + previous period data in parallel (filtered to selected platforms)
  const { prevStart, prevEnd } = prevPeriodDates(startDate, endDate, reportType)
  const nets = platforms?.length ? platforms : undefined

  const topPostsPromise: Promise<TopPost[]> = HAS_METRICOOL
    ? (async (): Promise<TopPost[]> => {
        const { getTopPosts } = await import('@/lib/metricool')
        const posts = await getTopPosts(blogId, startDate, endDate, nets ?? undefined).catch(() => [])
        return posts.map(p => ({
          id: p.id,
          network: p.network,
          publishDate: p.publishDate,
          url: p.url,
          text: p.text ?? p.title,
          reach: p.reach ?? 0,
          impressions: p.impressions ?? 0,
          likes: p.likes ?? 0,
          comments: p.comments ?? 0,
          shares: p.shares ?? 0,
          saves: p.saves ?? 0,
        }))
      })()
    : Promise.resolve([])

  const [metricoolData, prevData, topPosts] = await Promise.all([
    fetchMetricoolData(blogId, startDate, endDate, nets),
    fetchMetricoolData(blogId, prevStart, prevEnd, nets).catch(() => null),
    topPostsPromise,
  ])

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
    prevStats: prevData?.stats ?? null,
    platforms: metricoolData.platforms,
    trend: metricoolData.trend,
    topPosts,
    meta: {
      period: `${startDate} to ${endDate}`,
      prevPeriod: `${prevStart} to ${prevEnd}`,
      clientName: client.name,
      reportType,
      isMock: metricoolData.isMock,
    },
    _mock: metricoolData.isMock,
    error: metricoolData.error ?? undefined,
    _geminiError: geminiError ?? undefined,
  })
}
