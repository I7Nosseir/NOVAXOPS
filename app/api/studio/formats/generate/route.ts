// ============================================================
// POST /api/studio/formats/generate
// Peak Creative Format Generator.
// Given a niche, returns 5 viral content formats each with:
//   hook_stack, three_law_validation, episode_structure,
//   payoff_architecture, why_viral, best_platform, best_length
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export interface FormatResult {
  format_name: string
  format_tagline: string
  hook_stack: string[]                  // 2–4 hook types used in sequence
  three_law_validation: {
    law: string
    passes: boolean
    note: string
  }[]
  episode_structure: string[]           // ordered beat list
  payoff_architecture: string           // what the audience feels at the end
  why_viral: string                     // one sentence
  best_platform: string
  best_length: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  reusability: 'One-off' | 'Series' | 'Evergreen'
}

const PROMPT = (niche: string, platform: string, language: string) => `
You are a viral content strategist. Generate 5 distinct, highly creative content FORMATS for the following niche.

NICHE: "${niche}"
PRIMARY PLATFORM: ${platform}
LANGUAGE: ${language}

A FORMAT is a repeatable content structure — not a single post idea.
Think: "Myth vs Fact breakdown", "Day in the life of X", "The $0 vs $10,000 version".

For each format, apply this framework:

1. HOOK STACK — 2–4 hook types used in sequence. Choose from:
   Curiosity Gap, Contrarian, Before/After, Social Proof, Identity, Urgency,
   Problem-Agitate, Revelation, Challenge, Specificity, Authority

2. THREE-LAW VALIDATION — evaluate against these 3 laws:
   - Law of Pattern Interrupt: Does it break the scroll habit?
   - Law of Incomplete Information: Does it force the audience to watch/read to the end?
   - Law of Social Currency: Will the audience want to share it to look smart/interesting?

3. EPISODE STRUCTURE — ordered beats (e.g. "Hook → Tension → Surprise reveal → Actionable takeaway → Soft CTA")

4. PAYOFF ARCHITECTURE — what does the audience FEEL at the end? (Validated? Surprised? Motivated? Seen?)

5. WHY VIRAL — one sentence on the psychological mechanism that makes this spread

Return ONLY valid JSON — no markdown, no explanation:
{
  "formats": [
    {
      "format_name": "Short catchy name",
      "format_tagline": "One sentence that sells the format to the team",
      "hook_stack": ["Hook type 1", "Hook type 2", "Hook type 3"],
      "three_law_validation": [
        { "law": "Pattern Interrupt", "passes": true, "note": "Why" },
        { "law": "Incomplete Information", "passes": true, "note": "Why" },
        { "law": "Social Currency", "passes": false, "note": "Why not" }
      ],
      "episode_structure": ["Beat 1", "Beat 2", "Beat 3", "Beat 4", "Beat 5"],
      "payoff_architecture": "The audience feels...",
      "why_viral": "One sentence",
      "best_platform": "Instagram / TikTok / LinkedIn / YouTube",
      "best_length": "15s / 30s / 60s / carousel / long-form",
      "difficulty": "Easy | Medium | Hard",
      "reusability": "One-off | Series | Evergreen"
    }
  ]
}

Rules:
- 5 formats exactly — make them genuinely different from each other
- Each format must be usable at least 10 times without repetition
- No hashtags, no emojis in any text
- Be specific to the niche — generic formats are not useful
`

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: { niche: string; platform?: string; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.niche?.trim()) {
    return NextResponse.json({ error: 'niche is required' }, { status: 400 })
  }

  const platform = body.platform ?? 'Instagram'
  const language = body.language ?? 'english'
  const prompt = PROMPT(body.niche, platform, language)
  let raw = ''

  try {
    if (anthropicKey) {
      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4000,
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
      return NextResponse.json({ error: 'Failed to parse formats from AI', raw }, { status: 502 })
    }

    const parsed = JSON.parse(match[0]) as { formats: FormatResult[] }
    return NextResponse.json({ formats: parsed.formats ?? [] })
  } catch (e) {
    console.error('[formats/generate]', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
