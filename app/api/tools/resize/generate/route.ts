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

// ─── Sharp fallback — fill primary dimension + mirror edge extension ──────────
// For the 9:16 format (portrait):
//   • Scale image to fill the full 1080px width
//   • Extend top/bottom by mirroring the image edges → sky extends up naturally,
//     ground extends down naturally. No solid color bands. No letterboxing.
//
// For the 1:1 format (square):
//   • Scale image to fill the full 1080px height
//   • Extend sides by mirroring (or solid fill for flat color backgrounds)
//
// Content is NEVER cropped in the extension path — only if the image is already
// larger than the canvas after scaling (then focal-point-aligned crop is used).

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

  // Background fill color for alpha flatten + solid extension
  const hex = (background_extension?.fill_color ?? dominant_color ?? '#1a1a1a')
    .replace('#', '').padEnd(6, '0')
  const bgR = parseInt(hex.slice(0, 2), 16) || 26
  const bgG = parseInt(hex.slice(2, 4), 16) || 26
  const bgB = parseInt(hex.slice(4, 6), 16) || 26

  const isPortrait = targetH > targetW
  let scaledW: number
  let scaledH: number
  let extendTop = 0
  let extendBottom = 0
  let extendLeft = 0
  let extendRight = 0

  if (isPortrait) {
    // Fill the full target width — image spans edge to edge horizontally
    scaledW = targetW
    scaledH = Math.round(origH * (targetW / origW))

    if (scaledH >= targetH) {
      // Image taller than canvas after width-fill — focal-point crop, no content lost
      const excess = scaledH - targetH
      const cropTop = Math.max(0, Math.min(Math.round((focal_point.y / 100) * excess), excess))
      return sharp(inputBuffer)
        .flatten({ background: { r: bgR, g: bgG, b: bgB } })
        .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
        .extract({ left: 0, top: cropTop, width: targetW, height: targetH })
        .jpeg({ quality: 93 })
        .toBuffer()
    }

    // Position focal point at focal_y_target within the canvas
    const focalYTarget = (adaptation?.story_9x16?.focal_y_target ?? 50) / 100
    const imageFocalY  = Math.round((focal_point.y / 100) * scaledH)
    const canvasFocalY = Math.round(focalYTarget * targetH)
    let top = canvasFocalY - imageFocalY
    top = Math.max(0, Math.min(top, targetH - scaledH))
    extendTop    = top
    extendBottom = targetH - scaledH - extendTop

  } else {
    // Fill the full target height — image spans edge to edge vertically
    scaledH = targetH
    scaledW = Math.round(origW * (targetH / origH))

    if (scaledW >= targetW) {
      // Image wider than canvas after height-fill — focal-point crop
      const excess   = scaledW - targetW
      const cropLeft = Math.max(0, Math.min(Math.round((focal_point.x / 100) * excess), excess))
      return sharp(inputBuffer)
        .flatten({ background: { r: bgR, g: bgG, b: bgB } })
        .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
        .extract({ left: cropLeft, top: 0, width: targetW, height: targetH })
        .jpeg({ quality: 93 })
        .toBuffer()
    }

    const totalExtend = targetW - scaledW
    extendLeft  = Math.floor(totalExtend / 2)
    extendRight = totalExtend - extendLeft
  }

  // Scale image to computed intermediate size
  const scaled = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  // Mirror extension: reflect actual image content into the new space.
  // For photo/gradient backgrounds this looks natural (sky → sky, ground → ground).
  // For solid or pattern backgrounds, plain color fill is cleaner.
  const useMirror = background_type === 'complex_photo' || background_type === 'gradient'

  return sharp(scaled)
    .extend({
      top:    extendTop,
      bottom: extendBottom,
      left:   extendLeft,
      right:  extendRight,
      background: { r: bgR, g: bgG, b: bgB },
      extendWith: useMirror ? 'mirror' : 'background',
    })
    .resize(targetW, targetH, { fit: 'fill' })
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
