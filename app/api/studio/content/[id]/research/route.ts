import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface Phase1Data {
  platform: string
  audience: string
  goal: string
  emotion: string
  cta: string
  brief: string
  client_name?: string
  brand_voice?: string
  industry?: string
  key_messages?: string[]
}

const AUDIENCE_PROMPT = (d: Phase1Data) => `You are an expert audience psychologist. Analyse the target audience for the following content brief.

Platform: ${d.platform}
Audience: ${d.audience}
Brief: ${d.brief}
Goal: ${d.goal}
Desired emotion: ${d.emotion}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.brand_voice ? `Brand voice: ${d.brand_voice}` : ''}

Return a JSON object with these exact keys:
{
  "identity_desires": ["What they want to be seen as...", "..."],
  "core_fears": ["Biggest fear related to this topic...", "..."],
  "emotional_triggers": ["What makes them stop scrolling...", "..."],
  "language_patterns": ["Exact phrases they use...", "..."],
  "content_format_preference": "Short-form video / Long-form articles / etc.",
  "peak_engagement_insight": "One key insight about when and how this audience engages",
  "hook_angle": "The single strongest emotional angle to open with"
}

Return ONLY valid JSON. No markdown, no explanation.`

const TREND_PROMPT = (d: Phase1Data) => `You are an elite social media trend analyst. Identify content patterns that are working RIGHT NOW for the following brief.

Platform: ${d.platform}
Brief: ${d.brief}
Goal: ${d.goal}
${d.industry ? `Industry: ${d.industry}` : ''}

Return a JSON object with these exact keys:
{
  "viral_patterns": ["Pattern that's trending: e.g. 'Myth-busting numbered lists'", "..."],
  "hook_formats_winning": ["'POV: You finally figured out...' format", "..."],
  "competitor_content_gaps": ["Topic not being covered that this audience wants...", "..."],
  "content_format_trend": "What format is dominating this niche right now",
  "posting_insight": "Timing or frequency insight for this content type",
  "differentiation_angle": "The angle that would make this content stand out from 90% of similar posts"
}

Return ONLY valid JSON. No markdown, no explanation.`

const PERFORMANCE_PROMPT = (d: Phase1Data) => `You are a content performance strategist. Based on the brief, predict what content approach has the highest chance of success.

Platform: ${d.platform}
Audience: ${d.audience}
Content Goal: ${d.goal}
Brief: ${d.brief}
${d.key_messages?.length ? `Key messages: ${d.key_messages.join(', ')}` : ''}
${d.brand_voice ? `Brand voice: ${d.brand_voice}` : ''}

Return a JSON object with these exact keys:
{
  "predicted_er_range": "e.g. 4–7% (above average for this niche)",
  "highest_risk_elements": ["What usually kills engagement for this content type...", "..."],
  "success_factors": ["What drives strong performance here...", "..."],
  "optimal_length": "Ideal content length/duration for this format and goal",
  "cta_recommendation": "Most effective CTA approach for this goal on this platform",
  "format_verdict": "Best format verdict with brief reason"
}

Return ONLY valid JSON. No markdown, no explanation.`

function parseJSON(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found')
  return JSON.parse(match[0]) as Record<string, unknown>
}

async function callAI(prompt: string, anthropicKey: string | undefined, geminiKey: string | undefined): Promise<string> {
  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text : ''
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params // consume

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let phase1: Phase1Data
  try {
    phase1 = await req.json() as Phase1Data
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Run all 3 research agents in parallel
  const [audienceRaw, trendRaw, performanceRaw] = await Promise.allSettled([
    callAI(AUDIENCE_PROMPT(phase1), anthropicKey, geminiKey),
    callAI(TREND_PROMPT(phase1), anthropicKey, geminiKey),
    callAI(PERFORMANCE_PROMPT(phase1), anthropicKey, geminiKey),
  ])

  const audience_psychology = audienceRaw.status === 'fulfilled'
    ? (() => { try { return parseJSON(audienceRaw.value) } catch { return null } })()
    : null

  const trend_intelligence = trendRaw.status === 'fulfilled'
    ? (() => { try { return parseJSON(trendRaw.value) } catch { return null } })()
    : null

  const performance_context = performanceRaw.status === 'fulfilled'
    ? (() => { try { return parseJSON(performanceRaw.value) } catch { return null } })()
    : null

  return NextResponse.json({
    audience_psychology,
    trend_intelligence,
    performance_context,
  })
}
