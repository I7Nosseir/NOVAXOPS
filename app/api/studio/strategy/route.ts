// ============================================================
// POST /api/studio/strategy
// Single-call social media strategy generator.
// Output matches the Esplanade Q1/Q2 presentation format:
//   positioning · campaign line · content pillars · strategy arc ·
//   platform roles · monthly tactics · format roles · tenant integration · flow beats
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'
import type { StrategyDocument } from '@/lib/studio-types'

export const maxDuration = 120

interface StrategyRequest {
  client_id?: string
  client_name: string
  industry?: string
  brand_voice?: string
  key_messages?: string[]
  competitors?: string[]
  platforms?: string[]
  brief: string
  quarter: string
  year: number
  campaign_theme?: string
  cultural_moments?: string
  brand_persona?: string
  tenant_notes?: string
  signal_report?: unknown
}

function buildPrompt(d: StrategyRequest): string {
  const months = quarterMonths(d.quarter, d.year)
  return `You are a senior social media strategist at a world-class creative agency. You have produced quarterly strategy documents for leading brands across the Middle East and internationally. Your strategies are referenced internally as benchmarks because they are specific, culturally intelligent, and creatively ambitious.

What separates your work from every other strategist's output:
- Every tactic is pinned to a real cultural moment, not a generic theme
- Platform roles are differentiated by behavior, not just channel name
- Monthly personas describe the brand's emotional state, not just its content plan
- The arc has momentum: Month 1 sets up something that Month 3 delivers on
- No filler. Every sentence earns its place or gets cut.

─── CLIENT BRIEF ───────────────────────────────────────────────
Client: ${d.client_name}
Industry: ${d.industry ?? 'not specified'}
Quarter: ${d.quarter} ${d.year} — Months: ${months.join(', ')}
Platforms: ${d.platforms?.join(', ') ?? 'Instagram, TikTok'}
Brand Voice: ${d.brand_voice ?? 'not specified'}
${d.key_messages?.length ? `Key Messages: ${d.key_messages.join(' | ')}` : ''}
${d.competitors?.length ? `Competitors: ${d.competitors.join(', ')}` : ''}

Strategic Brief: ${d.brief}
${d.campaign_theme ? `Campaign Theme / Line: "${d.campaign_theme}"` : ''}
${d.cultural_moments ? `Key Cultural Moments this quarter: ${d.cultural_moments}` : ''}
${d.brand_persona ? `Brand Persona direction: ${d.brand_persona}` : ''}
${d.tenant_notes ? `Partner / Tenant Integration Notes: ${d.tenant_notes}` : ''}

─── QUALITY STANDARDS ──────────────────────────────────────────
POSITIONING STATEMENT: Must name the specific role the brand plays in the audience's life THIS quarter — not a generic brand promise. Example of weak: "A brand that empowers women." Example of strong: "The first brand in this category to say out loud what ${months[0]} actually feels like for its audience."

CAMPAIGN LINE: If not provided, generate one that: (a) could anchor a full quarter of content, (b) has poetic compression (3–7 words), (c) is owned-sounding — no other brand in ${d.industry} could use it.

CONTENT PILLARS: Each pillar names a specific life territory or cultural tension, not a topic category. Weak: "Lifestyle." Strong: "The moments between milestones — the Tuesday morning no one posts about."

PLATFORM ROLES: Each platform must have a different behavioral role. Not "Instagram = awareness, TikTok = engagement." Name what kind of content ONLY happens on that platform, and why.

MONTHLY TACTICS: Each month must be anchored to what is actually happening culturally in ${months.join('/')}: seasonal shifts, holidays, audience mindset changes, post-event psychology. The theme_line format is: [Role Name] × [Cultural/Emotional Trigger].

STRATEGY ARC: The 3-phase arc must have narrative momentum — the audience should feel the brand building toward something by Month 3.

─── OUTPUT ─────────────────────────────────────────────────────
Return ONLY valid JSON — no markdown, no commentary:
{
  "positioning_statement": "One specific sentence: what role the brand plays in its audience's life specifically this quarter",
  "campaign_line": "${d.campaign_theme ? d.campaign_theme : 'Generate a 3–7 word campaign line that only this brand could own this quarter'}",
  "quarter_role": "2–3 sentences: the strategic narrative of this quarter — what it builds from, what it builds toward, why this moment matters for the brand",
  "identity_shift": "One sentence: the single most important shift in how the brand shows up this quarter vs. the previous quarter — behavioral, not tonal",

  "content_pillars": [
    { "name": "Pillar Name (2–3 words)", "description": "One sentence: the specific life territory or cultural tension this pillar covers — and what makes it ownable for this brand" },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ],

  "strategy_arc": [
    { "number": "01", "phase_name": "2-word name", "description": "One sentence: what this phase establishes or activates" },
    { "number": "02", "phase_name": "2-word name", "description": "One sentence: the escalation or shift" },
    { "number": "03", "phase_name": "2-word name", "description": "One sentence: the payoff or culmination" }
  ],

  "platform_roles": [
    {
      "platform": "${d.platforms?.[0] ?? 'Instagram'}",
      "role": "One tagline: the specific behavioral role this platform plays for this brand this quarter",
      "description": "2–3 sentences: content type + visual style + tone shift + what content ONLY lives here and nowhere else"
    }
  ],

  "monthly_tactics": [
    {
      "month": "${months[0]}",
      "role": "2-word role name",
      "theme_line": "[Role] × [Specific cultural or emotional trigger for ${months[0]}]",
      "description": "2–3 sentences: the audience's mindset this month, the cultural moment, what the brand does in response",
      "brand_persona_adjectives": ["Specific adjective", "Specific adjective", "Specific adjective", "Specific adjective"],
      "brand_persona_description": "One sentence: the brand's emotional posture this month — not a tone list, a state of being",
      "focus": ["Specific content beat 1", "Specific content beat 2", "Specific content beat 3", "Specific content beat 4"],
      "outcome": ["Specific measurable or behavioral outcome 1", "Outcome 2", "Outcome 3"]
    },
    {
      "month": "${months[1] ?? months[0]}",
      "role": "...",
      "theme_line": "...",
      "description": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."],
      "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."],
      "outcome": ["...", "...", "..."]
    },
    {
      "month": "${months[2] ?? months[1] ?? months[0]}",
      "role": "...",
      "theme_line": "...",
      "description": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."],
      "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."],
      "outcome": ["...", "...", "..."]
    }
  ],

  "format_roles": {
    "reels": ["Use 1 — specific to this brand and quarter", "Use 2", "Use 3"],
    "motion_graphics": ["Use 1", "Use 2", "Use 3"],
    "static_carousel": ["Use 1", "Use 2", "Use 3"]
  },

  "tenant_integration": [
    "Principle 1 — how partners or products appear without feeling like ads",
    "Principle 2",
    "Principle 3"
  ],

  "strategy_flow": [
    { "beat": "1", "label": "${months[0]}", "phase": "Phase name", "description": "One sentence: the specific thing that happens at this moment in the arc" },
    { "beat": "2", "label": "Early ${months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "3", "label": "Late ${months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "4", "label": "${months[2] ?? months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "5", "label": "Quarter peak", "phase": "Culmination", "description": "..." }
  ]
}

Rules:
- Every item must be SPECIFIC to ${d.client_name}, ${d.industry ?? 'this industry'}, ${d.quarter} ${d.year}
- Monthly tactics must reference real cultural/seasonal dynamics in ${months.join(' / ')}
- No placeholder text. No "etc." No ellipsis in final output. Complete every sentence.
- Return ONLY valid JSON — no markdown wrapper, no commentary, no apology`
}

function quarterMonths(quarter: string, year: number): string[] {
  const map: Record<string, string[]> = {
    Q1: ['January', 'February', 'March'],
    Q2: ['April', 'May', 'June'],
    Q3: ['July', 'August', 'September'],
    Q4: ['October', 'November', 'December'],
  }
  return map[quarter] ?? ['Month 1', 'Month 2', 'Month 3']
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: StrategyRequest
  try {
    body = await req.json() as StrategyRequest
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.client_name || !body.brief || !body.quarter) {
    return NextResponse.json({ error: 'client_name, brief, and quarter are required' }, { status: 400 })
  }

  let prompt = buildPrompt(body)

  // Inject client intelligence memory if available
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const block = await buildClientIntelligenceBlock(body.client_id, 'strategy', db).catch(() => '')
      if (block) prompt = block + '\n\n' + prompt
    }
  }

  let raw = ''

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 16000, temperature: 0.7 },
        }),
      },
    )
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 })
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: 'Failed to parse strategy from AI', raw }, { status: 502 })
  }

  let result: StrategyDocument
  try {
    result = JSON.parse(match[0]) as StrategyDocument
    result.client_name = body.client_name
    result.platforms   = body.platforms
    result.brief       = body.brief
    result.quarter     = body.quarter
    result.year        = body.year
    result.campaign_theme = body.campaign_theme
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  return NextResponse.json({ strategy: result })
}
