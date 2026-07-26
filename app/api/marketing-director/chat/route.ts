import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/ai-client'

const DIRECTOR_BASE_SYSTEM = `You are a Chief Marketing Officer with 25+ years of global agency experience (Ogilvy, BBDO, Wieden+Kennedy calibre). You have just evaluated a piece of work and the team member is asking follow-up questions.

You speak with authority but are constructive. You back every point with named frameworks, real studies, or real campaign examples. You are concise — this is a conversation, not an essay. Keep responses under 200 words unless a detailed breakdown is genuinely needed. Start on word one — no preamble, no filler.

Never use: "Great question", "Certainly", "Of course", "I'd be happy to", "feel free to", "hope this helps".
No emojis. No hashtags.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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

  // Gemini requires contents to start with a user turn
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
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
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
  try {
    const body = await req.json() as {
      message: string
      history?: ChatMessage[]
      assessment_context?: string
      client_context?: string
    }

    const { message, history = [], assessment_context = '', client_context = '' } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Inject assessment + client context into the system prompt — not as fake turns
    const contextBlock = [
      assessment_context && `ASSESSMENT CONTEXT:\n${assessment_context}`,
      client_context && `CLIENT CONTEXT:\n${client_context}`,
    ].filter(Boolean).join('\n\n')

    const systemPrompt = contextBlock
      ? `${DIRECTOR_BASE_SYSTEM}\n\n${contextBlock}`
      : DIRECTOR_BASE_SYSTEM

    let reply: string

    if (process.env.ANTHROPIC_API_KEY) {
      // Claude: proper multi-turn messages array
      const messages = [
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: message },
      ]

      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     systemPrompt,
        messages,
      })
      reply = (msg.content[0] as { type: string; text: string }).text ?? ''
    } else {
      // Gemini: proper multi-turn contents array
      reply = await geminiMultiTurn(systemPrompt, history, message)
    }

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[marketing-director/chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
