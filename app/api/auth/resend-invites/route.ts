import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendTeamInvite } from '@/lib/email'

const APP_URL = 'https://www.novaxops.com'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

export async function POST(req: Request) {
  void req
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

  const { data: { user: authUser } } = await browser.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: callerProfile } = await admin
    .from('users')
    .select('role, name, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const callerName = (callerProfile?.name as string | undefined) ?? 'The NOVAX Team'
  const orgId: string | null = (callerProfile as { organization_id?: string } | null)?.organization_id ?? null

  // Fetch all unverified users
  const { data: pending, error: fetchErr } = await admin
    .from('users')
    .select('auth_id, email, name, role, organization_id')
    .eq('needs_onboarding', true)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, results: [] })
  }

  type ResultItem = {
    email: string
    name: string
    status: 'sent' | 'no_email' | 'error'
    error?: string
  }

  const results: ResultItem[] = []

  for (const u of pending) {
    const email  = u.email  as string
    const name   = u.name   as string
    const role   = u.role   as string
    const authId = u.auth_id as string
    const userOrgId = (u as { organization_id?: string }).organization_id ?? orgId

    const tempPassword = randomBytes(12).toString('base64url')

    // Reset their password so the new email credentials are valid
    const { error: pwErr } = await admin.auth.admin.updateUserById(authId, {
      password: tempPassword,
      user_metadata: { organization_id: userOrgId },
    })

    if (pwErr) {
      console.error('[resend-invites] password reset failed', email, authId, pwErr.message)
      results.push({ email, name, status: 'error', error: `pw: ${pwErr.message}` })
      continue
    }

    // Ensure the users row has organization_id set (fixes rows that missed it)
    if (userOrgId) {
      await admin
        .from('users')
        .update({ organization_id: userOrgId })
        .eq('auth_id', authId)
        .is('organization_id', null)
    }

    const emailResult = await sendTeamInvite({
      toEmail: email,
      toName: name,
      role,
      inviterName: callerName,
      appUrl: APP_URL,
      tempPassword,
    })

    if (emailResult.ok) {
      results.push({ email, name, status: 'sent' })
    } else {
      console.error('[resend-invites] email failed', email, emailResult.error)
      results.push({ email, name, status: 'no_email', error: `email: ${emailResult.error}` })
    }
  }

  const sent = results.filter(r => r.status === 'sent').length
  return NextResponse.json({ ok: true, sent, total: pending.length, results })
}
