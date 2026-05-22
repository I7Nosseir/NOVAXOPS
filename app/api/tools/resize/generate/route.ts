import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import type { LayoutSchema } from '../analyze/route'

// Node.js runtime — required for Sharp
export const runtime = 'nodejs'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Smart resize core ────────────────────────────────────────────────────────
// Strategy: never crop the content.
//   1. Create a blurred version of the original scaled to fill the target canvas
//      (background layer — colors always match, transitions feel intentional)
//   2. Scale the sharp original to fit inside the canvas while keeping its full
//      aspect ratio (no cropping, all content visible)
//   3. Composite the sharp original onto the blurred background, using the
//      detected focal point to decide vertical/horizontal positioning within
//      the safe zone of each platform format

async function smartResize(
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
  safeZone: { top: number; bottom: number; left: number; right: number }, // percent
): Promise<Buffer> {
  const { focal_point, background_type, dominant_color } = schema
  const fx = focal_point.x   // 0-100
  const fy = focal_point.y   // 0-100

  // ── Step 1: Background layer ─────────────────────────────────────────────
  // Cover the full canvas with a blurred version of the original.
  // Use the focal point as the anchor so the dominant color region is preserved.
  let bgBuffer: Buffer

  if (background_type === 'solid_color') {
    // For solid backgrounds, fill with the dominant color (sharper result)
    const hex = dominant_color?.replace('#', '') ?? '1a1a1a'
    const r = parseInt(hex.slice(0, 2), 16) || 0
    const g = parseInt(hex.slice(2, 4), 16) || 0
    const b = parseInt(hex.slice(4, 6), 16) || 0
    bgBuffer = await sharp({
      create: { width: targetW, height: targetH, channels: 3, background: { r, g, b } },
    })
      .jpeg({ quality: 95 })
      .toBuffer()
  } else {
    // For photos and gradients: scale to cover, blur heavily
    // Use gravity anchored to focal point so the blur reflects the right region
    const gravityX = fx < 33 ? 'left' : fx > 66 ? 'right' : 'center'
    const gravityY = fy < 33 ? 'north' : fy > 66 ? 'south' : 'center'
    const gravity = `${gravityY}${gravityX === 'center' ? '' : gravityX}` as sharp.Gravity

    bgBuffer = await sharp(inputBuffer)
      .resize(targetW, targetH, { fit: 'cover', position: gravity })
      .blur(50)                     // heavy blur — purely decorative backdrop
      .modulate({ brightness: 0.8 }) // slightly dim so foreground pops
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  // ── Step 2: Foreground — scale original to fit inside canvas ─────────────
  // `fit: 'inside'` guarantees the full image is visible, never cropped.
  // We cap at 95% of the canvas to always leave some blurred bg visible
  // (avoids a hard edge when the image exactly matches the canvas ratio).
  const maxFgW = Math.round(targetW * 0.97)
  const maxFgH = Math.round(targetH * 0.97)

  const fgBuffer = await sharp(inputBuffer)
    .resize(maxFgW, maxFgH, { fit: 'inside', withoutEnlargement: false })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 3 })  // mild sharpening after downscale
    .jpeg({ quality: 92 })
    .toBuffer()

  const fgMeta = await sharp(fgBuffer).metadata()
  const fgW = fgMeta.width!
  const fgH = fgMeta.height!

  // ── Step 3: Position the foreground using focal point + safe zones ────────
  // Safe zone defines the region where important content should live.
  // We position the image so the detected focal point lands inside this zone.
  const safeLeft   = Math.round(targetW * safeZone.left / 100)
  const safeRight  = Math.round(targetW * (1 - safeZone.right / 100))
  const safeTop    = Math.round(targetH * safeZone.top / 100)
  const safeBottom = Math.round(targetH * (1 - safeZone.bottom / 100))

  const safeW = safeRight - safeLeft
  const safeH = safeBottom - safeTop

  // Where we want the focal point to land on the output canvas (within safe zone)
  const targetFocalX = safeLeft + safeW * (fx / 100)
  const targetFocalY = safeTop  + safeH * (fy / 100)

  // Where the focal point is within the foreground image
  const focalInFgX = fgW * (fx / 100)
  const focalInFgY = fgH * (fy / 100)

  // Offset so focal points align, then clamp to keep fg inside canvas
  let left = Math.round(targetFocalX - focalInFgX)
  let top  = Math.round(targetFocalY - focalInFgY)

  // Hard clamp: foreground must always be fully within the canvas
  left = Math.max(0, Math.min(left, targetW - fgW))
  top  = Math.max(0, Math.min(top,  targetH - fgH))

  // ── Step 4: Composite ────────────────────────────────────────────────────
  const output = await sharp(bgBuffer)
    .composite([{ input: fgBuffer, left, top }])
    .jpeg({ quality: 92, mozjpeg: false })
    .toBuffer()

  return output
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { imageBase64: string; mimeType: string; schema: LayoutSchema }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { imageBase64, mimeType, schema } = body
  if (!imageBase64 || !schema) {
    return NextResponse.json({ error: 'imageBase64 and schema required' }, { status: 400 })
  }

  const inputBuffer = Buffer.from(imageBase64, 'base64')

  // Validate input can be decoded by Sharp
  let origMeta: sharp.Metadata
  try {
    origMeta = await sharp(inputBuffer).metadata()
  } catch {
    return NextResponse.json({ error: 'Could not read image. Ensure it is a valid JPEG, PNG, or WebP.' }, { status: 400 })
  }

  const origW = origMeta.width ?? 0
  const origH = origMeta.height ?? 0
  if (!origW || !origH) {
    return NextResponse.json({ error: 'Image has invalid dimensions.' }, { status: 400 })
  }

  // ── Generate both outputs in parallel ────────────────────────────────────
  const [buf9x16, buf1x1] = await Promise.all([
    // 9:16 — Stories & Reels (1080×1920)
    // Safe zone: top 12% (Instagram UI notch area) + bottom 20% (caption/button area)
    // Left/right: 5% margin so text elements near edges are never obscured
    smartResize(inputBuffer, 1080, 1920, schema, { top: 12, bottom: 20, left: 5, right: 5 }),

    // 1:1 — Square Feed (1080×1080)
    // Safe zone: 8% on all sides — generous margin for cropping thumbnails
    smartResize(inputBuffer, 1080, 1080, schema, { top: 8, bottom: 8, left: 8, right: 8 }),
  ])

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const db = adminSupabase()
  const ts = Date.now()

  const upload9 = db.storage.from('assets').upload(
    `resize/${ts}-9x16.jpg`, buf9x16,
    { contentType: 'image/jpeg', upsert: true },
  )
  const upload1 = db.storage.from('assets').upload(
    `resize/${ts}-1x1.jpg`, buf1x1,
    { contentType: 'image/jpeg', upsert: true },
  )

  const [res9, res1] = await Promise.all([upload9, upload1])

  if (res9.error || res1.error) {
    // Fallback: return base64 so the user can still download even if storage fails
    return NextResponse.json({
      url9x16: null,
      url1x1: null,
      base64_9x16: buf9x16.toString('base64'),
      base64_1x1: buf1x1.toString('base64'),
      warning: 'Storage upload failed — use base64 fallback.',
    })
  }

  const url9x16 = db.storage.from('assets').getPublicUrl(res9.data!.path).data.publicUrl
  const url1x1  = db.storage.from('assets').getPublicUrl(res1.data!.path).data.publicUrl

  return NextResponse.json({
    url9x16,
    url1x1,
    orig_dimensions: { w: origW, h: origH },
  })
}
