import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { UserRole } from '@/lib/types'
import { sendTeamInvite } from '@/lib/email'

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

function generateTempPassword(): string {
  // 16-char URL-safe base64 — readable, no ambiguous chars, satisfies most password policies
  return randomBytes(12).toString('base64url')
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

  const body = await req.json() as { email: string; name: string; role: UserRole; page_permissions?: string[] | null }
  const { email, name, role, page_permissions = null } = body

  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 })
  }

  const adminClient = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )

  const tempPassword = generateTempPassword()

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      department: DEPT_BY_ROLE[role] ?? 'creative',
      needs_onboarding: true,
      // stored here so the onboarding step can apply it to the users table row
      page_permissions,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Look up inviter's display name for the email
  const { data: inviterProfile } = await adminClient
    .from('users')
    .select('name')
    .eq('auth_id', authUser.id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

  // Await email so we can report success/failure to the UI
  const emailResult = await sendTeamInvite({
    toEmail: email,
    toName: name,
    role,
    inviterName: (inviterProfile?.name as string | undefined) ?? 'The NOVA Team',
    appUrl,
    tempPassword,
  })

  if (!emailResult.ok) {
    // Account was created — return credentials so admin can share them manually
    return NextResponse.json({
      ok: true,
      emailSent: false,
      emailError: emailResult.error ?? 'Email delivery failed',
      fallbackCredentials: { email, tempPassword },
    })
  }

  return NextResponse.json({ ok: true, emailSent: true })
}
