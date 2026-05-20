import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

/**
 * POST /api/clients/analyze
 * Body: { client_id: string }
 *
 * Runs Claude opus-grade analysis on the client's brand identity data
 * and generates a full intelligence report (SWOT, market position,
 * content gaps, 90-day strategy).
 * Saves result to clients.performance_intel.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const brand = (client.brand_identity_json ?? {}) as BrandIdentityJson
  const competitors = (client.competitor_context_json ?? []) as string[]

  const prompt = `You are a senior social media strategist and brand consultant. Analyze the following client brief and generate a comprehensive intelligence report.

CLIENT: ${client.name as string}
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

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude returned non-JSON response' }, { status: 500 })

    const intel = JSON.parse(jsonMatch[0]) as IntelResult

    await supabase.from('clients').update({
      performance_intel: intel,
      performance_analyzed_at: new Date().toISOString(),
    }).eq('id', client_id)

    return NextResponse.json({ intel })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
