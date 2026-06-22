import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function sanitize(v: string | undefined) {
  return (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')
}

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const browser = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )
  const { data: { user }, error: sessionErr } = await browser.auth.getUser()
  if (sessionErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { password: string; name: string; phone?: string }
  const { password, name, phone } = body

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  const admin = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Change password server-side — bypasses "Secure Password Change" email flow entirely
  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password })
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 })

  // Clear needs_onboarding flag in auth metadata
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, needs_onboarding: false, name: name.trim() },
  })

  // Upsert users table row — row may not exist yet if the DB trigger hasn't run
  const meta = user.user_metadata ?? {}
  const role = (meta.role as string | undefined) ?? 'copywriter'
  const department = (meta.department as string | undefined) ?? 'creative'
  const pagePerms = (meta.page_permissions as string[] | null | undefined) ?? null
  const initials = name.trim().split(' ').slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
  const colors = ['#1B3D38', '#2A6B62', '#5BB4AE', '#7B5EA7', '#C45C2A', '#2563EB']
  const color = colors[Math.floor(Math.random() * colors.length)]

  // Resolve organization_id: metadata (set during invite) → existing row → novax slug fallback
  let orgId = (meta.organization_id as string | undefined) ?? null
  if (!orgId) {
    const { data: existingRow } = await admin
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()
    orgId = (existingRow as { organization_id?: string } | null)?.organization_id ?? null
  }
  if (!orgId) {
    const { data: novaxOrg } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', 'novax')
      .single()
    orgId = (novaxOrg as { id?: string } | null)?.id ?? null
  }

  const userRow: Record<string, unknown> = {
    auth_id: user.id,
    email: user.email ?? '',
    name: name.trim(),
    phone_number: phone?.trim() || null,
    role,
    department,
    initials,
    color,
    needs_onboarding: false,
    page_permissions: pagePerms,
  }
  if (orgId) userRow.organization_id = orgId

  const { error: upsertErr } = await admin
    .from('users')
    .upsert(userRow, { onConflict: 'auth_id', ignoreDuplicates: false })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
