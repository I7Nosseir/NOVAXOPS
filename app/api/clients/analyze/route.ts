import { NextRequest, NextResponse } from 'next/server'

const HAS_DB     = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_CLAUDE = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI = !!process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20'

interface BrandIdentityJson {
  tone_of_voice?: string
  target_audience?: string
  key_messages?: string[]
  industry?: string
  language?: string
  website?: string
  platforms?: string[]
  posts_per_week?: number
  [key: string]: unknown
}

interface IntelResult {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  market_position: string
  growth_score: number
  engagement_trend: string
  content_gap: string[]
  key_insights: string[]
  strategy_90_days: string[]
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function buildPrompt(name: string, brand: BrandIdentityJson, competitors: string[]): string {
  return `You are a senior social media strategist and brand consultant. Analyze the following client brief and generate a comprehensive intelligence report.

CLIENT: ${name}
INDUSTRY: ${brand.industry ?? 'Unknown'}
WEBSITE: ${brand.website ?? 'Not provided'}
PLATFORMS: ${(brand.platforms ?? []).join(', ') || 'Not specified'}
POSTING CADENCE: ${brand.posts_per_week ?? '?'} posts/week
LANGUAGE: ${brand.language ?? 'en'}
TONE OF VOICE: ${brand.tone_of_voice ?? 'Not specified'}
TARGET AUDIENCE: ${brand.target_audience ?? 'Not specified'}
KEY MESSAGES: ${(brand.key_messages ?? []).join(' | ') || 'Not specified'}
KNOWN COMPETITORS: ${competitors.join(', ') || 'None listed'}

Return a JSON object with EXACTLY this structure — no explanation outside the JSON:
{
  "strengths": ["3-5 specific strengths based on the brief"],
  "weaknesses": ["3-5 specific weaknesses or gaps"],
  "opportunities": ["3-5 market opportunities for this brand"],
  "threats": ["3-5 threats or risks to watch"],
  "market_position": "2-3 sentence market position statement",
  "growth_score": <integer 0-100 representing growth potential>,
  "engagement_trend": "e.g. +15% projected MoM based on strategy alignment",
  "content_gap": ["3-5 specific content types or topics not covered"],
  "key_insights": ["3-5 data-backed or strategic insights"],
  "strategy_90_days": ["5-7 specific action items for the next 90 days, each with expected outcome"]
}

Be specific to this client's industry, audience, and competitive context. No hashtags, no emojis.`
}

/**
 * POST /api/clients/analyze
 * Body: { client_id: string, client_data?: { name: string } & BrandIdentityJson & { competitor_context?: string[] } }
 *
 * Accepts inline client_data so it works even before Supabase is fully wired.
 * Uses Claude when available, falls back to Gemini.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; client_data?: { name?: string; competitor_context?: string[] } & BrandIdentityJson }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, client_data } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_CLAUDE && !HAS_GEMINI) {
    return NextResponse.json({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.' }, { status: 503 })
  }

  let clientName: string
  let brand: BrandIdentityJson
  let competitors: string[]
  let supabaseClient: { from: (t: string) => unknown } | null = null

  if (client_data) {
    clientName  = client_data.name ?? 'Unknown Client'
    competitors = client_data.competitor_context ?? []
    const { name: _n, competitor_context: _cc, ...rest } = client_data
    brand = rest as BrandIdentityJson
  } else if (HAS_DB) {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    supabaseClient = sb
    const { data: clientRow, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()
    if (error || !clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    const row = clientRow as Record<string, unknown>
    clientName  = row.name as string
    brand       = (row.brand_identity_json ?? {}) as BrandIdentityJson
    competitors = (row.competitor_context_json ?? []) as string[]
  } else {
    return NextResponse.json({ error: 'Provide client_data in the request body or connect Supabase.' }, { status: 400 })
  }

  const prompt = buildPrompt(clientName, brand, competitors)

  try {
    let rawText: string

    if (HAS_CLAUDE) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const message = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    } else {
      rawText = await callGemini(prompt)
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI returned non-JSON response' }, { status: 500 })

    const intel = JSON.parse(jsonMatch[0]) as IntelResult

    if (supabaseClient && HAS_DB) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb2 = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await sb2.from('clients').update({
        performance_intel: intel,
        performance_analyzed_at: new Date().toISOString(),
      }).eq('id', client_id)
    }

    return NextResponse.json({ intel, analyzed_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
