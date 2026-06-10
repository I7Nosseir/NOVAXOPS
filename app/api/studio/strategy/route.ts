// ============================================================
// POST /api/studio/strategy
// Quarterly social media strategy generator.
// Output matches the Esplanade Q1/Q2 presentation format.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'
import type { StrategyDocument } from '@/lib/studio-types'
import { aiGuard } from '@/lib/ai-guard'

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

function quarterMonths(quarter: string, year: number): string[] {
  const map: Record<string, string[]> = {
    Q1: ['January', 'February', 'March'],
    Q2: ['April', 'May', 'June'],
    Q3: ['July', 'August', 'September'],
    Q4: ['October', 'November', 'December'],
  }
  return (map[quarter] ?? ['Month 1', 'Month 2', 'Month 3']).map(m => `${m} ${year}`)
}

function buildPrompt(d: StrategyRequest): string {
  const months = quarterMonths(d.quarter, d.year)

  return `You are a senior social media strategist at a world-class creative agency. Your quarterly strategies are referenced internally as benchmarks. You have produced work for leading brands across the Middle East and internationally. The work you produce does not just fill a presentation — it changes how a brand shows up in culture.

What separates your strategies from every other strategist's output:
- Every tactic is pinned to a specific cultural moment, not a generic theme
- Platform roles are differentiated by human behavior, not by channel name
- Monthly personas describe the brand's emotional state, not a content calendar
- The arc has momentum: Month 1 sets up something that Month 3 delivers on
- The competitive gap is named, not gestured at
- No filler. No "etc." Every sentence earns its place.

═══════════════════════════════════════════════════════
STRATEGIC THINKING PHASE — Complete this analysis before generating the strategy document.
These are INTERNAL REASONING STEPS — do NOT include them in the JSON output.
Your thinking here will be invisible in the output but visible in the quality of every line.
═══════════════════════════════════════════════════════

STEP 1 — STRATEGIC SITUATION ANALYSIS
Client: ${d.client_name} | Industry: ${d.industry ?? 'not specified'} | Quarter: ${d.quarter} ${d.year}
Brief: ${d.brief}

Answer internally:
• What is the single most important cultural or market shift happening in ${months[0].split(' ')[0]}–${months[2].split(' ')[0]} ${d.year} that this brand cannot ignore?
• What is the gap between where this brand's audience is emotionally right now, and where they want to be? (Not what the brand offers — what the audience desires.)
• What is the one thing this brand could say this quarter that no competitor would dare say? (Because it's too honest, too specific, too niche — not because it's controversial.)
• What does the brand's audience fear most in this quarter? What do they secretly desire? These are the two rails the strategy runs on.

STEP 2 — COMPETITIVE DIFFERENTIATION FORCING
Competitors: ${d.competitors?.join(', ') ?? 'not specified'}

Answer internally:
• What content format or theme is oversaturated in this industry right now? The strategy must actively avoid it.
• What emotional territory is UNCLAIMED in this space? (The emotion competitors are not addressing.)
• If a viewer sees this brand's content alongside a competitor's, what is the single visual or tonal difference that makes them immediately distinguishable?
• What would a competitor see in this strategy and think "we can't do that because we don't have the [credibility / authenticity / positioning] to pull it off"?

STEP 3 — QUARTERLY NARRATIVE ARC
Months: ${months.join(' → ')}

Answer internally:
• What is the NORTH STAR of this quarter? One sentence: what does the brand stand for by the end of ${months[2].split(' ')[0]}?
• What does the brand need to ESTABLISH in Month 1 for Month 3 to land?
• What is the escalation from Month 1 to Month 3? (Not just "more content" — what shifts in the audience relationship?)
• What is the MOMENT in Month 3 that the entire quarter was building toward?
• What would a viewer who follows this brand for all 3 months feel by the end? Name the specific emotional transformation.

STEP 4 — PLATFORM BEHAVIOR MAPPING
Platforms: ${d.platforms?.join(', ') ?? 'Instagram, TikTok'}

Answer internally:
• For each platform: what is the ONE type of content that ONLY makes sense on this platform, and nowhere else?
• What is the behavioral difference between how the audience uses each platform? (Not demographics — behavior. Why do they open TikTok vs. Instagram in a different state of mind?)
• What content format creates saves? (Long-term value signals.) What format creates shares? (Identity signals.) These need different treatments.

STEP 5 — CULTURAL CALENDAR ANCHORING
Months: ${months.join(', ')}

Answer internally:
• Name 3 specific cultural, seasonal, or audience mindset shifts that happen in ${months[0].split(' ')[0]}–${months[2].split(' ')[0]} in ${d.client_name}'s primary region/market.
• For each month, name the single most important thing happening in the audience's LIFE (not just the calendar) that shapes their emotional state.
• Are there any religious, national, or seasonal moments this brand should engage with specifically? Name the exact moment and the specific angle.

STEP 6 — QUALITY GATEKEEPING (anti-patterns to eliminate)
Before writing, verify your strategy avoids:
• Generic pillar names: "Lifestyle", "Education", "Behind the Scenes" — these are categories, not territories
• Generic monthly themes: "Summer vibes", "New year energy" — these describe a feeling, not a strategy
• Platform roles that are just awareness/engagement labels — name the BEHAVIOR
• Monthly tactics without a specific cultural anchor — "post more Reels in February" is not a tactic
• A strategy arc where Month 2 is just "more of Month 1"

═══════════════════════════════════════════════════════
END OF THINKING PHASE — Now produce the strategy document.
═══════════════════════════════════════════════════════

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
POSITIONING STATEMENT: Names the specific role the brand plays in the audience's life THIS quarter. Not a generic brand promise. Not "empowers" or "connects." Names the exact relationship: what the brand IS for its audience in ${months[0].split(' ')[0]}–${months[2].split(' ')[0]} ${d.year}.
Weak: "A brand that empowers women." Strong: "The brand that says out loud what ${months[0].split(' ')[0]} actually feels like for its audience."

CAMPAIGN LINE: 3–7 words. Poetic compression. Could anchor a full quarter of content. Owned-sounding — no other brand in ${d.industry ?? 'this category'} could use it. If a campaign theme is provided, use it exactly.
Weak: "Live Your Best Life." Strong: Something that only works for this brand, in this quarter.

CONTENT PILLARS: Each pillar names a specific life territory or cultural tension — not a topic category. 5 pillars, each mutually exclusive (no overlap in territory).
Weak: "Lifestyle", "Inspiration", "Tips." Strong: "The moments between milestones — the Tuesday morning no one posts about."

PLATFORM ROLES: Each platform gets a different behavioral role — what content ONLY exists on that platform, and why. Named as a specific behavior: "Where the brand gets uncomfortable" / "Where the brand earns trust" — not "awareness" / "engagement."

MONTHLY TACTICS: Each month must be anchored to:
(a) a specific cultural/emotional shift happening in that month
(b) a specific audience mindset change
(c) a content theme that builds on what came before and sets up what comes next
Format: [Role Name] × [Specific Cultural or Emotional Trigger] — not a generic theme, a named tension.

STRATEGY ARC: 3-phase arc with narrative momentum. Month 1 plants the seed. Month 2 deepens the investment. Month 3 delivers the payoff. The audience should feel the brand building toward something.

─── OUTPUT ─────────────────────────────────────────────────────
Return ONLY valid JSON — no markdown, no commentary, no ellipsis in final output:
{
  "positioning_statement": "One specific sentence: what role the brand plays in its audience's life in ${months[0].split(' ')[0]}–${months[2].split(' ')[0]} ${d.year}. Must be specific to this brand, this quarter, this moment.",

  "campaign_line": "${d.campaign_theme ? d.campaign_theme : `Generate a 3–7 word campaign line that only ${d.client_name} could own this quarter`}",

  "quarter_role": "2–3 sentences: the strategic narrative of this quarter — what it builds from, what it builds toward, why this specific moment in the calendar matters for this brand",

  "identity_shift": "One sentence: the single most important shift in how the brand shows up this quarter vs. the previous quarter — behavioral and specific, not tonal",

  "north_star": "One sentence: what the brand stands for by the end of ${months[2]} — the audience's relationship with the brand after following it for the full quarter",

  "competitive_gap": "One sentence: the specific emotional or creative territory that competitors are NOT occupying that this strategy claims",

  "creative_tension": "One sentence: the specific uncomfortable or bold creative choice in this strategy that a generic competitor would not make",

  "content_pillars": [
    { "name": "Pillar Name — 2–3 words, specific and ownable", "description": "One sentence: the specific life territory or cultural tension this pillar covers. What makes it specific to ${d.client_name} and not a generic brand in this space." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ],

  "strategy_arc": [
    { "number": "01", "phase_name": "2-word name", "month": "${months[0]}", "description": "One sentence: what this phase establishes — specifically what changes in the audience's perception of the brand" },
    { "number": "02", "phase_name": "2-word name", "month": "${months[1]}", "description": "One sentence: the escalation — what deepens, what shifts, what gets harder or more specific" },
    { "number": "03", "phase_name": "2-word name", "month": "${months[2]}", "description": "One sentence: the payoff — what the entire quarter was building toward, what the audience now believes or does" }
  ],

  "platform_roles": [
    {
      "platform": "Platform name",
      "role": "One specific tagline: the behavioral role this platform plays for this brand this quarter — not 'awareness', a named behavior",
      "description": "2–3 sentences: what content type lives ONLY here, the visual and tonal style, why this platform gets this role and not another",
      "content_that_only_lives_here": "One specific content format or series that is platform-native and cannot work on any other platform"
    }
  ],

  "monthly_tactics": [
    {
      "month": "${months[0]}",
      "role": "2-word role name — specific to this month's cultural moment",
      "theme_line": "[Role Name] × [Specific Cultural or Emotional Trigger for ${months[0].split(' ')[0]}]",
      "description": "2–3 sentences: the specific cultural moment or audience mindset shift in ${months[0].split(' ')[0]}, what the brand does in response, why this approach and not a generic one",
      "cultural_anchor": "The specific event, seasonal shift, or audience life moment that anchors this month's content — a real date or named event, not a generic theme",
      "brand_persona_adjectives": ["Specific adjective for this month only", "Specific adjective", "Specific adjective", "Specific adjective"],
      "brand_persona_description": "One sentence: the brand's emotional posture in ${months[0].split(' ')[0]} — a state of being, not a tone list",
      "focus": ["Specific content beat 1 — named format + specific topic", "Specific content beat 2", "Specific content beat 3", "Specific content beat 4"],
      "outcome": ["Specific behavioral or relational outcome 1 — what the audience does or believes after this month", "Outcome 2", "Outcome 3"]
    },
    {
      "month": "${months[1]}",
      "role": "...",
      "theme_line": "...",
      "description": "...",
      "cultural_anchor": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."],
      "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."],
      "outcome": ["...", "...", "..."]
    },
    {
      "month": "${months[2]}",
      "role": "...",
      "theme_line": "...",
      "description": "...",
      "cultural_anchor": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."],
      "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."],
      "outcome": ["...", "...", "..."]
    }
  ],

  "format_roles": {
    "reels": ["Specific use 1 — named series or format, not generic", "Specific use 2", "Specific use 3"],
    "motion_graphics": ["Specific use 1", "Specific use 2", "Specific use 3"],
    "static_carousel": ["Specific use 1", "Specific use 2", "Specific use 3"]
  },

  "tenant_integration": [
    "Integration principle 1 — how partners or products appear without feeling like ads: a specific approach",
    "Principle 2",
    "Principle 3"
  ],

  "strategy_flow": [
    { "beat": "1", "label": "${months[0].split(' ')[0]}", "phase": "Phase name from arc", "description": "One sentence: the specific thing that happens at this moment in the arc — a named content action or audience shift" },
    { "beat": "2", "label": "Mid-${months[1].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "3", "label": "Late ${months[1].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "4", "label": "${months[2].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "5", "label": "Quarter peak", "phase": "Culmination", "description": "The specific moment the entire quarter was building toward — name it" }
  ]
}

ABSOLUTE RULES:
- Every item must be specific to ${d.client_name}, ${d.industry ?? 'this industry'}, ${d.quarter} ${d.year}
- Monthly tactics must reference real cultural/seasonal dynamics in the exact months named
- No placeholder text. No "etc." No ellipsis in any field. Complete every sentence.
- Content pillars must be mutually exclusive — if two pillars could produce the same post, rewrite one
- Platform roles must be behaviorally differentiated — if two platforms could swap descriptions, rewrite both
- Return ONLY valid JSON — no markdown wrapper, no commentary, no apology`
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

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
      model:      'claude-opus-4-7',
      max_tokens: 32000,
      messages:   [{ role: 'user', content: prompt }],
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
          generationConfig: { maxOutputTokens: 32000, temperature: 0.80 },
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
    result.client_name    = body.client_name
    result.platforms      = body.platforms
    result.brief          = body.brief
    result.quarter        = body.quarter
    result.year           = body.year
    result.campaign_theme = body.campaign_theme
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  return NextResponse.json({ strategy: result })
}
