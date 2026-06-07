import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'

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

// ── Reel prompt (original) ────────────────────────────────────

const REEL_PROMPT = (d: ScriptRequest) => `You are an elite content director writing a production-ready ${d.platform} script.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
PLATFORM: ${d.platform}
AUDIENCE: ${d.audience}
GOAL: ${d.goal}
DESIRED EMOTION: ${d.emotion}
CTA GOAL: ${d.cta}
SELECTED HOOK: "${d.hook}" (type: ${d.hook_type})
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

${d.audience_psychology ? `AUDIENCE INSIGHTS:
- Identity desires: ${JSON.stringify(d.audience_psychology.identity_desires)}
- Core fears: ${JSON.stringify(d.audience_psychology.core_fears)}
- Emotional triggers: ${JSON.stringify(d.audience_psychology.emotional_triggers)}
- Hook angle: ${d.audience_psychology.hook_angle}` : ''}

${d.trend_intelligence ? `TREND CONTEXT:
- Winning format: ${d.trend_intelligence.content_format_trend}
- Differentiation angle: ${d.trend_intelligence.differentiation_angle}` : ''}

Write a full production-ready script using the One Peak retention structure:
1. HOOK — Open with the selected hook exactly as provided
2. CONTEXT — Establish who this is for and why it matters NOW (2–3 lines)
3. TENSION — Deepen the problem or desire (build urgency, don't resolve yet)
4. VALUE — Deliver the core insight, proof, or teaching
5. PAYOFF — The satisfying resolution, transformation, or revelation
6. CTA — The single clear action (matching the CTA goal above)

Format rules:
- Use [VISUAL: description] markers for camera direction
- Use [B-ROLL: description] for cutaway suggestions
- Use [EMPHASIS] before any line that should be punchy/loud
- Use [SOUND: description] for music/sfx moments
- Keep sentences short for ${d.platform === 'TikTok' || d.platform === 'Instagram' ? 'TikTok/Reels pacing (1 sentence per cut)' : d.platform + ' pacing'}
- No hashtags, no emojis in the script itself

Return a JSON object:
{
  "script_sections": [
    { "section": "HOOK", "lines": ["line 1", "line 2"], "visual_note": "...", "duration_estimate": "0:00–0:03" },
    { "section": "CONTEXT", "lines": [...], "visual_note": "...", "duration_estimate": "0:03–0:08" },
    { "section": "TENSION", "lines": [...], "visual_note": "...", "duration_estimate": "0:08–0:18" },
    { "section": "VALUE", "lines": [...], "visual_note": "...", "duration_estimate": "0:18–0:40" },
    { "section": "PAYOFF", "lines": [...], "visual_note": "...", "duration_estimate": "0:40–0:52" },
    { "section": "CTA", "lines": [...], "visual_note": "...", "duration_estimate": "0:52–1:00" }
  ],
  "total_duration": "~60 seconds",
  "brand_compliance_notes": "Any brand voice observations or flags",
  "production_difficulty": "Low / Medium / High",
  "key_broll_list": ["Most important B-roll shot 1", "..."],
  "caption_preview": "First 150 chars of caption this script would generate"
}

Return ONLY valid JSON. No markdown, no explanation.`

// ── Carousel prompt ───────────────────────────────────────────

const CAROUSEL_PROMPT = (d: ScriptRequest) => `You are creating a carousel post for ${d.platform}.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
HOOK (Cover Slide): "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

Create 5–7 carousel slides that build on the hook and deliver clear value slide-by-slide.

Return ONLY valid JSON:
{
  "slides": [
    { "title": "Cover title — use the hook exactly", "body": "2–3 sentences (max 30 words)", "visual_note": "Visual direction for this slide" },
    { "title": "Slide 2 title", "body": "...", "visual_note": "..." }
  ],
  "caption_preview": "First 150 chars of the carousel caption",
  "production_difficulty": "Low / Medium / High",
  "brand_compliance_notes": "Any brand voice notes",
  "key_broll_list": ["Design element or asset needed 1", "asset 2"]
}

Rules:
- Slide 1: hook/cover — use the provided hook as the title
- Slides 2–(N-1): each delivers ONE insight or step — no filler
- Last slide: clear CTA
- Body text: max 30 words per slide (readable at a glance on mobile)
- No hashtags, no emojis`

// ── Static prompt ─────────────────────────────────────────────

const STATIC_PROMPT = (d: ScriptRequest) => `You are creating a static social post image brief for ${d.platform}.
${languageInstruction(d.language, d.dialect)}

BRIEF: ${d.brief}
HOOK / MESSAGE: "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

Return ONLY valid JSON:
{
  "visual_direction": "Detailed description of the image: composition, subject, mood, lighting, color palette, background, framing",
  "text_overlay": "The exact text shown on the image — max 10 words, punchy and readable at a glance",
  "caption_preview": "First 150 chars of the post caption",
  "brand_compliance_notes": "Any brand voice or visual notes",
  "production_difficulty": "Low",
  "key_broll_list": ["Photography prop or element 1", "element 2"]
}

Rules:
- visual_direction: describe in enough detail for a photographer or designer to execute without questions
- text_overlay: this IS the hook — make it punchy, large, readable. No emojis, no hashtags
- caption_preview: max 150 chars including a soft CTA`

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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
