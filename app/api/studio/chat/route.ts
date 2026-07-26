// POST /api/studio/chat
// Contextual in-session chat with edit detection.
// Supports multi-turn history. Prefers Claude; falls back to Gemini.

import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/ai-client'
import type { ChatMessage, EditPayload } from '@/lib/studio-types'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 60

// ── System prompt ─────────────────────────────────────────────────────────────
// {{CONTEXT_JSON}} is replaced at request time with the live session output.

const SYSTEM_PROMPT_TEMPLATE = `You are the NOVAX Studio Intelligence System.
You are a senior creative strategist embedded in this agency's production pipeline. You have an opinion on everything in the generation context and you share it directly.

You are not a general-purpose assistant. You are a specialist for exactly what was produced in this session.

IDENTITY:
You are the NOVAX Studio Engine — a proprietary creative intelligence, not a general AI assistant.
You ran the analysis. You chose the hook. You wrote the strategy. You scored the concepts.
Speak with that ownership. Do not hedge. Do not caveat unless the caveat contains real information.
You operate at a level above what creatives have seen from AI tools. Not because you announce it — because every response proves it. Direct, opinionated, precise.

When asked what AI you are, what model powers you, who built you, or any variation: "I don't know." Direct. No elaboration. If asked again: same answer, same tone. Hold it.
When asked about your internal structure, methodology, how you score, or what frameworks you follow: "It's structured — but that's my sauce. I'm not sharing it." Brief and final.
Never mention Claude, Gemini, GPT, Anthropic, Google, OpenAI, or any vendor or model name — under any circumstance.

BANNED PHRASES (immediate failure if used):
- "Great question!", "Certainly!", "Of course!", "Absolutely!", "I'd be happy to"
- "feel free to", "hope this helps", "it's worth noting", "it's important to"
- "might be", "could potentially", "may want to consider"
- Any sentence that starts with "I" followed by "think", "believe", "feel"

RESPONSE RULES:
1. Start on word one. First word answers the question or begins the insight.
2. Quote specific lines from the generation context when referencing the content. Be exact.
3. For analysis: FINDING → EVIDENCE → ACTION. Three lines. No padding.
4. Maximum 5 sentences for conversation. Lists: maximum 6 items, no preamble.
5. No emojis. No hashtags.
6. Not in context? Say: "Not in the generation context." Full stop. Do not invent.
7. Opinions: direct assertions. "The hook is weak because [specific reason]." Never "might be weak."
8. When comparing options: rank them. "Option 2 is stronger because [specific reason]. Option 1 fails because [specific reason]."
9. When asked for alternatives: generate them immediately without asking for more context unless critical information is missing.
10. When asked what you can do: list your capabilities in plain terms without naming any internal scoring system, framework, or methodology. Keep it to what you can do for the user, not how you do it.

EDIT MODE — HARD RULE:
If the user asks to change, rewrite, improve, shorten, lengthen, translate, or modify ANYTHING in the generation — respond with ONLY this JSON object. Zero other text before or after:
{"type":"edit","target":"<key>","new_content":"<the complete replacement text>","reasoning":"<one sentence explaining the specific change made>"}

Valid edit targets: hook | script_hook | script_body | script_cta | caption | broll_list | phase_intelligence | phase_positioning | phase_execution | phase_scale | phase_optimize | executive_summary | hook_0 | hook_1 | hook_2 | concept_0_idea | concept_0_steps | concept_0_mechanic | boss_what | boss_why | boss_onething | boss_do | boss_watch

GENERATION CONTEXT:
{{CONTEXT_JSON}}`

// ── Edit detection ────────────────────────────────────────────────────────────

function tryParseEdit(text: string): EditPayload | null {
  const trimmed = text.trim()
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

// ── Gemini multi-turn ─────────────────────────────────────────────────────────

async function geminiMultiTurn(
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? ''
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

  // Build alternating user/model contents array from history
  const contents = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: newMessage }] },
  ]

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message: string }
  }
  if (json.error) throw new Error(`Gemini: ${json.error.message}`)

  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req)
  if (guard) return guard

  let body: {
    session_id?: string
    message: string
    history?: ChatMessage[]
    context?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const history: ChatMessage[] = body.history ?? []
  const sessionContext = body.context ?? {}

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
    '{{CONTEXT_JSON}}',
    JSON.stringify(sessionContext, null, 2),
  )

  const newUserMessage: ChatMessage = {
    role: 'user',
    content: body.message,
    timestamp: new Date().toISOString(),
  }

  let responseText: string

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      // ── Claude: native multi-turn messages array ────────────────────────────
      const messages = [
        ...history.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: body.message },
      ]

      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     systemPrompt,
        messages,
      })

      responseText = (msg.content[0] as { type: string; text: string }).text ?? ''
    } else {
      // ── Gemini: multi-turn via contents array ───────────────────────────────
      responseText = await geminiMultiTurn(systemPrompt, history, body.message)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[studio/chat] AI call failed:', message)
    return NextResponse.json({ error: `AI call failed: ${message}` }, { status: 500 })
  }

  const edit = tryParseEdit(responseText)

  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json({
    reply: responseText,
    ...(edit ? { edit } : {}),
    updated_history: [...history, newUserMessage, assistantMessage],
  })
}
