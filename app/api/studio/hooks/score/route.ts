import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface HookScoreResult {
  curiosity:   number
  clarity:     number
  compulsion:  number
  total:       number
  verdict:     string
  weakness:    string
  alternatives: string[]
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

  let body: { hook: string; client_id?: string; brief?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { hook, client_id, brief = '' } = body
  if (!hook?.trim()) return NextResponse.json({ error: 'hook is required' }, { status: 400 })

  const db = createAdminClient()

  let intelligenceBlock = ''
  if (client_id) {
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'hook_score', db)
    } catch { /* non-critical */ }
  }

  const prompt = `You are scoring a social media hook using the 3C framework: Curiosity, Clarity, Compulsion.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}${brief ? `CONTENT BRIEF: ${brief}\n\n` : ''}HOOK TO SCORE:
"${hook.trim()}"

3C Framework definitions:
- Curiosity (1–10): Does this create an unanswered question in the reader's mind? Does it make them want to know what comes next?
- Clarity (1–10): Is the subject immediately obvious? Could someone misunderstand who this is for or what it's about?
- Compulsion (1–10): Is there urgency, stakes, or desire strong enough to make someone stop scrolling?

Total = average of the three scores (to 1 decimal place).

verdict: One sentence — the single most important thing about this hook. Start with either "Strong" or "Weak" followed by what that means.

weakness: The specific word or phrase that most hurts this hook. Be surgical — identify the exact problem, not a general observation.

alternatives: Give exactly 2 rewrites that fix the weakness. Each rewrite keeps the same core idea but addresses the identified weakness. Under 12 words each.

JSON only:
{
  "curiosity": number,
  "clarity": number,
  "compulsion": number,
  "total": number,
  "verdict": "string",
  "weakness": "string",
  "alternatives": ["string", "string"]
}`

  try {
    const result = await geminiJson<HookScoreResult>(
      prompt,
      'You are a hook strategist. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.35, maxOutputTokens: 4096 },
    )
    const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(Number(n) || 5)))
    const curiosity  = clamp(result.curiosity)
    const clarity    = clamp(result.clarity)
    const compulsion = clamp(result.compulsion)
    return NextResponse.json({
      curiosity,
      clarity,
      compulsion,
      total:        Math.round(((curiosity + clarity + compulsion) / 3) * 10) / 10,
      verdict:      result.verdict      ?? '',
      weakness:     result.weakness     ?? '',
      alternatives: Array.isArray(result.alternatives) ? result.alternatives.slice(0, 2) : [],
    })
  } catch (err) {
    console.error('[hooks-score]', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
