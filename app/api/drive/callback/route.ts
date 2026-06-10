import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/assets?drive_error=access_denied', req.url))
  }

  const db = adminDb()
  if (!db) {
    return NextResponse.redirect(new URL('/assets?drive_error=db_not_configured', req.url))
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.nextUrl.origin}/api/drive/callback`,
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)

    // Fetch the connected Google account email
    let email: string | null = null
    if (tokens.access_token) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (userInfoRes.ok) {
          const info = await userInfoRes.json() as { email?: string }
          email = info.email ?? null
        }
      } catch { /* non-critical */ }
    }

    // Persist tokens + email server-side in system_settings
    await Promise.all([
      db.from('system_settings').upsert(
        { key: 'google_drive_tokens', value: tokens as Record<string, unknown>, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      ),
      db.from('system_settings').upsert(
        { key: 'google_drive_email', value: email as unknown, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      ),
    ])

    return NextResponse.redirect(new URL('/assets?drive=connected', req.url))
  } catch {
    return NextResponse.redirect(new URL('/assets?drive_error=token_exchange', req.url))
  }
}
