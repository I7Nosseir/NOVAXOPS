import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Smart resize core ────────────────────────────────────────────────────────
//
// Strategy — no blurring, no letterboxing, no scaling-down content:
//
// 1. Determine scale: match the dimension that fits tightest to the canvas edge
//    (fill width for portrait targets, fill height for landscape/square targets)
//
// 2. If scaled image fits inside the canvas with space left over:
//    - Solid background → extend canvas with the exact matched background color
//      so the extension is seamless (teeth ad teal becomes teal above/below)
//    - Photo/gradient background → use scale-to-fill + smart focal-point crop instead
//
// 3. If scaled image is larger than the canvas → smart crop centered on focal point
//
// Result: content is always full quality, background is always color-matched or cropped.

async function smartResize(
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
): Promise<Buffer> {
  const { focal_point, background_type, dominant_color } = schema
  const fx = focal_point.x / 100   // 0–1
  const fy = focal_point.y / 100   // 0–1

  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  const targetRatio = targetW / targetH
  const origRatio = origW / origH
  const isSolid = background_type === 'solid_color'

  // Parse background color for canvas fill
  const hex = (dominant_color ?? '#1a1a1a').replace('#', '')
  const bgR = parseInt(hex.slice(0, 2), 16) || 26
  const bgG = parseInt(hex.slice(2, 4), 16) || 26
  const bgB = parseInt(hex.slice(4, 6), 16) || 26

  // ── Scale: touch the nearest canvas edge without cropping content ──────────
  // Portrait target (9:16) → scale to fill target width exactly
  // Landscape/square target (1:1) → scale to fill target height exactly
  let scaledW: number
  let scaledH: number

  if (targetRatio <= origRatio) {
    // Target is more portrait than source → scale to fill width
    scaledW = targetW
    scaledH = Math.round(origH * (targetW / origW))
  } else {
    // Target is more landscape/square than source → scale to fill height
    scaledH = targetH
    scaledW = Math.round(origW * (targetH / origH))
  }

  // Flatten alpha (PNG transparency → background color) so compositing is clean
  const flatBuffer = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .toBuffer()

  // Resize to computed scale
  const resized = scaledW !== origW || scaledH !== origH
    ? await sharp(flatBuffer).resize(scaledW, scaledH, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer()
    : await sharp(flatBuffer).jpeg({ quality: 95 }).toBuffer()

  const fitsInCanvas = scaledW <= targetW && scaledH <= targetH

  // ── Path A: image fits inside canvas — extend the empty space ─────────────
  if (fitsInCanvas) {
    if (isSolid) {
      // Extend with exact background color — seamless, professional
      const canvasFX = targetW * fx
      const canvasFY = targetH * fy
      const imgFX = scaledW * fx
      const imgFY = scaledH * fy

      let left = Math.round(canvasFX - imgFX)
      let top = Math.round(canvasFY - imgFY)
      left = Math.max(0, Math.min(left, targetW - scaledW))
      top = Math.max(0, Math.min(top, targetH - scaledH))

      const canvas = await sharp({
        create: { width: targetW, height: targetH, channels: 3, background: { r: bgR, g: bgG, b: bgB } },
      }).jpeg({ quality: 95 }).toBuffer()

      return sharp(canvas)
        .composite([{ input: resized, left, top }])
        .jpeg({ quality: 93 })
        .toBuffer()
    } else {
      // Photo/gradient — can't extend seamlessly; use scale-to-fill + smart crop
      const scaleToFill = Math.max(targetW / origW, targetH / origH)
      const fillW = Math.round(origW * scaleToFill)
      const fillH = Math.round(origH * scaleToFill)

      const filled = await sharp(flatBuffer)
        .resize(fillW, fillH, { fit: 'fill' })
        .jpeg({ quality: 95 })
        .toBuffer()

      let cx = Math.round(fillW * fx - targetW / 2)
      let cy = Math.round(fillH * fy - targetH / 2)
      cx = Math.max(0, Math.min(cx, fillW - targetW))
      cy = Math.max(0, Math.min(cy, fillH - targetH))

      return sharp(filled)
        .extract({ left: cx, top: cy, width: targetW, height: targetH })
        .jpeg({ quality: 93 })
        .toBuffer()
    }
  }

  // ── Path B: image is larger than canvas — smart crop on focal point ────────
  let cx = Math.round(scaledW * fx - targetW / 2)
  let cy = Math.round(scaledH * fy - targetH / 2)
  cx = Math.max(0, Math.min(cx, Math.max(0, scaledW - targetW)))
  cy = Math.max(0, Math.min(cy, Math.max(0, scaledH - targetH)))

  const cropW = Math.min(targetW, scaledW)
  const cropH = Math.min(targetH, scaledH)

  const cropped = await sharp(resized)
    .extract({ left: cx, top: cy, width: cropW, height: cropH })
    .toBuffer()

  if (cropW === targetW && cropH === targetH) {
    return sharp(cropped).jpeg({ quality: 93 }).toBuffer()
  }

  // Edge case: crop was smaller than target → embed in background canvas
  const canvas = await sharp({
    create: { width: targetW, height: targetH, channels: 3, background: { r: bgR, g: bgG, b: bgB } },
  }).jpeg({ quality: 95 }).toBuffer()

  return sharp(canvas)
    .composite([{
      input: cropped,
      left: Math.round((targetW - cropW) / 2),
      top: Math.round((targetH - cropH) / 2),
    }])
    .jpeg({ quality: 93 })
    .toBuffer()
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { imageBase64: string; mimeType: string; schema: LayoutSchema }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { imageBase64, mimeType: _mimeType, schema } = body
  if (!imageBase64 || !schema) {
    return NextResponse.json({ error: 'imageBase64 and schema required' }, { status: 400 })
  }

  const inputBuffer = Buffer.from(imageBase64, 'base64')

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

  const [buf9x16, buf1x1] = await Promise.all([
    smartResize(inputBuffer, 1080, 1920, schema),
    smartResize(inputBuffer, 1080, 1080, schema),
  ])

  // Return base64 directly — no Supabase storage needed for ephemeral resize outputs.
  // This also guarantees the download button always works (no cross-origin issues).
  return NextResponse.json({
    base64_9x16: buf9x16.toString('base64'),
    base64_1x1:  buf1x1.toString('base64'),
    orig_dimensions: { w: origW, h: origH },
  })
}
