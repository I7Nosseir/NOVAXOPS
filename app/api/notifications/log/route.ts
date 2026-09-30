import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await sessionClient.auth.getUser()
    return user
  } catch {
    return null
  }
}

// Receives audit_log rows from browser-side notification helpers and inserts
// them using the admin client (browser client cannot INSERT into audit_log —
// no authenticated INSERT policy by design).
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows: unknown[]
  try {
    const body = await req.json() as { rows?: unknown[] }
    rows = Array.isArray(body.rows) ? body.rows : []
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (rows.length === 0) return NextResponse.json({ ok: true })

  const db = createAdminClient()
  const { error } = await db.from('audit_log').insert(rows)
  if (error) {
    console.error('[POST /api/notifications/log]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
