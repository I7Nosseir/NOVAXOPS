import { NextRequest, NextResponse } from 'next/server'

const ASPECT_RATIOS: Record<string, string> = {
  '1:1':  '1:1',
  '9:16': '9:16',
  '16:9': '16:9',
  '4:5':  '4:5',
  '3:4':  '3:4',
}

const STYLE_SUFFIXES: Record<string, string> = {
  photorealistic: 'photorealistic, professional photography, high resolution, sharp detail, studio quality',
  cinematic:      'cinematic photography, film still, dramatic lighting, anamorphic, color graded, shallow depth of field',
  product:        'product photography, clean white background, studio lighting, commercial advertising, sharp focus',
  lifestyle:      'lifestyle photography, natural light, authentic moment, warm tones, candid, editorial',
  illustration:   'digital illustration, vector art, vibrant colors, clean lines, graphic design',
  abstract:       'abstract art, bold colors, dynamic composition, modern digital art, creative',
}

/**
 * POST /api/ai-image/generate
 * Body: { prompt, style, aspectRatio, negativePrompt? }
 *
 * Calls Google Imagen 3 via the Generative Language API.
 * Returns: { imageData: base64String, mimeType: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: { prompt?: string; style?: string; aspectRatio?: string; negativePrompt?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { prompt, style = 'photorealistic', aspectRatio = '1:1', negativePrompt = '' } = body
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.photorealistic
  const fullPrompt = `${prompt.trim()}. ${styleSuffix}`
  const ar = ASPECT_RATIOS[aspectRatio] ?? '1:1'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`

  const payload = {
    instances: [{ prompt: fullPrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: ar,
      safetySetting: 'block_some',
      personGeneration: 'allow_all',
      ...(negativePrompt?.trim() ? { negativePrompt: negativePrompt.trim() } : {}),
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json() as {
      predictions?: { bytesBase64Encoded?: string; mimeType?: string }[]
      error?: { message?: string; code?: number }
    }

    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `Imagen API error ${res.status}`
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const prediction = json.predictions?.[0]
    if (!prediction?.bytesBase64Encoded) {
      return NextResponse.json({ error: 'No image returned from Imagen API' }, { status: 502 })
    }

    return NextResponse.json({
      imageData: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType ?? 'image/png',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Network error calling Imagen API' },
      { status: 502 },
    )
  }
}
