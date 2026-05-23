import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  )
}

async function requireAdmin(): Promise<{ authUserId: string } | NextResponse> {
  const cookieStore = await cookies()
  const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')
  const supabase = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = adminClient()
  const { data: profile } = await db.from('users').select('role').eq('auth_id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  return { authUserId: user.id }
}

// GET /api/auth/invitations — list pending (needs_onboarding) users
export async function GET() {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  const db = adminClient()
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pending = (data.users ?? [])
    .filter(u => u.user_metadata?.needs_onboarding === true)
    .map(u => ({
      id:         u.id,
      email:      u.email ?? '',
      name:       (u.user_metadata?.name as string | undefined) ?? '',
      role:       (u.user_metadata?.role as string | undefined) ?? '',
      created_at: u.created_at,
    }))

  // Sort newest first
  pending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ invitations: pending })
}
