import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendTeamInvite } from '@/lib/email'

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
  const { data: profile } = await db.from('users').select('role, name').eq('auth_id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  return { authUserId: user.id }
}

// DELETE /api/auth/invitations/[id] — cancel invitation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const { id } = await params
  const db = adminClient()
  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// POST /api/auth/invitations/[id]/resend is handled below via action param
// POST /api/auth/invitations/[id] — resend credentials
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const { id } = await params
  const db = adminClient()

  // Fetch the pending user to get their info
  const { data: { user: pendingUser }, error: fetchErr } = await db.auth.admin.getUserById(id)
  if (fetchErr || !pendingUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const email = pendingUser.email ?? ''
  const name  = (pendingUser.user_metadata?.name as string | undefined) ?? ''
  const role  = (pendingUser.user_metadata?.role as string | undefined) ?? ''

  // Generate a fresh temp password
  const tempPassword = randomBytes(12).toString('base64url')

  const { error: updateErr } = await db.auth.admin.updateUserById(id, { password: tempPassword })
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  // Get inviter name for the email
  const body = await req.json().catch(() => ({})) as { inviterName?: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://novaxops.com'

  const emailResult = await sendTeamInvite({
    toEmail: email,
    toName:  name,
    role,
    inviterName: body.inviterName ?? 'The NOVAX Team',
    appUrl,
    tempPassword,
  })

  if (!emailResult.ok) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      emailError: emailResult.error ?? 'Email delivery failed',
      fallbackCredentials: { email, tempPassword },
    })
  }

  return NextResponse.json({ ok: true, emailSent: true })
}
