// ============================================================
// GET    /api/studio/inspiration  — list saved board items
// POST   /api/studio/inspiration  — save an item to board
// DELETE /api/studio/inspiration  — remove an item from board
// All methods require authentication.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

// ─── Auth helper ──────────────────────────────────────────────

async function getCallerProfile() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  return profile ?? null
}

// ─── Types ────────────────────────────────────────────────────

export interface InspirationBoardItem {
  id:            string
  client_id:     string | null   // null = personal library item
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
  published_at?: string
  notes?:        string
  tags?:         string[]
  created_at:    string
}

type CreateInput = Omit<InspirationBoardItem, 'id' | 'created_at'> & { client_id?: string | null }

// ─── GET /api/studio/inspiration ─────────────────────────────

export async function GET(req: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id') ?? undefined
  const saved_by  = searchParams.get('saved_by')  ?? undefined
  const personal  = searchParams.get('personal') === 'true'

  const db = createAdminClient()
  let query = db
    .from('inspiration_board')
    .select('*')
    .order('created_at', { ascending: false })

  if (personal) {
    // Personal library: items where client_id IS NULL, scoped to authenticated user
    query = query.is('client_id', null).eq('saved_by', caller.id)
  } else {
    if (client_id) query = query.eq('client_id', client_id)
    // Only admins/CEOs can fetch all items; others must supply a saved_by or client_id
    if (saved_by) query = query.eq('saved_by', saved_by)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}

// ─── POST /api/studio/inspiration ────────────────────────────

export async function POST(req: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreateInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.platform || !body.content_type || !body.title || !body.url) {
    return NextResponse.json(
      { error: 'platform, content_type, title, and url are required' },
      { status: 400 },
    )
  }

  const now  = new Date().toISOString()
  const item: InspirationBoardItem = {
    id:            randomUUID(),
    client_id:     body.client_id ?? null,
    saved_by:      caller.id,             // always derived from authenticated session
    platform:      body.platform,
    content_type:  body.content_type,
    title:         body.title,
    url:           body.url,
    thumbnail_url: body.thumbnail_url,
    view_count:    body.view_count,
    channel:       body.channel,
    hashtag:       body.hashtag,
    industry:      body.industry,
    published_at:  body.published_at,
    notes:         body.notes,
    tags:          body.tags ?? [],
    created_at:    now,
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('inspiration_board')
    .insert(item)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data as InspirationBoardItem, { status: 201 })
}

// ─── DELETE /api/studio/inspiration ──────────────────────────

export async function DELETE(req: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = createAdminClient()

  // Fetch item first to verify ownership (admins/CEOs can delete any item)
  const { data: item } = await db
    .from('inspiration_board')
    .select('saved_by')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPrivileged = ['admin', 'ceo'].includes(caller.role)
  if (!isPrivileged && item.saved_by !== caller.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await db
    .from('inspiration_board')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
