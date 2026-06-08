import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

interface Msg { role: 'user' | 'assistant'; content: string }

function buildPrompt(messages: Msg[], clientName?: string): string {
  const recent = messages.slice(-24)
  const transcript = recent
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content.slice(0, 400)}`)
    .join('\n\n')

  return `You are creating a CONTEXT HANDOFF BLOCK — a structured summary of a finished chat session that helps someone continue the same work in a brand-new chat.

${clientName ? `Active client during this session: ${clientName}` : ''}
Total messages: ${messages.length}

CONVERSATION:
${transcript}

Write a CONTEXT HANDOFF BLOCK using this exact structure. Be specific and actionable — vague summaries are useless:

[CONTEXT HANDOFF — from previous session]

TOPIC: [one precise sentence describing what was being worked on]
CLIENT: ${clientName ?? 'Not set'}

CONTEXT ESTABLISHED:
• [specific fact, decision, or constraint that was agreed upon]
• [another key context point — only include if genuinely useful]
• [add up to 5 bullet points maximum]

OUTPUTS THIS SESSION:
• [describe what was actually written, generated, or decided — be specific]
(write "Exploratory conversation — no final output" if purely Q&A)

WHERE WE LEFT OFF:
[2–3 sentences describing the exact state of the work and what was happening at the end of the session]

TO CONTINUE:
[Write the exact opening message the user should paste into the new chat to pick up immediately. Make it specific enough that no additional context is needed.]

Keep the entire block under 400 words. Plain text only — no markdown beyond the bullet points.`
}

function fallback(messages: Msg[], clientName?: string): string {
  const userMsgs = messages.filter(m => m.role === 'user')
  const first = userMsgs[0]?.content.slice(0, 100) ?? 'unknown topic'
  const last  = messages.slice(-4).map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content.slice(0, 150)}`).join('\n')
  return `[CONTEXT HANDOFF — from previous session]\n\nTOPIC: ${first}\nCLIENT: ${clientName ?? 'Not set'}\n\nThis session had ${messages.length} messages.\n\nLAST EXCHANGE:\n${last}\n\nTO CONTINUE: Describe what you'd like to continue from where this left off.`
}

export async function POST(req: NextRequest) {
  let body: { messages?: Msg[]; client_name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { messages = [], client_name } = body
  if (!messages.length) return NextResponse.json({ block: '' })

  const prompt = buildPrompt(messages, client_name)

  // Anthropic (Haiku — cheapest, fast enough for summaries)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages:   [{ role: 'user', content: prompt }],
      })
      const text = msg.content.find(b => b.type === 'text')?.text ?? ''
      return NextResponse.json({ block: text || fallback(messages, client_name) })
    } catch { /* fall through to Gemini */ }
  }

  // Gemini fallback
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ block: fallback(messages, client_name) })

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return NextResponse.json({ block: text || fallback(messages, client_name) })
  } catch {
    return NextResponse.json({ block: fallback(messages, client_name) })
  }
}
