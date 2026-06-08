import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, buildCompetitorContextBlock, adminSupabase } from '@/lib/client-intelligence'

export const maxDuration = 60

export interface GeneratedHook {
  hook_text: string
  hook_type: 'curiosity' | 'contradiction' | 'fear' | 'status' | 'authority' | 'transformation' | 'emotional' | 'story' | 'shock'
  clarity_score: number
  context_score: number
  curiosity_score: number
  total_score: number
  virality_tier: 'S' | 'A' | 'B' | 'C'
  format_rec: 'vocal' | 'text_block' | 'caption' | 'all_three'
  format_note: string
  headline: string
  body: string
  cta: string
}

function languageInstruction(language: string, dialect: string): string {
  if (language !== 'arabic') return ''
  if (dialect === 'saudi') {
    return '\nLANGUAGE: Write ALL hooks in Saudi Arabic (اللهجة السعودية). Use Saudi colloquialisms, Saudi dialect vocabulary, and culturally relevant Saudi references. All hook text must be in Arabic script.\n'
  }
  return '\nLANGUAGE: Write ALL hooks in Egyptian Arabic (اللهجة المصرية / عامية مصرية). Use Egyptian dialect vocabulary, Egyptian colloquialisms, and culturally relevant Egyptian/pan-Arab references. All hook text must be in Arabic script.\n'
}

const HOOK_PROMPT = (
  brief: string,
  platform: string,
  audience: string,
  goal: string,
  emotion: string,
  brandVoice: string,
  language = 'english',
  dialect = 'saudi',
) => `You are the best hook writer in the world. You have studied every format that broke through on ${platform} and you know the exact psychological mechanism behind each one.
${languageInstruction(language, dialect)}
A great hook does three things simultaneously:
1. It creates an immediate information gap — the brain feels incomplete and must resolve it
2. It signals identity — the viewer instantly knows "this is for me" or "this is about someone I know"
3. It triggers a micro-commitment — reading/watching the next line feels less like a choice and more like a reflex

A weak hook: generic, could apply to any brand, no identity signal, no gap.
A strong hook: specific enough that only a fraction of scrollers stop — but that fraction is exactly the right audience.

BRIEF: ${brief}
PLATFORM: ${platform}
AUDIENCE: ${audience}
CONTENT GOAL: ${goal}
DESIRED EMOTION: ${emotion}
${brandVoice ? `BRAND VOICE: ${brandVoice}` : ''}

PLATFORM-SPECIFIC REQUIREMENTS FOR ${platform.toUpperCase()}:
${platform === 'TikTok' ? '- Maximum 8 words for text overlays. Spoken hooks: first syllable must hit hard. Use vernacular. Drop formal grammar where it helps rhythm.' :
  platform === 'Instagram' ? '- Reels: 6-12 words, punchy. Carousels: first slide hook must create a swipe reflex. Feed captions: first 125 chars before "more" must stop the scroll.' :
  platform === 'LinkedIn' ? '- Professional tension preferred. Use specificity and counterintuitive data. Works: "I made $0 doing what I was told was the path." Does not work: "5 productivity tips."' :
  platform === 'YouTube' ? '- Title hooks: promise a transformation or reveal. Thumbnail hook: creates a visual question. First 15 seconds: restate the promise, add urgency.' :
  '- Match platform norms: specific, identity-forward, pattern-interrupting.'}

HOOK TYPES — generate at least 2 of each type:
- Curiosity: Opens an information gap so specific the audience feels they already missed something important
- Contradiction: Challenges a belief the audience holds so tightly they need to read to defend it
- Fear: Loss aversion or FOMO — must be credible, not hyperbolic
- Status: Leverages identity and belonging signals specific to this audience
- Authority: Establishes credibility in the first phrase — a number, a credential, a named result
- Transformation: Before/after framing — the before must be painfully recognizable
- Emotional: Vulnerability or shared experience that makes the audience feel seen, not sold to
- Story: Opens a narrative loop with a specific character in a specific situation
- Shock: A counter-intuitive truth or surprising fact — must be verifiable

3C SCORING — score each dimension 0-10 with precision:
- Clarity (0-10): Does it land with zero cognitive friction? 10 = any 7-year-old understands the setup. 5 = requires two reads.
- Context (0-10): Does it signal the exact audience in the first phrase? 10 = the target audience feels personally called out. 5 = vaguely relevant.
- Curiosity (0-10): Does it create an irresistible pull? 10 = stopping is not a choice. 5 = mildly interesting.

CALIBRATION EXAMPLES (so you don't cluster scores around 7):
- Score 30 (S tier): "The doctor told me I had 6 months. I responded with a spreadsheet." — Curiosity + Shock + Story all in one. Perfect clarity. Universal identity signal. Irresistible gap.
- Score 22 (A tier): "I grew my account to 100k by doing the exact opposite of what every guru says." — Clear, relevant, information gap. Not perfect because the "guru" trope is slightly worn.
- Score 16 (B tier): "Here are 5 things I wish I knew about investing." — Clear, contextual, but the gap is weak. No urgency. Predictable.
- Score 9 (C tier): "Want to learn more about our products?" — No gap, no identity, no tension.

VIRALITY TIERS: S = 27–30 total, A = 21–26, B = 15–20, C = below 15

FORMAT RECOMMENDATIONS:
- vocal: Best delivered as a spoken opener (designed for video — one breath, natural pause after)
- text_block: Best as on-screen text overlay (7 words max, high contrast)
- caption: Best as written post opening (works when read silently)
- all_three: Strong enough to cross all formats without losing power

FOR EACH HOOK, ALSO WRITE:
- headline: A 4–8 word content title this hook introduces — NOT the hook itself. This names the content piece.
- body: 2–3 sentences of body copy that deliver on the hook's promise, deepen the tension, and set up the CTA. No filler. Every word earns its place.
- cta: One specific, native call-to-action sentence for ${platform}. Matches the content goal (${goal}). Low friction.

Rules:
- No hashtags, no emojis anywhere in any field
- Every hook must be a complete, standalone line — not mid-sentence
- Vary sentence structure — some 4-word punches, some 12-word setups
- No two hooks can use the same structural template
- If a hook feels like something you've read before, it's not good enough

Return ONLY a valid JSON array of exactly 20 hooks — no markdown, no explanation, no wrapper:
[
  {
    "hook_text": "...",
    "hook_type": "curiosity",
    "clarity_score": 9,
    "context_score": 8,
    "curiosity_score": 10,
    "total_score": 27,
    "virality_tier": "S",
    "format_rec": "vocal",
    "format_note": "One-breath opener, pause after the question lands",
    "headline": "4–8 words naming the content",
    "body": "2–3 sentences of body copy that deliver on the hook",
    "cta": "One platform-native CTA sentence"
  }
]`

export async function POST(req: NextRequest) {
  let body: {
    brief: string
    platform: string
    audience: string
    goal: string
    emotion: string
    brand_voice?: string
    language?: string
    dialect?: string
    client_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { brief, platform, audience, goal, emotion, brand_voice, language, dialect, client_id } = body
  if (!brief?.trim() || !platform || !audience) {
    return NextResponse.json({ error: 'brief, platform, and audience are required' }, { status: 400 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let prompt = HOOK_PROMPT(
    brief.trim(),
    platform,
    audience,
    goal || 'Engagement',
    emotion || 'Inspire',
    brand_voice || '',
    language || 'english',
    dialect || 'saudi',
  )

  if (client_id) {
    const db = adminSupabase()
    if (db) {
      const block = await buildClientIntelligenceBlock(client_id, 'hook_lab', db).catch(() => '')
      if (block) prompt = prompt + block
      const compBlock = await buildCompetitorContextBlock(client_id, db).catch(() => '')
      if (compBlock) prompt = prompt + compBlock
    }
  }

  let raw = ''

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
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
          generationConfig: { maxOutputTokens: 16000, temperature: 0.7 },
        }),
      },
    )
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 })
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // Parse JSON from raw response
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const arrMatch = stripped.match(/\[[\s\S]*\]/)
  if (!arrMatch) {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 502 })
  }

  let hooks: GeneratedHook[]
  try {
    hooks = JSON.parse(arrMatch[0]) as GeneratedHook[]
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  // Normalise and recompute
  hooks = hooks.map(h => {
    const c = Math.max(0, Math.min(10, Number(h.clarity_score)  || 0))
    const x = Math.max(0, Math.min(10, Number(h.context_score)  || 0))
    const q = Math.max(0, Math.min(10, Number(h.curiosity_score)|| 0))
    const total = c + x + q
    return {
      ...h,
      clarity_score:  c,
      context_score:  x,
      curiosity_score: q,
      total_score: total,
      virality_tier: total >= 27 ? 'S' : total >= 21 ? 'A' : total >= 15 ? 'B' : 'C',
    }
  })

  hooks.sort((a, b) => b.total_score - a.total_score)

  return NextResponse.json({ hooks })
}
