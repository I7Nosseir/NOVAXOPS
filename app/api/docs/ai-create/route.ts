import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { markdownToTiptap, markdownTableToSheet, isMarkdownTable } from '@/lib/markdown-to-tiptap'
import { randomBytes } from 'crypto'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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

  const title      = (body.title ?? '').trim() || 'Untitled Document'
  const rawContent = typeof body.content === 'string' ? body.content : ''
  const isTable    = isMarkdownTable(rawContent)
  const doc_type   = isTable ? 'sheet' : 'doc'
  const docContent = isTable ? markdownTableToSheet(rawContent) : markdownToTiptap(rawContent)
  const share_token = randomBytes(24).toString('hex')

  const organization_id = await resolveOrgId()

  const db = adminSupabase()
  const { data, error } = await db
    .from('documents')
    .insert({
      title,
      content:         docContent,
      client_id:       body.client_id ?? null,
      is_template:     false,
      doc_type,
      share_token,
      ...(organization_id ? { organization_id } : {}),
    })
    .select('id, title, created_at')
    .single()

  if (error) {
    console.error('[docs/ai-create]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
