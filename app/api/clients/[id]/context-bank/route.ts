import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { data, error } = await db
    .from('client_context_bank')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[context-bank GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entries: data })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: {
    category: string
    summary: string
    full_text: string
    source_type?: string
    created_by?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { data, error } = await db
    .from('client_context_bank')
    .insert({
      client_id: clientId,
      category: body.category,
      summary: body.summary,
      full_text: body.full_text,
      source_type: body.source_type ?? 'manual',
      created_by: body.created_by ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('[context-bank POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: { entry_id: string; is_active?: boolean; category?: string; summary?: string; full_text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { entry_id, ...updates } = body
  const { error } = await db
    .from('client_context_bank')
    .update(updates)
    .eq('id', entry_id)
    .eq('client_id', clientId)

  if (error) {
    console.error('[context-bank PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entry_id')
  if (!entryId) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

  const { error } = await db
    .from('client_context_bank')
    .delete()
    .eq('id', entryId)
    .eq('client_id', clientId)

  if (error) {
    console.error('[context-bank DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
