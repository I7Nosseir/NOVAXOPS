import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface ReviewResult {
  score: number
  verdict: string
  issues: string[]
  rewrites: string[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  linkedin: 'LinkedIn', youtube: 'YouTube', twitter: 'X (Twitter)',
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

  let body: { caption: string; client_id?: string; platform?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { caption, client_id, platform } = body
  if (!caption?.trim()) return NextResponse.json({ error: 'caption is required' }, { status: 400 })

  const db = createAdminClient()
  const platformLabel = PLATFORM_LABELS[platform ?? ''] ?? platform ?? 'social media'

  let clientName = ''
  let intelligenceBlock = ''
  if (client_id) {
    const { data: clientRow } = await db.from('clients').select('name').eq('id', client_id).single()
    clientName = clientRow?.name ?? ''
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'review_caption', db)
    } catch { /* non-critical */ }
  }

  const prompt = `You are a brutally honest social media editor for a professional creative agency. Your job is to surface real weaknesses, not be polite.

Review this caption for ${clientName || 'the client'} on ${platformLabel}.
${intelligenceBlock ? `\nCLIENT CONTEXT:\n${intelligenceBlock}\n` : ''}
CAPTION TO REVIEW:
"${caption.trim()}"

Evaluate against:
- Hook strength (does the first line make someone stop scrolling?)
- Clarity (is the message immediately obvious?)
- Brand voice alignment (does it match this client's established tone?)
- Platform fit (right length, style, energy for ${platformLabel}?)
- CTA effectiveness (does it drive the intended action?)

Rules:
- Score 1–10 (7 = publishable, 9+ = exceptional)
- Verdict: one sentence — the single most important thing wrong or right
- Issues: up to 4 specific, actionable problems. Be precise — "weak hook" is useless, "hook starts with a question that the audience can easily answer 'no' to, killing curiosity" is useful
- Rewrites: exactly 2 complete rewrites of the full caption that address the main issues. Write the full caption, not a template

Respond in JSON only:
{
  "score": number,
  "verdict": "string",
  "issues": ["string"],
  "rewrites": ["string"]
}`

  try {
    const result = await geminiJson<ReviewResult>(
      prompt,
      'You are a professional social media editor. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.4, maxOutputTokens: 4096 },
    )
    // Sanitize to expected shape
    return NextResponse.json({
      score:    Math.min(10, Math.max(1, Number(result.score) || 5)),
      verdict:  result.verdict ?? '',
      issues:   Array.isArray(result.issues)   ? result.issues.slice(0, 4)  : [],
      rewrites: Array.isArray(result.rewrites) ? result.rewrites.slice(0, 2) : [],
    })
  } catch (err) {
    console.error('[review-caption]', err)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
