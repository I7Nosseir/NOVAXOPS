import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const browser = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user }, error: sessionErr } = await browser.auth.getUser()
  if (sessionErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { password: string }
  const { password } = body

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const admin = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await admin.auth.admin.updateUserById(user.id, { password })
  if (error) {
    console.error('[change-password]', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
