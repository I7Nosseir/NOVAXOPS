import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { LayoutSchema } from '../analyze/route'

export const runtime = 'nodejs'

// ─── Gemini image-to-image adaptation ────────────────────────────────────────
// Primary engine: sends the original image + rich art direction to Gemini's
// image generation model, which natively understands composition and can
// recompose the design for the target format.

const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash-preview-image-generation',
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
6. Focal point should land at approximately ${adaptation.strategy === 'extend_vertical' ? `${schema.adaptation.story_9x16.focal_y_target}% from top` : 'visual center'}
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
            responseModalities: ['IMAGE', 'TEXT'],
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

      // Scale to exact target dimensions preserving all content
      return sharp(imgBuffer)
        .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
        .jpeg({ quality: 93 })
        .toBuffer()
    } catch {
      continue
    }
  }

  return null
}

// ─── Sharp fallback — fit-inside + background color extension ─────────────────
// Used when Gemini is unavailable or fails. Preserves ALL content by fitting
// the full image inside the canvas and extending with the matched background color.

async function sharpFallback(
  inputBuffer: Buffer,
  targetW: number,
  targetH: number,
  schema: LayoutSchema,
): Promise<Buffer> {
  const { focal_point, background_extension } = schema
  const fx = focal_point.x / 100
  const fy = focal_point.y / 100

  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width!
  const origH = meta.height!

  // Parse fill color from schema (AI-matched background color)
  const hex = (background_extension?.fill_color ?? schema.dominant_color ?? '#1a1a1a')
    .replace('#', '').padEnd(6, '0')
  const bgR = parseInt(hex.slice(0, 2), 16) || 26
  const bgG = parseInt(hex.slice(2, 4), 16) || 26
  const bgB = parseInt(hex.slice(4, 6), 16) || 26

  // Scale to fit fully inside canvas (no cropping ever)
  const scaleFit = Math.min(targetW / origW, targetH / origH)
  const scaledW = Math.round(origW * scaleFit)
  const scaledH = Math.round(origH * scaleFit)

  const prepared = await sharp(inputBuffer)
    .flatten({ background: { r: bgR, g: bgG, b: bgB } })
    .resize(scaledW, scaledH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  // PNG canvas avoids JPEG block artifacts at composite seams
  const canvas = await sharp({
    create: { width: targetW, height: targetH, channels: 3, background: { r: bgR, g: bgG, b: bgB } },
  }).png().toBuffer()

  // Align focal points between image and canvas
  const canvasFX = targetW * fx
  const canvasFY = targetH * fy
  const imgFX = scaledW * fx
  const imgFY = scaledH * fy

  let left = Math.round(canvasFX - imgFX)
  let top = Math.round(canvasFY - imgFY)
  left = Math.max(0, Math.min(left, targetW - scaledW))
  top = Math.max(0, Math.min(top, targetH - scaledH))

  return sharp(canvas)
    .composite([{ input: prepared, left, top, blend: 'over' }])
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

  // Run both formats — try Gemini first, fall back to Sharp independently
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
