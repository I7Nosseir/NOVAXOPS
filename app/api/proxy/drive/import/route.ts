import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function contentTypeToExt(ct: string): string {
  if (ct.includes('mp4'))      return '.mp4'
  if (ct.includes('quicktime')) return '.mov'
  if (ct.includes('webm'))     return '.webm'
  if (ct.includes('avi'))      return '.avi'
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'
  if (ct.includes('png'))      return '.png'
  if (ct.includes('webp'))     return '.webp'
  if (ct.includes('gif'))      return '.gif'
  return ''
}

/**
 * POST /api/proxy/drive/import
 * Body: { fileId: string }
 *
 * Downloads a publicly-shared Google Drive file and uploads it to
 * Supabase Storage (assets/drive-imports/{fileId}.{ext}).
 * Subsequent calls with the same fileId are idempotent (upsert).
 * Returns: { publicUrl: string, contentType: string }
 */
export async function POST(req: NextRequest) {
  let fileId: string | undefined
  try {
    const body = await req.json()
    fileId = body.fileId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 })
  }

  const driveUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`

  let upstream: Response
  try {
    upstream = await fetch(driveUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NOVAXOps/1.0)' },
      redirect: 'follow',
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach Google Drive' }, { status: 502 })
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Google Drive returned ${upstream.status}` }, { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'

  if (contentType.includes('text/html')) {
    return NextResponse.json(
      { error: 'File not accessible. Open Drive → Share → set to "Anyone with the link" → Viewer.' },
      { status: 403 }
    )
  }

  const ext = contentTypeToExt(contentType)
  const storagePath = `drive-imports/${fileId}${ext}`

  const buffer = await upstream.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

  return NextResponse.json({ publicUrl, contentType })
}
