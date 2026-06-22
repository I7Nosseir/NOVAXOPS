import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { UserRole } from '@/lib/types'
import { sendTeamInvite } from '@/lib/email'

const DEPT_BY_ROLE: Record<UserRole, string> = {
  admin:             'strategy',
  ceo:               'strategy',
  creative_director: 'creative',
  copywriter:        'creative',
  designer:          'creative',
  video_editor:      'creative',
  web_developer:     'creative',
  account_manager:   'accounts',
  strategist:        'strategy',
  social_manager:    'social',
}

export interface BulkInviteMember {
  name: string
  email: string
  role: UserRole
}

export interface BulkInviteItemResult {
  email: string
  name: string
  status: 'sent' | 'created_no_email' | 'skipped' | 'error'
  error?: string
  fallbackCredentials?: { email: string; tempPassword: string }
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

  const db = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )

  const { data: profile } = await db.from('users').select('role, name, organization_id').eq('auth_id', authUser.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
  }

  const orgId: string | null = (profile as { organization_id?: string } | null)?.organization_id ?? null

  const body = await req.json() as { members: BulkInviteMember[] }
  const { members } = body

  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json({ error: 'members array is required' }, { status: 400 })
  }

  const inviterName = (profile?.name as string | undefined) ?? 'The NOVAX Team'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.novaxops.com'
  const results: BulkInviteItemResult[] = []

  for (const member of members) {
    const { name, email, role } = member
    if (!email || !name || !role) {
      results.push({ email: email ?? '', name: name ?? '', status: 'error', error: 'Missing name, email, or role' })
      continue
    }

    const tempPassword = randomBytes(12).toString('base64url')

    const { data: newAuthUser, error: createErr } = await db.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, role, department: DEPT_BY_ROLE[role] ?? 'creative', needs_onboarding: true, organization_id: orgId },
    })

    if (createErr) {
      // Already exists — skip
      if (createErr.message.toLowerCase().includes('already')) {
        results.push({ email, name, status: 'skipped', error: 'Account already exists' })
      } else {
        results.push({ email, name, status: 'error', error: createErr.message })
      }
      continue
    }

    if (newAuthUser?.user) {
      const initials = name.trim().split(' ').slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
      const colors = ['#1B3D38', '#2A6B62', '#5BB4AE', '#7B5EA7', '#C45C2A', '#2563EB']
      const color = colors[Math.floor(Math.random() * colors.length)]
      const newUserRow: Record<string, unknown> = {
        auth_id: newAuthUser.user.id, email, name: name.trim(), role,
        department: DEPT_BY_ROLE[role] ?? 'creative', initials, color,
        needs_onboarding: true, page_permissions: null,
      }
      if (orgId) newUserRow.organization_id = orgId
      await db.from('users').upsert(newUserRow, { onConflict: 'auth_id', ignoreDuplicates: false })
    }

    const emailResult = await sendTeamInvite({ toEmail: email, toName: name, role, inviterName, appUrl, tempPassword })

    if (!emailResult.ok) {
      results.push({ email, name, status: 'created_no_email', error: emailResult.error ?? 'Email delivery failed', fallbackCredentials: { email, tempPassword } })
    } else {
      results.push({ email, name, status: 'sent' })
    }
  }

  return NextResponse.json({ ok: true, results })
}
