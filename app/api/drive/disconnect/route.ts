import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST() {
  const db = adminDb()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  await Promise.all([
    db.from('system_settings').upsert(
      { key: 'google_drive_tokens', value: null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    ),
    db.from('system_settings').upsert(
      { key: 'google_drive_email', value: null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    ),
  ])

  return NextResponse.json({ success: true })
}
