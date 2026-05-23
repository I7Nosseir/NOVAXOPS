import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const GEMINI_MODEL = 'gemini-3-flash-preview'

export interface LayoutSchema {
  focal_point: { x: number; y: number }
  background_type: 'solid_color' | 'gradient' | 'complex_photo' | 'pattern'
  dominant_color: string
  secondary_color: string
  design_style: 'luxury' | 'bold' | 'corporate' | 'modern' | 'playful' | 'cinematic' | 'editorial' | 'minimal'
  visual_weight: 'top_heavy' | 'centered' | 'bottom_heavy' | 'left_heavy' | 'right_heavy'
  elements: {
    type: 'headline' | 'subheadline' | 'cta' | 'logo' | 'subject' | 'product' | 'pricing' | 'offer' | 'disclaimer'
    label: string
    x: number; y: number; w: number; h: number
    importance: 'primary' | 'secondary' | 'tertiary'
    reading_order: number
  }[]
  safe_zones: {
    top_content_end_pct: number
    bottom_content_start_pct: number
    left_content_start_pct: number
    right_content_end_pct: number
  }
  background_extension: {
    top: boolean
    bottom: boolean
    left: boolean
    right: boolean
    method: 'solid_fill' | 'gradient_fade' | 'edge_extend'
    fill_color: string
  }
  adaptation: {
    story_9x16: {
      strategy: 'extend_vertical' | 'recompose' | 'scale_fit'
      focal_y_target: number
      notes: string
    }
    square_1x1: {
      strategy: 'extend_sides' | 'smart_crop' | 'scale_fit'
      focal_position: 'center' | 'upper_third' | 'lower_third'
      notes: string
    }
  }
  readability_score: number
  composition_score: number
}

const VISION_PROMPT = `You are an advanced AI creative adaptation engine. Analyze this marketing image with the depth of a senior art director.

Your analysis will be used to intelligently reformat this design for different social media platforms WITHOUT losing any content, without cropping, without distorting, and with the result looking like a native professional design for each format.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. All x/y/w/h values are percentages (0–100) of the image dimensions.

{
  "focal_point": {
    "x": <0-100, the single most visually dominant point — face, hero product, or largest headline>,
    "y": <0-100>
  },
  "background_type": "<solid_color | gradient | complex_photo | pattern>",
  "dominant_color": "<primary background hex, e.g. #1B3D38>",
  "secondary_color": "<secondary accent hex>",
  "design_style": "<luxury | bold | corporate | modern | playful | cinematic | editorial | minimal>",
  "visual_weight": "<top_heavy | centered | bottom_heavy | left_heavy | right_heavy>",
  "elements": [
    {
      "type": "<headline | subheadline | cta | logo | subject | product | pricing | offer | disclaimer>",
      "label": "<brief description of this element>",
      "x": <% from left edge>,
      "y": <% from top edge>,
      "w": <% width>,
      "h": <% height>,
      "importance": "<primary | secondary | tertiary>",
      "reading_order": <1 = first read, 2 = second, etc.>
    }
  ],
  "safe_zones": {
    "top_content_end_pct": <% from top where topmost content element ends — space above this is safe to extend>,
    "bottom_content_start_pct": <% from top where bottommost content element starts — space below this is safe to extend>,
    "left_content_start_pct": <% from left where leftmost content element starts>,
    "right_content_end_pct": <% from left where rightmost content element ends>
  },
  "background_extension": {
    "top": <true if background above top_content_end_pct can be extended safely>,
    "bottom": <true if background below bottom_content_start_pct can be extended safely>,
    "left": <true if background to the left of left_content_start_pct can be extended safely>,
    "right": <true if background to the right of right_content_end_pct can be extended safely>,
    "method": "<solid_fill if background is a flat color | gradient_fade if gradient | edge_extend if photo/texture>",
    "fill_color": "<exact hex color to use for extension — must match the background precisely>"
  },
  "adaptation": {
    "story_9x16": {
      "strategy": "<extend_vertical if solid/gradient bg can be extended top+bottom | scale_fit if complex photo>",
      "focal_y_target": <0-100, where the focal point should sit vertically in the 9:16 canvas — usually 45-55>,
      "notes": "<brief art direction note for this format>"
    },
    "square_1x1": {
      "strategy": "<extend_sides if image is taller than wide | smart_crop if image is wider and cropping is safe | scale_fit>",
      "focal_position": "<center | upper_third | lower_third>",
      "notes": "<brief art direction note for this format>"
    }
  },
  "readability_score": <0-100, how readable all text is>,
  "composition_score": <0-100, overall design quality>
}

Critical rules:
- Every detected element must be in the elements array with accurate bounding boxes
- focal_point must be inside the bounding box of the most important element
- safe_zones reflect where the actual design content lives — not the full image
- fill_color must exactly match the background so extensions are seamless
- reading_order 1 = what the eye goes to first (usually logo or hero headline)
- Identify ALL text elements including non-Latin (Arabic, Chinese, etc.) as headline/subheadline
- design_style must reflect the visual tone of the creative, not just describe it`

function extractSchema(raw: string): LayoutSchema {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const cleaned = jsonMatch ? jsonMatch[0] : stripped
  return JSON.parse(cleaned) as LayoutSchema
}

function normalise(schema: LayoutSchema): LayoutSchema {
  const clampPct = (v: unknown, fallback: number) =>
    typeof v === 'number' ? Math.max(0, Math.min(100, v)) : fallback

  schema.focal_point.x = clampPct(schema.focal_point.x, 50)
  schema.focal_point.y = clampPct(schema.focal_point.y, 50)

  schema.dominant_color = schema.dominant_color ?? '#1a1a1a'
  schema.secondary_color = schema.secondary_color ?? schema.dominant_color
  schema.design_style = schema.design_style ?? 'modern'
  schema.visual_weight = schema.visual_weight ?? 'centered'
  schema.readability_score = clampPct(schema.readability_score, 75)
  schema.composition_score = clampPct(schema.composition_score, 75)

  schema.elements = (schema.elements ?? []).map((el, i) => ({
    ...el,
    x: clampPct(el.x, 10),
    y: clampPct(el.y, 10),
    w: clampPct(el.w, 30),
    h: clampPct(el.h, 10),
    reading_order: el.reading_order ?? i + 1,
    importance: el.importance ?? 'secondary',
  }))

  schema.safe_zones = schema.safe_zones ?? {
    top_content_end_pct: 5,
    bottom_content_start_pct: 90,
    left_content_start_pct: 5,
    right_content_end_pct: 95,
  }

  schema.background_extension = schema.background_extension ?? {
    top: true,
    bottom: true,
    left: false,
    right: false,
    method: 'solid_fill',
    fill_color: schema.dominant_color,
  }

  schema.adaptation = schema.adaptation ?? {
    story_9x16: { strategy: 'extend_vertical', focal_y_target: 50, notes: '' },
    square_1x1: { strategy: 'extend_sides', focal_position: 'center', notes: '' },
  }

  return schema
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.' },
      { status: 500 },
    )
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
      ? (mimeType as ClaudeMime)
      : 'image/jpeg'
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageBase64 } },
            { type: 'text', text: VISION_PROMPT },
          ],
        }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
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
        return NextResponse.json(
          { error: `Gemini returned no text (${data.candidates?.[0]?.finishReason ?? 'unknown'})` },
          { status: 502 },
        )
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

  return NextResponse.json({ schema: normalise(schema) })
}
