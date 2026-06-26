import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, resolveOrgId } from '@/lib/api-auth'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// POST /api/studio/content — create a new studio session
export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if ('error' in auth) return auth.error
  let body: {
    client_id?: string
    created_by?: string
    title?: string
    phase_1_data?: object
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const orgId = await resolveOrgId({ clientId: body.client_id, userId: body.created_by })

  const db = adminSupabase()
  const { data, error } = await db
    .from('studio_sessions')
    .insert({
      client_id:       body.client_id   || null,
      created_by:      body.created_by  || null,
      title:           body.title       || 'Untitled Session',
      phase_1_data:    body.phase_1_data || {},
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET /api/studio/content?created_by=&client_id=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const created_by = searchParams.get('created_by')
  const client_id  = searchParams.get('client_id')

  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const db = adminSupabase()
  let query = db
    .from('studio_sessions')
    .select('id,title,phase,status,client_id,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (created_by) query = query.eq('created_by', created_by)
  if (client_id)  query = query.eq('client_id', client_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}
