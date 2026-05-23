import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
}

const HOOK_PROMPT = (
  brief: string,
  platform: string,
  audience: string,
  goal: string,
  emotion: string,
  brandVoice: string,
) => `You are an elite social media hook writer using the One Peak framework. Your hooks make people stop scrolling instantly.

BRIEF: ${brief}
PLATFORM: ${platform}
AUDIENCE: ${audience} audience
CONTENT GOAL: ${goal}
DESIRED EMOTION: ${emotion}
${brandVoice ? `BRAND VOICE: ${brandVoice}` : ''}

Generate exactly 20 hooks covering these types (distribute them, don't repeat types too much):
- Curiosity: Creates an information gap the audience must fill
- Contradiction: Challenges a belief the audience holds
- Fear: Triggers loss aversion or FOMO
- Status: Leverages identity and social proof
- Authority: Establishes credibility immediately
- Transformation: Before/after framing
- Emotional: Vulnerability, relatability, shared experience
- Story: Opens a narrative loop
- Shock: Surprising fact, counter-intuitive truth

For each hook apply the 3C framework and score 0-10 on each:
- Clarity: Is it instantly understood with zero friction?
- Context: Does it establish WHO this is for in the first read?
- Curiosity: Does it create an irresistible pull to keep reading/watching?

Virality tiers: S = 27-30 total, A = 21-26, B = 15-20, C = below 15

Format recommendations:
- vocal: Best delivered as spoken opening line (video hooks)
- text_block: Best as on-screen text overlay
- caption: Best as written post opening
- all_three: Works across all formats

Return ONLY a valid JSON array — no markdown, no explanation:
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
    "format_note": "One-breath opener, natural pause after the question"
  }
]

Rules:
- No hashtags, no emojis
- Each hook must be a complete standalone line (not mid-sentence)
- Vary sentence structure — some short, some medium
- Hooks for ${platform} should match platform norms (TikTok = shorter/punchier, LinkedIn = more intellectual)
- The best hooks feel like they were written by someone who deeply understands the audience, not an AI`

export async function POST(req: NextRequest) {
  let body: {
    brief: string
    platform: string
    audience: string
    goal: string
    emotion: string
    brand_voice?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { brief, platform, audience, goal, emotion, brand_voice } = body
  if (!brief?.trim() || !platform || !audience) {
    return NextResponse.json({ error: 'brief, platform, and audience are required' }, { status: 400 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  const prompt = HOOK_PROMPT(
    brief.trim(),
    platform,
    audience,
    goal || 'Engagement',
    emotion || 'Inspire',
    brand_voice || '',
  )

  let raw = ''

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
