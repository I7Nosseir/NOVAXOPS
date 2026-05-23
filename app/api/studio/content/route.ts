import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// POST /api/studio/content — create a new studio session
export async function POST(req: NextRequest) {
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

  if (!HAS_DB) {
    const mockId = randomBytes(8).toString('hex')
    return NextResponse.json({
      id: mockId,
      client_id: body.client_id || null,
      created_by: body.created_by || null,
      title: body.title || 'Untitled Session',
      phase: 'define',
      phase_1_data: body.phase_1_data || {},
      phase_2_data: {},
      phase_3_data: {},
      phase_4_data: {},
      phase_5_data: {},
      phase_6_data: {},
      status: 'draft',
      _mock: true,
    })
  }

  const db = adminSupabase()
  const { data, error } = await db
    .from('studio_sessions')
    .insert({
      client_id:    body.client_id   || null,
      created_by:   body.created_by  || null,
      title:        body.title       || 'Untitled Session',
      phase_1_data: body.phase_1_data || {},
    })
    .select()
    .single()

  if (error) {
    // Table may not exist yet — return mock session so UI stays functional
    const mockId = randomBytes(8).toString('hex')
    return NextResponse.json({
      id: mockId,
      client_id: body.client_id || null,
      created_by: body.created_by || null,
      title: body.title || 'Untitled Session',
      phase: 'define',
      phase_1_data: body.phase_1_data || {},
      phase_2_data: {}, phase_3_data: {}, phase_4_data: {}, phase_5_data: {}, phase_6_data: {},
      status: 'draft',
      _mock: true,
    })
  }
  return NextResponse.json(data)
}

// GET /api/studio/content?created_by=&client_id=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const created_by = searchParams.get('created_by')
  const client_id  = searchParams.get('client_id')

  if (!HAS_DB) return NextResponse.json({ sessions: [], _mock: true })

  const db = adminSupabase()
  let query = db
    .from('studio_sessions')
    .select('id,title,phase,status,client_id,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (created_by) query = query.eq('created_by', created_by)
  if (client_id)  query = query.eq('client_id', client_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ sessions: [], _mock: true })
  return NextResponse.json({ sessions: data ?? [] })
}
