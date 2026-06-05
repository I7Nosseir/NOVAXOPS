import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

function adminClient() {
  return createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )
}

// ─── GET — load the full data_json for a saved report ────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = adminClient()

  const { data, error } = await db
    .from('reports')
    .select('id, client_id, data_json, clients(name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: data.id,
    client_id: data.client_id,
    client_name: (data.clients as unknown as { name: string } | null)?.name ?? 'Unknown',
    data: data.data_json,
  })
}

// ─── DELETE — remove a saved report ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = adminClient()

  const { error } = await db.from('reports').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
