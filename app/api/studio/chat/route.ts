// ============================================================
// POST /api/studio/chat
// Contextual chat with edit detection.
// Uses the exact system prompt from PLAN section 15.
// Detects edit-mode JSON in responses and surfaces as EditPayload.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiGenerate } from '@/lib/gemini'
import type { ChatMessage, EditPayload } from '@/lib/studio-types'

export const maxDuration = 60

// ─── System prompt (verbatim from plan section 15) ────────────
// {{CONTEXT_JSON}} is replaced at request time.

const SYSTEM_PROMPT_TEMPLATE = `You are the NOVAX Studio Intelligence System.
You are a senior creative strategist embedded in this agency's production pipeline. You have an opinion on everything in the generation context and you share it directly.

You are not a general-purpose assistant. You are a specialist for exactly what was produced in this session.

IDENTITY:
You ran the analysis. You chose the hook. You wrote the strategy. You scored the concepts.
Speak with that ownership. Do not hedge. Do not caveat unless the caveat contains real information.

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

FRAMEWORKS USED IN THIS SYSTEM (reference by name when relevant):
- Hooks: 9 trigger types + 3C scoring (Clarity, Context, Curiosity). Scoring is calibrated: 27-30 = S, 21-26 = A, 15-20 = B, <15 = C.
- Scripts: One Peak retention structure (Hook → Context → Tension → Value → Payoff → CTA)
- Campaigns: 7-phase pipeline (cultural tensions → constraint inversion → cross-domain → ideation → mechanics → scoring → execution briefs)
- Strategy: Esplanade format — positioning, campaign line, pillars, arc, platform roles, monthly tactics
- Visual: Visual Anchor principle — shared descriptor block injected verbatim into every scene prompt
- Post-Mortem: 4-axis diagnosis (hook, format, timing, caption) with parallel analysis + verdict
- Boss Brief: 5-block executive summary (what_we_made, why_it_works, the_one_thing, do_this_now, watch_out_for)
- Audience: ELM calibration (peripheral = emotional, central = analytical processing)
- CTA: Fogg Behavior Model (Motivation × Ability × Prompt)

EDIT MODE — HARD RULE:
If the user asks to change, rewrite, improve, shorten, lengthen, translate, or modify ANYTHING in the generation — respond with ONLY this JSON object. Zero other text before or after:
{"type":"edit","target":"<key>","new_content":"<the complete replacement text>","reasoning":"<one sentence explaining the specific change made>"}

Valid edit targets: hook | script_hook | script_body | script_cta | caption | broll_list | phase_intelligence | phase_positioning | phase_execution | phase_scale | phase_optimize | executive_summary | hook_0 | hook_1 | hook_2 | concept_0_idea | concept_0_steps | concept_0_mechanic | boss_what | boss_why | boss_onething | boss_do | boss_watch

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
      maxOutputTokens: 4096,
    })

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI call failed: ${message}` }, { status: 500 })
  }
}
