import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const maxDuration = 30

/**
 * POST /api/assets/upload
 * Body: multipart/form-data with `file` field
 * Returns: { url: string }
 *
 * Uploads a file to the Supabase Storage `assets` bucket and returns
 * a public URL. Used by the Media Buying studio for reference image uploads.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const originalName = file instanceof File ? file.name : 'upload'
  const ext          = originalName.split('.').pop() ?? 'jpg'
  const storagePath  = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const buffer       = await file.arrayBuffer()

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    console.error('[assets/upload] Storage upload error:', uploadError.message)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

  return NextResponse.json({ url: publicUrl })
}
