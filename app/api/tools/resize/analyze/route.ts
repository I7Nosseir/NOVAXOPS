import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const GEMINI_MODEL = 'gemini-3-flash-preview'

export interface LayoutSchema {
  focal_point: { x: number; y: number }
  background_type: 'solid_color' | 'gradient' | 'complex_photo'
  dominant_color: string
  visual_weight: 'top_heavy' | 'centered' | 'bottom_heavy' | 'left_heavy' | 'right_heavy'
  safe_to_extend_edges: boolean
  elements: {
    type: 'headline' | 'secondary_text' | 'cta' | 'logo' | 'subject' | 'product' | 'background'
    label: string
    x: number; y: number; w: number; h: number
    importance: 'primary' | 'secondary'
  }[]
}

const VISION_PROMPT = `You are a visual design AI. Analyze this image and return a precise JSON object describing its layout. This will be used to intelligently reformat the image for different social media aspect ratios WITHOUT cropping.

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
      "label": "<brief description>",
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
- Include every distinct element you can identify
- If no elements are detectable, return an empty elements array
- dominant_color should be the background or most prevalent color as hex
- safe_to_extend_edges is true for clean backgrounds, false if critical content touches the edges`

function extractSchema(raw: string): LayoutSchema {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const cleaned = jsonMatch ? jsonMatch[0] : stripped
  return JSON.parse(cleaned) as LayoutSchema
}

function clamp(schema: LayoutSchema): LayoutSchema {
  schema.focal_point.x = Math.max(0, Math.min(100, schema.focal_point.x))
  schema.focal_point.y = Math.max(0, Math.min(100, schema.focal_point.y))
  schema.elements = (schema.elements ?? []).map(el => ({
    ...el,
    x: Math.max(0, Math.min(100, el.x)),
    y: Math.max(0, Math.min(100, el.y)),
    w: Math.max(0, Math.min(100, el.w)),
    h: Math.max(0, Math.min(100, el.h)),
  }))
  return schema
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.' }, { status: 500 })
  }

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

  let raw = ''

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type ClaudeMime = typeof validTypes[number]
    const safeMime: ClaudeMime = (validTypes as readonly string[]).includes(mimeType)
      ? mimeType as ClaudeMime
      : 'image/jpeg'

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageBase64 } },
            { type: 'text', text: VISION_PROMPT },
          ],
        }],
      })
      raw = message.content[0].type === 'text' ? message.content[0].text : ''
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Claude error' }, { status: 502 })
    }
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: VISION_PROMPT },
            ],
          }],
        }),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => res.status.toString())
        return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 })
      }
      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
        promptFeedback?: { blockReason?: string }
      }
      if (data.promptFeedback?.blockReason) {
        return NextResponse.json({ error: `Gemini blocked: ${data.promptFeedback.blockReason}` }, { status: 502 })
      }
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!raw) {
        return NextResponse.json({ error: `Gemini returned no text (${data.candidates?.[0]?.finishReason ?? 'unknown'})` }, { status: 502 })
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Gemini network error' }, { status: 502 })
    }
  }

  let schema: LayoutSchema
  try {
    schema = extractSchema(raw)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response as JSON', raw }, { status: 502 })
  }

  return NextResponse.json({ schema: clamp(schema) })
}
