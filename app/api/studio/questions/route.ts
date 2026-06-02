// ============================================================
// POST /api/studio/questions
// Haiku call. Returns a StructuredQuestion with 4 AI-generated
// or static options for the one structured question per tool.
// Never blocked — static fallback if Haiku fails.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { StructuredQuestion, StudioTool } from '@/lib/studio-types'

// ─── Static fallbacks per tool ────────────────────────────────

const STATIC_QUESTIONS: Record<string, StructuredQuestion> = {
  content: {
    question: 'What should this content make people FEEL the moment they see the first second?',
    options: [
      'Called out — their current belief is wrong',
      'Curious — they are missing something important',
      'FOMO — everyone else already knows this',
      'Proud — this reflects their taste and values',
    ],
    type: 'static',
  },
  hooks: {
    question: 'How bold should these hooks be?',
    options: [
      'Familiar — safe for any audience',
      'Unexpected — push the boundary',
      'Edge — make them uncomfortable',
      'Satirical — use humor and irony',
    ],
    type: 'static',
  },
  strategy: {
    question: 'What is the biggest obstacle to growth right now?',
    options: [
      'Awareness — not enough people know we exist',
      'Trust — people know us but do not believe us yet',
      'Differentiation — we look the same as everyone else',
      'Retention — we attract but cannot keep the audience',
    ],
    type: 'static',
  },
  campaign: {
    question: 'How bold are we going?',
    options: [
      'Safe — conventional and on-brand',
      'Disrupting — challenges industry norms',
      'Red Bull level — culture-defining provocation',
      'Something more nuanced...',
    ],
    type: 'static',
  },
}

// "Something else..." is always the 5th option — frontend appends it
// The backend only returns the 4 AI-generated or static options.

// ─── AI-generated question options ───────────────────────────

async function generateContentOptions(
  brief: string,
  client_name: string | undefined,
  platforms: string[],
  goal: string,
  audience: string,
): Promise<string[]> {
  const client = new Anthropic()

  const prompt = `A creative agency is about to generate social content for a client.

Brief: "${brief}"
Client: ${client_name ?? 'Not specified'}
Platforms: ${platforms.join(', ')}
Goal: ${goal}
Audience: ${audience}

Your task: Generate 4 emotionally distinct options for this question:
"What should this content make people FEEL the moment they see the first second?"

Rules:
- Each option must be a specific emotion + trigger phrase (e.g. "Called out — their current belief is wrong")
- Options must be meaningfully different — not variations of the same feeling
- Ground them in the specific brief above — not generic emotions
- Format: exactly 4 lines, one option per line, no numbering, no bullets
- Each option: "[Emotion label] — [one-clause explanation]"

Return only the 4 lines. Nothing else.`

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)

  if (lines.length < 4) throw new Error('Insufficient options returned')
  return lines
}

async function generateStrategyOptions(
  brief: string,
  client_name: string | undefined,
  platforms: string[],
  goal: string,
  audience: string,
): Promise<string[]> {
  const client = new Anthropic()

  const prompt = `A creative agency is building a social media strategy for a client.

Brief: "${brief}"
Client: ${client_name ?? 'Not specified'}
Platforms: ${platforms.join(', ')}
Goal: ${goal}
Audience: ${audience}

Generate 4 specific options for this question:
"What is the biggest obstacle to growth right now?"

Rules:
- Each option must be a specific, business-real obstacle — not generic
- Ground them in the brief, platforms, and goal above
- Format: exactly 4 lines, no numbering, no bullets
- Each option: "[Obstacle type] — [one-clause description specific to this client]"

Return only the 4 lines. Nothing else.`

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)

  if (lines.length < 4) throw new Error('Insufficient options returned')
  return lines
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    tool: StudioTool
    brief: string
    client_name?: string
    platforms: string[]
    goal: string
    audience: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.tool || !body.brief) {
    return NextResponse.json({ error: 'tool and brief are required' }, { status: 400 })
  }

  // Tools with static questions — return immediately, no AI needed
  if (body.tool === 'hooks' || body.tool === 'campaign') {
    const q = STATIC_QUESTIONS[body.tool]
    return NextResponse.json(q)
  }

  // Tools without a defined question — return content fallback
  if (!STATIC_QUESTIONS[body.tool]) {
    return NextResponse.json(STATIC_QUESTIONS.content)
  }

  // No API key → return static fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...STATIC_QUESTIONS[body.tool], type: 'static' })
  }

  // AI-generated options
  try {
    let options: string[]
    let question: string

    if (body.tool === 'content') {
      options = await generateContentOptions(
        body.brief,
        body.client_name,
        body.platforms,
        body.goal,
        body.audience,
      )
      question = 'What should this content make people FEEL the moment they see the first second?'
    } else if (body.tool === 'strategy') {
      options = await generateStrategyOptions(
        body.brief,
        body.client_name,
        body.platforms,
        body.goal,
        body.audience,
      )
      question = 'What is the biggest obstacle to growth right now?'
    } else {
      // Fallback for any other tool
      return NextResponse.json(STATIC_QUESTIONS[body.tool] ?? STATIC_QUESTIONS.content)
    }

    const result: StructuredQuestion = {
      question,
      options,
      type: 'generated',
    }
    return NextResponse.json(result)
  } catch {
    // Haiku failed — return static fallback, never block
    return NextResponse.json({ ...STATIC_QUESTIONS[body.tool], type: 'static' })
  }
}
