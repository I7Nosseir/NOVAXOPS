import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { markdownToTiptap } from '@/lib/markdown-to-tiptap'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/docs/[id]/ai-edit
// Body: { content: string }  — markdown string from AI
// Converts to Tiptap JSON and patches the document.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.content || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const db = adminSupabase()

  // Verify the document exists
  const { data: existing, error: fetchErr } = await db
    .from('documents')
    .select('id, title')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const tiptapContent = markdownToTiptap(body.content)

  const { data, error } = await db
    .from('documents')
    .update({ content: tiptapContent, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, title, updated_at')
    .single()

  if (error) {
    console.error('[docs/ai-edit] Update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, document: data })
}
