import { NextRequest, NextResponse } from 'next/server'

const STYLE_SUFFIXES: Record<string, string> = {
  photorealistic: 'photorealistic, professional photography, high resolution, sharp detail, studio quality',
  cinematic:      'cinematic photography, film still, dramatic lighting, anamorphic, color graded, shallow depth of field',
  product:        'product photography, clean white background, studio lighting, commercial advertising, sharp focus',
  lifestyle:      'lifestyle photography, natural light, authentic moment, warm tones, candid, editorial',
  illustration:   'digital illustration, vector art, vibrant colors, clean lines, graphic design',
  abstract:       'abstract art, bold colors, dynamic composition, modern digital art, creative',
}

// Models that use the generateContent endpoint (Gemini native image models)
const GEMINI_IMAGE_MODELS = new Set([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
])

// Models that use the predict endpoint (Imagen 4)
const IMAGEN_MODELS = new Set([
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-ultra-generate-001',
])

/**
 * POST /api/ai-image/generate
 * Body: { prompt, style, aspectRatio, negativePrompt?, model? }
 *
 * Supports:
 *   - Gemini native image models (gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview)
 *     → uses generateContent API, aspect ratio baked into prompt
 *   - Imagen 4 (imagen-4.0-generate-001, imagen-4.0-fast-generate-001, imagen-4.0-ultra-generate-001)
 *     → uses predict API, native aspect ratio parameter
 *
 * Returns: { imageData: base64String, mimeType: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: { prompt?: string; style?: string; aspectRatio?: string; negativePrompt?: string; model?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    prompt,
    style = 'photorealistic',
    aspectRatio = '1:1',
    negativePrompt = '',
    model = 'gemini-2.5-flash-image',
  } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.photorealistic
  const fullPrompt = `${prompt.trim()}. ${styleSuffix}`
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

  try {
    // ── Gemini native image models (generateContent) ───────────────────────────
    if (GEMINI_IMAGE_MODELS.has(model)) {
      // Aspect ratio baked into prompt since generateContent doesn't have a native param
      const arLabel: Record<string, string> = {
        '1:1': 'square 1:1 aspect ratio',
        '9:16': 'vertical 9:16 portrait aspect ratio, taller than wide',
        '16:9': 'horizontal 16:9 landscape aspect ratio, wider than tall',
        '4:5': 'portrait 4:5 aspect ratio',
        '3:4': 'portrait 3:4 aspect ratio',
      }
      const arHint = arLabel[aspectRatio] ?? 'square 1:1 aspect ratio'
      const finalPrompt = `${fullPrompt}. Compose the image in a ${arHint}.`
        + (negativePrompt?.trim() ? ` Avoid: ${negativePrompt.trim()}.` : '')

      const url = `${BASE}/${model}:generateContent?key=${apiKey}`
      const payload = {
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json() as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]
        error?: { message?: string }
      }

      if (!res.ok || json.error) {
        return NextResponse.json({ error: json.error?.message ?? `API error ${res.status}` }, { status: res.status })
      }

      const parts = json.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find(p => p.inlineData?.data)
      if (!imagePart?.inlineData?.data) {
        return NextResponse.json({ error: 'No image returned. Try a different prompt or model.' }, { status: 502 })
      }

      return NextResponse.json({
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      })
    }

    // ── Imagen 4 (predict) ─────────────────────────────────────────────────────
    if (IMAGEN_MODELS.has(model)) {
      const url = `${BASE}/${model}:predict?key=${apiKey}`
      const payload = {
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          safetySetting: 'block_some',
          personGeneration: 'allow_all',
          ...(negativePrompt?.trim() ? { negativePrompt: negativePrompt.trim() } : {}),
        },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json() as {
        predictions?: { bytesBase64Encoded?: string; mimeType?: string }[]
        error?: { message?: string }
      }

      if (!res.ok || json.error) {
        return NextResponse.json({ error: json.error?.message ?? `Imagen API error ${res.status}` }, { status: res.status })
      }

      const prediction = json.predictions?.[0]
      if (!prediction?.bytesBase64Encoded) {
        return NextResponse.json({ error: 'No image returned from Imagen API' }, { status: 502 })
      }

      return NextResponse.json({
        imageData: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType ?? 'image/png',
      })
    }

    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Network error' },
      { status: 502 },
    )
  }
}
