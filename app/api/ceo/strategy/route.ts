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

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

async function callAI(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
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
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface QuarterlyStrategy {
  goals: string
  themes: string
  kpis: string
  notes: string
}

interface MonthlyUpdate {
  content_summary: string
  what_worked: string
  what_didnt: string
  posts_published: number
  notes: string
}

interface StrategyRequest {
  tool: 'market_position' | 'campaign_concepts' | 'content_audit' | 'quarterly_narrative'
  client_id?: string
  client_name?: string
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
      viral_patterns?: string[]
      failure_patterns?: string[]
      strengths?: string[]
      weaknesses?: string[]
      opportunities?: string[]
      threats?: string[]
      market_position?: string
      growth_score?: number
      engagement_trend?: string
    }
    is_in_crisis?: boolean
    status?: string
  }
  brief?: string
  period?: string
  quarterly_strategy?: QuarterlyStrategy
  monthly_update?: MonthlyUpdate
  context_year?: number
  context_quarter?: number
  context_month?: number
}

function buildContextBlock(
  qs: QuarterlyStrategy | undefined,
  mu: MonthlyUpdate | undefined,
  year?: number,
  quarter?: number,
  month?: number,
): string {
  if (!qs && !mu) return ''
  const lines: string[] = []
  if (qs) {
    const qLabel = quarter && year ? `Q${quarter} ${year}` : 'Current Quarter'
    lines.push(`QUARTERLY STRATEGIC CONTEXT (${qLabel}):`)
    if (qs.goals)  lines.push(`Goals: ${qs.goals}`)
    if (qs.themes) lines.push(`Content Themes: ${qs.themes}`)
    if (qs.kpis)   lines.push(`KPIs / Success Metrics: ${qs.kpis}`)
    if (qs.notes)  lines.push(`Additional Context: ${qs.notes}`)
  }
  if (mu) {
    const mLabel = month && year ? `${MONTH_NAMES[month - 1]} ${year}` : 'Current Month'
    if (lines.length) lines.push('')
    lines.push(`MOST RECENT MONTH PERFORMANCE (${mLabel}):`)
    if (mu.content_summary)  lines.push(`Content Published: ${mu.content_summary}`)
    if (mu.what_worked)      lines.push(`What Worked: ${mu.what_worked}`)
    if (mu.what_didnt)       lines.push(`What Underperformed: ${mu.what_didnt}`)
    if (mu.posts_published)  lines.push(`Posts Published: ${mu.posts_published}`)
    if (mu.notes)            lines.push(`Additional Observations: ${mu.notes}`)
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'ceo']); if ('error' in auth) return auth.error
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No AI provider configured.' }, { status: 503 })
  }

  let body: StrategyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const {
    tool, client_name, client_data, brief, period,
    quarterly_strategy, monthly_update,
    context_year, context_quarter, context_month,
  } = body

  // Fetch client intelligence + competitor context in parallel (non-blocking)
  let intelligenceSection = ''
  if (HAS_DB && body.client_id) {
    const db = adminSupabase()
    const [intelBlock, compBlock] = await Promise.all([
      buildClientIntelligenceBlock(body.client_id, 'ceo_strategy', db).catch(() => ''),
      buildCompetitorContextBlock(body.client_id, db).catch(() => ''),
    ])
    intelligenceSection = [intelBlock, compBlock].filter(Boolean).join('\n')
  }

  const clientName = client_name ?? 'the client'
  const industry = client_data?.brand_identity?.industry ?? client_data?.industry ?? 'unspecified'
  const brandVoice = client_data?.brand_identity?.tone_of_voice ?? 'professional'
  const audience = client_data?.brand_identity?.target_audience ?? 'general audience'
  const keyMessages = client_data?.brand_identity?.key_messages?.join('; ') ?? 'not specified'
  const competitors = client_data?.competitor_context?.join(', ') ?? 'not specified'
  const perf = client_data?.performance_intel

  const contextBlock = buildContextBlock(
    quarterly_strategy, monthly_update,
    context_year, context_quarter, context_month,
  )

  let prompt = ''

  switch (tool) {
    case 'market_position':
      prompt = `You are a senior strategic marketing consultant with 20+ years of experience advising category-leading brands. You think with the precision of McKinsey and the creative intuition of a seasoned CMO.

## Client Intelligence Brief

Client: ${clientName}
Industry: ${industry}
Target Audience: ${audience}
Brand Voice: ${brandVoice}
Key Messages: ${keyMessages}
Known Competitors: ${competitors}
Current Market Position: ${perf?.market_position ?? 'not assessed'}
Growth Score: ${perf?.growth_score != null ? `${perf.growth_score}/10` : 'not assessed'}
Engagement Trend: ${perf?.engagement_trend ?? 'not assessed'}
Strengths: ${perf?.strengths?.join('; ') ?? 'not assessed'}
Weaknesses: ${perf?.weaknesses?.join('; ') ?? 'not assessed'}
Opportunities: ${perf?.opportunities?.join('; ') ?? 'not assessed'}
Threats: ${perf?.threats?.join('; ') ?? 'not assessed'}
${contextBlock ? '\n' + contextBlock : ''}

Deliver a rigorous market position analysis structured as follows:

## Competitive Position Assessment

Where does ${clientName} sit on the Value vs. Perception matrix right now? Be precise — name the quadrant and the specific evidence from the data above that places them there.

## Strategic Differentiation Analysis

Apply the Blue Ocean Strategy framework. What do all competitors in the ${industry} space compete on identically? What is the one axis none of them own? How does ${clientName} currently exploit or miss this whitespace?

## Brand Equity Audit

Assess ${clientName}'s brand equity across three dimensions: Awareness Architecture (how known vs. how understood), Preference Driver (why audiences choose them over competitors), and Loyalty Depth (signals of repeat vs. transactional relationships). Rate each Low / Medium / High and explain why.

## Positioning Gap Analysis

Identify the single most significant positioning gap — the space between who ${clientName} says they are and who their audience perceives them to be. Quantify the risk of this gap if left unaddressed.

## Strategic Positioning Statement

Draft a one-paragraph internal positioning statement using the format:
"For [specific audience segment], [client name] is the only [category] brand that [unique benefit] because [single reason to believe]."
This is a strategic tool, not ad copy — it must be defensible, specific, and based on evidence in this brief.

## The CEO Take

One paragraph. No hedging. What is the single most important thing the CEO needs to know about where this brand stands right now, and what happens if the current trajectory continues unchanged?

Rules: No hashtags. No emojis. No bullet-point padding. Write in executive prose.`
      break

    case 'campaign_concepts':
      if (!brief) {
        return NextResponse.json({ error: 'Brief is required for campaign concepts.' }, { status: 400 })
      }
      prompt = `You are a Creative Director and Brand Strategist at a world-class social media agency. You have built award-winning campaigns for brands across the ${industry} sector. You think in cultural tension, not just messaging.

## Campaign Brief

${brief}

Target Audience: ${audience}
Brand Voice: ${brandVoice}
Key Messages: ${keyMessages}
Client: ${clientName}
Industry: ${industry}
${contextBlock ? '\n' + contextBlock : ''}

Generate three distinctly different campaign concepts. Each concept must be strategically grounded, culturally intelligent, and immediately executable. They must differ not just in tone but in fundamental strategic logic.

---

## Concept 1 — [Give This Concept a Powerful 3–5 Word Campaign Name]

### Strategic Logic
What cultural tension, human truth, or market whitespace does this concept exploit? Name the insight precisely — not a category observation, but a specific human behaviour or belief that this campaign leverages.

### Campaign Platform
One sentence: the single idea that everything else hangs off. This is the thought, not the tagline.

### Narrative Architecture
How does the campaign unfold across a 4-week content arc? What happens in Week 1 (attention), Week 2 (engagement), Week 3 (conversion), Week 4 (loyalty)? Be specific about the type of content and the emotional journey.

### Hero Content Concept
Describe the single piece of content that would anchor this campaign — the one asset that, if it went viral, would define the campaign. Platform, format, opening scene, and the moment that makes people stop scrolling.

### Why This Will Work
The specific psychological mechanism (Cialdini principle, Berger STEPPS element, Kahneman system) this concept activates, and why that mechanism is particularly powerful for ${audience}.

---

## Concept 2 — [Give This Concept a Powerful 3–5 Word Campaign Name]

[Same structure as Concept 1]

---

## Concept 3 — [Give This Concept a Powerful 3–5 Word Campaign Name]

[Same structure as Concept 1]

---

## Concept Comparison Matrix

Brief table comparing the three concepts across: Risk Level (1–5), Cultural Resonance (1–5), Production Complexity (1–5), Expected Reach, Expected Engagement.

## CEO Recommendation

Which concept to greenlight, and the single most important reason why. No hedging.

Rules: No hashtags. No emojis. Executive-grade writing throughout.`
      break

    case 'content_audit':
      prompt = `You are a Chief Content Officer conducting a quarterly content strategy performance review. You apply data science, behavioural psychology, and platform algorithm expertise to audit content strategy effectiveness.

## Client Intelligence

Client: ${clientName}
Industry: ${industry}
Audience: ${audience}
Brand Voice: ${brandVoice}
Key Messages: ${keyMessages}
Period Under Review: ${period ?? 'last quarter'}
Viral Patterns Observed: ${perf?.viral_patterns?.join('; ') ?? 'not assessed'}
Failure Patterns Observed: ${perf?.failure_patterns?.join('; ') ?? 'not assessed'}
Engagement Trend: ${perf?.engagement_trend ?? 'not assessed'}
${contextBlock ? '\n' + contextBlock : ''}

Deliver a rigorous content strategy audit structured as follows:

## Strategy Alignment Score

Rate how well the content strategy is aligned to the stated brand positioning and quarterly goals. Score 0–100 with a calibrated verdict: 85+ = highly aligned, 60–85 = partially aligned, below 60 = misaligned. Support the score with specific evidence from the data above.

## Content Pillar Performance Analysis

Break down performance across the three standard pillars: Value/Education, Brand/Storytelling, Direct Promotion. Which pillar is overrepresented? Which is underperforming relative to its strategic purpose? What is the ideal rebalance for ${clientName}?

## Audience Resonance Audit

Based on the patterns observed, which audience segment is ${clientName} actually reaching versus the intended target (${audience})? If there is a gap, what is causing it and what content shift would close it?

## Content Format Effectiveness

Which formats are driving the highest engagement per impression? Which formats are consuming production resource without proportional return? Specific recommendation on format mix for the next quarter.

## Message Penetration Assessment

Are the key messages (${keyMessages}) actually being communicated through the content? Which messages are landing? Which are absent or diluted? What is the strategic risk of continued message dilution?

## 90-Day Strategic Pivot Recommendations

Three specific, prioritised recommendations. Each must include: the change, the reasoning, the expected metric impact, and the implementation timeline. Prioritised by highest expected ROI.

## What to Stop Immediately

The single content type, theme, or approach that should be discontinued now, with the reason why continuing it is actively harmful to the brand.

Rules: No hashtags. No emojis. No vague observations — every statement must be evidence-based or clearly marked as an inference.`
      break

    case 'quarterly_narrative':
      prompt = `You are a strategic communications advisor to the CEO of a social media agency. You have written executive narratives for Fortune 500 brands. You understand that a CEO narrative must be simultaneously honest, forward-looking, and confidence-instilling.

## Client Context

Client: ${clientName}
Industry: ${industry}
Audience: ${audience}
Key Messages: ${keyMessages}
Current Growth Score: ${perf?.growth_score != null ? `${perf.growth_score}/10` : 'not formally assessed'}
Engagement Trend: ${perf?.engagement_trend ?? 'not formally assessed'}
Market Position: ${perf?.market_position ?? 'not formally assessed'}
Strategic Opportunities: ${perf?.opportunities?.join('; ') ?? 'not assessed'}
Active Challenges: ${perf?.threats?.join('; ') ?? 'not assessed'}
Brand Strengths: ${perf?.strengths?.join('; ') ?? 'not assessed'}
Client Status: ${client_data?.status ?? 'active'}${client_data?.is_in_crisis ? ' (IN CRISIS MODE)' : ''}
${contextBlock ? '\n' + contextBlock : ''}

Produce a CEO-ready quarterly narrative for the ${clientName} account.

## Quarterly Executive Summary

Three paragraphs. Paragraph 1: Where we started this quarter and what the strategic intent was. Paragraph 2: What the data tells us — what worked, what did not, and the honest interpretation (no spin). Paragraph 3: What this means for where we go next — the one insight that changes how we approach this account.

## The Headline Result

One sentence. The single most important thing that happened this quarter for ${clientName}, expressed as a strategic outcome, not a metric. This is the sentence the CEO reads at the top of a board slide.

## Strategic Narrative for Client Communication

A polished 2-paragraph narrative the CEO can use directly in a client-facing quarterly review. Tone: confident, transparent, forward-looking. Acknowledges where performance fell short of targets without being defensive. Frame challenges as informed pivots, not failures.

## The 90-Day Strategic Commitment

Three specific strategic commitments for the next quarter — not tactics, not KPIs, but the directional choices the team is committing to. Each should be a single clear sentence that could appear on a strategy slide.

## Risk Disclosure (Internal Only)

One paragraph, maximum 4 sentences. The honest assessment of the biggest risk to ${clientName}'s growth trajectory next quarter and what the team needs to watch. This section is for internal CEO use only — direct, no softening.

Rules: No hashtags. No emojis. Executive prose only — no bullet points except where explicitly structured above. This must read like a McKinsey partner wrote it.`
      break

    default:
      return NextResponse.json({ error: `Unknown strategy tool: ${String(tool)}` }, { status: 400 })
  }

  // Inject client intelligence context (context bank, AI feedback, Pinterest learning, competitor intel)
  if (intelligenceSection) {
    prompt += `\n\n${intelligenceSection}`
  }

  try {
    const result = await callAI(prompt)

    // Persist to ai_generation_cache (fire-and-forget)
    if (HAS_DB) {
      const db = adminSupabase()
      void db.from('ai_generation_cache').insert({
        generation_type: 'ceo_strategy',
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
