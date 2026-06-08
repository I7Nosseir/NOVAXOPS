import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * POST /api/ai-image/save
 * Body: { imageData: base64string, mimeType?, title?, prompt?, aspectRatio?, clientId? }
 *
 * Uploads the AI-generated image to Supabase Storage under ai-generations/
 * and creates a record in the assets table with source='ai'.
 *
 * Returns: { asset, url }
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  let body: {
    imageData?: string
    mimeType?: string
    title?: string
    prompt?: string
    aspectRatio?: string
    clientId?: string
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    imageData,
    mimeType = 'image/png',
    title,
    prompt = '',
    aspectRatio = '',
    clientId,
  } = body

  if (!imageData) {
    return NextResponse.json({ error: 'imageData required' }, { status: 400 })
  }

  const buffer = Buffer.from(imageData, 'base64')
  const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'png'
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const storagePath = `ai-generations/${slug}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

  if (uploadError) {
    console.error('[ai-image/save] storage upload:', uploadError.message)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath)

  const assetTitle = title?.trim()
    || (prompt.trim() ? prompt.trim().slice(0, 80) : null)
    || `AI Generation ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`

  const { data: asset, error: dbError } = await supabase
    .from('assets')
    .insert({
      source: 'ai',
      type: 'image',
      file_url: publicUrl,
      thumbnail_url: publicUrl,
      license_info: aspectRatio ? `AI Generated · ${aspectRatio}` : 'AI Generated',
      title: assetTitle,
      client_id: clientId ?? null,
    })
    .select()
    .single()

  if (dbError) {
    console.error('[ai-image/save] db insert:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ asset, url: publicUrl })
}
