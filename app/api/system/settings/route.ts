import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { invalidateAiGuardCache } from '@/lib/ai-guard'

async function requireAdminOrCeo(): Promise<{ error: NextResponse } | { role: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['admin', 'ceo'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { role: profile.role }
}

/** GET /api/system/settings — returns key/value pairs (admin/CEO only). */
export async function GET() {
  const auth = await requireAdminOrCeo()
  if ('error' in auth) return auth.error

  const db = createAdminClient()
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
  const auth = await requireAdminOrCeo()
  if ('error' in auth) return auth.error

  let body: { key: string; value: unknown; updated_by?: string }
  try {
    body = await req.json() as { key: string; value: unknown; updated_by?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('system_settings')
    .upsert({
      key:        body.key,
      value:      body.value,
      updated_by: body.updated_by ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('[system/settings PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateAiGuardCache()
  return NextResponse.json({ ok: true })
}
