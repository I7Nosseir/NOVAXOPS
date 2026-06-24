import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

function shareToken() {
  return randomBytes(24).toString('hex')
}

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key)
}

async function resolveOrgId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return null
    const db = adminSupabase()
    const { data } = await db
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()
    return (data as { organization_id: string | null } | null)?.organization_id ?? null
  } catch {
    return null
  }
}

function dbError(msg: string, detail?: string): NextResponse {
  console.error('[/api/docs]', msg, detail ?? '')
  return NextResponse.json({ error: msg }, { status: 500 })
}

// GET /api/docs — list documents. ?templates=true returns only templates
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const templatesOnly = searchParams.get('templates') === 'true'

    const db = adminSupabase()
    let query = db.from('documents').select('*').order('updated_at', { ascending: false })
    if (templatesOnly) query = query.eq('is_template', true)

    const { data, error } = await query
    if (error) return dbError(error.message, error.details)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return dbError(err instanceof Error ? err.message : 'Unexpected error')
  }
}

// POST /api/docs — create a new document, optionally from a template
export async function POST(req: NextRequest) {
  try {
    let body: { title?: string; client_id?: string; content?: object; is_template?: boolean; template_category?: string; from_template_id?: string; doc_type?: string }
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const db = adminSupabase()
    const organization_id = await resolveOrgId()
    const orgField = organization_id ? { organization_id } : {}

    // Create from template — copy title + content, reset template flags
    if (body.from_template_id) {
      const { data: tmpl, error: tmplErr } = await db
        .from('documents')
        .select('title, content, doc_type')
        .eq('id', body.from_template_id)
        .single()
      if (tmplErr || !tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const { data, error } = await db
        .from('documents')
        .insert({
          title: tmpl.title as string,
          content: tmpl.content as object,
          doc_type: (tmpl as Record<string, unknown>).doc_type ?? 'doc',
          client_id: body.client_id ?? null,
          is_template: false,
          share_token: shareToken(),
          ...orgField,
        })
        .select()
        .single()
      if (error) return dbError(error.message, error.details)
      return NextResponse.json(data, { status: 201 })
    }

    const { title = 'Untitled Document', client_id, content = {}, is_template = false, template_category, doc_type = 'doc' } = body
    const { data, error } = await db
      .from('documents')
      .insert({ title, client_id: client_id ?? null, content, is_template, template_category: template_category ?? null, doc_type, share_token: shareToken(), ...orgField })
      .select()
      .single()

    if (error) return dbError(error.message, error.details)
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return dbError(err instanceof Error ? err.message : 'Unexpected error')
  }
}
