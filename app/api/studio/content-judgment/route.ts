import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiGenerate } from '@/lib/gemini'

export interface JudgmentResult {
  relevance:      number  // 1-10
  originality:    number  // 1-10
  cta_clarity:    number  // 1-10
  platform_fit:   number  // 1-10
  emotional_pull: number  // 1-10
  overall:        number  // 1-10
  verdict: 'exceptional' | 'strong' | 'solid' | 'needs_work'
  strengths: string[]
  weaknesses: string[]
  quick_win: string  // Single most impactful improvement
}

interface RequestBody {
  hook?: string
  script?: string       // Script sections as plain text
  caption?: string
  tov?: string          // Text on visual
  platform?: string
  goal?: string
  brand_voice?: string
  content_type?: string
  language?: string
}

const SYSTEM = `You are a world-class social media creative director evaluating content before it goes live.
Your job: judge content quality across 6 dimensions and give one actionable quick win.
Be brutally honest but constructive. Return only valid JSON.`

function buildPrompt(body: RequestBody): string {
  const parts: string[] = []
  if (body.hook)    parts.push(`HOOK: ${body.hook}`)
  if (body.script)  parts.push(`SCRIPT:\n${body.script}`)
  if (body.caption) parts.push(`CAPTION: ${body.caption}`)
  if (body.tov)     parts.push(`TEXT ON VISUAL: ${body.tov}`)

  return `Judge this ${body.content_type ?? 'reel'} for ${body.platform ?? 'Instagram'}.

Goal: ${body.goal ?? 'Engagement'}
${body.brand_voice ? `Brand voice: ${body.brand_voice}` : ''}
Language: ${body.language ?? 'english'}

Content:
${parts.join('\n\n')}

Score each dimension 1-10:
- relevance: How relevant to the platform's current content patterns?
- originality: How distinctive vs generic content in this space?
- cta_clarity: How clearly does it drive the stated goal?
- platform_fit: How well optimised for this specific platform?
- emotional_pull: How strongly does it trigger an emotion in the first 3 seconds?
- overall: Holistic quality score

Verdict: exceptional=9-10 overall, strong=7-8, solid=5-6, needs_work=<5

Return this exact JSON:
{
  "relevance": <1-10>,
  "originality": <1-10>,
  "cta_clarity": <1-10>,
  "platform_fit": <1-10>,
  "emotional_pull": <1-10>,
  "overall": <1-10>,
  "verdict": "exceptional" | "strong" | "solid" | "needs_work",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>"],
  "quick_win": "<single most impactful change, specific and actionable>"
}
Return ONLY the JSON object.`
}

function flattenScript(script?: Record<string, unknown>): string {
  if (!script) return ''
  const sections = (script.script_sections as Array<{ section: string; lines: string[] }> | undefined) ?? []
  if (sections.length) {
    return sections.map(s => `[${s.section}] ${s.lines.join(' ')}`).join('\n')
  }
  const slides = (script.slides as Array<{ title: string; body: string }> | undefined) ?? []
  if (slides.length) {
    return slides.map((s, i) => `Slide ${i+1}: ${s.title} — ${s.body}`).join('\n')
  }
  if (typeof script.visual_direction === 'string') return script.visual_direction
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody & { script_raw?: Record<string, unknown> }

    if (!body.hook && !body.script) {
      return NextResponse.json({ error: 'hook or script required' }, { status: 400 })
    }

    // Accept pre-flattened script string or raw script object
    if (!body.script && body.script_raw) {
      body.script = flattenScript(body.script_raw)
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
    let result: JudgmentResult
    try {
      result = JSON.parse(cleaned) as JudgmentResult
    } catch {
      console.error('[content-judgment] JSON parse failed:', cleaned.slice(0, 200))
      return NextResponse.json({ error: 'Parse error' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[content-judgment]', e)
    return NextResponse.json({ error: 'Content judgment failed' }, { status: 500 })
  }
}
