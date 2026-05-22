import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

export interface LayoutSchema {
  focal_point: { x: number; y: number }         // 0-100 percent from top-left
  background_type: 'solid_color' | 'gradient' | 'complex_photo'
  dominant_color: string                          // hex
  visual_weight: 'top_heavy' | 'centered' | 'bottom_heavy' | 'left_heavy' | 'right_heavy'
  safe_to_extend_edges: boolean
  elements: {
    type: 'headline' | 'secondary_text' | 'cta' | 'logo' | 'subject' | 'product' | 'background'
    label: string
    x: number; y: number; w: number; h: number   // percent of image dimensions
    importance: 'primary' | 'secondary'
  }[]
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  let body: { imageBase64: string; mimeType: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { imageBase64, mimeType } = body
  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: 'imageBase64 and mimeType required' }, { status: 400 })
  }

  const prompt = `You are a visual design AI. Analyze this image and return a precise JSON object describing its layout. This will be used to intelligently reformat the image for different social media aspect ratios WITHOUT cropping.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. Every number is a percentage (0–100) of the image's total width or height.

{
  "focal_point": {
    "x": <0-100, percentage from left edge to the single most visually important point>,
    "y": <0-100, percentage from top edge to the single most visually important point>
  },
  "background_type": "<solid_color | gradient | complex_photo>",
  "dominant_color": "<the most dominant background hex color, e.g. #1a1a2e>",
  "visual_weight": "<top_heavy | centered | bottom_heavy | left_heavy | right_heavy>",
  "safe_to_extend_edges": <true if the edges can be blurred/extended without destroying meaning, false if text or logos sit at edges>,
  "elements": [
    {
      "type": "<headline | secondary_text | cta | logo | subject | product>",
      "label": "<brief description, e.g. 'brand logo top-right' or 'main product shot'>",
      "x": <% from left>,
      "y": <% from top>,
      "w": <% width of this element>,
      "h": <% height of this element>,
      "importance": "<primary | secondary>"
    }
  ]
}

Rules:
- focal_point is the single pixel the eye goes to FIRST — usually the face, product, or largest text
- Include every distinct element you can identify (text blocks, logos, people, products)
- If no elements are detectable (abstract background), return an empty elements array
- dominant_color should be the background or most prevalent color as hex
- safe_to_extend_edges is true for most designs with clean backgrounds, false if critical content touches the edges`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 })
  }

  const data = await res.json()
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip markdown fences, extract JSON object
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const cleaned = jsonMatch ? jsonMatch[0] : stripped

  let schema: LayoutSchema
  try {
    schema = JSON.parse(cleaned) as LayoutSchema
  } catch {
    return NextResponse.json({ error: 'Failed to parse Gemini response as JSON', raw }, { status: 502 })
  }

  // Clamp all values to valid percentage ranges
  schema.focal_point.x = Math.max(0, Math.min(100, schema.focal_point.x))
  schema.focal_point.y = Math.max(0, Math.min(100, schema.focal_point.y))
  schema.elements = (schema.elements ?? []).map(el => ({
    ...el,
    x: Math.max(0, Math.min(100, el.x)),
    y: Math.max(0, Math.min(100, el.y)),
    w: Math.max(0, Math.min(100, el.w)),
    h: Math.max(0, Math.min(100, el.h)),
  }))

  return NextResponse.json({ schema })
}
