import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/api-auth'
import { buildClientIntelligenceBlock, buildCompetitorContextBlock } from '@/lib/client-intelligence'

const GEMINI_MODEL = 'gemini-3-flash-preview'

const HAS_DB = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function callAI(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text : ''
  }
  return callGemini(prompt)
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000 },
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface CrisisRequest {
  tool: 'situation_assessment' | 'holding_statement' | 'recovery_plan'
  client_id: string
  client_name: string
  client_data?: {
    industry?: string
    brand_identity?: {
      tone_of_voice?: string
      target_audience?: string
      key_messages?: string[]
      industry?: string
    }
    competitor_context?: string[]
    performance_intel?: {
      strengths?: string[]
      weaknesses?: string[]
      market_position?: string
    }
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'ceo']); if ('error' in auth) return auth.error
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No AI provider configured.' }, { status: 503 })
  }

  let body: CrisisRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { tool, client_name, client_data } = body

  // Fetch intelligence context in parallel (non-blocking) — crisis tools benefit from
  // knowing client brand voice, past wins to anchor recovery, and competitor landscape
  let intelligenceSection = ''
  if (HAS_DB) {
    const db = adminSupabase()
    const [intelBlock, compBlock] = await Promise.all([
      buildClientIntelligenceBlock(body.client_id, 'ceo_crisis', db).catch(() => ''),
      buildCompetitorContextBlock(body.client_id, db).catch(() => ''),
    ])
    intelligenceSection = [intelBlock, compBlock].filter(Boolean).join('\n')
  }

  const industry = client_data?.brand_identity?.industry ?? client_data?.industry ?? 'unspecified'
  const brandVoice = client_data?.brand_identity?.tone_of_voice ?? 'professional'
  const audience = client_data?.brand_identity?.target_audience ?? 'general audience'
  const keyMessages = client_data?.brand_identity?.key_messages?.join('; ') ?? 'not specified'
  const strengths = client_data?.performance_intel?.strengths?.join('; ') ?? 'not assessed'
  const marketPosition = client_data?.performance_intel?.market_position ?? 'not assessed'

  let prompt = ''

  switch (tool) {
    case 'situation_assessment':
      prompt = `You are a crisis communications specialist with 25 years of experience managing brand crises for global companies across the ${industry} sector. You assess situations with clinical precision and without panic.

## Crisis Client Profile

Client: ${client_name}
Industry: ${industry}
Target Audience: ${audience}
Brand Voice: ${brandVoice}
Brand Strengths: ${strengths}
Current Market Position: ${marketPosition}
Core Messages at Risk: ${keyMessages}

This client has been flagged as IN CRISIS MODE. Conduct a comprehensive situation assessment.

## Crisis Severity Classification

Classify the current crisis level:
- Level 1: Reputational risk — negative sentiment trending, no confirmed incident
- Level 2: Active incident — confirmed issue affecting brand perception
- Level 3: Escalating crisis — media coverage or viral spread confirmed
- Level 4: Full crisis — significant audience trust damage, stakeholder intervention required

State the classification and the specific indicators that support it.

## Stakeholder Impact Matrix

Map the impact across ${client_name}'s key stakeholder groups:
- Primary audience (${audience}): Current sentiment, risk of defection, severity
- Media and influencers: Coverage risk, amplification probability
- Partners/collaborators: Relationship risk
- Internal team: Morale and operational impact

## Brand Asset Vulnerability Assessment

Which specific brand assets are most at risk in this crisis? Rate each: Under Threat / At Risk / Safe — with reasoning.

## Crisis Timeline Projection

Based on typical crisis arc patterns in the ${industry} sector:
- Hours 0–24: What is likely to happen if no action is taken
- Days 2–7: Secondary wave risks (media pickup, community response, competitor opportunism)
- Weeks 2–4: Long-tail reputational effects and recovery window

## Immediate Action Priorities

The three most important actions to take in the next 24 hours, in priority order. Each must be: specific, actionable, assigned to a function (CEO, social team, PR, legal), and measurable.

## The CEO Assessment

One paragraph, no hedging. What is the true severity of this situation, what is the realistic outcome if handled well versus handled poorly, and what is the single decision that will define how this crisis resolves?

Rules: No hashtags. No emojis. Crisis communications require clarity and precision — no vague language.`
      break

    case 'holding_statement':
      prompt = `You are a crisis communications specialist and former senior PR executive. You have written holding statements for Fortune 500 brands during product recalls, social media controversies, data breaches, and leadership crises.

## Crisis Client Profile

Client: ${client_name}
Industry: ${industry}
Audience: ${audience}
Brand Voice: ${brandVoice}
Core Values / Key Messages: ${keyMessages}

A holding statement must: (1) acknowledge the situation without admitting liability, (2) demonstrate the organisation is taking it seriously, (3) buy time for a full investigation without appearing evasive, (4) maintain the brand's voice and human authority, (5) be legally defensible.

Generate three distinct holding statement variants, each optimised for a different communication channel and tone strategy.

---

## Statement 1 — Formal

Suitable for press release, official website, LinkedIn.
Tone: Authoritative, composed, institutional.
Length: 80–120 words.
Structure: Acknowledgement + Position + Commitment + Next step (with timeframe).

---

## Statement 2 — Conversational

Suitable for Instagram / Facebook caption, community post.
Tone: Human, direct, warm but serious. Sounds like a real person wrote it, not a legal team.
Length: 60–90 words.
Structure: Direct acknowledgement + empathy signal + clear next step.

---

## Statement 3 — Minimal

Suitable for a pinned post or interim response to direct comments.
Tone: Concise, clear, no wasted words.
Length: Maximum 40 words.
Structure: One acknowledgement sentence + one action sentence.

---

## Communication Do-Not List

For this specific client and situation, list 5 specific phrases, approaches, or commitments that must NOT appear in any crisis communication. Explain why each is dangerous.

## Timing Recommendation

When should the first public statement go out (hours from now), on which platform first, and why.

Rules: No hashtags. No emojis. The statements must be ready to publish with minimal editing.`
      break

    case 'recovery_plan':
      prompt = `You are a brand recovery strategist who has rebuilt trust for brands across the ${industry} sector following crises. You understand that recovery is not about erasing the crisis — it is about demonstrating change and earning trust back through consistent action over time.

## Crisis Client Profile

Client: ${client_name}
Industry: ${industry}
Audience: ${audience}
Brand Voice: ${brandVoice}
Brand Strengths to Rebuild From: ${strengths}
Market Position to Recover: ${marketPosition}
Core Messages to Reestablish: ${keyMessages}

Design a 2-week social media content recovery plan. This plan must:
- Acknowledge the crisis has occurred without reopening it
- Systematically rebuild trust through actions, not claims
- Gradually return to normal content cadence by Week 2
- Provide specific content briefs ready to assign to the team

---

## Week 1: Acknowledgement and Stabilisation (Days 1–7)

**Day 1–2: Crisis Response Content**
What to post, platform priority, tone instruction, and what NOT to post.

**Day 3–4: Demonstration of Action**
Evidence of steps being taken — not promises, actions. Include format recommendation and tone instruction.

**Day 5–7: Community Re-engagement**
Content approach for re-engaging the community. Response strategy for incoming negative, neutral, and positive comments.

---

## Week 2: Trust Rebuilding and Return to Brand Voice (Days 8–14)

**Day 8–10: Value Content Return**
Content that demonstrates brand value without direct reference to crisis. Framing instruction so it reads as authentic recovery, not pivot-and-ignore.

**Day 11–12: Social Proof and Community Validation**
Content type (testimonials, community stories, UGC), platform and format recommendation.

**Day 13–14: Brand Voice Reinstatement**
The specific content type and tone that signals the brand has returned to normal operations. The metric that will indicate this post has succeeded.

---

## What Complete Recovery Looks Like

The specific metric benchmarks (engagement rate, sentiment ratio, follower growth/loss rate) that, when reached, signal the brand has returned to pre-crisis health.

## The Single Biggest Recovery Mistake

The one approach that brands in this situation most commonly take that extends the crisis rather than ending it. Make sure ${client_name} does not make this mistake.

Rules: No hashtags. No emojis. Every content directive must be specific enough to brief a copywriter with no other context.`
      break

    default:
      return NextResponse.json({ error: `Unknown crisis tool: ${String(tool)}` }, { status: 400 })
  }

  // Inject client intelligence: brand voice, context bank wins, competitor landscape
  if (intelligenceSection) {
    prompt += `\n\n${intelligenceSection}`
  }

  try {
    const result = await callAI(prompt)

    // Persist to ai_generation_cache (fire-and-forget)
    if (HAS_DB) {
      const db = adminSupabase()
      void db.from('ai_generation_cache').insert({
        generation_type: 'ceo_crisis',
        context_id: body.client_id ?? null,
        meta: body.tool,
        output_json: { result, client_name: body.client_name, tool: body.tool },
      })
    }

    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
