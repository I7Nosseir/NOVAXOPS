import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Layout computation ────────────────────────────────────────────────────────
// Scale original to fill the primary canvas axis (width for portrait, height for
// landscape/square), then calculate how many pixels to outpaint on each edge.

function computeLayout(
  origW: number, origH: number,
  targetW: number, targetH: number,
  focalX: number, focalY: number,
  focalYTarget: number,
) {
  const isPortrait = targetH > targetW
  let iW: number, iH: number
  let eTop = 0, eBottom = 0, eLeft = 0, eRight = 0
  let cropTop = 0, cropLeft = 0

  if (isPortrait) {
    iW = targetW
    iH = Math.round(origH * (targetW / origW))
    if (iH >= targetH) {
      cropTop = Math.max(0, Math.min(Math.round(focalY * (iH - targetH)), iH - targetH))
    } else {
      const imageFY  = Math.round(focalY * iH)
      const canvasFY = Math.round(focalYTarget * targetH)
      eTop    = Math.max(0, Math.min(canvasFY - imageFY, targetH - iH))
      eBottom = targetH - iH - eTop
    }
  } else {
    iH = targetH
    iW = Math.round(origW * (targetH / origH))
    if (iW >= targetW) {
      cropLeft = Math.max(0, Math.min(Math.round(focalX * (iW - targetW)), iW - targetW))
    } else {
      const total = targetW - iW
      eLeft  = Math.floor(total / 2)
      eRight = total - eLeft
    }
  }

  return { iW, iH, eTop, eBottom, eLeft, eRight, cropTop, cropLeft }
}

function parseBg(schema: LayoutSchema): { r: number; g: number; b: number } {
  const hex = (schema.background_extension?.fill_color ?? schema.dominant_color ?? '#1a1a1a')
    .replace('#', '').padEnd(6, '0')
  return {
    r: parseInt(hex.slice(0, 2), 16) || 26,
    g: parseInt(hex.slice(2, 4), 16) || 26,
    b: parseInt(hex.slice(4, 6), 16) || 26,
  }
}

// ─── Build composite canvas ────────────────────────────────────────────────────
// Places the scaled intermediate image on a full-size canvas, with the expansion
// zones filled with the matched background color. This is what we send to the AI
// so it can see exactly where to outpaint.

async function buildComposite(
  intermediateBuffer: Buffer,
  targetW: number, targetH: number,
  eTop: number, eLeft: number,
  bg: { r: number; g: number; b: number },
): Promise<Buffer> {
  const canvas = await sharp({
    create: { width: targetW, height: targetH, channels: 3, background: bg },
  }).png().toBuffer()
  return sharp(canvas)
    .composite([{ input: intermediateBuffer, left: eLeft, top: eTop }])
    .jpeg({ quality: 95 })
    .toBuffer()
}

// ─── Engine 1: Gemini outpaint ─────────────────────────────────────────────────
// Sends the composite canvas (original in place + colored extension zones) to
// Gemini image generation with an explicit outpainting prompt. Gemini sees the
// spatial layout and fills the extension areas to match the scene.

async function geminiOutpaint(
  compositeB64: string,
  targetW: number, targetH: number,
  eTop: number, eBottom: number, eLeft: number, eRight: number,
  iW: number, iH: number,
  schema: LayoutSchema,
): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const isPortrait = targetH > targetW
  const fillColorHex = schema.background_extension?.fill_color ?? schema.dominant_color ?? '#000'

  const extZone = isPortrait
    ? `the ${fillColorHex} colored strips ${eTop}px above and ${eBottom}px below the original image`
    : `the ${fillColorHex} colored strips ${eLeft}px to the left and ${eRight}px to the right of the original image`

  const bgDesc =
    schema.background_type === 'solid_color'  ? `flat ${fillColorHex} solid color`
    : schema.background_type === 'gradient'   ? `gradient in ${schema.dominant_color} tones`
    : `${schema.design_style} photo background with ${schema.dominant_color} dominant tones`

  const prompt = `You are performing an outpainting task. I am sending you a ${targetW}×${targetH}px composite image.

The original image content is ${iW}×${iH}px and sits at position (left: ${eLeft}px, top: ${eTop}px) inside this canvas. ${extZone} are the areas that need to be filled in.

YOUR TASK: Replace ${extZone} with seamlessly generated content that:
1. Naturally continues the scene from the original image — matching lighting, perspective, atmosphere, colors and style
2. Has no visible seam or edge where the original image meets the new content
3. Looks like it was always part of the original photograph/design
4. Background style to match: ${bgDesc}
5. Design style: ${schema.design_style}

Output the complete ${targetW}×${targetH}px image. Keep the original image region (position left: ${eLeft}px, top: ${eTop}px, width: ${iW}px, height: ${iH}px) exactly as-is — only fill in the extension zones.`

  for (const model of ['gemini-3.0-flash-preview', 'gemini-2.5-flash-preview-05-20']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: compositeB64 } },
              ],
            }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        },
      )
      if (!res.ok) continue
      const data = await res.json() as {
        candidates?: { content?: { parts?: { inline_data?: { mime_type: string; data: string } }[] } }[]
      }
      const part = data?.candidates?.[0]?.content?.parts?.find(
        p => p.inline_data?.mime_type?.startsWith('image/'),
      )
      if (!part?.inline_data?.data) continue
      return sharp(Buffer.from(part.inline_data.data, 'base64'))
        .resize(targetW, targetH, { fit: 'fill' })
        .jpeg({ quality: 93 })
        .toBuffer()
    } catch { continue }
  }
  return null
}

// ─── Engine 2: Stability AI outpaint ──────────────────────────────────────────
async function stabilityOutpaint(
  intermediateBuffer: Buffer,
  eTop: number, eBottom: number, eLeft: number, eRight: number,
  schema: LayoutSchema,
): Promise<Buffer | null> {
  const key = process.env.STABILITY_API_KEY
  if (!key) return null

  const prompt = `Seamlessly extend this ${schema.design_style} image. Match the existing lighting, perspective, atmosphere and colors exactly. The extension must look like it was part of the original.`

  try {
    const imgArrayBuf = intermediateBuffer.buffer.slice(
      intermediateBuffer.byteOffset,
      intermediateBuffer.byteOffset + intermediateBuffer.byteLength,
    ) as ArrayBuffer

    const form = new FormData()
    form.append('image', new Blob([imgArrayBuf], { type: 'image/jpeg' }), 'image.jpg')
    if (eTop    > 0) form.append('up',    String(eTop))
    if (eBottom > 0) form.append('down',  String(eBottom))
    if (eLeft   > 0) form.append('left',  String(eLeft))
    if (eRight  > 0) form.append('right', String(eRight))
    form.append('prompt', prompt)
    form.append('creativity', '0.35')
    form.append('output_format', 'jpeg')

    const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/outpaint', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
      body: form,
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

// ─── Engine 3: fal.ai FLUX Fill ───────────────────────────────────────────────
async function falOutpaint(
  compositeBuffer: Buffer,
  targetW: number, targetH: number,
  eTop: number, eBottom: number, eLeft: number, eRight: number,
  iW: number, iH: number,
  schema: LayoutSchema,
): Promise<Buffer | null> {
  const key = process.env.FAL_API_KEY
  if (!key) return null

  try {
    // White mask = fill, black = keep original
    const maskData = Buffer.alloc(targetW * targetH, 0)
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const inOriginal = y >= eTop && y < eTop + iH && x >= eLeft && x < eLeft + iW
        if (!inOriginal) maskData[y * targetW + x] = 255
      }
    }
    const maskBuf = await sharp(maskData, { raw: { width: targetW, height: targetH, channels: 1 } })
      .png().toBuffer()

    const res = await fetch('https://fal.run/fal-ai/flux-pro/v1/fill', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${compositeBuffer.toString('base64')}`,
        mask_url:  `data:image/png;base64,${maskBuf.toString('base64')}`,
        prompt: `Seamlessly extend this ${schema.design_style} image. Match existing lighting, colors and atmosphere. No visible seam.`,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        output_format: 'jpeg',
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { images?: { url: string }[] }
    const imgUrl = data?.images?.[0]?.url
    if (!imgUrl) return null
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return null
    return Buffer.from(await imgRes.arrayBuffer())
  } catch { return null }
}

// ─── Engine 4: Sharp blurred canvas (always available) ────────────────────────
async function sharpBlurredCanvas(
  inputBuffer: Buffer,
  targetW: number, targetH: number,
  schema: LayoutSchema,
): Promise<Buffer> {
  const bg = parseBg(schema)
  const { focal_point, background_type, adaptation } = schema
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!
  const isPortrait = targetH > targetW

  if (background_type === 'solid_color' || background_type === 'pattern') {
    const focalYTarget = (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
    const layout = computeLayout(origW, origH, targetW, targetH,
      focal_point.x / 100, focal_point.y / 100, focalYTarget)
    const intermediate = await sharp(inputBuffer)
      .flatten({ background: bg })
      .resize(layout.iW, layout.iH, { fit: 'fill', kernel: 'lanczos3' })
      .toBuffer()
    if (layout.cropTop || layout.cropLeft) {
      return sharp(intermediate)
        .extract({ left: layout.cropLeft, top: layout.cropTop, width: targetW, height: targetH })
        .jpeg({ quality: 93 }).toBuffer()
    }
    return sharp(intermediate)
      .extend({ top: layout.eTop, bottom: layout.eBottom, left: layout.eLeft, right: layout.eRight,
        background: bg, extendWith: 'background' })
      .resize(targetW, targetH, { fit: 'fill' })
      .jpeg({ quality: 93 }).toBuffer()
  }

  const blurredBg = await sharp(inputBuffer)
    .flatten({ background: bg })
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .blur(45).modulate({ brightness: 0.72 })
    .toBuffer()

  let fgW = isPortrait ? targetW : Math.round(origW * (targetH / origH))
  let fgH = isPortrait ? Math.round(origH * (targetW / origW)) : targetH
  if (fgW > targetW) { fgH = Math.round(fgH * (targetW / fgW)); fgW = targetW }
  if (fgH > targetH) { fgW = Math.round(fgW * (targetH / fgH)); fgH = targetH }

  const foreground = await sharp(inputBuffer)
    .flatten({ background: bg })
    .resize(fgW, fgH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  const focalYTarget = isPortrait ? (adaptation?.story_9x16?.focal_y_target ?? 50) / 100 : 0.5
  const top  = Math.max(0, Math.min(Math.round(focalYTarget * targetH - (focal_point.y / 100) * fgH), targetH - fgH))
  const left = Math.max(0, Math.round((targetW - fgW) / 2))

  return sharp(blurredBg)
    .composite([{ input: foreground, left, top, blend: 'over' }])
    .jpeg({ quality: 93 }).toBuffer()
}

// ─── Per-format adapter ────────────────────────────────────────────────────────
async function adapt(
  inputBuffer: Buffer,
  targetW: number, targetH: number,
  schema: LayoutSchema,
  formatKey: '9x16' | '1x1',
): Promise<Buffer> {
  const { focal_point, adaptation } = schema
  const bg = parseBg(schema)
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  const focalYTarget = formatKey === '9x16'
    ? (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
    : 0.5

  const layout = computeLayout(
    origW, origH, targetW, targetH,
    focal_point.x / 100, focal_point.y / 100, focalYTarget,
  )
  const { iW, iH, eTop, eBottom, eLeft, eRight, cropTop, cropLeft } = layout
  const needsExpansion = eTop > 0 || eBottom > 0 || eLeft > 0 || eRight > 0

  // Scale to primary axis size
  const intermediate = await sharp(inputBuffer)
    .flatten({ background: bg })
    .resize(iW, iH, { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: 95 })
    .toBuffer()

  // No expansion needed — just crop to target
  if (!needsExpansion) {
    return sharp(intermediate)
      .extract({ left: cropLeft, top: cropTop, width: targetW, height: targetH })
      .jpeg({ quality: 93 }).toBuffer()
  }

  // Build composite canvas for AI engines
  const composite = await buildComposite(intermediate, targetW, targetH, eTop, eLeft, bg)

  // Try AI outpainting engines in priority order
  const gemini = await geminiOutpaint(
    composite.toString('base64'), targetW, targetH,
    eTop, eBottom, eLeft, eRight, iW, iH, schema,
  )
  if (gemini) return gemini

  const stability = await stabilityOutpaint(intermediate, eTop, eBottom, eLeft, eRight, schema)
  if (stability) {
    return sharp(stability).resize(targetW, targetH, { fit: 'fill' }).jpeg({ quality: 93 }).toBuffer()
  }

  const fal = await falOutpaint(composite, targetW, targetH, eTop, eBottom, eLeft, eRight, iW, iH, schema)
  if (fal) {
    return sharp(fal).resize(targetW, targetH, { fit: 'fill' }).jpeg({ quality: 93 }).toBuffer()
  }

  return sharpBlurredCanvas(inputBuffer, targetW, targetH, schema)
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { imageBase64: string; mimeType: string; schema: LayoutSchema }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { imageBase64, mimeType: _mimeType, schema } = body
  if (!imageBase64 || !schema) {
    return NextResponse.json({ error: 'imageBase64 and schema are required' }, { status: 400 })
  }

  const inputBuffer = Buffer.from(imageBase64, 'base64')
  let origMeta: sharp.Metadata
  try {
    origMeta = await sharp(inputBuffer).metadata()
  } catch {
    return NextResponse.json({ error: 'Could not decode image.' }, { status: 400 })
  }

  const origW = origMeta.width ?? 0
  const origH = origMeta.height ?? 0
  if (!origW || !origH) {
    return NextResponse.json({ error: 'Image has zero dimensions.' }, { status: 400 })
  }

  const [result9x16, result1x1] = await Promise.all([
    adapt(inputBuffer, 1080, 1920, schema, '9x16')
      .catch(() => sharpBlurredCanvas(inputBuffer, 1080, 1920, schema)),
    adapt(inputBuffer, 1080, 1080, schema, '1x1')
      .catch(() => sharpBlurredCanvas(inputBuffer, 1080, 1080, schema)),
  ])

  return NextResponse.json({
    base64_9x16: result9x16.toString('base64'),
    base64_1x1:  result1x1.toString('base64'),
    orig_dimensions: { w: origW, h: origH },
  })
}
