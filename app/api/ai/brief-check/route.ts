import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { geminiJson } from '@/lib/gemini'

interface BriefCheckResult {
  quality: 'good' | 'needs_work' | 'incomplete'
  gaps: string[]
  suggestions: string[]
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

  let body: { title?: string; description?: string; task_type?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { title = '', description = '', task_type = '' } = body
  if (!title.trim() && !description.trim()) {
    return NextResponse.json({ error: 'title or description is required' }, { status: 400 })
  }

  const prompt = `You are a creative director reviewing a task brief before it gets assigned to a copywriter or designer. Your job is to catch gaps now, not after work is submitted.

TASK:
Title: "${title}"
Type: ${task_type || 'general'}
Brief / Description:
"${description || '(no description provided)'}"

A good brief must answer:
1. What is the specific deliverable? (format, length, quantity)
2. Who is the audience? (age, mindset, platform context)
3. What is the single goal of this piece? (awareness, conversion, retention)
4. What tone and voice are required?
5. What must be included or avoided?
6. What does success look like?

Evaluate:
- "good": at least 4 of the 6 areas are clear, no critical gaps
- "needs_work": 2–3 areas are clear, 2–3 gaps that could cause rework
- "incomplete": fewer than 2 areas clear, or a critical piece (deliverable, audience, or goal) is missing entirely

Rules:
- gaps: list only what is actually missing — be specific ("no platform mentioned" not "more context needed")
- suggestions: for each gap, one concrete question the brief writer should answer before assigning
- If quality is "good", gaps and suggestions can be empty

JSON only:
{
  "quality": "good" | "needs_work" | "incomplete",
  "gaps": ["string"],
  "suggestions": ["string"]
}`

  try {
    const result = await geminiJson<BriefCheckResult>(
      prompt,
      'You are a creative director. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.3, maxOutputTokens: 4096 },
    )
    return NextResponse.json({
      quality:     ['good', 'needs_work', 'incomplete'].includes(result.quality) ? result.quality : 'needs_work',
      gaps:        Array.isArray(result.gaps)        ? result.gaps.slice(0, 5)        : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 5) : [],
    })
  } catch (err) {
    console.error('[brief-check]', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
