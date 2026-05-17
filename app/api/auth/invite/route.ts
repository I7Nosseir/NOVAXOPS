import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/types'

const DEPT_BY_ROLE: Record<UserRole, string> = {
  admin:            'strategy',
  ceo:              'strategy',
  creative_director:'creative',
  copywriter:       'creative',
  designer:         'creative',
  account_manager:  'accounts',
  strategist:       'strategy',
  social_manager:   'social',
}

export async function POST(req: Request) {
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

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', authUser.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
  }

  const body = await req.json() as { email: string; name: string; role: UserRole }
  const { email, name, role } = body

  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 })
  }

  const adminClient = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name, role, department: DEPT_BY_ROLE[role] ?? 'creative' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
