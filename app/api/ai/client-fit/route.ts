import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface ClientFitResult {
  fit_score: number
  verdict: string
  pushbacks: string[]
  fixes: string[]
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

  let body: { content: string; client_id: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { content, client_id } = body
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })
  if (!client_id)        return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  const db = createAdminClient()

  const { data: clientRow } = await db.from('clients').select('name').eq('id', client_id).single()
  const clientName = clientRow?.name ?? 'this client'

  let intelligenceBlock = ''
  try {
    intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'client_fit', db)
  } catch { /* non-critical */ }

  const prompt = `You are a senior account manager who knows ${clientName} very well. You have seen what they approve and what they push back on.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}CONTENT TO EVALUATE:
"${content.trim()}"

Think like the client, not the agency. Ask yourself:
- Does this match our brand voice exactly — not approximately?
- Would the client recognise this as "us"?
- Are there any phrases, claims, or tones that would make the client frown?
- Does it match what we know they've approved before?
- What would they say in the first 30 seconds of reading this?

Pushbacks: specific things the client would flag — quote the exact words or phrases if possible.
Fixes: for each pushback, one precise rewrite or change that would resolve it.
Fit score: 1–10 (7 = approvable with minor edits, 9+ = send immediately).

JSON only:
{
  "fit_score": number,
  "verdict": "string (one sentence — the most important finding)",
  "pushbacks": ["string"],
  "fixes": ["string"]
}`

  try {
    const result = await geminiJson<ClientFitResult>(
      prompt,
      'You are a senior account manager. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.4, maxOutputTokens: 4096 },
    )
    return NextResponse.json({
      fit_score: Math.min(10, Math.max(1, Number(result.fit_score) || 5)),
      verdict:   result.verdict   ?? '',
      pushbacks: Array.isArray(result.pushbacks) ? result.pushbacks.slice(0, 4) : [],
      fixes:     Array.isArray(result.fixes)     ? result.fixes.slice(0, 4)     : [],
    })
  } catch (err) {
    console.error('[client-fit]', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
