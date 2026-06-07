// ============================================================
// POST /api/studio/campaign/generate
// Campaign Igniter — 7-phase sequential pipeline.
// Each phase saves to session immediately on completion.
// Returns CampaignDocument & { boss_brief: BossBrief }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson, geminiGenerate } from '@/lib/gemini'
import { buildClientIntelligenceBlock, buildCompetitorContextBlock, adminSupabase } from '@/lib/client-intelligence'
import type {
  CampaignDocument,
  CampaignConcept,
  BossBrief,
  SignalReport,
} from '@/lib/studio-types'
import { pickRandomDomains } from '@/lib/studio-campaign-domains'

// ─── Request type ─────────────────────────────────────────────

interface CampaignGenerateBody {
  session_id?:        string
  client_id?:         string
  client_name:        string
  industry:           string
  brand_voice?:       string
  target_audience:    string
  current_platforms:  string[]
  boldness:           'safe' | 'disrupting' | 'red_bull' | 'nuanced'
  constraint?:        'budget' | 'timeline' | 'brand_safe'
  signal_report?:     SignalReport
  metricool_context?: {
    best_format:       string
    best_posting_time: string
    avg_er:            number
    observed_pattern?: string
  }
  _intelligence_block?: string
}

// ─── Phase-save helper ────────────────────────────────────────

async function savePhase(
  sessionId: string,
  phase: string,
  output: unknown,
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/studio/session/${sessionId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phase, output }),
    })
  } catch {
    // Non-blocking — phase save failure should never stop generation
  }
}

// ─── JSON parse helper ────────────────────────────────────────

function parseJson<T>(text: string, fallback: T): T {
  try {
    const clean = text
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/, '')
      .trim()
    return JSON.parse(clean) as T
  } catch {
    return fallback
  }
}

// ─── Phase 1: Cultural Tension Mining (Sonnet → Gemini) ──────

async function runPhase1(
  body: CampaignGenerateBody,
): Promise<Array<{ tension: string; evidence: string; opportunity: string }>> {
  const tensionsContext = body.signal_report?.cultural_tensions
    ? `Known cultural tensions from Signal Report:\n${JSON.stringify(body.signal_report.cultural_tensions, null, 2)}\n\nExpand and deepen these with additional tensions relevant to ${body.industry}.`
    : `No pre-computed Signal Report available. Generate tensions from your knowledge of ${body.industry}.`

  const prompt = `You are mining cultural tensions for a campaign targeting: ${body.target_audience}
Industry: ${body.industry}
Client: ${body.client_name}
${body._intelligence_block ?? ''}

${tensionsContext}

A tension = something the audience simultaneously WANTS AND RESISTS.
Example: "People love skincare but feel guilty about how complicated it's become."
Example: "People want to be seen as successful but are tired of brands selling hustle."

Find 5-7 specific, actionable tensions. Each must be grounded in real audience psychology — not generic.

Return ONLY valid JSON array — no markdown, no extra text:
[
  {
    "tension": "One sentence: [People love X but feel/resist/fear Y]",
    "evidence": "One sentence: where this shows up (social behavior, search patterns, cultural signals)",
    "opportunity": "One sentence: what a brand could do with this tension"
  }
]`

  const result = await geminiJson<Array<{ tension: string; evidence: string; opportunity: string }>>(
    prompt,
    undefined,
    { temperature: 0.5, maxOutputTokens: 1200 },
  )
  return result
}

// ─── Phase 2: Constraint Inversion (Sonnet → Gemini) ─────────

async function runPhase2(
  industry: string,
): Promise<Array<{ rule: string; inversion: string }>> {
  const prompt = `List 5 unwritten marketing rules that EVERY brand in ${industry} follows without questioning.
Then invert each rule deliberately and with intention.

Return ONLY valid JSON array — no markdown, no extra text:
[
  {
    "rule": "One sentence: what every brand does",
    "inversion": "One sentence: what happens if a brand breaks this rule publicly and on purpose — be specific and actionable"
  }
]`

  return geminiJson<Array<{ rule: string; inversion: string }>>(
    prompt,
    undefined,
    { temperature: 0.5, maxOutputTokens: 800 },
  )
}

// ─── Phase 3: Cross-Domain Stimulation (Haiku → Gemini) ──────

async function runPhase3(
  domains: string[],
  industry: string,
  client_name: string,
): Promise<string[]> {
  const prompt = `You are generating creative campaign seeds using cross-domain thinking.

Brand: ${client_name} (${industry})
Three thinking lenses to apply: ${domains.join(', ')}

For each lens, answer: "If this campaign was designed by a ${domains[0]}, what would the core mechanic be?"
These are NOT themes to copy — they are thinking lenses.
A game designer asks: "What is the reward loop?"
A street artist asks: "What is the unexpected surface or medium?"
A chess grandmaster asks: "What is the move no one sees coming?"

Generate 3 raw concept seeds — one per domain. Wild. No judgment. No filtering.

Return ONLY 3 lines — one seed per line, no numbering, no JSON.`

  const text = await geminiGenerate(prompt, undefined, {
    temperature:     0.4,
    maxOutputTokens: 300,
  })
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)

  if (lines.length < 3) {
    return [
      `A ${domains[0]} would build a campaign with a reward mechanic — the audience earns something real`,
      `A ${domains[1]} would find the unexpected surface — not where brands usually show up`,
      `A ${domains[2]} would structure the campaign so the opponent's move is already answered`,
    ]
  }
  return lines
}

// ─── Phase 4: Divergent Ideation (Opus → Gemini high-temp) ───

async function runPhase4(
  tensions: Array<{ tension: string }>,
  inversions: Array<{ inversion: string }>,
  seeds: string[],
  boldness: CampaignGenerateBody['boldness'],
  targetAudience: string,
): Promise<string[]> {
  const boldnessModifier =
    boldness === 'red_bull'
      ? 'Include at least 5 concepts that would make any brand manager uncomfortable. Push further than feels safe.'
      : boldness === 'disrupting'
        ? 'Include at least 3 concepts that challenge industry conventions directly.'
        : boldness === 'nuanced'
          ? 'Prioritize unexpected elegance over shock value. Subtle subversions that reward attention.'
          : 'Keep concepts executable and on-brand while still being genuinely interesting.'

  const prompt = `You are generating 15 raw campaign concepts. No filtering. No judgment. Budget is irrelevant. Feasibility is irrelevant.

Target audience: ${targetAudience}

Cultural tensions to activate:
${tensions.map((t) => `- ${t.tension}`).join('\n')}

Industry rules to break:
${inversions.map((i) => `- ${i.inversion}`).join('\n')}

Cross-domain seeds:
${seeds.map((s) => `- ${s}`).join('\n')}

RULES:
- 15 concepts minimum
- Each concept: one sentence only. No explanation yet.
- Include at least 2 rooted in a specific cultural tension above
- Include at least 1 inspired by each cross-domain seed
- ${boldnessModifier}
- Include concepts that feel too simple AND concepts that feel too complex

Return ONLY 15 lines — one concept per line, no numbering, no bullets.`

  const text = await geminiGenerate(prompt, undefined, {
    temperature:     0.8,
    maxOutputTokens: 3000,
  })
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 15)

  return lines.length >= 7 ? lines : [
    'Invite your most vocal critics to design the next campaign with you',
    'Give your product away to one person a day for 30 days and document what they do with it',
    'Run every ad from the perspective of someone who tried the product and it failed',
    'Create a campaign that works only if people talk about it — silence makes it disappear',
    'Partner with a competitor on one piece of content that benefits both audiences equally',
    'Document the supply chain in real time — every step, unfiltered',
    'Let the audience vote on what product gets discontinued next',
  ]
}

// ─── Phase 5: Participatory Mechanics (Sonnet → Gemini) ──────

async function runPhase5(
  concepts: string[],
  targetAudience: string,
): Promise<Array<{ concept: string; mechanic_type: string; mechanic_description: string }>> {
  const top7 = concepts.slice(0, 7)

  const prompt = `For each of these 7 campaign concepts, design how the audience BECOMES the campaign.

Target audience: ${targetAudience}

Examples of what great participatory mechanics look like:
- Duolingo's death hoax: audiences mourned and resurrected Duo
- Vaseline Verified: audiences tested the hacks themselves
- McDonald's illegal flowers: pedestrians photographed them daily

Mechanic types: UGC trigger / Opinion mechanic / Mystery / Physical action / Duet-reaction / Share-to-unlock

Concepts:
${top7.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return ONLY valid JSON array — no markdown, no extra text:
[
  {
    "concept": "exact concept text from above",
    "mechanic_type": "one of the mechanic types above",
    "mechanic_description": "one sentence: exactly how the audience participates"
  }
]`

  return geminiJson<Array<{ concept: string; mechanic_type: string; mechanic_description: string }>>(
    prompt,
    undefined,
    { temperature: 0.5, maxOutputTokens: 800 },
  )
}

// ─── Phase 6: Convergent Scoring (Haiku → Gemini) ────────────

interface ScoredConcept {
  concept:          string
  mechanic_type:    string
  mechanic_description: string
  boldness:         number
  implementability: number
  virality:         number
}

async function runPhase6(
  conceptsWithMechanics: Array<{ concept: string; mechanic_type: string; mechanic_description: string }>,
  constraint: CampaignGenerateBody['constraint'],
): Promise<ScoredConcept[]> {
  const prompt = `Score each campaign concept on three dimensions (1-10 each).

Concepts to score:
${conceptsWithMechanics.map((c, i) => `${i + 1}. ${c.concept}\nMechanic: ${c.mechanic_description}`).join('\n\n')}

Scoring definitions:
- Boldness: 1=safe/expected, 10=completely unexpected/industry-challenging
- Implementability: 10=doable in 3 days with no budget, 1=needs Netflix production budget
- Virality: 10=almost guaranteed sharing, 1=no inherent spread mechanism

Return ONLY valid JSON array — no markdown, no extra text:
[
  {
    "concept": "exact concept text",
    "mechanic_type": "mechanic type",
    "mechanic_description": "mechanic description",
    "boldness": number,
    "implementability": number,
    "virality": number
  }
]`

  const scored = await geminiJson<ScoredConcept[]>(prompt, undefined, {
    temperature:     0.4,
    maxOutputTokens: 800,
  })

  // Apply filters from spec:
  // implementability < 4 kept only if virality = 9-10
  // boldness < 5 excluded
  let filtered = scored.filter((c) => {
    if (c.boldness < 5) return false
    if (c.implementability < 4 && c.virality < 9) return false
    return true
  })

  // Apply constraint modifiers
  if (constraint === 'budget') {
    // Penalize high-production concepts — lower their effective score
    filtered = filtered.map((c) => ({
      ...c,
      implementability: c.implementability > 7 ? c.implementability - 2 : c.implementability,
    }))
  } else if (constraint === 'brand_safe') {
    // Remove boldness > 8
    filtered = filtered.filter((c) => c.boldness <= 8)
  }

  // Sort by composite score
  filtered.sort(
    (a, b) => b.boldness + b.virality - (a.boldness + a.virality),
  )

  return filtered.length > 0 ? filtered : scored.slice(0, 5)
}

// ─── Phase 7: Execution Briefs (Opus → Gemini high-temp) ─────

async function runPhase7(
  topConcepts: ScoredConcept[],
  body: CampaignGenerateBody,
  tensions: Array<{ tension: string }>,
): Promise<CampaignConcept[]> {
  const top5 = topConcepts.slice(0, 5)

  const prompt = `You are writing full execution briefs for the top campaign concepts.

Client: ${body.client_name} (${body.industry})
Target audience: ${body.target_audience}
Platforms: ${body.current_platforms.join(', ')}
Brand voice: ${body.brand_voice ?? 'Not specified'}

Cultural tensions activated in this campaign:
${tensions.map((t) => `- ${t.tension}`).join('\n')}

Concepts to brief (${top5.length} total):
${top5.map((c, i) => `Concept ${i + 1}: ${c.concept}
Mechanic type: ${c.mechanic_type}
Mechanic: ${c.mechanic_description}
Scores: Boldness ${c.boldness}/10, Implementability ${c.implementability}/10, Virality ${c.virality}/10`).join('\n\n')}

For each concept, write a complete execution brief. "Core idea" must be one sentence — if you can't say it in one sentence, it's too complex.

Return ONLY valid JSON array — no markdown, no extra text:
[
  {
    "campaign_name": "3 words max",
    "tagline": "The idea in one punchy line",
    "core_idea": "One sentence. The entire concept.",
    "why_it_works": "The psychological principle by name + how it applies here",
    "cultural_tension": "Which tension from the list above does this activate?",
    "platform": "Primary platform + secondary",
    "execution_steps": ["Step 1 — who does what", "Step 2", "Step 3", "Step 4", "Step 5"],
    "participation_mechanic": "Exactly how the audience becomes part of this",
    "shareable_moment": "The specific frame, screenshot, or moment they will share",
    "scoring": { "boldness": 0, "implementability": 0, "virality": 0 },
    "budget": "Low",
    "timeline": "Days",
    "risk": "One-line risk",
    "mitigation": "One-line mitigation"
  }
]`

  const text = await geminiGenerate(prompt, undefined, {
    temperature:     0.8,
    maxOutputTokens: 3000,
  })
  return parseJson<CampaignConcept[]>(text, top5.map((c, i) => ({
    campaign_name: `Concept ${i + 1}`,
    tagline:       c.concept,
    core_idea:     c.concept,
    why_it_works:  'Cialdini social proof principle — audiences adopt behaviors they see peers perform',
    cultural_tension: tensions[0]?.tension ?? 'Core audience tension',
    platform:      body.current_platforms[0] ?? 'Instagram',
    execution_steps: [
      'Define the core mechanic with the team',
      'Produce the seed content',
      'Launch to initial audience segment',
      'Amplify UGC that emerges',
      'Measure participation rate vs. reach',
    ],
    participation_mechanic: c.mechanic_description,
    shareable_moment:       'The moment when the audience sees their own contribution reflected back',
    scoring: { boldness: c.boldness, implementability: c.implementability, virality: c.virality },
    budget:   c.implementability >= 7 ? 'Low' : c.implementability >= 4 ? 'Medium' : 'High',
    timeline: c.implementability >= 7 ? 'Days' : c.implementability >= 4 ? 'Weeks' : 'Months',
    risk:        'Audience may not participate at expected rate',
    mitigation:  'Seed with 10 authentic first participants before public launch',
  })))
}

// ─── Boss Brief (Haiku → Gemini) ─────────────────────────────

async function buildBossBrief(
  topConcept: CampaignConcept,
  body: CampaignGenerateBody,
): Promise<BossBrief> {
  const prompt = `Write a Boss Brief for this campaign concept. For a busy executive with 30 seconds.

Campaign: "${topConcept.campaign_name}" — ${topConcept.tagline}
Client: ${body.client_name} (${body.industry})
Core idea: ${topConcept.core_idea}
Why it works: ${topConcept.why_it_works}
Risk: ${topConcept.risk ?? 'None identified'}

BOSS BRIEF RULES:
- No marketing jargon. No passive voice. No sentence over 20 words.
- Never use: leverage, synergy, utilize, going forward, circle back, touch base, deep dive, actionable insights, move the needle
- Every block must be evidenced or actionable — no decoration
- Written for someone in back-to-back meetings

Return ONLY valid JSON — no markdown, no extra text:
{
  "what_we_made": "One sentence: what was built and for whom",
  "why_it_works": "One sentence: cite the specific data or psychological principle",
  "the_one_thing": "The single most important line — the one asset they must get right",
  "do_this_now": "Immediate next action. Two sentences max.",
  "watch_out_for": "One-sentence risk. Omit this key if there is no meaningful risk."
}`

  return geminiJson<BossBrief>(prompt, undefined, {
    temperature:     0.4,
    maxOutputTokens: 350,
  })
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: CampaignGenerateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_name || !body.industry || !body.target_audience) {
    return NextResponse.json(
      { error: 'client_name, industry, and target_audience are required' },
      { status: 400 },
    )
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 })
  }

  // Inject client intelligence into first-phase prompt
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const intelBlock = await buildClientIntelligenceBlock(body.client_id, 'studio_content', db).catch(() => '')
      const compBlock  = await buildCompetitorContextBlock(body.client_id, db).catch(() => '')
      body._intelligence_block = intelBlock + compBlock
    }
  }

  const domains = pickRandomDomains(3)

  // ── Phase 1 — Cultural Tension Mining ─────────────────────
  let tensions: Array<{ tension: string; evidence: string; opportunity: string }> = []
  try {
    tensions = await runPhase1(body)
    if (body.session_id) await savePhase(body.session_id, 'tensions', tensions)
  } catch {
    tensions = [
      {
        tension:     `Consumers in ${body.industry} want premium results but resist the premium price signal`,
        evidence:    'Price sensitivity alongside aspiration is a dominant consumer pattern in this category',
        opportunity: 'A brand that democratizes the premium result without the premium aesthetic',
      },
    ]
  }

  // ── Phase 2 — Constraint Inversion ────────────────────────
  let inversions: Array<{ rule: string; inversion: string }> = []
  try {
    inversions = await runPhase2(body.industry)
    if (body.session_id) await savePhase(body.session_id, 'inversions', inversions)
  } catch {
    inversions = [
      {
        rule:      `Every ${body.industry} brand shows aspirational results`,
        inversion: 'Show the failure, the process, and the doubt — document what actually goes wrong',
      },
    ]
  }

  // ── Phase 3 — Cross-Domain Stimulation ────────────────────
  let seeds: string[] = []
  try {
    seeds = await runPhase3(domains, body.industry, body.client_name)
    if (body.session_id) await savePhase(body.session_id, 'seeds', { domains, seeds })
  } catch {
    seeds = [
      `A ${domains[0]} would design a reward loop into every touchpoint`,
      `A ${domains[1]} would find the unexpected medium, not the expected channel`,
      `A ${domains[2]} would make the first move look like a mistake`,
    ]
  }

  // ── Phase 4 — Divergent Ideation ──────────────────────────
  let rawConcepts: string[] = []
  try {
    rawConcepts = await runPhase4(tensions, inversions, seeds, body.boldness, body.target_audience)
    if (body.session_id) await savePhase(body.session_id, 'raw_concepts', rawConcepts)
  } catch {
    rawConcepts = [
      `Invite critics to test the product publicly and document everything`,
      `Give away the product to 30 people with zero marketing — just observation`,
      `Run a campaign that only works if people talk about it — silence ends it`,
    ]
  }

  // ── Phase 5 — Participatory Mechanics ─────────────────────
  let conceptsWithMechanics: Array<{ concept: string; mechanic_type: string; mechanic_description: string }> = []
  try {
    conceptsWithMechanics = await runPhase5(rawConcepts, body.target_audience)
    if (body.session_id) await savePhase(body.session_id, 'mechanics', conceptsWithMechanics)
  } catch {
    conceptsWithMechanics = rawConcepts.slice(0, 7).map((c) => ({
      concept:              c,
      mechanic_type:        'UGC trigger',
      mechanic_description: 'Audience shares their own version of the core concept',
    }))
  }

  // ── Phase 6 — Convergent Scoring ──────────────────────────
  let scoredConcepts: ScoredConcept[] = []
  try {
    scoredConcepts = await runPhase6(conceptsWithMechanics, body.constraint)
    if (body.session_id) await savePhase(body.session_id, 'scored_concepts', scoredConcepts)
  } catch {
    scoredConcepts = conceptsWithMechanics.map((c) => ({
      ...c,
      boldness: 7, implementability: 6, virality: 7,
    }))
  }

  // ── Phase 7 — Execution Briefs ─────────────────────────────
  let concepts: CampaignConcept[] = []
  try {
    concepts = await runPhase7(scoredConcepts, body, tensions)
    if (body.session_id) await savePhase(body.session_id, 'concepts', concepts)
  } catch {
    concepts = scoredConcepts.slice(0, 3).map((c, i) => ({
      campaign_name: `Concept ${i + 1}`,
      tagline:       c.concept,
      core_idea:     c.concept,
      why_it_works:  'Social proof principle — audiences adopt behaviors they see peers perform',
      cultural_tension: tensions[0]?.tension ?? 'Core audience tension',
      platform:      body.current_platforms[0] ?? 'Instagram',
      execution_steps: [
        'Define the core mechanic',
        'Produce the seed content',
        'Launch to initial segment',
        'Amplify emerging UGC',
        'Measure participation rate',
      ],
      participation_mechanic: c.mechanic_description,
      shareable_moment:       'The moment audience sees their contribution reflected back',
      scoring: { boldness: c.boldness, implementability: c.implementability, virality: c.virality },
      budget:   c.implementability >= 7 ? 'Low' : c.implementability >= 4 ? 'Medium' : 'High',
      timeline: c.implementability >= 7 ? 'Days' : c.implementability >= 4 ? 'Weeks' : 'Months',
      risk:        'Lower-than-expected participation rate',
      mitigation:  'Seed with authentic participants before public launch',
    }))
  }

  // ── Boss Brief ─────────────────────────────────────────────
  let bossBrief: BossBrief = {
    what_we_made:  `Campaign framework for ${body.client_name}.`,
    why_it_works:  concepts[0]?.why_it_works ?? 'Social proof principle drives audience participation',
    the_one_thing: concepts[0]?.tagline ?? 'The core campaign hook',
    do_this_now:   'Align the team on Concept 1 and assign ownership of the first execution step.',
  }

  try {
    if (concepts.length > 0) {
      bossBrief = await buildBossBrief(concepts[0], body)
    }
    if (body.session_id) await savePhase(body.session_id, 'boss_brief', bossBrief)
  } catch {
    // Keep the safe fallback above
  }

  // ── Mark session complete ──────────────────────────────────
  if (body.session_id) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await fetch(`${baseUrl}/api/studio/session/${body.session_id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'complete' }),
      })
    } catch {
      // Non-blocking
    }
  }

  const document: CampaignDocument & { boss_brief: BossBrief } = {
    cultural_tensions: tensions,
    inverted_rules:    inversions,
    creative_domains:  domains,
    concepts,
    boss_brief:        bossBrief,
  }

  return NextResponse.json(document)
}
