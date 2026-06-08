import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'

export const maxDuration = 60

interface ScriptRequest {
  content_type?: 'reel' | 'carousel' | 'static'
  platform: string
  audience: string
  goal: string
  emotion: string
  cta: string
  brief: string
  hook: string
  hook_type: string
  audience_psychology?: Record<string, unknown>
  trend_intelligence?: Record<string, unknown>
  brand_voice?: string
  key_messages?: string[]
  client_name?: string
  client_id?: string
  language?: string
  dialect?: string
}

function languageInstruction(language: string | undefined, dialect: string | undefined): string {
  if (language !== 'arabic') return ''
  if (dialect === 'saudi') {
    return '\nLANGUAGE: Write the ENTIRE script in Saudi Arabic (اللهجة السعودية). All spoken lines must be in Saudi colloquial Arabic. Visual/direction notes (inside brackets) may stay in English for production clarity.\n'
  }
  return '\nLANGUAGE: Write the ENTIRE script in Egyptian Arabic (اللهجة المصرية / عامية مصرية). All spoken lines must be in Egyptian colloquial Arabic. Visual/direction notes (inside brackets) may stay in English for production clarity.\n'
}

// ── Reel prompt ───────────────────────────────────────────────

const REEL_PROMPT = (d: ScriptRequest) => `You are an elite content director. You have made videos that have broken through on every major platform. You write scripts that get shot exactly as written because every line has a purpose and every direction is executable.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
PLATFORM: ${d.platform}
AUDIENCE: ${d.audience}
GOAL: ${d.goal}
DESIRED EMOTION: ${d.emotion}
CTA GOAL: ${d.cta}
SELECTED HOOK: "${d.hook}" (hook type: ${d.hook_type})
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

${d.audience_psychology ? `AUDIENCE PSYCHOLOGY PROFILE:
- Identity desires: ${JSON.stringify(d.audience_psychology.identity_desires)}
- Core fears: ${JSON.stringify(d.audience_psychology.core_fears)}
- Emotional triggers: ${JSON.stringify(d.audience_psychology.emotional_triggers)}
- Hook angle: ${d.audience_psychology.hook_angle}` : ''}

${d.trend_intelligence ? `PLATFORM INTELLIGENCE:
- Winning format right now: ${d.trend_intelligence.content_format_trend}
- Differentiation angle: ${d.trend_intelligence.differentiation_angle}` : ''}

RETENTION PHYSICS — why people stop watching and what prevents it:
- The first 1.5 seconds must earn the next 5 seconds. The hook lands or the rest doesn't matter.
- Each section must end in a micro-open-loop: a question implied, a tension unresolved, a promise not yet delivered.
- The TENSION section is where most creators fail: they move to the answer too fast. Hold the tension one beat longer than feels comfortable.
- The VALUE section must deliver the insight in the first sentence, then expand — never bury the payoff at the end.
- The PAYOFF must feel earned: it resolves the exact emotional tension opened in the HOOK.
- The CTA must be one thing only. Two asks = zero asks.

SCRIPT STRUCTURE — One Peak retention framework:
1. HOOK — Use the selected hook verbatim as the opening line. Do not paraphrase. Do not soften.
2. CONTEXT — Establish WHO this is for and WHY it matters RIGHT NOW (2–3 punchy lines). No setup fluff.
3. TENSION — Deepen the problem, desire, or fear opened in the hook (3–5 lines). Build pressure. Do NOT resolve yet.
4. VALUE — Deliver the core insight, teaching, or revelation. Lead with the answer. (4–8 lines depending on complexity)
5. PAYOFF — The emotional resolution. Transformation confirmed. The viewer feels something has shifted. (2–3 lines)
6. CTA — One action, frictionless, native to ${d.platform}. (1–2 lines)

FORMATTING RULES:
- [VISUAL: description] — camera direction. Be specific: "tight close-up on hands", not just "close-up"
- [B-ROLL: description] — cutaway suggestion. Name the specific shot.
- [EMPHASIS] — before any line that must land with weight. One-second hold after delivery.
- [SOUND: description] — music or sfx cue. Name the mood shift, not just "music plays"
- [PAUSE] — deliberate silence before a key reveal
- Sentence length for ${d.platform === 'TikTok' || d.platform === 'Instagram' ? 'TikTok/Reels: keep each spoken sentence to one breath maximum (≤12 words). One thought per cut.' : d.platform + ': match native pacing — sentences can be up to 2 breaths on longer formats'}
- No hashtags, no emojis in the script

DIRECTOR'S INTENT per section:
- In each section's visual_note, describe what the VIEWER should feel, not just what the camera does
- The visual direction should reinforce the emotional arc, not decorate it

Return a JSON object — no markdown, no explanation:
{
  "script_sections": [
    {
      "section": "HOOK",
      "lines": ["exact spoken line"],
      "visual_note": "What the camera does AND what the viewer feels in this moment",
      "duration_estimate": "0:00–0:03",
      "director_note": "One sentence: the single most important thing to get right in this section"
    },
    {
      "section": "CONTEXT",
      "lines": ["line 1", "line 2"],
      "visual_note": "...",
      "duration_estimate": "0:03–0:08",
      "director_note": "..."
    },
    {
      "section": "TENSION",
      "lines": ["line 1", "line 2", "line 3"],
      "visual_note": "...",
      "duration_estimate": "0:08–0:20",
      "director_note": "..."
    },
    {
      "section": "VALUE",
      "lines": ["line 1", "line 2", "line 3", "line 4"],
      "visual_note": "...",
      "duration_estimate": "0:20–0:42",
      "director_note": "..."
    },
    {
      "section": "PAYOFF",
      "lines": ["line 1", "line 2"],
      "visual_note": "...",
      "duration_estimate": "0:42–0:52",
      "director_note": "..."
    },
    {
      "section": "CTA",
      "lines": ["one clear action line"],
      "visual_note": "...",
      "duration_estimate": "0:52–1:00",
      "director_note": "..."
    }
  ],
  "total_duration": "~60 seconds",
  "brand_compliance_notes": "Any voice or messaging flags",
  "production_difficulty": "Low | Medium | High",
  "key_broll_list": ["Most important cutaway 1", "cutaway 2", "cutaway 3"],
  "caption_preview": "First 150 chars of the post caption — must continue the hook energy",
  "retention_risk": "The single moment in this script where viewers are most likely to drop off, and what to watch in the edit"
}

Return ONLY valid JSON.`

// ── Carousel prompt ───────────────────────────────────────────

const CAROUSEL_PROMPT = (d: ScriptRequest) => `You are creating a high-performing carousel post for ${d.platform}.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
HOOK (Cover Slide): "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

SWIPE MOMENTUM PRINCIPLES:
- Every slide must earn the swipe to the next slide. If a slide fully resolves the tension, the swipe stops.
- Each slide creates a micro-gap: a question implied, a step promised, a reveal withheld.
- The cover slide's job is to make swiping feel like the only possible response.
- The second slide is where 50% of carousels lose the reader. Make it the best slide in the deck.
- The last slide's CTA must feel like the natural conclusion of a journey, not a sudden ask.

Create 6–8 carousel slides. Each slide has ONE job. No filler.

SLIDE STRUCTURE:
- Slide 1 (Cover): Hook exactly as provided. No extra text.
- Slides 2–(N-1): Each delivers ONE insight, one step, or one reveal. Maximum 30 words body text.
  - Each slide title must create a micro-curiosity gap that the body text resolves.
  - After each body text, the reader should feel "I need to see what comes next."
- Last slide: CTA that feels earned by the journey. One ask.

Return ONLY valid JSON:
{
  "slides": [
    {
      "title": "Cover title — hook verbatim",
      "body": "Cover subheading if needed — max 12 words, or empty string",
      "visual_note": "What this slide looks like — layout, dominant visual, color zone",
      "swipe_driver": "What creates the urge to see the next slide"
    },
    {
      "title": "Slide 2 title — creates a micro-gap",
      "body": "Body text — one insight, max 30 words",
      "visual_note": "...",
      "swipe_driver": "..."
    }
  ],
  "caption_preview": "First 150 chars of the carousel caption — must amplify the hook",
  "production_difficulty": "Low | Medium | High",
  "brand_compliance_notes": "Any voice or messaging flags",
  "key_broll_list": ["Design asset or visual needed 1", "asset 2"],
  "weakest_slide": "Slide number most likely to cause drop-off, and why"
}

Rules: no hashtags, no emojis`

// ── Static prompt ─────────────────────────────────────────────

const STATIC_PROMPT = (d: ScriptRequest) => `You are creating a high-impact static social post for ${d.platform}.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
HOOK / MESSAGE: "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

VISUAL HIERARCHY PRINCIPLES:
- The text overlay is the hook. It must be legible at half-size on a mobile screen in 0.5 seconds.
- The image creates the emotional context that makes the text land harder.
- Composition guides the eye: the visual must lead to the text, not compete with it.
- The image must work without the text, and the text must work without the image — together they create one clear message.

Return ONLY valid JSON:
{
  "visual_direction": "Detailed production brief: subject + exact pose/position, background + depth, lighting setup + quality, color palette + mood, composition + focal point, how the visual leads the viewer's eye to where the text appears. Specific enough that a photographer executes this without one question.",
  "text_overlay": "The exact text on the image — maximum 8 words. Must be legible at 50% size. No emojis.",
  "secondary_text": "Optional supporting text beneath the main overlay — max 12 words, or null",
  "caption_preview": "First 150 chars of the post caption — continues the hook energy, soft CTA",
  "brand_compliance_notes": "Voice or visual flags",
  "production_difficulty": "Low",
  "key_broll_list": ["Photography element or prop 1", "element 2"],
  "focal_point": "One sentence: exactly where the viewer's eye should land first, and what it should feel"
}

Rules: no hashtags, no emojis`

function selectPrompt(d: ScriptRequest): string {
  if (d.content_type === 'carousel') return CAROUSEL_PROMPT(d)
  if (d.content_type === 'static')   return STATIC_PROMPT(d)
  return REEL_PROMPT(d)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: ScriptRequest
  try {
    body = await req.json() as ScriptRequest
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.hook?.trim()) {
    return NextResponse.json({ error: 'hook is required — complete Phase 3 first' }, { status: 400 })
  }

  let prompt = selectPrompt(body)
  let raw = ''

  // Inject client intelligence
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const block = await buildClientIntelligenceBlock(body.client_id, 'studio_content', db).catch(() => '')
      if (block) prompt = prompt + block
    }
  }

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 12000, temperature: 0.6 },
        }),
      },
    )
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: 'Failed to parse script from AI', raw }, { status: 502 })
  }

  let script: unknown
  try {
    script = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  return NextResponse.json({ script })
}
