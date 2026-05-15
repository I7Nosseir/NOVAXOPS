import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { drive } from '@googleapis/drive'

function getAuth(accessToken?: string, refreshToken?: string) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  return client
}

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('drive_access_token')?.value
  const refreshToken = req.cookies.get('drive_refresh_token')?.value

  if (!refreshToken && !accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const auth = getAuth(accessToken, refreshToken)
  const driveClient = drive({ version: 'v3', auth })

  const folderId = req.nextUrl.searchParams.get('folderId') ?? 'root'
  const search = req.nextUrl.searchParams.get('q') ?? ''

  const q = search
    ? `name contains '${search.replace(/'/g, "\\'")}' and trashed = false`
    : `'${folderId}' in parents and trashed = false`

  try {
    const response = await driveClient.files.list({
      q,
      fields: 'files(id,name,mimeType,modifiedTime,size,thumbnailLink,webViewLink,iconLink,parents)',
      orderBy: 'folder,modifiedTime desc',
      pageSize: 60,
    })

    const files = response.data.files ?? []

    // Refresh access token in cookie if it was renewed
    const newToken = await auth.getAccessToken().catch(() => null)
    const res = NextResponse.json({ files, folderId })

    if (newToken?.token && newToken.token !== accessToken) {
      res.cookies.set('drive_access_token', newToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3500,
        path: '/',
      })
    }

    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Drive API error'
    if (message.includes('invalid_grant') || message.includes('Token has been expired')) {
      const res = NextResponse.json({ error: 'not_connected' }, { status: 401 })
      res.cookies.delete('drive_access_token')
      res.cookies.delete('drive_refresh_token')
      return res
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
