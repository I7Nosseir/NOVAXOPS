import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ai-image/edit
 * Body: { imageData: base64, mimeType?, editPrompt: string, model? }
 *
 * Applies a surgical edit to an existing image using Gemini's multimodal
 * generateContent endpoint. The model is instructed to change ONLY what is
 * explicitly described and preserve everything else perfectly.
 *
 * Returns: { imageData: base64string, mimeType: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: {
    imageData?: string
    mimeType?: string
    editPrompt?: string
    model?: string
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    imageData,
    mimeType = 'image/png',
    editPrompt,
    model = 'gemini-3.1-flash-image-preview',
  } = body

  if (!imageData) return NextResponse.json({ error: 'imageData required' }, { status: 400 })
  if (!editPrompt?.trim()) return NextResponse.json({ error: 'editPrompt required' }, { status: 400 })

  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`

  // Surgical edit instruction — extremely precise to avoid unwanted changes
  const instruction = [
    'You are a precision image editor. Apply the requested edit with surgical accuracy.',
    '',
    'ABSOLUTE RULES:',
    '1. Change ONLY what the edit instruction explicitly specifies — nothing else',
    '2. Every other element (composition, colors, lighting, textures, text, logos, subjects) must remain IDENTICAL to the input image',
    '3. The edit must be seamless and indistinguishable from a professional retouching job',
    '4. Preserve image resolution, sharpness, and quality — no quality degradation',
    '5. If the edit is ambiguous, apply the most conservative interpretation that satisfies the request',
    '',
    `EDIT INSTRUCTION: ${editPrompt.trim()}`,
  ].join('\n')

  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

  const parts: GeminiPart[] = [
    { text: 'Image to edit:' },
    { inlineData: { mimeType, data: imageData } },
    { text: instruction },
  ]

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json() as {
      candidates?: {
        content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] }
        finishReason?: string
      }[]
      error?: { message?: string }
    }

    if (!res.ok || json.error) {
      return NextResponse.json({ error: json.error?.message ?? `API error ${res.status}` }, { status: res.status })
    }

    const resParts = json.candidates?.[0]?.content?.parts ?? []
    const imagePart = resParts.find(p => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      const finishReason = json.candidates?.[0]?.finishReason
      const modelText = resParts.find(p => p.text)?.text?.slice(0, 300)
      const reason = finishReason === 'SAFETY'
        ? 'Blocked by safety filters — try rephrasing the edit.'
        : modelText
          ? `Model response: ${modelText}`
          : 'Edit produced no image. Try rephrasing the instruction.'
      return NextResponse.json({ error: reason }, { status: 502 })
    }

    return NextResponse.json({
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    })
  } catch (err) {
    console.error('[ai-image/edit]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Network error' }, { status: 502 })
  }
}
