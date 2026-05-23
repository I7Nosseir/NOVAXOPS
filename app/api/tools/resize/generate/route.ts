import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute how to scale the original to fill the primary axis, then how many
 *  pixels to outpaint on each edge to reach the final canvas. */
function computeLayout(
  origW: number, origH: number,
  targetW: number, targetH: number,
  focalX: number, focalY: number,   // 0-1
  focalYTarget: number,             // 0-1, desired vertical position in final canvas
) {
  const isPortrait = targetH > targetW
  let iW: number, iH: number
  let eTop = 0, eBottom = 0, eLeft = 0, eRight = 0

  if (isPortrait) {
    iW = targetW
    iH = Math.round(origH * (targetW / origW))
    if (iH >= targetH) {
      // Image already taller — crop only, no outpaint needed
      const cropTop = Math.max(0, Math.min(Math.round(focalY * (iH - targetH)), iH - targetH))
      return { iW, iH, eTop: 0, eBottom: 0, eLeft: 0, eRight: 0, cropTop, cropLeft: 0 }
    }
    const imageFY  = Math.round(focalY * iH)
    const canvasFY = Math.round(focalYTarget * targetH)
    let top = Math.max(0, Math.min(canvasFY - imageFY, targetH - iH))
    eTop    = top
    eBottom = targetH - iH - eTop
  } else {
    iH = targetH
    iW = Math.round(origW * (targetH / origH))
    if (iW >= targetW) {
      const cropLeft = Math.max(0, Math.min(Math.round(focalX * (iW - targetW)), iW - targetW))
      return { iW, iH, eTop: 0, eBottom: 0, eLeft: 0, eRight: 0, cropTop: 0, cropLeft }
    }
    const total = targetW - iW
    eLeft  = Math.floor(total / 2)
    eRight = total - eLeft
  }

  return { iW, iH, eTop, eBottom, eLeft, eRight, cropTop: 0, cropLeft: 0 }
}

function buildOutpaintPrompt(schema: LayoutSchema): string {
  const style = schema.design_style ?? 'professional'
  const bg =
    schema.background_type === 'solid_color'
      ? `flat ${schema.background_extension?.fill_color ?? schema.dominant_color} background`
      : schema.background_type === 'gradient'
      ? `smooth gradient background in ${schema.dominant_color} tones`
      : `${style} photo background with ${schema.dominant_color} dominant tones`
  return `Seamlessly extend this ${style} marketing creative. ${bg}. Match the existing lighting, perspective, atmosphere and visual style exactly. The extended area must look like it was part of the original image from the start.`
}

// ─── Engine 1: Stability AI Outpaint ─────────────────────────────────────────
// Uses the dedicated v2beta/stable-image/edit/outpaint endpoint — the same
// technology as Photoshop Generative Expand. Generates new content for the
// expansion zones that seamlessly continues the scene.

async function stabilityOutpaint(
  intermediateBuffer: Buffer,
  eTop: number, eBottom: number, eLeft: number, eRight: number,
  schema: LayoutSchema,
): Promise<Buffer | null> {
  const key = process.env.STABILITY_API_KEY
  if (!key) return null
  if (!eTop && !eBottom && !eLeft && !eRight) return null

  const form = new FormData()
  const imgArrayBuf = intermediateBuffer.buffer.slice(
    intermediateBuffer.byteOffset,
    intermediateBuffer.byteOffset + intermediateBuffer.byteLength,
  ) as ArrayBuffer
  form.append('image', new Blob([imgArrayBuf], { type: 'image/jpeg' }), 'image.jpg')
  if (eTop    > 0) form.append('up',    String(eTop))
  if (eBottom > 0) form.append('down',  String(eBottom))
  if (eLeft   > 0) form.append('left',  String(eLeft))
  if (eRight  > 0) form.append('right', String(eRight))
  form.append('prompt', buildOutpaintPrompt(schema))
  form.append('creativity', '0.35')
  form.append('output_format', 'jpeg')

  try {
    const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/outpaint', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
      body: form,
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ─── Engine 2: fal.ai FLUX Fill (inpainting / outpainting) ────────────────────
// Places the intermediate image on a black canvas at the target size, generates
// a white mask for the expansion zones, then calls FLUX Fill to inpaint.

async function falOutpaint(
  intermediateBuffer: Buffer,
  targetW: number, targetH: number,
  eTop: number, eBottom: number, eLeft: number, eRight: number,
  iW: number, iH: number,
  schema: LayoutSchema,
): Promise<Buffer | null> {
  const key = process.env.FAL_API_KEY
  if (!key) return null
  if (!eTop && !eBottom && !eLeft && !eRight) return null

  try {
    // Build composite canvas: black bg + intermediate image at correct offset
    const canvas = await sharp({
      create: { width: targetW, height: targetH, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).png().toBuffer()

    const composite = await sharp(canvas)
      .composite([{ input: intermediateBuffer, left: eLeft, top: eTop }])
      .jpeg({ quality: 95 })
      .toBuffer()

    // Build mask: white where expansion is needed, black where original sits
    const maskData = Buffer.alloc(targetW * targetH, 0)
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const inOriginal = y >= eTop && y < eTop + iH && x >= eLeft && x < eLeft + iW
        if (!inOriginal) maskData[y * targetW + x] = 255
      }
    }
    const maskBuf = await sharp(maskData, { raw: { width: targetW, height: targetH, channels: 1 } })
      .png().toBuffer()

    const imageB64 = composite.toString('base64')
    const maskB64  = maskBuf.toString('base64')

    const res = await fetch('https://fal.run/fal-ai/flux-pro/v1/fill', {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${imageB64}`,
        mask_url:  `data:image/png;base64,${maskB64}`,
        prompt: buildOutpaintPrompt(schema),
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
  } catch {
    return null
  }
}

// ─── Engine 3: Gemini image-to-image ──────────────────────────────────────────
async function geminiAdapt(
  imageBase64: string,
  mimeType: string,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
  platform: string,
  formatKey: '9x16' | '1x1',
): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const isPortrait = targetH > targetW
  const adaptation = formatKey === '9x16' ? schema.adaptation.story_9x16 : schema.adaptation.square_1x1
  const elementList = [...schema.elements]
    .sort((a, b) => a.reading_order - b.reading_order)
    .map(e => `  • ${e.type} — "${e.label}" (${e.importance})`)
    .join('\n')

  const prompt = `You are an expert creative designer. Adapt this marketing image to ${targetW}×${targetH}px for ${platform}.

RULES:
1. Keep ALL elements fully visible — nothing cropped
2. ${isPortrait ? 'Extend background above and below' : 'Extend background on sides'} to fill the canvas
3. The result must look natively designed for this format
4. Focal point at ${formatKey === '9x16' ? `${schema.adaptation.story_9x16.focal_y_target}% from top` : 'visual center'}
5. Style: ${schema.design_style}, background: ${schema.background_type}

ELEMENTS TO PRESERVE:
${elementList}

Strategy: ${adaptation.strategy}. ${adaptation.notes ?? ''}
Output: exactly ${targetW}×${targetH}px.`

  for (const model of ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-preview-05-20']) {
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
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
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
      const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inline_data?.mime_type?.startsWith('image/'))
      if (!part?.inline_data?.data) continue
      return sharp(Buffer.from(part.inline_data.data, 'base64'))
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 93 })
        .toBuffer()
    } catch { continue }
  }
  return null
}

// ─── Engine 4: Sharp blurred canvas (always available) ───────────────────────
async function sharpBlurredCanvas(
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
): Promise<Buffer> {
  const { focal_point, background_extension, background_type, dominant_color, adaptation } = schema
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  const hex = (background_extension?.fill_color ?? dominant_color ?? '#1a1a1a')
    .replace('#', '').padEnd(6, '0')
  const bgR = parseInt(hex.slice(0, 2), 16) || 26
  const bgG = parseInt(hex.slice(2, 4), 16) || 26
  const bgB = parseInt(hex.slice(4, 6), 16) || 26

  const isPortrait = targetH > targetW

  if (background_type === 'solid_color' || background_type === 'pattern') {
    const focalYTarget = (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
    const layout = computeLayout(origW, origH, targetW, targetH,
      focal_point.x / 100, focal_point.y / 100, focalYTarget)

    const intermediate = await sharp(inputBuffer)
      .flatten({ background: { r: bgR, g: bgG, b: bgB } })
      .resize(layout.iW, layout.iH, { fit: 'fill', kernel: 'lanczos3' })
      .toBuffer()

    if (layout.cropTop || layout.cropLeft) {
      return sharp(intermediate)
        .extract({ left: layout.cropLeft, top: layout.cropTop, width: targetW, height: targetH })
        .jpeg({ quality: 93 }).toBuffer()
    }

    return sharp(intermediate)
      .extend({ top: layout.eTop, bottom: layout.eBottom, left: layout.eLeft, right: layout.eRight,
        background: { r: bgR, g: bgG, b: bgB }, extendWith: 'background' })
      .resize(targetW, targetH, { fit: 'fill' })
      .jpeg({ quality: 93 }).toBuffer()
  }

  // Blurred cover background + sharp foreground
  const blurredBg = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .blur(45)
    .modulate({ brightness: 0.72 })
    .toBuffer()

  let fgW = isPortrait ? targetW : Math.round(origW * (targetH / origH))
  let fgH = isPortrait ? Math.round(origH * (targetW / origW)) : targetH
  if (fgW > targetW) { fgH = Math.round(fgH * (targetW / fgW)); fgW = targetW }
  if (fgH > targetH) { fgW = Math.round(fgW * (targetH / fgH)); fgH = targetH }

  const foreground = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(fgW, fgH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  const focalYTarget = isPortrait ? (adaptation?.story_9x16?.focal_y_target ?? 50) / 100 : 0.5
  const top  = Math.max(0, Math.min(Math.round(focalYTarget * targetH - (focal_point.y / 100) * fgH), targetH - fgH))
  const left = Math.max(0, Math.round((targetW - fgW) / 2))

  return sharp(blurredBg)
    .composite([{ input: foreground, left, top, blend: 'over' }])
    .jpeg({ quality: 93 })
    .toBuffer()
}

// ─── Per-format adapter ────────────────────────────────────────────────────────
async function adapt(
  imageBase64: string,
  mimeType: string,
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
  platform: string,
  formatKey: '9x16' | '1x1',
): Promise<Buffer> {
  const { focal_point, adaptation } = schema
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  const focalYTarget = (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
  const layout = computeLayout(
    origW, origH, targetW, targetH,
    focal_point.x / 100, focal_point.y / 100,
    formatKey === '9x16' ? focalYTarget : 0.5,
  )

  const { iW, iH, eTop, eBottom, eLeft, eRight, cropTop, cropLeft } = layout
  const needsExpansion = eTop > 0 || eBottom > 0 || eLeft > 0 || eRight > 0

  // Scale to intermediate size (fills primary axis)
  const intermediate = await sharp(inputBuffer)
    .flatten({ background: { r: 26, g: 26, b: 26 } })
    .resize(iW, iH, { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: 95 })
    .toBuffer()

  // If no expansion needed, just crop to target
  if (!needsExpansion) {
    return sharp(intermediate)
      .extract({ left: cropLeft, top: cropTop, width: targetW, height: targetH })
      .jpeg({ quality: 93 }).toBuffer()
  }

  // Try AI outpainting engines in order
  const stability = await stabilityOutpaint(intermediate, eTop, eBottom, eLeft, eRight, schema)
  if (stability) {
    return sharp(stability).resize(targetW, targetH, { fit: 'fill' }).jpeg({ quality: 93 }).toBuffer()
  }

  const fal = await falOutpaint(intermediate, targetW, targetH, eTop, eBottom, eLeft, eRight, iW, iH, schema)
  if (fal) {
    return sharp(fal).resize(targetW, targetH, { fit: 'fill' }).jpeg({ quality: 93 }).toBuffer()
  }

  const gemini = await geminiAdapt(imageBase64, mimeType, targetW, targetH, schema, platform, formatKey)
  if (gemini) return gemini

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

  const { imageBase64, mimeType, schema } = body
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
    adapt(imageBase64, mimeType, inputBuffer, 1080, 1920, schema, 'Instagram Stories & Reels', '9x16')
      .catch(() => sharpBlurredCanvas(inputBuffer, 1080, 1920, schema)),
    adapt(imageBase64, mimeType, inputBuffer, 1080, 1080, schema, 'Instagram Square Feed', '1x1')
      .catch(() => sharpBlurredCanvas(inputBuffer, 1080, 1080, schema)),
  ])

  return NextResponse.json({
    base64_9x16: result9x16.toString('base64'),
    base64_1x1:  result1x1.toString('base64'),
    orig_dimensions: { w: origW, h: origH },
  })
}
