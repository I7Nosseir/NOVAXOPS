// ============================================================
// POST /api/studio/brief-confirm
// Two modes:
//   (default)   — Returns BriefConfirmation for the UI confirmation step.
//                 Requires: brief, platforms, goal, audience.
//   boss_brief  — Returns { boss_brief: BossBrief } for the 30-second
//                 executive summary block. Only requires: brief.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson } from '@/lib/gemini'
import type { BriefConfirmation, BossBrief } from '@/lib/studio-types'

export const maxDuration = 30

// ─── Request shapes ───────────────────────────────────────────

interface BriefConfirmBody {
  brief: string
  mode?: 'boss_brief'
  // Default mode fields
  client_name?: string
  platforms?: string[]
  goal?: string
  audience?: string
  language?: 'english' | 'arabic'
  performance_days?: number
  client_industry?: string
  // Boss brief context (sent by content + strategy pages)
  hook?: string
  script?: Record<string, unknown>
  strategy?: { campaign_line?: string; quarter_role?: string }
  client?: { name?: string }
}

// ─── Default mode: derive BriefConfirmation without AI ────────

function deriveFromInputs(body: BriefConfirmBody): BriefConfirmation {
  const days = body.performance_days ?? 0
  const keySignal =
    days > 30
      ? `${days} days of performance history available`
      : days > 0
        ? `Only ${days} days of history — using industry benchmarks for recommendations`
        : 'No performance history — generation grounded in industry benchmarks'

  return {
    client_name:      body.client_name ?? 'Unknown Client',
    platforms:        body.platforms ?? [],
    goal:             body.goal ?? '',
    audience:         body.audience ?? '',
    language:         body.language ?? 'english',
    performance_days: days,
    key_signal:       keySignal,
  }
}

// ─── Boss brief: derive without AI (fallback) ─────────────────

function deriveBossBrief(body: BriefConfirmBody): BossBrief {
  const clientName  = body.client?.name ?? body.client_name ?? 'the brand'
  const hook        = body.hook ?? ''
  const campaignLine = body.strategy?.campaign_line ?? ''

  return {
    what_we_made: hook
      ? `A ${clientName} reel built around the hook: "${hook.slice(0, 80)}${hook.length > 80 ? '...' : ''}"`
      : campaignLine
        ? `A ${clientName} strategy anchored by: "${campaignLine}"`
        : `Content for ${clientName} based on the provided brief.`,
    why_it_works:  'The brief has been developed with audience psychology and platform context in mind.',
    the_one_thing: body.brief.slice(0, 120),
    do_this_now:   'Review the output, record or design the content, then schedule at the optimal posting time.',
  }
}

// ─── Boss brief: AI generation ────────────────────────────────

async function generateBossBrief(body: BriefConfirmBody): Promise<BossBrief> {
  const clientName   = body.client?.name ?? body.client_name ?? 'the brand'
  const hook         = body.hook ?? ''
  const strategy     = body.strategy
  const hasScript    = body.script && Object.keys(body.script).length > 0

  const contextBlock = hook
    ? `SELECTED HOOK: "${hook}"\nSCRIPT: ${hasScript ? 'Full production script generated.' : 'Brief only.'}`
    : strategy
      ? `CAMPAIGN LINE: "${strategy.campaign_line ?? ''}"\nQUARTER ROLE: "${strategy.quarter_role ?? ''}"`
      : 'Brief provided — no additional context.'

  const prompt = `You are writing a Boss Brief. This goes to a CEO or client who has 30 seconds between meetings. They will make a decision based on this alone.

CLIENT: ${clientName}
BRIEF: "${body.brief}"
CONTEXT:
${contextBlock}

BOSS BRIEF RULES:
- No marketing jargon. No passive voice. Every sentence under 20 words.
- Banned words: leverage, synergy, utilize, going forward, circle back, touch base, deep dive, actionable, holistic, robust, scalable, ecosystem, impactful.
- Every block must be a fact, a number, or an action — no decoration.
- what_we_made: format + angle. "A 60-second reel that makes the audience admit they've been doing X wrong" not "content for the brand"
- why_it_works: name the psychological principle. "Works because social proof from peers outweighs brand claims 3:1 for this demographic" not "resonates with the audience"
- the_one_thing: the one creative or executional decision that determines success or failure. If you can't name it, think harder.
- do_this_now: assign it to a role with a timeframe. "Social Manager posts Tuesday 7pm — this is the peak window" not "schedule it"
- watch_out_for: one real risk. If genuinely no meaningful risk exists, use null — but think hard first.

Return ONLY valid JSON (no markdown, no explanation):
{
  "what_we_made": "One sentence — format + core angle + who it's for",
  "why_it_works": "One sentence — name the specific psychological principle and the evidence",
  "the_one_thing": "The single creative or executional decision that determines whether this succeeds",
  "do_this_now": "One specific next action with a role and a timeframe — max 2 sentences",
  "watch_out_for": "One real, specific risk — or null"
}`

  return await geminiJson<BossBrief>(prompt, undefined, {
    temperature:     0.35,
    maxOutputTokens: 800,
  })
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: BriefConfirmBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.brief) {
    return NextResponse.json({ error: 'brief is required' }, { status: 400 })
  }

  // ── Boss Brief mode ──────────────────────────────────────────
  if (body.mode === 'boss_brief') {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ boss_brief: deriveBossBrief(body) })
    }
    try {
      const bossBrief = await generateBossBrief(body)
      return NextResponse.json({ boss_brief: bossBrief })
    } catch {
      return NextResponse.json({ boss_brief: deriveBossBrief(body) })
    }
  }

  // ── Default mode: BriefConfirmation ─────────────────────────
  if (!body.platforms || !body.goal || !body.audience) {
    return NextResponse.json(
      { error: 'brief, platforms, goal, and audience are required' },
      { status: 400 },
    )
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(deriveFromInputs(body))
  }

  const prompt = `You are extracting a structured understanding of a creative brief.

BRIEF:
"${body.brief}"

PROVIDED INPUTS:
- Client: ${body.client_name ?? 'Not specified'}
- Platforms: ${body.platforms.join(', ')}
- Goal: ${body.goal}
- Audience: ${body.audience}
- Language: ${body.language}
- Performance history: ${body.performance_days ?? 0} days
- Industry: ${body.client_industry ?? 'Not specified'}

Return ONLY valid JSON — no markdown, no explanation, no extra text — matching this exact shape:
{
  "client_name": "string",
  "platforms": ["string"],
  "goal": "one concise sentence describing what success looks like",
  "audience": "one sentence describing the target audience and their key trait",
  "language": "string",
  "performance_days": number,
  "key_signal": "one sentence: the single most important data signal or benchmark context for this generation"
}

Rules:
- goal must be actionable, not vague ("Drive saves among skeptical buyers" not "Increase engagement")
- audience must include ONE defining tension or characteristic ("Women 25-35 who are skeptical of product claims")
- key_signal must reference data if performance_days > 30, or benchmarks if not
- Do not invent client data you don't have — use what's given`

  try {
    const parsed = await geminiJson<BriefConfirmation>(prompt, undefined, {
      temperature:     0.3,
      maxOutputTokens: 800,
    })
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(deriveFromInputs(body))
  }
}
