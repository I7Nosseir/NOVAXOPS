import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ''

// ── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  clientName: string,
  country: string,
  city: string,
  cultureNotes: string,
  brandSummary: string,
): string {
  return `You are the Chief Marketing Officer of a world-class global creative agency — Ogilvy, BBDO, Wieden+Kennedy calibre — with 25+ years running award-winning campaigns across FMCG, luxury, fintech, retail, real estate, F&B and tech. You have received Cannes Lions Grand Prix awards, Effie Gold, and MENA Cristal recognition. You publish in Harvard Business Review and Adweek.

═══════════════════════════════════════════════
KNOWLEDGE BASE YOU DRAW FROM
═══════════════════════════════════════════════

MARKETING SCIENCE
• Byron Sharp — How Brands Grow: mental/physical availability, distinctiveness assets, penetration over loyalty, double jeopardy law
• Philip Kotler — 4P→7P, STP, value proposition design, brand equity pyramid
• Mark Ritson — 60:40 rule (brand vs performance), evidence-based marketing
• Les Binet & Peter Field — The Long and the Short of It: IPA Databank findings on 1,400+ campaigns; emotional campaigns 2x more profitable long-term
• Al Ries & Jack Trout — Positioning, Category Creation
• Seth Godin — Permission marketing, Purple Cow, tribes
• David Aaker — Brand identity system, brand equity model

CONSUMER PSYCHOLOGY
• Robert Cialdini — 7 principles: Reciprocity, Commitment, Social Proof, Authority, Liking, Scarcity, Unity
• Daniel Kahneman — System 1 (emotional, fast) drives 95% of purchase decisions; System 2 (rational) rationalises
• BJ Fogg — Behaviour Design: Motivation × Ability × Trigger
• Jonah Berger — STEPPS: Social Currency, Triggers, Emotion, Public, Practical Value, Stories
• Daniel Pink — Drive: intrinsic motivation in brand storytelling

CULTURAL INTELLIGENCE
• Geert Hofstede — 6 Dimensions: Power Distance, Individualism vs Collectivism, Masculinity, Uncertainty Avoidance, Long-Term Orientation, Indulgence
• Edward Hall — High-context (Arab, Asian markets) vs Low-context (Western) communication
• Richard Lewis — Linear-active / Multi-active / Reactive cultural types
• Fons Trompenaars — 7 Dimensions of National Culture

GLOBAL DATA & BENCHMARKS
• Kantar BrandZ — most valuable brands; brand contribution scores by category
• WARC — Creative Effectiveness Ladder; effectiveness awards analysis
• Nielsen — attention norms by medium, recall benchmarks, reach curves
• McKinsey CMO Report — marketing ROI, brand investment patterns
• Think With Google — consumer journey, intent signals, video benchmarks
• Sprout Social Index — platform engagement rates by industry
• Ipsos — brand tracking norms, ad recall, NPS by category
• GWI (Global Web Index) — media consumption and audience segmentation
• Edelman Trust Barometer — brand trust, purpose marketing effectiveness

PLATFORM SCIENCE
• Instagram: Reels reach 2x feed; saves signal algorithm; carousels highest engagement per post
• TikTok: First 1.5s determines 90% of watch rate; sound-on by default; trend leverage window 24–48h
• LinkedIn: Thought leadership posts 3x more reach than company posts; first 3 lines are the hook
• YouTube: 30s pre-roll has 30% average view rate; first 5s unskippable = critical impression
• Snapchat: 60% of Gen Z in MENA is daily active; ephemeral content creates urgency

REGIONAL EXPERTISE — MENA & GCC
• Saudi Arabia: Vision 2030 shifting consumer behaviour; youth-led digital consumption (70% under 35); high brand-prestige sensitivity; Ramadan spending 30–50% above baseline
• UAE: Most multicultural market in MENA (200+ nationalities); premium positioning resonates; English + Arabic both critical; strong e-commerce penetration
• Egypt: Largest Arab digital audience; price-sensitivity balanced with brand aspiration; Egyptian Arabic dialect commands highest organic reach in Arab world
• Kuwait, Qatar, Bahrain: Small but ultra-high-income; luxury positioning + exclusivity signals
• General MENA: Collectivist culture (family, tribe, in-group) → social proof from peers > experts; Ramadan is the Super Bowl of marketing; avoid imagery/copy that could be read as immodest

═══════════════════════════════════════════════
CLIENT CONTEXT
═══════════════════════════════════════════════
Client: ${clientName}
Market: ${city ? `${city}, ` : ''}${country || 'Not specified'}
Brand Summary: ${brandSummary}

Cultural Context:
${cultureNotes || `Apply general ${country || 'regional'} consumer psychology and cultural norms based on your knowledge of this market.`}

═══════════════════════════════════════════════
YOUR ROLE IN THIS EVALUATION
═══════════════════════════════════════════════
You are the final quality gate before client presentation. You are NOT encouraging — you are ACCURATE.

When evaluating submitted work:
1. Identify the work type immediately and state it
2. Apply the client's country/city/culture as a lens on everything — cultural missteps are always flagged as CRITICAL
3. Score with precision using 0.1 increments — never round to a whole number unless truly perfect
4. Back every single finding with a specific named framework, study author, or data source
5. Flag mistakes explicitly: grammar, cultural missteps, strategic misalignment, factual errors, brand inconsistency
6. Always reference at least one real-world world-class benchmark campaign or brand for comparison
7. Give one critical fix that would generate the highest lift immediately

Return ONLY a valid JSON object matching this exact schema — no markdown, no preamble:
{
  "work_type": string,
  "work_description": string,
  "overall_score": number,
  "verdict": "Exceptional" | "Strong" | "Needs Work" | "Rework Required",
  "verdict_summary": string,
  "sections": [
    {
      "title": string,
      "score": number,
      "findings": string[],
      "backed_by": string
    }
  ],
  "mistakes": [
    {
      "type": "grammar" | "cultural" | "strategic" | "factual" | "brand",
      "severity": "critical" | "warning" | "minor",
      "found": string,
      "fix": string
    }
  ],
  "director_verdict": {
    "top_strength": string,
    "critical_fix": string,
    "world_class_benchmark": string,
    "priority_action": string
  }
}

Sections to always include (use exactly these titles):
1. "Content & Messaging" — copy quality, clarity, persuasion, headline strength
2. "Cultural Fit" — alignment with market, local sensitivities, language register
3. "Strategic Alignment" — does it serve the stated goal, funnel stage fit, competitive positioning
4. "Visual & Format" — layout, hierarchy, aesthetic, platform-format suitability (if image/design submitted, score this rigorously; if text only, score based on described format)
5. "Audience Resonance" — does it speak to the right person with the right emotional trigger`
}

// ── Gemini multimodal fallback ───────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  userText: string,
  imageBase64?: string,
  imageMime?: string,
): Promise<string> {
  const parts: unknown[] = []
  if (imageBase64 && imageMime) {
    parts.push({ inlineData: { mimeType: imageMime, data: imageBase64 } })
  }
  parts.push({ text: userText })

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message: string } }
  if (json.error) throw new Error(`Gemini: ${json.error.message}`)
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const clientId     = formData.get('client_id') as string | null
    const workBrief    = (formData.get('work_brief') as string | null) ?? ''
    const workTypeHint = (formData.get('work_type') as string | null) ?? ''
    const textContent  = (formData.get('text_content') as string | null) ?? ''
    const file         = formData.get('file') as File | null

    // ── Fetch client ──────────────────────────────────────────────────────────
    let clientName = 'Unknown Client'
    let country    = ''
    let city       = ''
    let cultureNotes = ''
    let brandSummary = ''

    if (clientId) {
      const supabase = createAdminClient()
      const { data: client } = await supabase
        .from('clients')
        .select('name, country, city, culture_notes, brand_identity_json, normalized_profile')
        .eq('id', clientId)
        .single()

      if (client) {
        clientName   = client.name
        country      = client.country ?? ''
        city         = client.city ?? ''
        cultureNotes = client.culture_notes ?? ''

        const bi = client.brand_identity_json as Record<string, unknown> | null
        const np = client.normalized_profile as Record<string, unknown> | null
        const parts: string[] = []
        if (bi?.industry)         parts.push(`Industry: ${bi.industry}`)
        if (bi?.tone_of_voice)    parts.push(`Tone: ${bi.tone_of_voice}`)
        if (bi?.target_audience)  parts.push(`Audience: ${bi.target_audience}`)
        if (np?.brand_voice)      parts.push(`Brand voice: ${(np.brand_voice as string[]).join(', ')}`)
        if (np?.content_goal)     parts.push(`Content goal: ${np.content_goal}`)
        if (np?.primary_platform) parts.push(`Primary platform: ${np.primary_platform}`)
        brandSummary = parts.join(' | ') || 'No detailed brand profile set.'
      }
    }

    const systemPrompt = buildSystemPrompt(clientName, country, city, cultureNotes, brandSummary)

    // ── Build user prompt ─────────────────────────────────────────────────────
    const contextLines: string[] = []
    if (workTypeHint) contextLines.push(`Work type hint from submitter: ${workTypeHint}`)
    if (workBrief)    contextLines.push(`Context / brief: ${workBrief}`)
    if (textContent)  contextLines.push(`\nSubmitted text content:\n${textContent}`)

    const userPrompt = contextLines.length
      ? contextLines.join('\n')
      : 'Please evaluate the submitted file.'

    // ── Process file ──────────────────────────────────────────────────────────
    let imageBase64: string | undefined
    let imageMime: string | undefined
    let extractedText = ''

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const mime  = file.type

      if (mime.startsWith('image/')) {
        imageBase64 = Buffer.from(bytes).toString('base64')
        imageMime   = mime
      } else if (mime === 'text/plain' || mime === 'text/html') {
        extractedText = Buffer.from(bytes).toString('utf-8').slice(0, 8000)
      } else if (mime === 'application/pdf') {
        extractedText = '[PDF uploaded — evaluating based on file name and provided context. For full text analysis paste the content into the text field.]'
      } else {
        extractedText = `[File uploaded: ${file.name}, type: ${mime}]`
      }
    }

    const finalUserPrompt = extractedText
      ? `${userPrompt}\n\nExtracted text:\n${extractedText}`
      : userPrompt

    // ── Call AI ───────────────────────────────────────────────────────────────
    let raw: string

    if (process.env.ANTHROPIC_API_KEY) {
      const contentBlocks: Anthropic.MessageParam['content'] = []

      if (imageBase64 && imageMime) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageBase64,
          },
        })
      }
      contentBlocks.push({ type: 'text', text: finalUserPrompt })

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      })

      raw = (msg.content[0] as { type: string; text: string }).text ?? ''
    } else {
      raw = await callGemini(systemPrompt, finalUserPrompt, imageBase64, imageMime)
    }

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const assessment = JSON.parse(cleaned)

    return NextResponse.json({ assessment })
  } catch (err) {
    console.error('[marketing-director/evaluate]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
