// ============================================================
// GET  /api/studio/session   — list sessions
// POST /api/studio/session   — create session
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { StudioSession, StudioTool } from '@/lib/studio-types'
import {
  createMockSession,
  listMockSessions,
} from '@/lib/studio-session-store'

// ─── DB helpers ──────────────────────────────────────────────

const HAS_DB = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── GET /api/studio/session ──────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tool       = searchParams.get('tool')       ?? undefined
  const client_id  = searchParams.get('client_id')  ?? undefined
  const created_by = searchParams.get('created_by') ?? undefined
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  if (!HAS_DB) {
    const sessions = listMockSessions({ tool, client_id, created_by }).slice(0, limit)
    return NextResponse.json({ sessions, total: sessions.length, _mock: true })
  }

  const db = adminSupabase()
  let query = db
    .from('studio_sessions')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (tool)       query = query.eq('tool', tool)
  if (client_id)  query = query.eq('client_id', client_id)
  if (created_by) query = query.eq('created_by', created_by)

  const { data, error, count } = await query

  if (error) {
    // Graceful fallback — table may not exist yet
    const sessions = listMockSessions({ tool, client_id, created_by }).slice(0, limit)
    return NextResponse.json({ sessions, total: sessions.length, _mock: true, _db_error: error.message })
  }

  return NextResponse.json({ sessions: data ?? [], total: count ?? 0 })
}

// ─── POST /api/studio/session ────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    name?: string
    tool?: StudioTool
    client_id?: string
    created_by?: string
    brief?: string
    inputs?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.tool) {
    return NextResponse.json({ error: 'tool is required' }, { status: 400 })
  }

  const payload: Partial<StudioSession> = {
    name:       body.name      || 'Untitled Session',
    tool:       body.tool,
    client_id:  body.client_id  || null,
    created_by: body.created_by || null,
    brief:      body.brief      || null,
    inputs:     body.inputs     || {},
    status:     'running',
    outputs:    {},
    structured_answers: {},
    chat_history: [],
    edit_history:  [],
  }

  if (!HAS_DB) {
    const session = createMockSession(payload)
    return NextResponse.json(session, { status: 201 })
  }

  const db = adminSupabase()
  const { data, error } = await db
    .from('studio_sessions')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Table not ready — fall back to mock
    const session = createMockSession(payload)
    return NextResponse.json({ ...session, _mock: true }, { status: 201 })
  }

  return NextResponse.json(data as StudioSession, { status: 201 })
}
