import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/assets?drive_error=access_denied', req.url))
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.nextUrl.origin}/api/drive/callback`,
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    const res = NextResponse.redirect(new URL('/assets?drive=connected', req.url))

    if (tokens.refresh_token) {
      res.cookies.set('drive_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }
    if (tokens.access_token) {
      res.cookies.set('drive_access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3500, // slightly under 1 hour
        path: '/',
      })
    }

    return res
  } catch {
    return NextResponse.redirect(new URL('/assets?drive_error=token_exchange', req.url))
  }
}
