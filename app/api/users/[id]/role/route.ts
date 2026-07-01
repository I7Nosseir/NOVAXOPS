import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { sendRoleChanged } from '@/lib/email'
import type { UserRole } from '@/lib/types'

const VALID_ROLES: UserRole[] = [
  'admin', 'ceo', 'creative_director', 'account_manager',
  'strategist', 'copywriter', 'designer', 'video_editor',
  'web_developer', 'social_manager',
]

// PATCH /api/users/[id]/role
// Body: { role: UserRole }
// Admin only. Updates the user's role and sends a notification email.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cookieStore = await cookies()

  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: { user: authUser } } = await sessionClient.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: caller } = await db
    .from('users')
    .select('role, name')
    .eq('auth_id', authUser.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 })
  }

  const body = await req.json() as { role?: UserRole }
  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: target, error: fetchErr } = await db
    .from('users')
    .select('name, email, role')
    .eq('id', id)
    .single()

  if (fetchErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.role === body.role) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await db
    .from('users')
    .update({ role: body.role })
    .eq('id', id)

  if (error) {
    console.error('[users/role]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (target.email) {
    sendRoleChanged({
      toEmail:       target.email,
      toName:        (target.name as string | null) ?? 'Team member',
      oldRole:       target.role as string,
      newRole:       body.role,
      changedByName: (caller.name as string | null) ?? 'Admin',
    }).catch(err => console.error('[users/role] email failed:', err))
  }

  return NextResponse.json({ ok: true })
}
