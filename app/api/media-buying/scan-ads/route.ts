import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let imageBase64: string
  let mimeType = 'image/jpeg'

  // Accept either multipart/form-data (file upload) or JSON { imageBase64, mimeType }
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    imageBase64 = buffer.toString('base64')
    mimeType = file.type || 'image/jpeg'
  } else {
    let body: { imageBase64?: string; mimeType?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    imageBase64 = body.imageBase64
    mimeType = body.mimeType ?? 'image/jpeg'
  }

  // Try Claude Vision first (if key configured), fall back to Gemini Vision
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  const extractionPrompt = `This is a screenshot from an ads manager (Meta, TikTok, Google, etc.).
Extract every numeric metric visible. Return ONLY a JSON object with these keys (omit keys where data is not visible):
{
  "spend": "number only, no currency symbol",
  "impressions": "number only",
  "reach": "number only",
  "clicks": "number only",
  "ctr": "number only, no % symbol",
  "cpc": "number only, no currency symbol",
  "cpm": "number only, no currency symbol",
  "conversions": "number only",
  "roas": "number only, no x symbol",
  "campaignName": "campaign name if visible"
}
Return ONLY the JSON — no markdown, no explanation.`

  let raw = ''

  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
              { type: 'text', text: extractionPrompt },
            ],
          }],
        }),
      })
      if (res.ok) {
        const data = await res.json() as { content?: { type: string; text?: string }[] }
        raw = data.content?.find(c => c.type === 'text')?.text ?? ''
      }
    } catch { /* fall through to Gemini */ }
  }

  if (!raw && geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: extractionPrompt },
            ],
          }],
        }),
      })
      if (res.ok) {
        const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      }
    } catch { /* fall through */ }
  }

  if (!raw) {
    return NextResponse.json({ error: 'No AI service available for image scanning' }, { status: 503 })
  }

  // Parse result
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, string>
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Could not parse metrics from image' }, { status: 422 })
  }
}
