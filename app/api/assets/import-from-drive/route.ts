import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OAuth2Client } from 'google-auth-library'
import { drive } from '@googleapis/drive'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/assets/import-from-drive
 * Body: { driveFileId, name, mimeType, thumbnailLink?, clientId? }
 *
 * Downloads the file from Google Drive and uploads it to Supabase Storage,
 * then upserts a record in the assets table.
 */
export async function POST(req: NextRequest) {
  let body: { driveFileId?: string; name?: string; mimeType?: string; thumbnailLink?: string; clientId?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { driveFileId, name, mimeType, thumbnailLink, clientId } = body
  if (!driveFileId || !name || !mimeType) {
    return NextResponse.json({ error: 'driveFileId, name, and mimeType required' }, { status: 400 })
  }

  const accessToken = req.cookies.get('drive_access_token')?.value
  const refreshToken = req.cookies.get('drive_refresh_token')?.value
  if (!refreshToken && !accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const auth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const driveClient = drive({ version: 'v3', auth })

  // Determine asset type
  const assetType = mimeType.startsWith('video/') ? 'video'
    : mimeType.startsWith('image/') ? 'image'
    : 'document'

  // Folders can't be imported
  if (mimeType === 'application/vnd.google-apps.folder') {
    return NextResponse.json({ error: 'Cannot import a folder' }, { status: 400 })
  }

  try {
    // Download file content from Drive
    const fileRes = await driveClient.files.get(
      { fileId: driveFileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    const buffer = Buffer.from(fileRes.data as ArrayBuffer)
    const ext = name.split('.').pop() ?? 'bin'
    const storagePath = `drive/${driveFileId}.${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

    // Upsert asset record
    const { data: asset, error: dbError } = await supabase
      .from('assets')
      .upsert({
        source: 'drive',
        type: assetType,
        file_url: publicUrl,
        thumbnail_url: thumbnailLink ?? publicUrl,
        license_info: 'Google Drive',
        title: name,
        client_id: clientId ?? null,
        drive_file_id: driveFileId,
      }, { onConflict: 'drive_file_id', ignoreDuplicates: false })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ asset })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
