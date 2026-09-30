// ============================================================
// /api/studio/formats/favorites
// GET  — load saved formats for a niche / user
// POST — save a format to favorites
// DELETE — remove a saved format by id
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET — load saved formats for a niche (optional) filtered by user
export async function GET(req: NextRequest) {
  const niche  = req.nextUrl.searchParams.get('niche')
  const userId = req.nextUrl.searchParams.get('user_id')

  const db = createAdminClient()

  let query = db
    .from('format_favorites')
    .select('*')
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('saved_by', userId)
  if (niche)  query = query.eq('niche', niche)

  const { data, error } = await query.limit(50)
  if (error) {
    console.error('[format-favorites/GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ favorites: data ?? [] })
}

// POST — save a format
export async function POST(req: NextRequest) {
  let body: {
    saved_by: string
    session_id?: string | null
    niche: string
    format_name: string
    format_data: unknown
    notes?: string
    tags?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.saved_by || !body.niche || !body.format_name || !body.format_data) {
    return NextResponse.json({ error: 'saved_by, niche, format_name, format_data are required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data, error } = await db
    .from('format_favorites')
    .insert({
      saved_by:    body.saved_by,
      session_id:  body.session_id ?? null,
      niche:       body.niche,
      format_name: body.format_name,
      format_data: body.format_data,
      notes:       body.notes ?? null,
      tags:        body.tags ?? [],
    })
    .select()
    .single()

  if (error) {
    console.error('[format-favorites/POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ favorite: data })
}

// DELETE — remove a saved format
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createAdminClient()

  const { error } = await db
    .from('format_favorites')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[format-favorites/DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
