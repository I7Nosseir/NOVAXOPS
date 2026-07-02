import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface RevisionHelperResult {
  interpretation: string
  changes: string[]
  revised_caption: string
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

  let body: { original_caption: string; client_note: string; client_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { original_caption, client_note, client_id } = body
  if (!original_caption?.trim()) return NextResponse.json({ error: 'original_caption is required' }, { status: 400 })
  if (!client_note?.trim())      return NextResponse.json({ error: 'client_note is required' }, { status: 400 })

  const db = createAdminClient()

  let clientName = 'this client'
  let intelligenceBlock = ''
  if (client_id) {
    const { data: clientRow } = await db.from('clients').select('name').eq('id', client_id).single()
    clientName = clientRow?.name ?? 'this client'
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'revision_helper', db)
    } catch { /* non-critical */ }
  }

  const prompt = `A client has reviewed a post for ${clientName} and requested changes. Your job is to translate vague client feedback into a concrete revision plan.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}ORIGINAL CAPTION:
"${original_caption.trim()}"

CLIENT'S FEEDBACK NOTE:
"${client_note.trim()}"

Your task:
1. INTERPRETATION: What is the client actually asking for? Translate their note into plain-English creative direction. Be specific — "make it more exciting" should become "add urgency to the opening line and make the CTA more action-oriented."
2. CHANGES: List each specific edit that needs to happen. Quote the exact text to change when possible. Keep each item to one clear action.
3. REVISED CAPTION: Write the full revised version incorporating all changes. Keep the same structure unless the client explicitly asked to change it. No hashtags or emojis unless they were in the original.

Rules:
- Base interpretation on what the client said AND what you know about their preferences from the context
- Revised caption must sound like the brand — not generic
- If the client's note is already clear, say so in the interpretation and proceed

JSON only:
{
  "interpretation": "string",
  "changes": ["string"],
  "revised_caption": "string"
}`

  try {
    const result = await geminiJson<RevisionHelperResult>(
      prompt,
      'You are a senior copywriter interpreting client feedback. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.45, maxOutputTokens: 4096 },
    )
    return NextResponse.json({
      interpretation:  result.interpretation  ?? '',
      changes:         Array.isArray(result.changes) ? result.changes.slice(0, 6) : [],
      revised_caption: result.revised_caption ?? '',
    })
  } catch (err) {
    console.error('[revision-helper]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
