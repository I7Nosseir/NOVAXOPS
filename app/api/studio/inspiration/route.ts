// ============================================================
// GET    /api/studio/inspiration  — list saved board items
// POST   /api/studio/inspiration  — save an item to board
// DELETE /api/studio/inspiration  — remove an item from board
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// ─── DB detection ─────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────

export interface InspirationBoardItem {
  id:            string
  client_id:     string
  saved_by:      string | null
  platform:      string
  content_type:  string
  title:         string
  url:           string
  thumbnail_url?: string
  view_count?:   number
  channel?:      string
  hashtag?:      string
  industry?:     string
  notes?:        string
  tags?:         string[]
  created_at:    string
}

type CreateInput = Omit<InspirationBoardItem, 'id' | 'created_at'>

// ─── In-memory mock store ─────────────────────────────────────

const MOCK_STORE = new Map<string, InspirationBoardItem>()

// ─── GET /api/studio/inspiration ─────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id') ?? undefined
  const saved_by  = searchParams.get('saved_by')  ?? undefined

  if (!HAS_DB) {
    let items = Array.from(MOCK_STORE.values())
    if (client_id) items = items.filter(i => i.client_id === client_id)
    if (saved_by)  items = items.filter(i => i.saved_by  === saved_by)
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return NextResponse.json({ items, _mock: true })
  }

  const db = adminSupabase()
  let query = db
    .from('inspiration_board')
    .select('*')
    .order('created_at', { ascending: false })

  if (client_id) query = query.eq('client_id', client_id)
  if (saved_by)  query = query.eq('saved_by',  saved_by)

  const { data, error } = await query

  if (error) {
    // Graceful fallback
    let items = Array.from(MOCK_STORE.values())
    if (client_id) items = items.filter(i => i.client_id === client_id)
    return NextResponse.json({ items, _mock: true, _db_error: error.message })
  }

  return NextResponse.json({ items: data ?? [] })
}

// ─── POST /api/studio/inspiration ────────────────────────────

export async function POST(req: NextRequest) {
  let body: CreateInput

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_id || !body.platform || !body.content_type || !body.title || !body.url) {
    return NextResponse.json(
      { error: 'client_id, platform, content_type, title, and url are required' },
      { status: 400 },
    )
  }

  const now  = new Date().toISOString()
  const item: InspirationBoardItem = {
    id:            randomUUID(),
    client_id:     body.client_id,
    saved_by:      body.saved_by    ?? null,
    platform:      body.platform,
    content_type:  body.content_type,
    title:         body.title,
    url:           body.url,
    thumbnail_url: body.thumbnail_url,
    view_count:    body.view_count,
    channel:       body.channel,
    hashtag:       body.hashtag,
    industry:      body.industry,
    notes:         body.notes,
    tags:          body.tags         ?? [],
    created_at:    now,
  }

  if (!HAS_DB) {
    MOCK_STORE.set(item.id, item)
    return NextResponse.json(item, { status: 201 })
  }

  const db = adminSupabase()
  const { data, error } = await db
    .from('inspiration_board')
    .insert(item)
    .select()
    .single()

  if (error) {
    MOCK_STORE.set(item.id, item)
    return NextResponse.json({ ...item, _mock: true }, { status: 201 })
  }

  return NextResponse.json(data as InspirationBoardItem, { status: 201 })
}

// ─── DELETE /api/studio/inspiration ──────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  if (!HAS_DB) {
    const existed = MOCK_STORE.has(id)
    MOCK_STORE.delete(id)
    return NextResponse.json({ success: existed, _mock: true })
  }

  const db = adminSupabase()
  const { error } = await db
    .from('inspiration_board')
    .delete()
    .eq('id', id)

  if (error) {
    MOCK_STORE.delete(id)
    return NextResponse.json({ success: true, _mock: true, _db_error: error.message })
  }

  return NextResponse.json({ success: true })
}
