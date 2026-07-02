import { NextRequest, NextResponse } from 'next/server'
import { aiGuard } from '@/lib/ai-guard'
import { geminiJson } from '@/lib/gemini'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'
import type { DeckStructureRequest, DeckDocument, DeckSlide } from '@/lib/deck-types'
import { NOVAX_BRANDING } from '@/lib/deck-types'
import { getDeckDesignTemplate } from '@/lib/deck-templates'
import { validateBrandingContrast } from '@/lib/design-system'

export const maxDuration = 120

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const SAFE_FONTS = new Set(['Calibri', 'Georgia', 'Times New Roman', 'Helvetica'])

function validHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback
}
function validFont(v: unknown, fallback: string): string {
  return typeof v === 'string' && SAFE_FONTS.has(v.trim()) ? v.trim() : fallback
}

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

const UNIVERSAL_SCHEMA = `
Analyze the brief and build the best slide structure (6–15 slides) for the content.

Available slide types:
  cover              — title page (always slide 0). Fields: title, subtitle, tag (client/date)
  executive_summary  — overview or key context. Fields: title, body
  section_header     — visual section break. Fields: title only (renders centered, large)
  campaign           — any concept, idea, or individual item with a headline. Fields: title, subtitle, body, bullets
    Special "why" slide: immediately after a campaign slide, add another campaign slide with tag="why"
    and bullets prefixed "TOV:" (tone of voice lines) and "WHY:" (rationale lines)
  pillar             — strategy pillar, theme, or framework item. Fields: title, body, bullets
  metrics            — KPIs, numbers, results (renders dark). Fields: title, body, bullets
  cta                — final action slide (renders dark). Fields: title, body, bullets

Auto-detect the deck type from the brief:
  - Campaign concepts  → executive_summary + 4–6 campaign pairs (main + why) + cta
  - Strategy/pillars   → executive_summary + section_header + 3–5 pillar slides + metrics + cta
  - Performance report → executive_summary + metrics + campaign (best content) + pillar (insights) + cta
  - Pitch/proposal     → executive_summary + campaign (problem) + campaign (solution) + metrics + cta
  - Mixed/other        → use whatever structure best serves the content
`.trim()

function extractTitle(slides: DeckSlide[]): string {
  const cover = slides.find(s => s.type === 'cover')
  return cover?.title || 'Presentation'
}

export async function POST(request: NextRequest) {
  const guardResponse = await aiGuard(request)
  if (guardResponse) return guardResponse

  try {
    const body: DeckStructureRequest = await request.json()
    const { session_id, client_id, template, mode, prompt, client_name, design_template } = body

    if (!mode || !prompt?.trim()) {
      return NextResponse.json({ error: 'Missing mode or prompt' }, { status: 400 })
    }

    const slideSchema = template && template !== 'universal'
      ? (SLIDE_SCHEMAS[template] ?? UNIVERSAL_SCHEMA)
      : UNIVERSAL_SCHEMA

    // Resolve design template branding — if specified, skip Gemini branding extraction
    const designTemplateData = design_template ? getDeckDesignTemplate(design_template) : undefined
    if (design_template && !designTemplateData) {
      return NextResponse.json({ error: `Unknown design template: ${design_template}` }, { status: 400 })
    }

    // Client intelligence block
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

    const brandingInstruction = designTemplateData
      ? `BRANDING: A pre-built design template "${designTemplateData.name}" is applied automatically. Do NOT include a branding key in your output — it will be ignored.`
      : `BRANDING RULES:
Scan the user's text for color, style, or font instructions (e.g. "dark background", "gold accents", "serif titles", "luxury black and white", "tech minimal blue").
If found: translate into hex color values. Fonts must be PPTX-safe: Calibri, Georgia, Times New Roman, or Helvetica.
If no branding instructions: use these exact defaults:
{ "background": "#1B3D38", "surface": "#FFFFFF", "primary": "#1B3D38", "accent": "#5BB4AE", "body": "#0F172A", "muted": "#64748B", "titleFont": "Calibri", "bodyFont": "Calibri" }
The branding object must always have all 8 keys: background, surface, primary, accent, body, muted, titleFont, bodyFont.`

    const systemInstruction = `You are a professional presentation architect. Return ONLY valid JSON — no markdown, no explanation.

Your output must be a single JSON object with:
- "slides": DeckSlide array (REQUIRED)
${designTemplateData ? '' : '- "branding": DeckBranding object (REQUIRED)'}

${brandingInstruction}

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

SLIDE SCHEMA
${slideSchema}

Every slide must have: id (UUID v4), type, title.
Optional fields (subtitle, body, bullets, tag, note) only where they add value.
Do not add extra slides or omit required slides.${intelligenceBlock ? `\n\nCLIENT CONTEXT:\n${intelligenceBlock}` : ''}`

    const fullPrompt = `Brief:\n${prompt}`

    const result = await geminiJson<{ branding?: Record<string, string>; slides: DeckSlide[] }>(
      fullPrompt,
      systemInstruction,
      { temperature: 0.4, maxOutputTokens: 16384 },
    )

    if (!Array.isArray(result?.slides) || result.slides.length === 0) {
      throw new Error('Gemini returned invalid structure — missing slides')
    }

    // Resolve final branding
    let branding: typeof NOVAX_BRANDING
    if (designTemplateData) {
      branding = designTemplateData.branding
      console.log(`[decks/structure] Using design template branding: ${designTemplateData.id}`)
    } else {
      const rawB = result.branding ?? {}
      if (!result.branding) {
        console.warn('[decks/structure] Gemini omitted branding — using NOVAX defaults')
      }
      branding = {
        background: validHex(rawB.background, NOVAX_BRANDING.background),
        surface:    validHex(rawB.surface,    NOVAX_BRANDING.surface),
        primary:    validHex(rawB.primary,    NOVAX_BRANDING.primary),
        accent:     validHex(rawB.accent,     NOVAX_BRANDING.accent),
        body:       validHex(rawB.body,       NOVAX_BRANDING.body),
        muted:      validHex(rawB.muted,      NOVAX_BRANDING.muted),
        titleFont:  validFont(rawB.titleFont, NOVAX_BRANDING.titleFont),
        bodyFont:   validFont(rawB.bodyFont,  NOVAX_BRANDING.bodyFont),
      }
      console.log('[decks/structure] Gemini branding resolved:', branding)
    }

    const slides: DeckSlide[] = result.slides.map((slide: DeckSlide) => ({
      ...slide,
      id: slide.id || crypto.randomUUID(),
    }))

    const deck: DeckDocument = {
      title:        extractTitle(slides),
      client_name:  client_name ?? '',
      template:     template ?? 'universal',
      branding,
      slides,
      generated_at: new Date().toISOString(),
    }

    const contrastWarnings = validateBrandingContrast(branding)
    if (contrastWarnings.length > 0) {
      console.warn('[decks/structure] Contrast warnings:', contrastWarnings)
    }

    console.log('[decks/structure] Done:', {
      slides: deck.slides.length,
      design_template: designTemplateData?.id ?? 'custom',
      accent: deck.branding.accent,
      contrastOk: contrastWarnings.length === 0,
    })

    if (session_id) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${baseUrl}/api/studio/session/${session_id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ output: { deck, design_template } }),
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
