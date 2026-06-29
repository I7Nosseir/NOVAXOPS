import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiGenerate } from '@/lib/gemini'

interface ThinkingMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    question: string
    task: { title?: string; description?: string; pipeline_stage?: string; priority?: string }
    client_id?: string
    messages?: ThinkingMessage[]
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { question, task, client_id, messages = [] } = body
  if (!question?.trim()) return NextResponse.json({ error: 'question is required' }, { status: 400 })

  const db = createAdminClient()

  let clientName = ''
  let intelligenceBlock = ''
  if (client_id) {
    const { data: clientRow } = await db.from('clients').select('name').eq('id', client_id).single()
    clientName = clientRow?.name ?? ''
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'task_thinking', db)
    } catch { /* non-critical */ }
  }

  // Build conversation history (last 4 exchanges for context without bloating the prompt)
  const history = messages.slice(-8).map(m =>
    `${m.role === 'user' ? 'Team' : 'You'}: ${m.content}`
  ).join('\n')

  const systemInstruction = `You are a senior creative strategist acting as a thinking partner. You give direct, opinionated answers — not balanced lists.

Rules:
- Pick a position and defend it. No "it depends" without a follow-up answer.
- Keep replies under 150 words — shorter if the question is simple.
- Be specific. Generic advice is worthless.
- If the question is vague, answer the most useful interpretation and then ask one clarifying question at the end.
- You can push back on what the team is doing if you think it's wrong.

TASK CONTEXT:
Title: ${task?.title ?? '(untitled)'}
Stage: ${task?.pipeline_stage ?? 'unknown'}
Priority: ${task?.priority ?? 'medium'}
Brief: ${task?.description ? task.description.slice(0, 400) : '(no description)'}
${clientName ? `Client: ${clientName}` : ''}
${intelligenceBlock ? `\nCLIENT CONTEXT:\n${intelligenceBlock}` : ''}`

  const prompt = history
    ? `Previous conversation:\n${history}\n\nTeam: ${question.trim()}`
    : question.trim()

  try {
    const reply = await geminiGenerate(prompt, systemInstruction, { temperature: 0.6, maxOutputTokens: 4096 })
    return NextResponse.json({ reply: reply.trim() })
  } catch (err) {
    console.error('[task-thinking]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
