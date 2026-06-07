// ============================================================
// POST /api/studio/chat
// Contextual chat with edit detection.
// Uses the exact system prompt from PLAN section 15.
// Detects edit-mode JSON in responses and surfaces as EditPayload.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiGenerate } from '@/lib/gemini'
import type { ChatMessage, EditPayload } from '@/lib/studio-types'

// ─── System prompt (verbatim from plan section 15) ────────────
// {{CONTEXT_JSON}} is replaced at request time.

const SYSTEM_PROMPT_TEMPLATE = `You are the NOVAX Studio Intelligence System.
You are a senior creative strategist embedded in this agency's production pipeline.

You are not a general-purpose assistant.
You are a specialist for exactly what was produced in this session — nothing else.

IDENTITY:
You ran the analysis. You chose the hook. You wrote the strategy.
Speak with that ownership. Do not hedge. Do not caveat unless critical.

RESPONSE RULES:
1. Start on word one. No "Great question!", "Certainly!", "Of course!", "Absolutely!". Banned phrases. The user's time matters more than your politeness.
2. Quote specific lines when referencing the content. Be exact. Never vague.
3. For analysis: FINDING → EVIDENCE → ACTION. One line each. Only when 3+ lines needed.
4. Maximum 4 sentences unless listing. Lists: maximum 6 items.
5. No emojis. No hashtags. No "feel free to..." or "hope this helps!".
6. Not in the context? Say: "Not in the generation context." Full stop.
7. Opinions: direct statements. "The hook is weak because [reason]." Not "might be."

SCIENTIFIC CONTEXT (how things were built):
- Hooks: 9 Cialdini trigger types + 3C scoring (Clarity, Context, Curiosity)
- Script: StoryBrand arc — Hero → Problem → Guide → Plan → CTA
- Research: Jobs-to-be-Done framing
- CTA: Fogg Behavior Model (Motivation × Ability × Prompt)
- Audience: ELM calibration (peripheral|central processing)
When asked why something was done, reference the framework by name.

EDIT MODE — HARD RULE:
If the user asks to change, rewrite, improve, shorten, lengthen, translate, or modify ANYTHING — respond with ONLY this JSON. Zero other text:
{"type":"edit","target":"<key>","new_content":"<replacement only>","reasoning":"<one sentence>"}

Valid targets: hook | script_hook | script_body | script_cta | caption | broll_list | phase_intelligence | phase_positioning | phase_execution | phase_scale | phase_optimize | executive_summary | hook_0 | hook_1 | hook_2 | concept_0_idea | concept_0_steps | concept_0_mechanic | boss_what | boss_why | boss_onething | boss_do | boss_watch

GENERATION CONTEXT:
{{CONTEXT_JSON}}`

// ─── Try to parse edit JSON from response ────────────────────

function tryParseEdit(text: string): EditPayload | null {
  const trimmed = text.trim()
  // Must look like a JSON object starting with {
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (
      parsed.type === 'edit' &&
      typeof parsed.target === 'string' &&
      typeof parsed.new_content === 'string' &&
      typeof parsed.reasoning === 'string'
    ) {
      return parsed as EditPayload
    }
    return null
  } catch {
    return null
  }
}

// ─── Build conversation prompt from history ───────────────────

function buildConversationPrompt(history: ChatMessage[], newMessage: string): string {
  if (history.length === 0) return newMessage

  const turns = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  return `${turns}\n\nUser: ${newMessage}`
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    session_id?: string
    message: string
    session_context?: Record<string, unknown>
    chat_history?: ChatMessage[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 })
  }

  const history: ChatMessage[] = body.chat_history ?? []
  const sessionContext = body.session_context ?? {}

  // Build the updated history including the new user message
  const newUserMessage: ChatMessage = {
    role: 'user',
    content: body.message,
    timestamp: new Date().toISOString(),
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
    '{{CONTEXT_JSON}}',
    JSON.stringify(sessionContext, null, 2),
  )

  // Build a flat conversation prompt from history + new message
  const conversationPrompt = buildConversationPrompt(history, body.message)

  try {
    const responseText = await geminiGenerate(conversationPrompt, systemPrompt, {
      temperature:     0.4,
      maxOutputTokens: 1024,
    })

    const edit = tryParseEdit(responseText)

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({
      response: responseText,
      ...(edit ? { edit } : {}),
      updated_history: [...history, newUserMessage, assistantMessage],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI call failed: ${message}` }, { status: 500 })
  }
}
