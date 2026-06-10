import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { invalidateAiGuardCache } from '@/lib/ai-guard'

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** GET /api/system/settings — returns key/value pairs (admin/CEO only). */
export async function GET() {
  const db = adminDb()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const { data, error } = await db
    .from('system_settings')
    .select('key, value')
    .neq('key', 'google_drive_tokens') // never expose OAuth tokens

  if (error) {
    console.error('[system/settings GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  return NextResponse.json({ settings })
}

/** PATCH /api/system/settings — upsert a key/value pair (admin/CEO only). */
export async function PATCH(req: NextRequest) {
  const db = adminDb()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: { key: string; value: unknown; updated_by?: string }
  try {
    body = await req.json() as { key: string; value: unknown; updated_by?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const { error } = await db
    .from('system_settings')
    .upsert({
      key: body.key,
      value: body.value,
      updated_by: body.updated_by ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('[system/settings PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bust the guard cache whenever any setting changes
  invalidateAiGuardCache()

  return NextResponse.json({ ok: true })
}
