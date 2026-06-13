import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'
const RESEND_KEY   = process.env.RESEND_API_KEY
const RESEND_FROM  = process.env.RESEND_FROM_ADDRESS ?? 'NOVAX Ops <noreply@perfumeexhibition.com>'

async function getSessionRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('auth_id', user.id)
    .single()
  return profile
}

async function sendLoginBlastEmail(to: string, name: string, magicLink: string) {
  if (!RESEND_KEY) return { ok: false, error: 'No RESEND_API_KEY' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: 'Your NOVAX Ops login link',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <div style="background:#1B3D38;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px;">NOVAX Ops</h1>
          </div>
          <p style="color:#334155;font-size:15px;">Hi ${name},</p>
          <p style="color:#334155;font-size:15px;">
            Your NOVAX Ops account is ready. Click the button below to set your password and log in — the link expires in 24 hours.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${magicLink}"
               style="display:inline-block;background:#1B3D38;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
              Set Password &amp; Log In
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;">
            Or copy this link into your browser:<br/>
            <span style="color:#2A6B62;word-break:break-all;">${magicLink}</span>
          </p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
            Platform: <a href="${APP_URL}" style="color:#5BB4AE;">${APP_URL}</a>
          </p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    return { ok: false, error: err }
  }
  return { ok: true }
}

export async function POST() {
  const profile = await getSessionRole()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Find all users who haven't completed onboarding (never set their own password)
  const { data: pending, error: dbErr } = await db
    .from('users')
    .select('id, name, email, role')
    .eq('needs_onboarding', true)
    .order('name')

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ sent: 0, results: [], message: 'No pending users found.' })
  }

  const results: { name: string; email: string; status: 'sent' | 'failed'; error?: string }[] = []

  for (const user of pending) {
    try {
      // Generate a password-reset (recovery) magic link via Supabase admin
      const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: { redirectTo: `${APP_URL}/onboarding` },
      })

      if (linkErr || !linkData?.properties?.action_link) {
        results.push({ name: user.name, email: user.email, status: 'failed', error: linkErr?.message ?? 'No link returned' })
        continue
      }

      const emailResult = await sendLoginBlastEmail(user.email, user.name, linkData.properties.action_link)

      if (emailResult.ok) {
        results.push({ name: user.name, email: user.email, status: 'sent' })
      } else {
        results.push({ name: user.name, email: user.email, status: 'failed', error: emailResult.error })
      }
    } catch (err) {
      results.push({
        name: user.name,
        email: user.email,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const sentCount = results.filter(r => r.status === 'sent').length
  return NextResponse.json({ sent: sentCount, total: pending.length, results })
}
