import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Gemini image-to-image adaptation ────────────────────────────────────────
const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-preview-05-20',
]

function buildAdaptationPrompt(
  schema: LayoutSchema,
  targetW: number,
  targetH: number,
  platform: string,
  formatKey: '9x16' | '1x1',
): string {
  const isPortrait = targetH > targetW
  const adaptation = formatKey === '9x16' ? schema.adaptation.story_9x16 : schema.adaptation.square_1x1

  const elementList = [...schema.elements]
    .sort((a, b) => a.reading_order - b.reading_order)
    .map(e => `  • ${e.type} — "${e.label}" (${e.importance} importance, read order ${e.reading_order})`)
    .join('\n')

  const bgDesc =
    schema.background_type === 'solid_color'
      ? `solid color ${schema.background_extension.fill_color}`
      : schema.background_type === 'gradient'
      ? `gradient background (dominant: ${schema.dominant_color})`
      : `photo/complex background (dominant color: ${schema.dominant_color})`

  return `You are an expert creative designer and art director. Adapt this marketing creative to ${targetW}×${targetH}px for ${platform}.

DESIGN BRIEF:
- Style: ${schema.design_style}
- Background: ${bgDesc}
- Visual weight: ${schema.visual_weight}
- Adaptation strategy: ${adaptation.strategy}
- Art direction: ${adaptation.notes || 'Maintain original visual identity'}

CONTENT ELEMENTS TO PRESERVE (ALL must be fully visible, nothing cropped):
${elementList}

ADAPTATION RULES:
1. Keep ALL elements 100% intact — no cropping, no cutting, no removing
2. ${isPortrait ? `Extend the ${bgDesc} above and below to fill the taller canvas` : `Extend the ${bgDesc} on the sides to fill the wider canvas`}
3. Rebalance spacing so the design looks ${isPortrait ? 'vertical-native' : 'square-native'}
4. Maintain the ${schema.design_style} design style throughout
5. Keep text readable and properly spaced
6. Focal point should land at approximately ${formatKey === '9x16' ? `${schema.adaptation.story_9x16.focal_y_target}% from top` : 'visual center'}
7. Output must be exactly ${targetW}×${targetH}px
8. The result must look like it was originally designed for this format — not a resized image

PLATFORM SAFE ZONES for ${platform}:
${isPortrait ? '- Top 12%: UI zone (keep clear of important content)\n- Bottom 20%: CTA/caption zone (keep clear or place CTA here)\n- Sides: 5% minimum margin' : '- All sides: 8% minimum margin'}

Generate the adapted creative now.`
}

async function geminiAdapt(
  imageBase64: string,
  mimeType: string,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
  platform: string,
  formatKey: '9x16' | '1x1',
): Promise<Buffer | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return null

  const prompt = buildAdaptationPrompt(schema, targetW, targetH, platform, formatKey)

  for (const model of GEMINI_IMAGE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      })

      if (!res.ok) continue

      const data = await res.json() as {
        candidates?: {
          content?: {
            parts?: { inline_data?: { mime_type: string; data: string }; text?: string }[]
          }
        }[]
      }

      const imgPart = data?.candidates?.[0]?.content?.parts?.find(
        p => p.inline_data?.mime_type?.startsWith('image/'),
      )

      if (!imgPart?.inline_data?.data) continue

      const imgBuffer = Buffer.from(imgPart.inline_data.data, 'base64')

      return sharp(imgBuffer)
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 93 })
        .toBuffer()
    } catch {
      continue
    }
  }

  return null
}

// ─── Sharp fallback ────────────────────────────────────────────────────────────
// Strategy depends on background type:
//
// Solid / pattern: scale image to fill width (portrait) or height (landscape),
//   extend remaining space with the exact matched fill color. Clean, seamless.
//
// Photo / gradient: industry-standard "blurred canvas" technique —
//   1. Scale+cover the full target canvas → apply heavy gaussian blur (sigma 45)
//      + slight brightness reduction. This becomes the background layer and
//      perfectly matches the image's colors/tones with no seams.
//   2. Scale the original (sharp) to fill the primary dimension, clamp to canvas.
//   3. Composite the sharp original centered at focal_y_target on the blurred bg.
//
// This is how Snapseed, Adobe Express, and iOS Photos handle canvas expansion.
// It always looks designed — no mirror artifacts, no upside-down subjects.

async function sharpFallback(
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

  // ── Solid / pattern: extend with flat color ──────────────────────────────────
  if (background_type === 'solid_color' || background_type === 'pattern') {
    let scaledW: number, scaledH: number
    let extTop = 0, extBottom = 0, extLeft = 0, extRight = 0

    if (isPortrait) {
      scaledW = targetW
      scaledH = Math.round(origH * (targetW / origW))
      if (scaledH >= targetH) {
        const excess = scaledH - targetH
        const cropTop = Math.max(0, Math.min(Math.round((focal_point.y / 100) * excess), excess))
        return sharp(inputBuffer)
          .flatten({ background: { r: bgR, g: bgG, b: bgB } })
          .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
          .extract({ left: 0, top: cropTop, width: targetW, height: targetH })
          .jpeg({ quality: 93 }).toBuffer()
      }
      const focalYTarget = (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
      const imageFocalY  = Math.round((focal_point.y / 100) * scaledH)
      const canvasFocalY = Math.round(focalYTarget * targetH)
      let top = canvasFocalY - imageFocalY
      top = Math.max(0, Math.min(top, targetH - scaledH))
      extTop    = top
      extBottom = targetH - scaledH - extTop
    } else {
      scaledH = targetH
      scaledW = Math.round(origW * (targetH / origH))
      if (scaledW >= targetW) {
        const excess   = scaledW - targetW
        const cropLeft = Math.max(0, Math.min(Math.round((focal_point.x / 100) * excess), excess))
        return sharp(inputBuffer)
          .flatten({ background: { r: bgR, g: bgG, b: bgB } })
          .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
          .extract({ left: cropLeft, top: 0, width: targetW, height: targetH })
          .jpeg({ quality: 93 }).toBuffer()
      }
      const total = targetW - scaledW
      extLeft  = Math.floor(total / 2)
      extRight = total - extLeft
    }

    const scaled = await sharp(inputBuffer)
      .flatten({ background: { r: bgR, g: bgG, b: bgB } })
      .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
      .toBuffer()

    return sharp(scaled)
      .extend({ top: extTop, bottom: extBottom, left: extLeft, right: extRight,
        background: { r: bgR, g: bgG, b: bgB }, extendWith: 'background' })
      .resize(targetW, targetH, { fit: 'fill' })
      .jpeg({ quality: 93 }).toBuffer()
  }

  // ── Photo / gradient: blurred canvas background + sharp original on top ───────
  //
  // Layer 1 — blurred background: cover the full canvas with the image, blur hard.
  //   Slight darkening prevents the bg from competing with the sharp foreground.
  const blurredBg = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .blur(45)
    .modulate({ brightness: 0.72 })
    .toBuffer()

  // Layer 2 — sharp foreground: scale to fill the primary axis, never exceed canvas.
  let fgW = isPortrait
    ? targetW
    : Math.round(origW * (targetH / origH))
  let fgH = isPortrait
    ? Math.round(origH * (targetW / origW))
    : targetH

  // Clamp: foreground must not exceed the canvas on either axis
  if (fgW > targetW) { fgH = Math.round(fgH * (targetW / fgW)); fgW = targetW }
  if (fgH > targetH) { fgW = Math.round(fgW * (targetH / fgH)); fgH = targetH }

  const foreground = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(fgW, fgH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  // Position foreground: horizontal center, vertical at focal_y_target
  const focalYTarget = isPortrait ? (adaptation?.story_9x16?.focal_y_target ?? 50) / 100 : 0.5
  const imageFocalY  = Math.round((focal_point.y / 100) * fgH)
  const canvasFocalY = Math.round(focalYTarget * targetH)
  let top  = Math.max(0, Math.min(canvasFocalY - imageFocalY, targetH - fgH))
  let left = Math.max(0, Math.round((targetW - fgW) / 2))

  return sharp(blurredBg)
    .composite([{ input: foreground, left, top, blend: 'over' }])
    .jpeg({ quality: 93 })
    .toBuffer()
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
    return NextResponse.json(
      { error: 'Could not decode image. Upload a valid JPEG, PNG, or WebP.' },
      { status: 400 },
    )
  }

  const origW = origMeta.width ?? 0
  const origH = origMeta.height ?? 0
  if (!origW || !origH) {
    return NextResponse.json({ error: 'Image has zero dimensions.' }, { status: 400 })
  }

  const [result9x16, result1x1] = await Promise.all([
    geminiAdapt(imageBase64, mimeType, 1080, 1920, schema, 'Instagram Stories & Reels', '9x16')
      .then(buf => buf ?? sharpFallback(inputBuffer, 1080, 1920, schema))
      .catch(() => sharpFallback(inputBuffer, 1080, 1920, schema)),

    geminiAdapt(imageBase64, mimeType, 1080, 1080, schema, 'Instagram Square Feed', '1x1')
      .then(buf => buf ?? sharpFallback(inputBuffer, 1080, 1080, schema))
      .catch(() => sharpFallback(inputBuffer, 1080, 1080, schema)),
  ])

  return NextResponse.json({
    base64_9x16: result9x16.toString('base64'),
    base64_1x1:  result1x1.toString('base64'),
    orig_dimensions: { w: origW, h: origH },
  })
}
