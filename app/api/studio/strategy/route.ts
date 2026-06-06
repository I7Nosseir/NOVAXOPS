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
  return `You are a senior social media strategist producing a QUARTERLY SOCIAL MEDIA STRATEGY document for an agency client presentation.

You must follow the EXACT format of a high-quality agency strategy deck (similar to The Esplanade Riyadh Q1/Q2 strategies). Every section must be concrete, specific, and tailored — no generic filler.

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

─── WHAT TO GENERATE ───────────────────────────────────────────
Generate a complete social media strategy document. Every field must be SPECIFIC to this client, quarter, and cultural context — not generic.

Return ONLY valid JSON, no markdown fences:
{
  "positioning_statement": "One-sentence brand role statement for this quarter — what the brand IS for its audience this period",
  "campaign_line": "${d.campaign_theme ? d.campaign_theme : 'A punchy campaign tagline that anchors the whole quarter — 3–7 words, poetic, not generic'}",
  "quarter_role": "2–3 sentences: what this quarter represents strategically, how it builds on what came before and what it sets up for next quarter",
  "identity_shift": "The single most important shift in brand behavior or narrative this quarter vs last quarter",

  "content_pillars": [
    { "name": "Pillar Name", "description": "What this pillar captures — specific content territory, mood, and the type of life moments it reflects" },
    { "name": "Pillar Name", "description": "..." },
    { "name": "Pillar Name", "description": "..." },
    { "name": "Pillar Name", "description": "..." },
    { "name": "Pillar Name", "description": "..." }
  ],

  "strategy_arc": [
    { "number": "01", "phase_name": "Short name", "description": "One sentence — what this phase does strategically" },
    { "number": "02", "phase_name": "Short name", "description": "..." },
    { "number": "03", "phase_name": "Short name", "description": "..." }
  ],

  "platform_roles": [
    { "platform": "${d.platforms?.[0] ?? 'Instagram'}", "role": "Role tagline — what this platform does for the brand this quarter", "description": "2–3 sentences on visual style, content type, tone shift, and what changes vs last quarter" }
  ],

  "monthly_tactics": [
    {
      "month": "${months[0]}",
      "role": "Short role name (e.g. Revival, The Flip, Spark)",
      "theme_line": "Theme name × Cultural trigger (e.g. Post-Eid Energy × Spring Light)",
      "description": "2–3 sentences — what this month does for the brand, who the audience is in this moment, what makes now different",
      "brand_persona_adjectives": ["Adjective", "Adjective", "Adjective", "Adjective"],
      "brand_persona_description": "One sentence: what the brand IS in this month's tone",
      "focus": ["Specific content focus 1", "Specific content focus 2", "Specific content focus 3", "Specific content focus 4"],
      "outcome": ["Business/brand outcome 1", "Business/brand outcome 2", "Business/brand outcome 3"]
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
    "reels": ["Format use 1 — why Reels serve this brand this quarter", "Format use 2", "Format use 3"],
    "motion_graphics": ["Format use 1", "Format use 2", "Format use 3"],
    "static_carousel": ["Format use 1", "Format use 2", "Format use 3"]
  },

  "tenant_integration": [
    "Principle 1 — how partners/tenants/products appear in content",
    "Principle 2",
    "Principle 3"
  ],

  "strategy_flow": [
    { "beat": "1", "label": "${months[0]}", "phase": "Phase name", "description": "One sentence — what happens" },
    { "beat": "2", "label": "Early ${months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "3", "label": "Late ${months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "4", "label": "${months[2] ?? months[1] ?? months[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "5", "label": "Peak moment", "phase": "Climax", "description": "..." }
  ]
}

Rules:
- Every item must be SPECIFIC to ${d.client_name}, ${d.industry}, ${d.quarter} ${d.year}
- Monthly tactics must align with actual cultural/seasonal moments in ${months.join('/')}
- No generic strategy filler — if you don't know something, make a specific creative judgment
- Platform roles must reflect what actually changes this quarter, not generic descriptions
- Return ONLY valid JSON — no markdown, no commentary`
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
      max_tokens: 6000,
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
          generationConfig: { maxOutputTokens: 6000, temperature: 0.7 },
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
