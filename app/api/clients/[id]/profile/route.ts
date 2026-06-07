import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ClientNormalizedProfile } from '@/lib/types'

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
    .from('clients')
    .select('normalized_profile')
    .eq('id', clientId)
    .single()

  if (error) {
    console.error('[profile GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: (data?.normalized_profile ?? {}) as ClientNormalizedProfile })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let profile: ClientNormalizedProfile
  try {
    const body = await req.json() as { profile: ClientNormalizedProfile }
    profile = body.profile
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { error } = await db
    .from('clients')
    .update({ normalized_profile: profile, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) {
    console.error('[profile PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
