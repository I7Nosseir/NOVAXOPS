import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client, type Credentials } from 'google-auth-library'
import { drive } from '@googleapis/drive'
import { createClient } from '@supabase/supabase-js'

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getStoredTokens(): Promise<Credentials | null> {
  const db = adminDb()
  if (!db) return null
  const { data } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_tokens')
    .single()
  const val = data?.value
  if (!val || val === null || typeof val !== 'object' || !('access_token' in val || 'refresh_token' in val)) {
    return null
  }
  return val as Credentials
}

async function saveTokens(tokens: Credentials) {
  const db = adminDb()
  if (!db) return
  await db.from('system_settings').upsert(
    { key: 'google_drive_tokens', value: tokens as Record<string, unknown>, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

async function getConnectedEmail(): Promise<string | null> {
  const db = adminDb()
  if (!db) return null
  const { data } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_email')
    .single()
  const val = data?.value
  return typeof val === 'string' ? val : null
}

export async function GET(req: NextRequest) {
  const storedTokens = await getStoredTokens()

  if (!storedTokens) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials(storedTokens)

  // Listen for token refresh events so we can persist the new token
  auth.on('tokens', async (freshTokens) => {
    const merged: Credentials = { ...storedTokens, ...freshTokens }
    await saveTokens(merged)
  })

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
    const email = await getConnectedEmail()

    return NextResponse.json({ files, folderId, email })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Drive API error'
    if (
      message.includes('invalid_grant') ||
      message.includes('Token has been expired') ||
      message.includes('invalid_token') ||
      message.includes('Invalid Credentials')
    ) {
      // Tokens are stale — clear them so UI shows reconnect prompt
      await saveTokens({ access_token: null, refresh_token: null })
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }
    console.error('[drive/files]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
