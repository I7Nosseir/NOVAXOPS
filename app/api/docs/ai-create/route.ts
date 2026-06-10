import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { markdownToTiptap } from '@/lib/markdown-to-tiptap'
import { randomBytes } from 'crypto'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/docs/ai-create
// Body: { title: string; content: string (markdown); client_id?: string | null }
// Converts markdown → Tiptap JSON and creates a new document.
export async function POST(req: NextRequest) {
  let body: { title?: string; content?: string; client_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const title   = (body.title ?? '').trim() || 'Untitled Document'
  const content = typeof body.content === 'string' ? body.content : ''

  const tiptapContent = markdownToTiptap(content)
  const share_token   = randomBytes(24).toString('hex')

  const db = adminSupabase()
  const { data, error } = await db
    .from('documents')
    .insert({
      title,
      content:    tiptapContent,
      client_id:  body.client_id ?? null,
      is_template: false,
      doc_type:   'doc',
      share_token,
    })
    .select('id, title, created_at')
    .single()

  if (error) {
    console.error('[docs/ai-create]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
