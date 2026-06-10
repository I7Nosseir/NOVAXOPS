// ============================================================
// POST /api/studio/campaign/generate
// Campaign Igniter — 7-phase sequential pipeline.
// Each phase saves to session immediately on completion.
// Returns { campaign: CampaignDocument, boss_brief: BossBrief }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson, geminiGenerate } from '@/lib/gemini'
import { buildClientIntelligenceBlock, buildCompetitorContextBlock, adminSupabase } from '@/lib/client-intelligence'
import { aiGuard } from '@/lib/ai-guard'
import type {
  CampaignDocument,
  CampaignConcept,
  BossBrief,
  SignalReport,
} from '@/lib/studio-types'
import { pickRandomDomains } from '@/lib/studio-campaign-domains'

export const maxDuration = 300

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

async function savePhase(sessionId: string, phase: string, output: unknown): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/studio/session/${sessionId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phase, output }),
    })
  } catch {
    // Non-blocking
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

// ─── Phase 1: Cultural Tension Mining ────────────────────────

async function runPhase1(
  body: CampaignGenerateBody,
): Promise<Array<{ tension: string; evidence: string; opportunity: string }>> {
  const tensionsContext = body.signal_report?.cultural_tensions
    ? `Pre-computed signal report tensions:\n${JSON.stringify(body.signal_report.cultural_tensions, null, 2)}\n\nExpand, deepen, and add 3–4 more tensions specific to ${body.client_name} and their audience.`
    : `No Signal Report available. Generate from deep knowledge of ${body.industry} and the target audience.`

  const prompt = `You are a cultural intelligence analyst who has spent 10 years studying consumer psychology in ${body.industry}.
Your job: surface the tensions that make audiences stop mid-scroll, feel understood, and act.

TARGET AUDIENCE: ${body.target_audience}
INDUSTRY: ${body.industry}
CLIENT: ${body.client_name}
${body._intelligence_block ? `\nCLIENT INTELLIGENCE:\n${body._intelligence_block}` : ''}

${tensionsContext}

WHAT A REAL TENSION LOOKS LIKE:
A tension = something the audience WANTS and simultaneously RESISTS, FEARS, or FEELS GUILTY ABOUT.
Bad example: "People want beauty products but worry about price" — this is just a price objection.
Good example: "People in ${body.industry} publicly celebrate natural beauty while privately spending aggressively on products that promise artificial transformation — then feel shame about both."
The good version has: a want, a contradiction in behavior, and an emotional undercurrent.

TENSION MINING RULES:
1. Each tension must name a specific want AND a specific contradiction or resistance. Generic = rejected.
2. Evidence must describe an observable behavior pattern — what people DO, not what they say.
3. The opportunity must be counterintuitive: what does this tension ENABLE a brave brand to do that others won't?
4. At least 2 tensions must reflect something that has SHIFTED in 2024–2025 (cultural, economic, or behavioral change).
5. At least 1 must be a "second-order tension" — the tension beneath the tension. The thing audiences won't admit even to themselves.
6. At least 1 must be platform-specific: something specific to how ${(body.current_platforms ?? ['social media']).join(' and ')} users behave in ${body.industry}.

Generate 6–7 tensions. Reject any that could apply to any brand in any industry.

Return ONLY a valid JSON array — no markdown, no extra text:
[
  {
    "tension": "One sentence: [Audience] simultaneously [wants X] and [resists/fears/feels guilty about Y]",
    "evidence": "One sentence: The observable behavior that proves this tension exists right now",
    "opportunity": "One sentence: What this tension enables a brand to do that competitors are too scared to attempt"
  }
]`

  return geminiJson<Array<{ tension: string; evidence: string; opportunity: string }>>(
    prompt, undefined, { temperature: 0.6, maxOutputTokens: 4000 },
  )
}

// ─── Phase 2: Constraint Inversion ───────────────────────────

async function runPhase2(industry: string, client_name: string): Promise<Array<{ rule: string; inversion: string }>> {
  const prompt = `You are a creative strategist who specializes in breaking category conventions in ${industry}.

List 6 unwritten marketing rules that EVERY brand in ${industry} follows without questioning.
These are the rules that make all the brands look and sound the same.
Examples of what you're looking for:
- "Every luxury brand shows aspirational lifestyles rather than actual product use"
- "Every fitness brand shows transformation, not the boring daily process"
- "Every food brand uses close-up product photography with perfect lighting"

For ${industry}, find the specific rules that have become so normalized they're invisible.
Then invert each rule deliberately, specifically, and with creative intention.

A good inversion is not just "don't do X" — it's "actively do the opposite in a way that creates narrative."

Return ONLY a valid JSON array — no markdown, no extra text:
[
  {
    "rule": "One sentence: the unwritten rule every ${industry} brand follows",
    "inversion": "One sentence: the specific, actionable opposite — what a brand actually does if they break this rule publicly and on purpose"
  }
]`

  return geminiJson<Array<{ rule: string; inversion: string }>>(
    prompt, undefined, { temperature: 0.55, maxOutputTokens: 2000 },
  )
}

// ─── Phase 3: Cross-Domain Stimulation ───────────────────────

async function runPhase3(domains: string[], industry: string, client_name: string): Promise<string[]> {
  const prompt = `You are applying cross-domain thinking to generate campaign seeds for ${client_name} (${industry}).

Three thinking lenses: ${domains.join(', ')}

Each lens is a mental model from a different field. The goal is NOT to copy the domain — it's to think like someone from that domain would think about the campaign problem.

How each domain sees the world:
- A game designer asks: "What is the reward loop? What makes someone come back tomorrow?"
- A street artist asks: "Where is the unexpected surface? What's the medium no brand has claimed yet?"
- A chess grandmaster asks: "What is the three-move sequence? What do I do so the competitor's response helps me?"
- A neuroscientist asks: "What triggers the dopamine response? What creates anticipation versus satisfaction?"
- A stand-up comedian asks: "What is the setup that everyone nods at, and what is the punchline that flips it?"
- A documentary filmmaker asks: "What is the truth everyone knows but no one has said out loud yet?"
- A fashion designer asks: "What makes something a status signal? How do you make ordinary behavior feel exclusive?"

For each of the three lenses (${domains.join(', ')}), generate one raw campaign seed.
Wild. Unexpected. No self-editing. No feasibility filter. Just the concept.

Return ONLY 3 lines — one seed per line, no numbering, no JSON, no labels.`

  const text = await geminiGenerate(prompt, undefined, { temperature: 0.55, maxOutputTokens: 1000 })
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)

  return lines.length >= 3 ? lines : [
    `A ${domains[0]} would build a campaign with a reward loop — the audience earns something real for participating`,
    `A ${domains[1]} would find the unexpected surface — not where brands usually show up in ${industry}`,
    `A ${domains[2]} would structure the campaign so the competitor's most likely response becomes the campaign's second chapter`,
  ]
}

// ─── Phase 4: Divergent Ideation ─────────────────────────────

async function runPhase4(
  tensions: Array<{ tension: string; opportunity: string }>,
  inversions: Array<{ rule: string; inversion: string }>,
  seeds: string[],
  boldness: CampaignGenerateBody['boldness'],
  targetAudience: string,
  clientName: string,
  industry: string,
): Promise<string[]> {
  const boldnessModifier =
    boldness === 'red_bull'
      ? 'Include at least 5 concepts that would make a brand manager immediately say no. Push past discomfort into genuine provocation. If it feels safe, it is not bold enough.'
      : boldness === 'disrupting'
        ? 'Include at least 3 concepts that directly challenge the way the industry behaves. Not edgy for the sake of it — specifically targeted disruption.'
        : boldness === 'nuanced'
          ? 'Prioritize unexpected elegance over shock. Concepts that reward close attention. Subversions that only the audience notices.'
          : 'Keep concepts executable and brand-aligned while still being genuinely surprising. Polished but not predictable.'

  const prompt = `You are generating 20 raw campaign concepts for ${clientName} (${industry}).
No filtering. No judgment. Budget is irrelevant. Production scale is irrelevant. Career safety is irrelevant.
This is a pure divergent ideation session. The filter comes in the next phase.

TARGET AUDIENCE: ${targetAudience}

CULTURAL TENSIONS TO ACTIVATE (use at least 3):
${tensions.map((t) => `• ${t.tension}\n  OPPORTUNITY: ${t.opportunity}`).join('\n\n')}

INDUSTRY RULES TO BREAK (use at least 2):
${inversions.map((i) => `• RULE: ${i.rule}\n  BROKEN AS: ${i.inversion}`).join('\n\n')}

CROSS-DOMAIN SEEDS (use at least one from each):
${seeds.map((s, i) => `• SEED ${i + 1}: ${s}`).join('\n')}

MANDATORY DIVERSITY REQUIREMENTS — your 20 concepts must include:
✓ At least 3 that directly activate a cultural tension from the list above
✓ At least 1 from each cross-domain seed above
✓ At least 2 that could go genuinely viral within 24 hours with zero budget — concepts so simple and true that people share immediately
✓ At least 2 that use a completely unexpected medium or surface (NOT a social media post — think physical space, product packaging, email, SMS, audio, retail, etc.)
✓ At least 2 that put the audience in an uncomfortable but irresistible position — concepts that create productive tension
✓ At least 1 that a brand lawyer would immediately flag — but that would be completely legal
✓ At least 1 that involves real people (employees, critics, strangers) in an unexpected role
✓ ${boldnessModifier}

OUTPUT FORMAT:
- Exactly 20 lines
- One concept per line — one sentence only
- No explanation. No justification. No numbering. No bullets.
- Each concept must be specific to ${clientName} and ${industry} — not generic

Generate now:`

  const text = await geminiGenerate(prompt, undefined, { temperature: 0.85, maxOutputTokens: 8192 })
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 20)

  return lines.length >= 8 ? lines : [
    `Invite your most vocal critics to co-write the next campaign brief with you — publish the unedited transcript`,
    `Give the product to 30 strangers with one rule: document everything that goes wrong`,
    `Run every ad from the perspective of a customer who tried it and it didn't work — and what happened next`,
    `Create a campaign that only exists if people talk about it — silence makes it disappear in 24 hours`,
    `Partner with the one competitor you'd never partner with on a single piece of content that benefits both audiences`,
    `Document every step of the supply chain in real time — the boring parts, the mistakes, the delays`,
    `Let the audience vote on which product feature gets removed next — and actually do it`,
    `Commission a report from the audience on everything wrong with the industry — publish it with your logo on it`,
  ]
}

// ─── Phase 5: Participatory Mechanics ────────────────────────

async function runPhase5(
  concepts: string[],
  targetAudience: string,
): Promise<Array<{ concept: string; mechanic_type: string; mechanic_description: string }>> {
  const top10 = concepts.slice(0, 10)

  const prompt = `For each of these campaign concepts, design the participatory mechanic — exactly how the audience BECOMES the campaign.

TARGET AUDIENCE: ${targetAudience}

Great participatory mechanics create the feeling that the audience is co-authoring something real:
- Duolingo's death hoax: audiences mourned publicly → Duo came back from the dead → UGC explosion
- Vaseline Verified: audiences tested the viral hacks → posted results → brand amplified the honest outcomes
- McDonald's Floating Menu: pedestrians photographed a floating billboard daily → organic city-by-city spread
- Dove Real Beauty: women defined beauty in their own words → brand used their words verbatim in ads

Mechanic types:
- UGC trigger: audience creates content as the direct response
- Opinion mechanic: audience is asked to take a public position
- Mystery: incomplete information drives investigation and sharing
- Physical action: audience does something in the real world
- Duet/reaction: audience adds themselves to brand content
- Share-to-unlock: content only becomes available when shared
- Social proof trigger: participation becomes visible to peers
- Co-creation: audience literally makes something with the brand

Concepts:
${top10.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return ONLY a valid JSON array — no markdown, no extra text:
[
  {
    "concept": "exact concept text from above",
    "mechanic_type": "one mechanic type from the list",
    "mechanic_description": "Two sentences: exactly how the audience participates AND what they feel while doing it"
  }
]`

  return geminiJson<Array<{ concept: string; mechanic_type: string; mechanic_description: string }>>(
    prompt, undefined, { temperature: 0.5, maxOutputTokens: 4000 },
  )
}

// ─── Phase 6: Convergent Scoring ─────────────────────────────

interface ScoredConcept {
  concept:              string
  mechanic_type:        string
  mechanic_description: string
  boldness:             number
  implementability:     number
  virality:             number
}

async function runPhase6(
  conceptsWithMechanics: Array<{ concept: string; mechanic_type: string; mechanic_description: string }>,
  constraint: CampaignGenerateBody['constraint'],
): Promise<ScoredConcept[]> {
  const prompt = `You are scoring campaign concepts on three dimensions. Be ruthlessly honest — do not cluster scores around 7.

Concepts to score:
${conceptsWithMechanics.map((c, i) => `${i + 1}. ${c.concept}\nMechanic (${c.mechanic_type}): ${c.mechanic_description}`).join('\n\n')}

SCORING DEFINITIONS:
- Boldness (1–10): 1 = what every brand in this category already does, 10 = genuinely unexpected, risks discomfort
- Implementability (1–10): 10 = any team member could launch this in 3 days with their phone, 1 = requires Netflix production budget and 6 months
- Virality (1–10): 10 = nearly guaranteed organic sharing — the concept itself IS the share mechanic, 1 = no inherent reason to spread

CALIBRATION:
- A score of 6 means "above average." A score of 8 means "genuinely exceptional." A score of 10 should be rare.
- Boldness and virality are correlated but not the same. A cheap UGC mechanic can be viral without being bold.
- Implementability score of 5 = needs a small production budget and 2 weeks.

Return ONLY a valid JSON array — no markdown, no extra text:
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

  const scored = await geminiJson<ScoredConcept[]>(prompt, undefined, { temperature: 0.3, maxOutputTokens: 4000 })

  let filtered = scored.filter((c) => {
    if (c.boldness < 5) return false
    if (c.implementability < 4 && c.virality < 9) return false
    return true
  })

  if (constraint === 'budget') {
    filtered = filtered.map((c) => ({
      ...c,
      implementability: c.implementability > 7 ? c.implementability - 2 : c.implementability,
    }))
  } else if (constraint === 'brand_safe') {
    filtered = filtered.filter((c) => c.boldness <= 8)
  } else if (constraint === 'timeline') {
    filtered = filtered.filter((c) => c.implementability >= 6)
  }

  filtered.sort((a, b) => (b.boldness + b.virality) - (a.boldness + a.virality))

  return filtered.length > 0 ? filtered : scored.slice(0, 5)
}

// ─── Phase 7: Execution Briefs ────────────────────────────────

async function runPhase7(
  topConcepts: ScoredConcept[],
  body: CampaignGenerateBody,
  tensions: Array<{ tension: string; evidence: string; opportunity: string }>,
): Promise<CampaignConcept[]> {
  const top5 = topConcepts.slice(0, 5)

  const prompt = `You are a world-class creative strategist. You have led breakthrough campaigns for iconic brands across ${body.industry}.
Your execution briefs are legendary because they are specific enough that a junior social media manager can execute without a single clarifying question, yet creative enough that agencies study them.

This 7-phase ideation pipeline has just completed. The concepts below have survived:
cultural tension mining → constraint inversion → cross-domain stimulation → 20-concept divergent ideation → participatory mechanic design → convergent scoring.

Only the top ${top5.length} survived the filter. Now write their complete execution briefs.

═══════════════════════════════════════════════════
CLIENT CONTEXT
═══════════════════════════════════════════════════
Brand: ${body.client_name}
Industry: ${body.industry}
Target audience: ${body.target_audience}
Platforms: ${body.current_platforms.join(', ')}
Brand voice: ${body.brand_voice ?? 'Not specified'}
${body._intelligence_block ? `\nClient intelligence:\n${body._intelligence_block}` : ''}

═══════════════════════════════════════════════════
CULTURAL TENSIONS THIS CAMPAIGN ACTIVATES
═══════════════════════════════════════════════════
${tensions.map((t) => `• TENSION: ${t.tension}\n  EVIDENCE: ${t.evidence}\n  OPPORTUNITY: ${t.opportunity}`).join('\n\n')}

═══════════════════════════════════════════════════
TOP CONCEPTS (survived 7-phase filter)
═══════════════════════════════════════════════════
${top5.map((c, i) => `CONCEPT ${i + 1}: "${c.concept}"
  Mechanic: ${c.mechanic_type} — ${c.mechanic_description}
  Pipeline scores: Boldness ${c.boldness}/10 | Implementability ${c.implementability}/10 | Virality ${c.virality}/10`).join('\n\n')}

═══════════════════════════════════════════════════
EXECUTION BRIEF REQUIREMENTS
═══════════════════════════════════════════════════

Write a complete, production-ready brief for each of the ${top5.length} concepts above.

FIELD-BY-FIELD REQUIREMENTS:

1. campaign_name
   Maximum 3 words. Must be ownable — not a description. Not a tagline. A NAME.
   Test: would you put this on a deck slide and be proud of it?

2. tagline
   One punchy line. It must survive being printed on a billboard with zero context.
   No brand name in the tagline. No verbs like "discover" or "experience."

3. core_idea
   ONE sentence. Start with an active verb. If it needs two sentences, it is not clear enough yet.
   This is the sentence a CEO reads in the elevator and either nods or asks a follow-up question.

4. why_it_works
   Name a SPECIFIC psychological or behavioral principle (e.g., "Reactance theory", "Social facilitation", "Peak-end rule", "Beneffectance bias", "Identity-protective cognition") followed by one sentence showing exactly how it applies to THIS audience in THIS context. No generic psychology.

5. cultural_tension
   Quote the exact tension from the list above that this concept activates. Do not paraphrase.

6. platform
   "Primary: [platform] — [specific native content format e.g. 'Instagram Reels 9:16' or 'TikTok Stitch' or 'LinkedIn Document post'] | Secondary: [platform] — [format for amplification]"

7. execution_steps
   7 steps. Each step format: "[Role] — [specific action] → [specific measurable or observable outcome]"
   Bad: "Post the content" — Good: "Social Manager — Schedule the seed Reel for Tuesday 7:30 PM → catches the primary engagement window before competitor posting peaks at 9 PM"
   Steps must be sequential and assignable to a specific team role.

8. content_ladder
   3-item array. Shows how the content ESCALATES over 3 weeks.
   Format: "Week [N]: [Exact content format] — [Specific hook type] — [Expected audience response]"
   Example: "Week 1: Single Reel (no brand name, just the tension stated plainly) — curiosity hook — comments ask 'is this us?'"
   The escalation should make the audience feel like they're watching something build toward a revelation.

9. seed_strategy
   One paragraph. Answer: Who are the FIRST 20 people to receive this content (before any public launch)?
   Be specific: are they micro-influencers in [specific niche]? Loyal customers from [specific cohort]? Industry journalists? Employees? Critics?
   What do they receive? What specific action are they asked to take? Why were they chosen over everyone else?

10. virality_trigger
    Describe the EXACT moment when a neutral observer feels compelled to share this.
    Write it as a scene: "When [specific person] sees [specific thing happen], they immediately [specific action] because [specific psychological reason]."
    This is not the same as the participation mechanic — this is the involuntary response of someone who didn't even participate.

11. participation_mechanic
    One sentence. The specific action the audience takes that makes them part of the campaign.
    Must be simple enough to explain in 10 seconds.

12. shareable_moment
    Describe one specific image, video frame, or piece of text that this campaign will DEFINITELY produce — something visual enough to screenshot and share.
    Be specific about what it looks like. Not "authentic UGC" — describe the actual frame.

13. scoring
    Use the pipeline scores from above exactly as-is.

14. budget
    One of: "Low (<$500)" or "Medium ($500–$5,000)" or "High (>$5,000)"

15. timeline
    Be specific: "3 days" / "1 week" / "10 days" / "3 weeks" / "6 weeks" — not just "Days" or "Weeks"

16. risk
    The ONE specific thing that kills this campaign in the first 72 hours. Not a generic risk.

17. mitigation
    The specific action taken in the first 48 hours to prevent the risk above. Not generic advice.

18. anti_example
    Name a real campaign (brand + year if you know it) that attempted something similar and failed or underperformed.
    One sentence: what specifically went wrong.
    One sentence: what this concept does fundamentally differently to avoid the same outcome.

═══════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════

Return ONLY a valid JSON array of exactly ${top5.length} objects.
All 18 fields are required for every object.
No markdown fences. No trailing commas. No comments inside the JSON.

[
  {
    "campaign_name": "...",
    "tagline": "...",
    "core_idea": "...",
    "why_it_works": "...",
    "cultural_tension": "...",
    "platform": "...",
    "execution_steps": ["...", "...", "...", "...", "...", "...", "..."],
    "content_ladder": ["Week 1: ...", "Week 2: ...", "Week 3: ..."],
    "seed_strategy": "...",
    "virality_trigger": "...",
    "participation_mechanic": "...",
    "shareable_moment": "...",
    "scoring": { "boldness": 0, "implementability": 0, "virality": 0 },
    "budget": "...",
    "timeline": "...",
    "risk": "...",
    "mitigation": "...",
    "anti_example": "..."
  }
]`

  const text = await geminiGenerate(prompt, undefined, { temperature: 0.75, maxOutputTokens: 32000 })
  return parseJson<CampaignConcept[]>(text, top5.map((c, i) => ({
    campaign_name:          `Concept ${i + 1}`,
    tagline:                c.concept,
    core_idea:              c.concept,
    why_it_works:           'Social proof via observation learning — audiences adopt behaviors they see their peers perform first',
    cultural_tension:       tensions[0]?.tension ?? 'Core audience tension',
    platform:               body.current_platforms[0] ?? 'Instagram',
    execution_steps:        [
      'Creative Director — define the core mechanic and brief the production team → aligned execution brief',
      'Social Manager — identify the seed audience of 20 and brief them → confirmed seed list',
      'Designer — produce the seed content piece → final creative asset',
      'Social Manager — distribute to seed audience → first organic reactions captured',
      'Social Manager — monitor for organic spread signals → initial participation rate measured',
      'Creative Director — amplify top-performing organic responses → second wave of reach',
      'Account Manager — report participation rate and share metrics to client → campaign performance review',
    ],
    content_ladder:          [
      'Week 1: Seed content (minimal branding) — curiosity hook — audience asks questions',
      'Week 2: Brand response to audience questions — credibility hook — sustained engagement',
      'Week 3: Audience-generated content amplified — social proof hook — organic reach peak',
    ],
    seed_strategy:          'Identify 20 genuine customers who have previously engaged with brand content. Send them the campaign concept privately, ask them to be the first to respond publicly. Do not ask for positive framing — ask for honest reaction.',
    virality_trigger:       `When a bystander sees peers genuinely engaging with ${body.client_name}'s content on their terms, they share it because it feels real rather than manufactured — something rare enough to be worth sending to someone.`,
    participation_mechanic: c.mechanic_description,
    shareable_moment:       'The moment when the audience response is amplified by the brand — the frame where the person feels seen by a brand for the first time',
    scoring:                { boldness: c.boldness, implementability: c.implementability, virality: c.virality },
    budget:                 c.implementability >= 7 ? 'Low (<$500)' : c.implementability >= 4 ? 'Medium ($500–$5,000)' : 'High (>$5,000)',
    timeline:               c.implementability >= 7 ? '3–5 days' : c.implementability >= 4 ? '2–3 weeks' : '6+ weeks',
    risk:                   'Seed audience shares without context, stripping the campaign narrative before it builds',
    mitigation:             'Brief seed audience with a one-paragraph context note. Ask them to share with the campaign framing intact, not in isolation.',
    anti_example:           'Generic UGC campaigns that launched without seeding have low initial participation — this concept avoids that by guaranteeing a first wave of authentic response before any public launch.',
  })))
}

// ─── Boss Brief ───────────────────────────────────────────────

async function buildBossBrief(topConcept: CampaignConcept, body: CampaignGenerateBody): Promise<BossBrief> {
  const prompt = `Write a Boss Brief for this campaign. For a CEO or client with 30 seconds between meetings.

Campaign: "${topConcept.campaign_name}" — ${topConcept.tagline}
Client: ${body.client_name} (${body.industry})
Core idea: ${topConcept.core_idea}
Why it works: ${topConcept.why_it_works}
How the audience participates: ${topConcept.participation_mechanic}
Virality trigger: ${topConcept.virality_trigger ?? 'Organic sharing driven by authentic participation'}
Risk: ${topConcept.risk ?? 'None identified'}

BOSS BRIEF RULES:
- No marketing jargon. No passive voice. Every sentence must be under 20 words.
- Never write: leverage, synergy, utilize, going forward, circle back, touch base, deep dive, actionable insights, move the needle, holistic, robust, scalable, ecosystem.
- Every block must be either a fact, a number, or an action — no decoration.
- Written for someone in back-to-back meetings who will make a decision based on this alone.
- "The One Thing" must be the single most important creative or executional decision — the one that makes or breaks this campaign.
- "Do This Now" must be the literal next action — specific enough to assign to a person with a deadline.

Return ONLY valid JSON — no markdown, no extra text:
{
  "what_we_made": "One sentence: what was built and for whom — include the campaign name",
  "why_it_works": "One sentence: cite the specific psychological principle and the evidence",
  "the_one_thing": "The single creative or executional decision that determines whether this succeeds or fails",
  "do_this_now": "Specific next action with a person and a timeframe. Two sentences max.",
  "watch_out_for": "One-sentence risk. Only include if there is a meaningful risk worth flagging."
}`

  return geminiJson<BossBrief>(prompt, undefined, { temperature: 0.4, maxOutputTokens: 1000 })
}

// ─── Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

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

  // Inject client intelligence
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const intelBlock = await buildClientIntelligenceBlock(body.client_id, 'studio_content', db).catch(() => '')
      const compBlock  = await buildCompetitorContextBlock(body.client_id, db).catch(() => '')
      body._intelligence_block = [intelBlock, compBlock].filter(Boolean).join('\n\n')
    }
  }

  const domains = pickRandomDomains(3)

  // ── Phase 1 — Cultural Tension Mining ─────────────────────
  let tensions: Array<{ tension: string; evidence: string; opportunity: string }> = []
  try {
    tensions = await runPhase1(body)
    if (body.session_id) await savePhase(body.session_id, 'tensions', tensions)
  } catch {
    tensions = [{
      tension:     `Consumers in ${body.industry} want premium results but simultaneously resist the price signal that would signal quality`,
      evidence:    'Price sensitivity coexists with aspiration — audiences research premium options then buy mid-tier and justify it',
      opportunity: 'A brand that democratizes the premium result and openly acknowledges the price tension wins the audience that felt judged by the category',
    }]
  }

  // ── Phase 2 — Constraint Inversion ────────────────────────
  let inversions: Array<{ rule: string; inversion: string }> = []
  try {
    inversions = await runPhase2(body.industry, body.client_name)
    if (body.session_id) await savePhase(body.session_id, 'inversions', inversions)
  } catch {
    inversions = [{
      rule:      `Every ${body.industry} brand shows aspirational results rather than the real process`,
      inversion: 'Document the failure, the doubt, and the boring daily process — make the audience feel seen in the struggle rather than judged by the result',
    }]
  }

  // ── Phase 3 — Cross-Domain Stimulation ────────────────────
  let seeds: string[] = []
  try {
    seeds = await runPhase3(domains, body.industry, body.client_name)
    if (body.session_id) await savePhase(body.session_id, 'seeds', { domains, seeds })
  } catch {
    seeds = [
      `A ${domains[0]} would design a reward loop into every touchpoint — participation earns something real`,
      `A ${domains[1]} would find the unexpected medium — not where ${body.industry} brands usually show up`,
      `A ${domains[2]} would make the first move look like a mistake so the competitor's response becomes the campaign's second chapter`,
    ]
  }

  // ── Phase 4 — Divergent Ideation ──────────────────────────
  let rawConcepts: string[] = []
  try {
    rawConcepts = await runPhase4(tensions, inversions, seeds, body.boldness, body.target_audience, body.client_name, body.industry)
    if (body.session_id) await savePhase(body.session_id, 'raw_concepts', rawConcepts)
  } catch {
    rawConcepts = [
      `Invite critics to test the product publicly and document everything unfiltered`,
      `Give away the product to 30 people with one rule: document everything that goes wrong`,
      `Run a campaign that only exists if people talk about it — silence ends it in 24 hours`,
    ]
  }

  // ── Phase 5 — Participatory Mechanics ─────────────────────
  let conceptsWithMechanics: Array<{ concept: string; mechanic_type: string; mechanic_description: string }> = []
  try {
    conceptsWithMechanics = await runPhase5(rawConcepts, body.target_audience)
    if (body.session_id) await savePhase(body.session_id, 'mechanics', conceptsWithMechanics)
  } catch {
    conceptsWithMechanics = rawConcepts.slice(0, 10).map((c) => ({
      concept:              c,
      mechanic_type:        'UGC trigger',
      mechanic_description: 'Audience shares their own version of the core concept, feeling like co-authors rather than consumers',
    }))
  }

  // ── Phase 6 — Convergent Scoring ──────────────────────────
  let scoredConcepts: ScoredConcept[] = []
  try {
    scoredConcepts = await runPhase6(conceptsWithMechanics, body.constraint)
    if (body.session_id) await savePhase(body.session_id, 'scored_concepts', scoredConcepts)
  } catch {
    scoredConcepts = conceptsWithMechanics.map((c) => ({
      ...c, boldness: 7, implementability: 6, virality: 7,
    }))
  }

  // ── Phase 7 — Execution Briefs ─────────────────────────────
  let concepts: CampaignConcept[] = []
  try {
    concepts = await runPhase7(scoredConcepts, body, tensions)
    if (body.session_id) await savePhase(body.session_id, 'concepts', concepts)
  } catch (err) {
    console.error('[campaign/generate Phase 7]', err instanceof Error ? err.message : err)
    concepts = scoredConcepts.slice(0, 3).map((c, i) => ({
      campaign_name:          `Concept ${i + 1}`,
      tagline:                c.concept,
      core_idea:              c.concept,
      why_it_works:           'Social proof via observation learning',
      cultural_tension:       tensions[0]?.tension ?? 'Core audience tension',
      platform:               body.current_platforms[0] ?? 'Instagram',
      execution_steps:        ['Define the mechanic', 'Produce seed content', 'Launch to seed audience', 'Amplify organic responses', 'Measure participation rate'],
      content_ladder:         ['Week 1: Seed content — curiosity hook', 'Week 2: Brand responds — credibility hook', 'Week 3: UGC amplified — social proof'],
      seed_strategy:          '20 genuine customers briefed privately before public launch',
      virality_trigger:       'The moment when audience participation is reflected back by the brand — feels real, not manufactured',
      participation_mechanic: c.mechanic_description,
      shareable_moment:       'The specific frame where the audience sees their contribution amplified by the brand',
      scoring:                { boldness: c.boldness, implementability: c.implementability, virality: c.virality },
      budget:                 c.implementability >= 7 ? 'Low (<$500)' : c.implementability >= 4 ? 'Medium ($500–$5,000)' : 'High (>$5,000)',
      timeline:               c.implementability >= 7 ? '3–5 days' : '2–3 weeks',
      risk:                   'Seed audience shares without campaign context',
      mitigation:             'Brief seed audience with context note before any public launch',
      anti_example:           'Generic UGC campaigns without seeding fail at launch due to low initial participation',
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
  } catch { /* keep fallback */ }

  // ── Mark session complete ──────────────────────────────────
  if (body.session_id) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await fetch(`${baseUrl}/api/studio/session/${body.session_id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'complete' }),
      })
    } catch { /* non-blocking */ }
  }

  // ── Response — campaign nested under 'campaign' key ────────
  // The page reads data.campaign and data.boss_brief separately.
  return NextResponse.json({
    campaign: {
      cultural_tensions: tensions,
      inverted_rules:    inversions,
      creative_domains:  domains,
      concepts,
    } satisfies CampaignDocument,
    boss_brief: bossBrief,
  })
}
