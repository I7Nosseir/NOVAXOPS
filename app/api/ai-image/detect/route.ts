import { NextRequest, NextResponse } from 'next/server'

export interface DetectResult {
  hasText: boolean
  hasLogo: boolean
  hasSubject: boolean
}

/**
 * POST /api/ai-image/detect
 * Body: { imageData: base64, mimeType?: string }
 *
 * Fast vision analysis — detects text, logos, and subjects in an image.
 * Used to auto-populate resize toggles without user input.
 * Uses gemini-3-flash-preview (text mode with vision) — cheap and fast.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  let body: { imageData?: string; mimeType?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageData, mimeType = 'image/png' } = body
  if (!imageData) {
    return NextResponse.json({ error: 'imageData is required' }, { status: 400 })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imageData } },
        {
          text: [
            'Analyze this image carefully. Reply ONLY with valid JSON — no prose, no markdown, no explanation.',
            'Format: {"hasText": boolean, "hasLogo": boolean, "hasSubject": boolean}',
            '',
            'Rules:',
            '- hasText: true if any readable text, headline, body copy, numbers, or labels appear in the image',
            '- hasLogo: true if a brand mark, logo, wordmark, emblem, crest, badge, or distinctive brand symbol is present (even small)',
            '- hasSubject: true if a specific identifiable person, product, vehicle, animal, or named object is the clear focal point (not just a generic background/scene)',
          ].join('\n'),
        },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 64,
      temperature: 0,
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }

    if (!res.ok || json.error) {
      console.error('[ai-image/detect] API error:', json.error?.message)
      // Return safe defaults on error — don't block the user
      return NextResponse.json({ hasText: false, hasLogo: false, hasSubject: true })
    }

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    let result: DetectResult
    try {
      result = JSON.parse(clean) as DetectResult
    } catch {
      console.error('[ai-image/detect] JSON parse failed:', clean.slice(0, 200))
      return NextResponse.json({ hasText: false, hasLogo: false, hasSubject: true })
    }

    return NextResponse.json({
      hasText: Boolean(result.hasText),
      hasLogo: Boolean(result.hasLogo),
      hasSubject: Boolean(result.hasSubject),
    })
  } catch (err) {
    console.error('[ai-image/detect]', err)
    // Safe defaults — never block the resize flow
    return NextResponse.json({ hasText: false, hasLogo: false, hasSubject: true })
  }
}
