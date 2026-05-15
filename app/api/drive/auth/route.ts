import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'

function getOAuthClient(req: NextRequest) {
  const origin = req.nextUrl.origin
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/drive/callback`,
  )
}

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.' },
      { status: 500 },
    )
  }

  const oauth2Client = getOAuthClient(req)
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  })

  return NextResponse.redirect(authUrl)
}
