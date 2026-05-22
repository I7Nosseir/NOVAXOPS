import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/docs — list documents. ?templates=true returns only templates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const templatesOnly = searchParams.get('templates') === 'true'

  const db = adminSupabase()
  let query = db.from('documents').select('*').order('updated_at', { ascending: false })
  if (templatesOnly) query = query.eq('is_template', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/docs — create a new document, optionally from a template
export async function POST(req: NextRequest) {
  let body: { title?: string; client_id?: string; content?: object; is_template?: boolean; template_category?: string; from_template_id?: string; doc_type?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const db = adminSupabase()

  // Create from template — copy title + content, reset template flags
  if (body.from_template_id) {
    const { data: tmpl, error: tmplErr } = await db
      .from('documents')
      .select('title, content')
      .eq('id', body.from_template_id)
      .single()
    if (tmplErr || !tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const { data, error } = await db
      .from('documents')
      .insert({ title: tmpl.title as string, content: tmpl.content as object, doc_type: (tmpl as Record<string, unknown>).doc_type ?? 'doc', client_id: body.client_id ?? null, is_template: false })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  const { title = 'Untitled Document', client_id, content = {}, is_template = false, template_category, doc_type = 'doc' } = body
  const { data, error } = await db
    .from('documents')
    .insert({ title, client_id: client_id ?? null, content, is_template, template_category: template_category ?? null, doc_type })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
