import { NextRequest, NextResponse } from 'next/server'
import { aiGuard } from '@/lib/ai-guard'
import { geminiJson } from '@/lib/gemini'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'
import type { DeckStructureRequest, DeckDocument, DeckSlide } from '@/lib/deck-types'

export const maxDuration = 120

const SLIDE_SCHEMAS: Record<string, string> = {
  campaign: `
    Slide 0: cover — title (deck title), subtitle (one-line deck purpose), tag (client name)
    Slide 1: executive_summary — title: "Overview", body: 2-3 sentence summary
    For each campaign (4-6 total) — 2 consecutive slides:
      Slide A: campaign, tag = "Campaign 01" etc., title (name), subtitle (tagline), body (150-250 word description)
      Slide B: campaign, tag = "why", title = same campaign name, bullets = TOV lines prefixed "TOV:" + Why It Works points prefixed "WHY:"
    Last slide: cta — title: "Recommended Next Steps", bullets: 3 action items
  `.trim(),
  strategy: `
    Slide 0: cover
    Slide 1: executive_summary (title: "Context", body: market/brand context)
    Slide 2: section_header (title: "Content Pillars")
    Slides 3-5: three pillar slides (title = pillar name, body = description, bullets = 3 tactics each)
    Slide 6: metrics (title: "KPIs & Targets", bullets = metric lines)
    Slide 7: cta (title: "Roadmap & Next Steps", bullets = timeline items)
  `.trim(),
  report: `
    Slide 0: cover
    Slide 1: executive_summary (title: "Performance Overview", body: period summary)
    Slide 2: metrics (title: "Key Numbers", bullets = metric lines)
    Slide 3: campaign (title: "Best Performing Content", body: why it worked)
    Slide 4: section_header (title: "What We Learned")
    Slide 5: pillar (title: "Insights", bullets = learning bullets)
    Slide 6: cta (title: "Next Month Focus", bullets = action items)
  `.trim(),
  pitch: `
    Slide 0: cover
    Slide 1: campaign (title: "The Challenge", body: problem description)
    Slide 2: campaign (title: "Our Solution", body: solution description, bullets: 3 proof points)
    Slide 3: metrics (title: "Results & Proof", bullets = metric/proof lines)
    Slide 4: section_header (title: "Investment")
    Slide 5: cta (title: "Let's Get Started", body: closing statement, bullets: 3 package/option lines)
  `.trim(),
}

function extractTitle(slides: DeckSlide[]): string {
  const cover = slides.find(s => s.type === 'cover')
  return cover?.title || 'Presentation'
}

export async function POST(request: NextRequest) {
  const guardResponse = await aiGuard(request)
  if (guardResponse) return guardResponse

  try {
    const body: DeckStructureRequest = await request.json()
    const { session_id, client_id, template, mode, prompt, client_name } = body

    if (!template || !mode || !prompt?.trim()) {
      return NextResponse.json({ error: 'Missing template, mode, or prompt' }, { status: 400 })
    }

    const slideSchema = SLIDE_SCHEMAS[template]
    if (!slideSchema) {
      return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 })
    }

    let intelligenceBlock = ''
    if (client_id) {
      const db = adminSupabase()
      if (db) {
        try {
          intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'deck_builder', db)
        } catch (err) {
          console.error('[decks/structure] client intelligence failed:', err)
        }
      }
    }

    const systemInstruction = `You are a professional presentation architect. Return ONLY valid JSON — no markdown, no explanation.

Your output must be a single JSON object with exactly two keys:
- "branding": DeckBranding object
- "slides": DeckSlide array

BRANDING RULES:
Scan the user's text for color, style, or font instructions (e.g. "dark background", "gold accents", "serif titles", "luxury black and white", "tech minimal blue").
If found: translate into hex color values. Fonts must be PPTX-safe: Calibri, Georgia, Times New Roman, or Helvetica.
If no branding instructions: use these exact defaults:
{ "background": "#1B3D38", "surface": "#FFFFFF", "primary": "#1B3D38", "accent": "#5BB4AE", "body": "#0F172A", "muted": "#64748B", "titleFont": "Calibri", "bodyFont": "Calibri" }
The branding object must always have all 8 keys: background, surface, primary, accent, body, muted, titleFont, bodyFont.

CONTENT MODE: ${mode === 'exact_text' ? 'EXACT TEXT' : 'AI GENERATE'}
${mode === 'exact_text'
  ? `EXACT TEXT MODE: The user provided final approved content.
- Do NOT rewrite, paraphrase, summarise, improve, or change any word.
- Only decide which text belongs in which slide field (title / subtitle / body / bullets).
- If text is clearly a list, split into bullets. Otherwise use body.
- Preserve every word, punctuation mark, and capital letter exactly.`
  : `AI GENERATE MODE: Generate all slide content from the brief.
- Write professionally. No emojis. No hashtags.
- Be specific to the brief — never use placeholder text.`
}

SLIDE SCHEMA — template: ${template}
${slideSchema}

Every slide must have: id (UUID v4), type, title.
Optional fields (subtitle, body, bullets, tag, note) only where they add value.
Do not add extra slides or omit required slides.${intelligenceBlock ? `\n\nCLIENT CONTEXT:\n${intelligenceBlock}` : ''}`

    const fullPrompt = `Brief:\n${prompt}`

    const result = await geminiJson<{ branding: Record<string, string>; slides: DeckSlide[] }>(
      fullPrompt,
      systemInstruction,
      { temperature: 0.4, maxOutputTokens: 16384 },
    )

    if (!result?.branding || !Array.isArray(result?.slides)) {
      throw new Error('Gemini returned invalid structure — missing branding or slides')
    }

    const slides: DeckSlide[] = result.slides.map(slide => ({
      ...slide,
      id: slide.id || crypto.randomUUID(),
    }))

    const deck: DeckDocument = {
      title:        extractTitle(slides),
      client_name:  client_name ?? '',
      template,
      branding: {
        background: result.branding.background || '#1B3D38',
        surface:    result.branding.surface    || '#FFFFFF',
        primary:    result.branding.primary    || '#1B3D38',
        accent:     result.branding.accent     || '#5BB4AE',
        body:       result.branding.body       || '#0F172A',
        muted:      result.branding.muted      || '#64748B',
        titleFont:  result.branding.titleFont  || 'Calibri',
        bodyFont:   result.branding.bodyFont   || 'Calibri',
      },
      slides,
      generated_at: new Date().toISOString(),
    }

    if (session_id) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${baseUrl}/api/studio/session/${session_id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ output: { deck } }),
      }).catch(err => console.error('[decks/structure] session save failed:', err))
    }

    return NextResponse.json({ deck })
  } catch (err) {
    console.error('[decks/structure] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate deck structure' },
      { status: 500 },
    )
  }
}
