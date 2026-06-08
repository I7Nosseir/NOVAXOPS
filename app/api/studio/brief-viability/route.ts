import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiGenerate } from '@/lib/gemini'

export interface ViabilityResult {
  score: number          // 0-100
  verdict: 'strong' | 'good' | 'weak' | 'blocked'
  summary: string        // One-line diagnosis
  flags: string[]        // Issues detected
  improvements: string[] // Actionable suggestions
  hook_archetype_hints: string[] // 2-3 best hook archetypes for this brief
}

interface RequestBody {
  brief: string
  platform?: string
  goal?: string
  audience?: string
  client_name?: string
  brand_voice?: string
  language?: string
  content_type?: string
}

const SYSTEM = `You are a senior creative strategist who evaluates content briefs before production.
Your job: quickly assess whether a brief is strong enough to generate high-performing content.
Be direct, practical, and specific. Return only valid JSON.`

function buildPrompt(body: RequestBody): string {
  return `Evaluate this content brief for social media viability.

Brief: "${body.brief}"
Platform: ${body.platform ?? 'Instagram'}
Goal: ${body.goal ?? 'Engagement'}
Audience: ${body.audience ?? 'B2C'}
Content type: ${body.content_type ?? 'reel'}
Language: ${body.language ?? 'english'}
${body.brand_voice ? `Brand voice: ${body.brand_voice}` : ''}
${body.client_name ? `Client: ${body.client_name}` : ''}

Score this brief on 5 criteria (0-20 each):
1. Specificity (is the topic clear enough to write distinct hooks?)
2. Audience clarity (do we know exactly who this speaks to?)
3. Emotional potential (does it trigger a real emotion: fear, desire, curiosity, pride, relief?)
4. Platform fit (does it suit the platform and content type?)
5. CTA potential (can it drive the stated goal?)

Return this exact JSON shape:
{
  "score": <0-100>,
  "verdict": "strong" | "good" | "weak" | "blocked",
  "summary": "<one-line diagnosis>",
  "flags": ["<specific issue 1>", "<specific issue 2>"],
  "improvements": ["<actionable fix 1>", "<actionable fix 2>"],
  "hook_archetype_hints": ["<archetype 1>", "<archetype 2>", "<archetype 3>"]
}

Verdicts: strong=85+, good=65-84, weak=40-64, blocked=<40
hook_archetype_hints: 2-3 of: Curiosity Gap, Social Proof, Controversy, Before/After, Fear of Missing Out, Personal Story, Myth-Busting, Data Shock, Direct Challenge, How-To Promise
Return ONLY the JSON object.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody

    if (!body.brief?.trim()) {
      return NextResponse.json({ error: 'brief required' }, { status: 400 })
    }

    const prompt = buildPrompt(body)
    let raw = ''

    if (process.env.ANTHROPIC_API_KEY) {
      const msg = await anthropic.messages.create({
        model:      AI_MODELS.primary,
        max_tokens: 512,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: prompt }],
      })
      raw = (msg.content[0] as { text: string }).text ?? ''
    } else {
      raw = await geminiGenerate(prompt, SYSTEM, { jsonMode: true, maxOutputTokens: 512, temperature: 0.2 })
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    let result: ViabilityResult
    try {
      result = JSON.parse(cleaned) as ViabilityResult
    } catch {
      console.error('[brief-viability] JSON parse failed:', cleaned.slice(0, 200))
      return NextResponse.json({ error: 'Parse error' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[brief-viability]', e)
    return NextResponse.json({ error: 'Viability check failed' }, { status: 500 })
  }
}
