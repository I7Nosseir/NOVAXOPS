import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Core strategy ────────────────────────────────────────────────────────────
//
// Rule: NEVER crop any content. ALWAYS fit the full original inside the canvas.
//
// 1. Scale the image to fit INSIDE the target dimensions (preserve all content).
// 2. Place it on a solid canvas using the detected background color, positioned
//    so the focal point lands as close to the canvas center as possible.
// 3. The gap areas (above, below, or sides) are filled with the matched color.
//
// For solid color backgrounds this is seamless — identical to extending the
// original design space. For photos the fill is a flat color but content is
// always 100% intact.

async function smartResize(
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
): Promise<Buffer> {
  const { focal_point, dominant_color } = schema
  const fx = focal_point.x / 100   // 0–1
  const fy = focal_point.y / 100   // 0–1

  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  // ── Parse background color for the canvas fill ────────────────────────────
  const hex = (dominant_color ?? '#1a1a1a').replace('#', '').padEnd(6, '0')
  const bgR = parseInt(hex.slice(0, 2), 16) || 26
  const bgG = parseInt(hex.slice(2, 4), 16) || 26
  const bgB = parseInt(hex.slice(4, 6), 16) || 26

  // ── Scale: FIT INSIDE target — never crop, never upscale beyond 1x ────────
  const scaleFit = Math.min(targetW / origW, targetH / origH)
  const scaledW = Math.round(origW * scaleFit)
  const scaledH = Math.round(origH * scaleFit)

  // Flatten alpha to background color (handles PNG transparency cleanly)
  const prepared = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  // ── Create solid-color canvas ─────────────────────────────────────────────
  const canvas = await sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 3,
      background: { r: bgR, g: bgG, b: bgB },
    },
  })
    .png()   // PNG canvas avoids JPEG block artifacts at composite edges
    .toBuffer()

  // ── Position: align focal point to canvas focal point, then clamp ─────────
  // Where the focal point should land on the canvas
  const canvasFX = targetW * fx
  const canvasFY = targetH * fy

  // Where the focal point currently is in the resized image
  const imgFX = scaledW * fx
  const imgFY = scaledH * fy

  // Offset so focal points align
  let left = Math.round(canvasFX - imgFX)
  let top  = Math.round(canvasFY - imgFY)

  // Clamp: the image must sit fully within the canvas bounds
  left = Math.max(0, Math.min(left, targetW - scaledW))
  top  = Math.max(0, Math.min(top,  targetH - scaledH))

  // ── Composite and output ──────────────────────────────────────────────────
  return sharp(canvas)
    .composite([{ input: prepared, left, top, blend: 'over' }])
    .jpeg({ quality: 93, mozjpeg: false })
    .toBuffer()
}

// ─── Route ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { imageBase64: string; mimeType?: string; schema: LayoutSchema }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { imageBase64, schema } = body
  if (!imageBase64 || !schema) {
    return NextResponse.json({ error: 'imageBase64 and schema are required' }, { status: 400 })
  }

  const inputBuffer = Buffer.from(imageBase64, 'base64')

  let origMeta: sharp.Metadata
  try {
    origMeta = await sharp(inputBuffer).metadata()
  } catch {
    return NextResponse.json({ error: 'Could not decode image. Upload a valid JPEG, PNG, or WebP.' }, { status: 400 })
  }

  const origW = origMeta.width ?? 0
  const origH = origMeta.height ?? 0
  if (!origW || !origH) {
    return NextResponse.json({ error: 'Image has zero dimensions.' }, { status: 400 })
  }

  const [buf9x16, buf1x1] = await Promise.all([
    smartResize(inputBuffer, 1080, 1920, schema),   // Stories & Reels
    smartResize(inputBuffer, 1080, 1080, schema),   // Square feed
  ])

  // Return base64 — no Supabase needed for temporary outputs, and it avoids
  // cross-origin download restrictions entirely.
  return NextResponse.json({
    base64_9x16: buf9x16.toString('base64'),
    base64_1x1:  buf1x1.toString('base64'),
    orig_dimensions: { w: origW, h: origH },
  })
}
