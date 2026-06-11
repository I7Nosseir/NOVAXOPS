import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI    = !!process.env.GEMINI_API_KEY
const HAS_DB        = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

interface CompetitorSuggestion {
  handle:      string
  platform:    string
  name:        string
  social_url:  string
  positioning: string
  reason:      string
}

interface DiscoverPayload {
  local:  CompetitorSuggestion[]
  global: CompetitorSuggestion[]
}

// Multi-strategy JSON extractor — handles Gemini response variations
function extractDiscoverPayload(raw: string): DiscoverPayload {
  // Strip markdown fences (single and nested)
  const cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Strategy 1: find the outermost { … } object
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object found in AI response. Got: ${cleaned.slice(0, 200)}`)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    throw new Error(`JSON.parse failed. Raw JSON: ${match[0].slice(0, 300)}`)
  }

  // Strategy 2: direct { local, global } shape
  if (Array.isArray(parsed.local) && Array.isArray(parsed.global)) {
    return { local: parsed.local as CompetitorSuggestion[], global: parsed.global as CompetitorSuggestion[] }
  }

  // Strategy 3: { competitors: { local, global } }
  const nested = parsed.competitors as Record<string, unknown> | undefined
  if (nested && Array.isArray(nested.local) && Array.isArray(nested.global)) {
    return { local: nested.local as CompetitorSuggestion[], global: nested.global as CompetitorSuggestion[] }
  }

  // Strategy 4: flat { suggestions: [...] } — split first 3 as local, next 3 as global
  const flat = (parsed.suggestions ?? parsed.competitors) as CompetitorSuggestion[] | undefined
  if (Array.isArray(flat) && flat.length > 0) {
    const withScope = flat as Array<CompetitorSuggestion & { scope?: string }>
    const local  = withScope.filter(s => s.scope === 'local').slice(0, 3)
    const global = withScope.filter(s => s.scope !== 'local').slice(0, 3)
    if (local.length === 0 && global.length === 0) {
      return { local: flat.slice(0, 3), global: flat.slice(3, 6) }
    }
    return { local, global }
  }

  throw new Error(`Unrecognised JSON shape. Keys: ${Object.keys(parsed).join(', ')}`)
}

/**
 * POST /api/competitors/discover
 * Body: { client_id, industry, client_name, audience? }
 *
 * Uses AI to discover exactly 3 local + 3 global competitors.
 * Auto-saves all 6 to competitor_snapshots with scope = 'local' | 'global'.
 * Returns the saved snapshot records so the panel can display them immediately.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; industry?: string; client_name?: string; audience?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, industry, client_name, audience } = body
  if (!client_id)                    return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!industry && !client_name)     return NextResponse.json({ error: 'industry or client_name required' }, { status: 400 })
  if (!HAS_DB)                       return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!HAS_ANTHROPIC && !HAS_GEMINI) return NextResponse.json({ error: 'No AI provider configured' }, { status: 503 })

  // Fetch client brand identity for better context
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clientRow } = await supabase
    .from('clients')
    .select('name, brand_identity_json')
    .eq('id', client_id)
    .single()

  const identity = (clientRow?.brand_identity_json ?? {}) as Record<string, unknown>
  const resolvedIndustry = (identity.industry as string | undefined) ?? industry ?? 'Unknown'
  const resolvedAudience = (identity.target_audience as string | undefined) ?? audience ?? ''
  const resolvedName     = clientRow?.name ?? client_name ?? 'Unknown'
  const platforms        = Array.isArray(identity.platforms) ? (identity.platforms as string[]).join(', ') : 'Instagram, TikTok'

  const prompt = `You are a competitive intelligence expert specialising in social media brand strategy.

CLIENT PROFILE:
- Brand: ${resolvedName}
- Industry / Niche: ${resolvedIndustry}
- Target Audience: ${resolvedAudience || 'Not specified'}
- Active Platforms: ${platforms}

TASK: Identify exactly 6 real competitor brands this client must monitor and benchmark against.

Rules:
1. LOCAL (exactly 3): Brands operating in the same country/region, competing for the same local audience. These are direct rivals the client's customers also consider.
2. GLOBAL (exactly 3): Internationally-recognised benchmark brands in this exact industry. These set the content, aesthetic, and positioning standard the local market aspires to.
3. Every brand MUST be real and verifiable on social media — no made-up accounts.
4. Prioritise brands with strong social media presence (Instagram, TikTok, YouTube).
5. For each competitor provide their real social media handle on their primary platform.

Return ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "local": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "name": "Brand Display Name",
      "social_url": "https://instagram.com/handle",
      "positioning": "One-sentence description of their market positioning and content strategy",
      "reason": "Why the client must specifically watch this competitor"
    }
  ],
  "global": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "name": "Brand Display Name",
      "social_url": "https://instagram.com/handle",
      "positioning": "One-sentence description of their market positioning and content strategy",
      "reason": "Why this global player sets the benchmark for this industry"
    }
  ]
}`

  let payload: DiscoverPayload
  try {
    let raw = ''

    if (HAS_ANTHROPIC) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const ai  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await ai.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1200,
        messages:   [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { maxOutputTokens: 1200 })
    }

    payload = extractDiscoverPayload(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[competitors/discover] AI error:', msg)
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 })
  }

  // Delete existing discovered competitors for this client and replace with new set
  // (re-discovery replaces old AI suggestions; manually-added ones are preserved via notes field)
  await supabase
    .from('competitor_snapshots')
    .delete()
    .eq('client_id', client_id)
    .is('notes', null)

  // Build rows to upsert
  const rows = [
    ...payload.local.slice(0, 3).map(s => ({
      client_id,
      competitor_handle:  s.handle.startsWith('@') ? s.handle : `@${s.handle}`,
      platform:           s.platform.toLowerCase(),
      scope:              'local',
      social_url:         s.social_url ?? null,
      platform_strategy:  s.positioning ?? null,
      followers:          0,
      avg_er:             0,
      posting_frequency:  0,
      top_content_types:  {},
      captured_at:        new Date().toISOString(),
    })),
    ...payload.global.slice(0, 3).map(s => ({
      client_id,
      competitor_handle:  s.handle.startsWith('@') ? s.handle : `@${s.handle}`,
      platform:           s.platform.toLowerCase(),
      scope:              'global',
      social_url:         s.social_url ?? null,
      platform_strategy:  s.positioning ?? null,
      followers:          0,
      avg_er:             0,
      posting_frequency:  0,
      top_content_types:  {},
      captured_at:        new Date().toISOString(),
    })),
  ]

  const { data: saved, error: dbErr } = await supabase
    .from('competitor_snapshots')
    .upsert(rows, { onConflict: 'client_id,competitor_handle,platform' })
    .select()

  if (dbErr) {
    console.error('[competitors/discover] DB upsert error:', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({
    saved:   saved ?? [],
    local:   payload.local.slice(0, 3),
    global:  payload.global.slice(0, 3),
    total:   (saved ?? []).length,
  })
}
