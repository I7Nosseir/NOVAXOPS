import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/docs — list all documents ordered by updated_at desc
export async function GET() {
  const db = adminSupabase()
  const { data, error } = await db
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/docs — create a new document
export async function POST(req: NextRequest) {
  let body: { title?: string; client_id?: string; content?: object }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { title = 'Untitled Document', client_id, content = {} } = body

  const db = adminSupabase()
  const { data, error } = await db
    .from('documents')
    .insert({
      title,
      client_id: client_id ?? null,
      content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
