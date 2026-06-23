import { NextRequest, NextResponse } from 'next/server'

export interface IdeationConcept {
  archetype: string
  name: string
  one_liner: string
  idea: string
  visual_direction: string
  why_it_works: string
  scores: { clarity: number; contrast: number; credibility: number }
}

export interface IdeationOutput {
  decode: {
    core_problem: string
    success: string
    failure: string
    tension: string
  }
  cultural_scan: {
    forces: string[]
    category_clichees: string[]
    white_space: string
  }
  reframes: Array<{ problem_as: string; territory: string }>
  concepts: IdeationConcept[]
  top_picks: number[]
  execution: {
    reel: string
    carousel: string
    static: string
    campaign_line: string
  }
}

const SYSTEM = `You are a world-class creative director with 20 years at iconic agencies (Wieden+Kennedy, TBWA, BBH, R/GA). You have built landmark campaigns for Apple, Nike, Patagonia, and challenger brands. Your thinking is:
- Culturally attuned: you spot tensions before they become obvious
- Strategically grounded: every idea has a clear business rationale
- Visually specific: you think in images, moods, and compositions
- Distinctively surprising: you never produce category defaults

You run ideas through a rigorous 7-phase creative process that produces concepts that are simultaneously brave, precise, and commercially ownable.`

/**
 * POST /api/ai-image/ideate
 * Body: { context, problem, audience, constraints? }
 *
 * Runs a full 7-phase creative ideation session via Gemini and returns
 * structured IdeationOutput JSON.
 *
 * Phases:
 *   1. Brief Decode — strip to the real problem + tensions
 *   2. Cultural Scan — forces, category clichés, white space
 *   3. Reframe × 5 — same problem, 5 different angles
 *   4. Concept Divergence × 7 — one per archetype
 *   5. 3C Scoring (Clarity / Contrast / Credibility, 1–5 each)
 *   6. Top 3 selection with strategic rationale
 *   7. Executional vectors (Reel, Carousel, Static, Campaign Line)
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: {
    context?: string
    problem?: string
    audience?: string
    constraints?: string
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { context = '', problem = '', audience = '', constraints = '' } = body
  if (!problem.trim()) {
    return NextResponse.json({ error: 'problem is required' }, { status: 400 })
  }

  const prompt = `
Run a complete 7-phase creative ideation session for this brief.

BRIEF:
Brand / Context: ${context || 'Not specified'}
Problem / Goal: ${problem}
Audience: ${audience || 'Not specified'}
${constraints ? `Constraints: ${constraints}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — BRIEF DECODE
Strip the brief to its essential creative problem:
- core_problem: One precise sentence that captures what we're ACTUALLY solving
- success: What does success look, feel, and sound like? Be specific
- failure: What is the version of this that fails? Why does it fail?
- tension: The sharpest tension to exploit creatively (brand desire vs audience need, or cultural friction)

PHASE 2 — CULTURAL SCAN
Map the territory:
- forces: 4–6 cultural forces / anxieties / aspirations / movements relevant right now for this audience (be specific, not generic)
- category_clichees: 3–5 things this category/brand category ALWAYS does that feel tired — the patterns to consciously break
- white_space: The exact unclaimed creative territory — articulate it as one sharp sentence

PHASE 3 — REFRAME × 5
State the problem 5 completely different ways. Each reframe should open a different creative territory that the original brief does NOT suggest. Format as pairs of (problem_as, territory).

PHASE 4 — CONCEPT DIVERGENCE × 7
Generate one concept per archetype. Each must be fully developed, not just a tagline:

Archetypes:
1. "Obvious Elevated" — The expected thing, but executed with extraordinary craft, specificity, or unexpected detail that makes it feel surprising despite being familiar
2. "Inversion" — Flip the assumed approach completely. If everyone shows the product, hide it. If everyone claims strength, show vulnerability.
3. "Category Collision" — Steal the aesthetic language, format, or cultural codes of a completely different category. A perfume brand doing financial services language. A gym acting like a philosophy school.
4. "Human Truth" — Lead with a universal emotion or experience that transcends the product. The product is just the enabler of something deeply human.
5. "Cultural Hijack" — Attach powerfully to a specific, real cultural moment, tension, or movement. Not trend-chasing — reframing the brand through it.
6. "Serialized Universe" — Build a world, not a post. A mythology, recurring character, or expanding universe that makes every piece feel like part of something bigger.
7. "The Insane One" — The concept that would make the category uncomfortable. Throws out every convention. Probably scares the client. But has a kernel of something genuinely powerful.

For each concept provide:
- archetype (the archetype name from above)
- name (sharp memorable concept name, 2–4 words)
- one_liner (the concept in one sentence, written like a brief)
- idea (full concept development, 4–6 sentences — be specific about the execution, not just the direction)
- visual_direction (mood, color palette, composition approach, production references, visual language)
- why_it_works (the strategic argument for why this lands for THIS brand/audience — be specific)
- scores: clarity (1–5), contrast (1–5), credibility (1–5)
  - clarity: Does it land in under 3 seconds? (5 = instant, 1 = needs explanation)
  - contrast: Does it stop the scroll? (5 = completely unexpected, 1 = category default)
  - credibility: Does it feel true to this brand/audience? (5 = perfect fit, 1 = off-brand)

PHASE 5–6 — TOP PICKS
Set top_picks to the 3 indices (0-based) of the concepts with the highest combined scores AND best strategic fit. Include at least one brave/surprising choice.

PHASE 7 — EXECUTION (for the highest-scoring concept)
How does the top concept execute across formats?
- reel: Specific execution notes for a 15–30 second video — opening frame, narrative arc, final beat, sound direction
- carousel: How it works as a carousel — slide 1 hook, what each slide does, final CTA slide
- static: Single image execution — hero visual, composition, text placement, mood
- campaign_line: The overarching campaign headline or thought that could live across all touchpoints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid JSON matching this EXACT structure (no markdown, no prose outside the JSON):
{
  "decode": {
    "core_problem": "string",
    "success": "string",
    "failure": "string",
    "tension": "string"
  },
  "cultural_scan": {
    "forces": ["string", "string", "string", "string"],
    "category_clichees": ["string", "string", "string"],
    "white_space": "string"
  },
  "reframes": [
    { "problem_as": "string", "territory": "string" }
  ],
  "concepts": [
    {
      "archetype": "string",
      "name": "string",
      "one_liner": "string",
      "idea": "string",
      "visual_direction": "string",
      "why_it_works": "string",
      "scores": { "clarity": 0, "contrast": 0, "credibility": 0 }
    }
  ],
  "top_picks": [0, 2, 4],
  "execution": {
    "reel": "string",
    "carousel": "string",
    "static": "string",
    "campaign_line": "string"
  }
}
`.trim()

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.92,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
      error?: { message?: string }
    }

    if (!res.ok || json.error) {
      console.error('[ai-image/ideate] API error:', json.error?.message)
      return NextResponse.json({ error: json.error?.message ?? `API error ${res.status}` }, { status: res.status })
    }

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const finishReason = json.candidates?.[0]?.finishReason
    if (!raw) return NextResponse.json({ error: 'Empty response from model' }, { status: 502 })

    // Extract the first { ... } block — handles markdown fences and trailing prose
    const jsonStart = raw.indexOf('{')
    const jsonEnd   = raw.lastIndexOf('}')
    const clean     = jsonStart !== -1 && jsonEnd > jsonStart
      ? raw.slice(jsonStart, jsonEnd + 1)
      : raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim()

    let output: IdeationOutput
    try {
      output = JSON.parse(clean) as IdeationOutput
    } catch {
      console.error('[ai-image/ideate] JSON parse failed. finishReason:', finishReason, 'Raw:', raw.slice(0, 500))
      return NextResponse.json({
        error: finishReason === 'MAX_TOKENS'
          ? 'Response was too long and was cut off. Try a shorter brief.'
          : 'Model returned malformed JSON. Try again.',
      }, { status: 502 })
    }

    return NextResponse.json({ output })
  } catch (err) {
    console.error('[ai-image/ideate]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Network error' }, { status: 502 })
  }
}
