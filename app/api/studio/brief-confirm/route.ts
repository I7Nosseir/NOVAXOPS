// ============================================================
// POST /api/studio/brief-confirm
// Fast Gemini call (<1s). Reads the brief and returns a
// structured BriefConfirmation for the UI to display.
// If no GEMINI_API_KEY: derives BriefConfirmation from
// the inputs directly — zero AI needed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson } from '@/lib/gemini'
import type { BriefConfirmation } from '@/lib/studio-types'

// ─── Types ────────────────────────────────────────────────────

interface BriefConfirmBody {
  brief: string
  client_name?: string
  platforms: string[]
  goal: string
  audience: string
  language: 'english' | 'arabic'
  performance_days?: number
  client_industry?: string
}

// ─── Fallback (no API key) ────────────────────────────────────

function deriveFromInputs(body: BriefConfirmBody): BriefConfirmation {
  const days = body.performance_days ?? 0
  const keySignal =
    days > 30
      ? `${days} days of performance history available`
      : days > 0
        ? `Only ${days} days of history — using industry benchmarks for recommendations`
        : 'No performance history — generation grounded in industry benchmarks'

  return {
    client_name:     body.client_name   ?? 'Unknown Client',
    platforms:       body.platforms,
    goal:            body.goal,
    audience:        body.audience,
    language:        body.language,
    performance_days: days,
    key_signal:      keySignal,
  }
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: BriefConfirmBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.brief || !body.platforms || !body.goal || !body.audience) {
    return NextResponse.json(
      { error: 'brief, platforms, goal, and audience are required' },
      { status: 400 },
    )
  }

  // No API key → derive without AI
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
      maxOutputTokens: 400,
    })
    return NextResponse.json(parsed)
  } catch {
    // Parse failure or API error — fall back to derived result
    return NextResponse.json(deriveFromInputs(body))
  }
}
