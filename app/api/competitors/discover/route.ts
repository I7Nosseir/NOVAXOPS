import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI    = !!process.env.GEMINI_API_KEY
const HAS_DB        = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

interface CompetitorSuggestion {
  handle:              string
  platform:            string
  name:                string
  social_url:          string
  positioning:         string
  reason:              string
  threat_level:        'high' | 'medium' | 'low'
  audience_overlap:    string
  content_pillars:     string[]
  dominant_formats:    string[]
  posting_frequency:   string
  estimated_followers: string
  engagement_style:    string
  visual_aesthetic:    string
  key_strengths:       string[]
  exploitable_gaps:    string[]
  signature_hooks:     string[]
  growth_trajectory:   'growing' | 'stable' | 'declining'
  watch_for:           string
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
 * Uses AI to discover 3 local + 3 global competitors with deep intelligence profiles.
 * Auto-saves all 6 to competitor_snapshots. Rich analysis stored in top_content_types JSON.
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clientRow } = await supabase
    .from('clients')
    .select('name, brand_identity_json, organization_id')
    .eq('id', client_id)
    .single()

  const identity         = (clientRow?.brand_identity_json ?? {}) as Record<string, unknown>
  const resolvedIndustry = (identity.industry as string | undefined) ?? industry ?? 'Unknown'
  const resolvedAudience = (identity.target_audience as string | undefined) ?? audience ?? ''
  const resolvedName     = clientRow?.name ?? client_name ?? 'Unknown'
  const platforms        = Array.isArray(identity.platforms) ? (identity.platforms as string[]).join(', ') : 'Instagram, TikTok'
  const toneOfVoice      = (identity.tone_of_voice as string | undefined) ?? ''
  const keyMessages      = Array.isArray(identity.key_messages) ? (identity.key_messages as string[]).join('; ') : ''

  const prompt = `You are a world-class competitive intelligence analyst specialising in social media strategy and brand positioning. Your analysis is used by creative directors and strategists to build winning content strategies.

CLIENT PROFILE:
- Brand: ${resolvedName}
- Industry / Niche: ${resolvedIndustry}
- Target Audience: ${resolvedAudience || 'Not specified'}
- Active Platforms: ${platforms}
- Tone of Voice: ${toneOfVoice || 'Not specified'}
- Key Messages: ${keyMessages || 'Not specified'}

TASK: Conduct a deep competitive intelligence analysis. Identify exactly 6 real competitor brands — 3 local, 3 global — and produce a comprehensive intelligence profile for each.

DEFINITIONS:
- LOCAL (exactly 3): Direct rivals operating in the same country/region competing for the same audience. Customers actively compare these brands to our client.
- GLOBAL (exactly 3): Internationally-recognised benchmark brands in this exact industry/niche. They set the content standard, aesthetic bar, and positioning ceiling the local market aspires to reach.

REQUIREMENTS FOR EACH COMPETITOR PROFILE:
1. Every brand MUST be real, verifiable, and active on social media.
2. Use their primary platform (Instagram or TikTok preferred).
3. threat_level: Assess as 'high' (directly steals audience/budget), 'medium' (partial overlap), or 'low' (aspirational benchmark only).
4. audience_overlap: Specific description of how much and which segment of the client's audience this competitor also targets.
5. content_pillars: Exactly 3-4 recurring content themes/topics they consistently publish around.
6. dominant_formats: Their most-used content formats (e.g. "long-form reels", "educational carousels", "UGC reposts", "behind-the-scenes stories", "product demos").
7. posting_frequency: Realistic estimate (e.g. "5-7x per week", "1-2x daily").
8. estimated_followers: Realistic follower range (e.g. "850K-1.2M", "12K-20K").
9. engagement_style: How their community engages — the emotional register they operate in (e.g. "aspirational lifestyle with high comment sentiment", "educational with saves-heavy engagement", "entertainment-first with heavy sharing").
10. visual_aesthetic: Specific description of their visual identity (colour palette feel, editing style, shot composition, typography).
11. key_strengths: Exactly 3 things they do exceptionally well that the client should study and learn from.
12. exploitable_gaps: Exactly 3 specific weaknesses, blind spots, or underserved content areas where the client has an opening to win.
13. signature_hooks: 2-3 recurring hook patterns or opening formulas they use in their content (e.g. "They always open reels with a bold claim + fast cut", "Lead with a question that triggers FOMO").
14. growth_trajectory: Their current momentum — 'growing', 'stable', or 'declining'.
15. watch_for: One specific strategic move or content trend from this competitor that the client must be ready to counter or adopt within the next 90 days.

Return ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "local": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "name": "Brand Display Name",
      "social_url": "https://instagram.com/handle",
      "positioning": "2-3 sentence description of their market positioning, content strategy, and what makes them distinctive in this space",
      "reason": "Specific reason why the client MUST monitor this competitor — what direct threat or learning opportunity they represent",
      "threat_level": "high",
      "audience_overlap": "Specific description of overlapping audience segment and degree of overlap",
      "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
      "dominant_formats": ["format 1", "format 2", "format 3"],
      "posting_frequency": "X-Y times per week",
      "estimated_followers": "XK-YK",
      "engagement_style": "Description of community engagement pattern and emotional register",
      "visual_aesthetic": "Specific description of visual identity, palette, editing style, composition",
      "key_strengths": ["strength 1", "strength 2", "strength 3"],
      "exploitable_gaps": ["gap 1", "gap 2", "gap 3"],
      "signature_hooks": ["hook pattern 1", "hook pattern 2"],
      "growth_trajectory": "growing",
      "watch_for": "Specific 90-day strategic watch item"
    }
  ],
  "global": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "name": "Brand Display Name",
      "social_url": "https://instagram.com/handle",
      "positioning": "2-3 sentence description of their market positioning, content strategy, and what makes them a global benchmark",
      "reason": "Specific reason why this global player sets the benchmark — what standard they represent that the client must aspire to",
      "threat_level": "low",
      "audience_overlap": "Description of aspirational audience overlap and relevance to client",
      "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
      "dominant_formats": ["format 1", "format 2", "format 3"],
      "posting_frequency": "X-Y times per week",
      "estimated_followers": "XM-YM",
      "engagement_style": "Description of community engagement pattern at global scale",
      "visual_aesthetic": "Specific description of world-class visual identity and production standard",
      "key_strengths": ["strength 1", "strength 2", "strength 3"],
      "exploitable_gaps": ["gap 1", "gap 2", "gap 3"],
      "signature_hooks": ["hook pattern 1", "hook pattern 2"],
      "growth_trajectory": "stable",
      "watch_for": "Specific trend or format innovation from this global player to adopt locally"
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
        max_tokens: 16000,
        messages:   [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { maxOutputTokens: 16000 })
    }

    payload = extractDiscoverPayload(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[competitors/discover] AI error:', msg)
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 })
  }

  await supabase
    .from('competitor_snapshots')
    .delete()
    .eq('client_id', client_id)
    .is('notes', null)

  const organization_id = (clientRow as { organization_id?: string | null } | null)?.organization_id ?? null

  const toRow = (s: CompetitorSuggestion, scope: 'local' | 'global') => ({
    client_id,
    organization_id,
    competitor_handle:  s.handle.startsWith('@') ? s.handle : `@${s.handle}`,
    platform:           s.platform.toLowerCase(),
    scope,
    social_url:         s.social_url ?? null,
    platform_strategy:  s.positioning ?? null,
    followers:          0,
    avg_er:             0,
    posting_frequency:  0,
    // Store full rich analysis in the JSON column
    top_content_types: {
      threat_level:        s.threat_level,
      audience_overlap:    s.audience_overlap,
      content_pillars:     s.content_pillars,
      dominant_formats:    s.dominant_formats,
      posting_frequency:   s.posting_frequency,
      estimated_followers: s.estimated_followers,
      engagement_style:    s.engagement_style,
      visual_aesthetic:    s.visual_aesthetic,
      key_strengths:       s.key_strengths,
      exploitable_gaps:    s.exploitable_gaps,
      signature_hooks:     s.signature_hooks,
      growth_trajectory:   s.growth_trajectory,
      watch_for:           s.watch_for,
      reason:              s.reason,
    },
    captured_at: new Date().toISOString(),
  })

  const rows = [
    ...payload.local.slice(0, 3).map(s => toRow(s, 'local')),
    ...payload.global.slice(0, 3).map(s => toRow(s, 'global')),
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
