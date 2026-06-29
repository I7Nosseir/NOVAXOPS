import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface PreApprovalResult {
  ready: boolean
  score: number
  verdict: string
  issues: string[]
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

  let body: { caption: string; platform?: string; client_id?: string; post_type?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { caption, platform, client_id, post_type } = body
  if (!caption?.trim()) return NextResponse.json({ error: 'caption is required' }, { status: 400 })

  const db = createAdminClient()
  const platformLabel = PLATFORM_LABELS[platform ?? ''] ?? platform ?? 'social media'

  let clientName = ''
  let intelligenceBlock = ''
  if (client_id) {
    const { data: clientRow } = await db.from('clients').select('name').eq('id', client_id).single()
    clientName = clientRow?.name ?? ''
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'pre_approval_check', db)
    } catch { /* non-critical */ }
  }

  const prompt = `You are a senior account manager doing a final quality check before sending content to a client for approval. Think like the client, not the agency.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}POST TO CHECK:
Platform: ${platformLabel}
Type: ${post_type ?? 'post'}
Caption: "${caption.trim()}"
Client: ${clientName || '(unspecified)'}

Assess whether this is ready to send to the client. A client wants content that:
1. Matches their brand voice exactly (no off-tone words or phrases)
2. Fits the platform format and length norms
3. Has a hook strong enough to justify the post type
4. Does not contain anything the client has previously pushed back on
5. Has a clear, appropriate CTA

Score 1–10. Ready = score >= 7 with no critical issues.
Issues: list only the specific problems that would cause the client to push back. If score >= 7 and nothing is wrong, issues can be empty.

JSON only:
{
  "ready": boolean,
  "score": number,
  "verdict": "string (one sentence — the most critical observation)",
  "issues": ["string"]
}`

  try {
    const result = await geminiJson<PreApprovalResult>(
      prompt,
      'You are a senior account manager. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.3, maxOutputTokens: 4096 },
    )
    const score = Math.min(10, Math.max(1, Number(result.score) || 5))
    return NextResponse.json({
      ready:   result.ready ?? (score >= 7),
      score,
      verdict: result.verdict ?? '',
      issues:  Array.isArray(result.issues) ? result.issues.slice(0, 5) : [],
    })
  } catch (err) {
    console.error('[pre-approval-check]', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
