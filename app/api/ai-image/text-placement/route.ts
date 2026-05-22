import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ai-image/text-placement
 * Body: { imageData: base64, mimeType: string, textItems: { text, role }[], brandColors?: string[] }
 *
 * Uses Gemini vision to analyze the image and return world-class typographic text placements.
 * Returns: { layers: TextLayer[] }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  let body: {
    imageData?: string
    mimeType?: string
    textItems?: { text: string; role: string }[]
    brandColors?: string[]
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageData, mimeType = 'image/png', textItems, brandColors = [] } = body

  if (!imageData) return NextResponse.json({ error: 'imageData required' }, { status: 400 })
  if (!textItems?.length) return NextResponse.json({ error: 'textItems required' }, { status: 400 })

  const textList = textItems
    .map((t, i) => `${i + 1}. "${t.text}" (role: ${t.role})`)
    .join('\n')

  const brandColorNote = brandColors.length
    ? `\nBrand colors available: ${brandColors.join(', ')} — prefer these where contrast is sufficient (WCAG AA: 4.5:1 minimum).`
    : ''

  const systemPrompt = `You are a world-class typographic design director. Your expertise matches Pentagram, Wolff Olins, and the best advertising agencies — Ogilvy, Wieden+Kennedy, TBWA.

Your knowledge spans:
- Swiss International Typographic Style: grid systems, visual hierarchy, negative space, optical margins
- Rule of thirds and dynamic compositional placement — text activates the image without competing with its subject
- WCAG AA contrast ratios: minimum 4.5:1 for body text, 3:1 for large display type
- Cannes Lions / D&AD Gold-level advertising design execution
- Platform-specific safe zones (Instagram, Meta, TikTok — 5% minimum margin from edges)
- Type pairing theory: matching font personality to image mood and visual language
- Visual flow: leading the viewer's eye through the composition with purpose
- Gestalt principles: proximity, continuity, figure-ground relationships in typography

ANALYSIS TASK — examine this image for:
1. Visual style and mood (luxury, editorial, minimal, bold, tech, organic, lifestyle, etc.)
2. Dominant color palette — identify light and dark zones at key positions
3. The main subject and focal point — NEVER place text directly over it
4. Negative space regions that are compositionally safe for text (flat tone, at least 30% usable contrast)
5. Existing visual rhythm, angles, or implied lines that text alignment should follow
6. Depth and layering cues that text could integrate with

PLACEMENT RULES — apply these without exception:
- Headline: largest and most dominant. Place in the strongest compositional zone (often lower-left, upper-left, or center depending on image balance). Size: 48–90px for 1:1 square, scale proportionally.
- Tagline: 45–60% of headline size. Clear breathing room — at minimum 1.5× the headline's font size as vertical gap.
- Body: 16–24px. Place only in a high-contrast, visually quiet zone. Never near the focal point.
- Callout: Can be bold, italic, or contrasting. Often effective near a key visual element (product, character) or anchored at a corner.
- Minimum 5% margin from all edges (x: 5–90, y: 5–90).
- Never stack multiple text blocks without deliberate hierarchy and spacing.

FONT SELECTION — match typeface personality to image mood:
- Luxury / high-fashion / editorial → "Georgia, serif" or '"Times New Roman", serif'
- Modern brand / tech / clean minimal → "Arial, sans-serif" or "Verdana, sans-serif"
- Impact advertising / bold headline statement → "Impact, Haettenschweiler, sans-serif"
- Warm / organic / approachable lifestyle → "Verdana, sans-serif"
- Classic / heritage / heritage brand → '"Times New Roman", serif'

COLOR SELECTION — for each text element:
- Choose color based on the specific background area where the text will sit
- Light text (#FFFFFF, brand light) on dark backgrounds; dark text (#111111, brand dark) on light backgrounds
- Add shadow:true when placing over complex or mixed backgrounds
- Add outline:true only when extreme contrast is needed${brandColorNote}

TEXT ELEMENTS TO PLACE:
${textList}

Return ONLY a valid JSON array. No markdown fences, no explanation, nothing else:
[
  {
    "text": "exact text string",
    "x": <number 5–88>,
    "y": <number 5–85>,
    "fontSize": <number 16–100>,
    "fontFamily": "one of exactly: Arial, sans-serif | Georgia, serif | Impact, Haettenschweiler, sans-serif | \\"Times New Roman\\", serif | \\"Courier New\\", monospace | Verdana, sans-serif",
    "color": "#RRGGBB",
    "bold": true or false,
    "italic": true or false,
    "shadow": true or false,
    "outline": true or false,
    "outlineColor": "#000000",
    "align": "left" or "center" or "right"
  }
]`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imageData } },
        { text: systemPrompt },
      ],
    }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 2048 },
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
      return NextResponse.json(
        { error: json.error?.message ?? `Gemini error ${res.status}` },
        { status: res.status },
      )
    }

    const raw = json.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''

    // Strip markdown fences if the model wraps anyway
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI did not return valid placement data. Try again.' }, { status: 502 })
    }

    const layers = JSON.parse(jsonMatch[0])
    return NextResponse.json({ layers })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Network error' },
      { status: 502 },
    )
  }
}
