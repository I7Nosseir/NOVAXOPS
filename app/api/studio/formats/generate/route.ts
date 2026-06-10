// ============================================================
// POST /api/studio/formats/generate
// Peak Creative Format Generator.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 60

export interface FormatResult {
  format_name: string
  format_tagline: string
  hook_stack: string[]
  three_law_validation: {
    law: string
    passes: boolean
    note: string
  }[]
  episode_structure: string[]
  payoff_architecture: string
  why_viral: string
  best_platform: string
  best_length: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  reusability: 'One-off' | 'Series' | 'Evergreen'
  example_hooks: string[]
  audience_psychology: string
  what_kills_it: string
}

const PROMPT = (niche: string, platform: string, language: string) => `
You are a viral content format strategist. You have spent years studying what makes content formats repeatable — formats that a creator can use 50 times and still have audiences come back for more.

NICHE: "${niche}"
PRIMARY PLATFORM: ${platform}
LANGUAGE: ${language}

The difference between a format and a post idea:
- A post idea: "The day I quit my job to travel full-time" (single use, not repeatable)
- A format: "The Hidden Cost" (repeatable — every episode names a real cost of something the audience pursues, revealing the thing no one talks about)

A great format has three properties:
1. REPEATABILITY — can be used 20+ times without becoming stale because the variable (the topic) changes while the structure stays constant
2. IDENTITY SIGNAL — the audience self-selects immediately ("this is for someone like me")
3. SHAREABILITY MECHANISM — a psychological reason to forward it built into the structure itself

FRAMEWORK APPLICATION:

1. HOOK STACK — 2–4 hook types used in sequence. Each one amplifies the previous.
   Types: Curiosity Gap, Contrarian, Before/After, Social Proof, Identity, Urgency, Problem-Agitate, Revelation, Challenge, Specificity, Authority

2. THREE-LAW VALIDATION:
   - Law of Pattern Interrupt: Does the format's structure visually or verbally break the feed scroll? Not just the content — the FORMAT itself.
   - Law of Incomplete Information: Does the format's structure force watching/reading to the end? (Not just hoping the content is interesting — is there a structural reason the end is needed?)
   - Law of Social Currency: Would sharing this format make the sharer look smart, caring, or interesting to their specific circle?

3. EPISODE STRUCTURE — 5–7 ordered beats. Each beat has a job. Name the job, not just the content.
   Example: "Beat 1: Name the trap (hook) → Beat 2: Prove the trap is real (evidence) → Beat 3: Make the audience admit they've been in it (identity) → Beat 4: The escape (value) → Beat 5: The cost of NOT escaping (urgency) → Beat 6: Low-friction CTA (next step)"

4. PAYOFF ARCHITECTURE — what specific emotion does the audience feel at the LAST second?
   Options: Validated (I knew this), Surprised (I didn't know that), Motivated (I'm going to do something now), Seen (this is about me), Empowered (I now know something others don't)

5. EXAMPLE HOOKS — 3 specific hook examples using this format for the "${niche}" niche. These should be usable tomorrow.

6. AUDIENCE PSYCHOLOGY — one sentence describing the specific psychological state the audience is in when this format performs best (e.g. "Works best when the audience is in a state of quiet dissatisfaction — not acute crisis, not contentment")

7. WHAT KILLS IT — the single execution mistake that makes this format fail. Not generic ("bad content") — the SPECIFIC mistake unique to this format's structure.

Generate 5 distinct formats. They must be genuinely different from each other in structure, audience psychology, and shareability mechanism.

Return ONLY valid JSON:
{
  "formats": [
    {
      "format_name": "Short, ownable name",
      "format_tagline": "One sentence that makes a creator want to use this format today",
      "hook_stack": ["Hook type 1", "Hook type 2", "Hook type 3"],
      "three_law_validation": [
        { "law": "Pattern Interrupt", "passes": true, "note": "Specific reason why" },
        { "law": "Incomplete Information", "passes": true, "note": "Specific reason why" },
        { "law": "Social Currency", "passes": false, "note": "Specific reason why not, or why yes" }
      ],
      "episode_structure": ["Beat 1: job — description", "Beat 2: job — description", "Beat 3: job — description", "Beat 4: job — description", "Beat 5: job — description"],
      "payoff_architecture": "The specific emotion the audience feels at the last second, and what produces it",
      "why_viral": "The specific psychological mechanism that makes this spread — name the bias or drive",
      "best_platform": "Instagram | TikTok | LinkedIn | YouTube | all",
      "best_length": "15s | 30s | 60s | carousel | long-form",
      "difficulty": "Easy | Medium | Hard",
      "reusability": "One-off | Series | Evergreen",
      "example_hooks": ["Specific hook 1 for ${niche}", "Specific hook 2", "Specific hook 3"],
      "audience_psychology": "One sentence: the psychological state the audience is in when this format works best",
      "what_kills_it": "One sentence: the specific execution mistake that destroys this format's effectiveness"
    }
  ]
}

Rules:
- 5 formats exactly
- No two formats can have the same episode structure shape
- Each format must be usable at least 20 times without repetition
- No hashtags, no emojis
- Example hooks must be specific and ready to use — not placeholder text
`

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

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
            generationConfig: { maxOutputTokens: 12000, temperature: 0.7 },
          }),
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
