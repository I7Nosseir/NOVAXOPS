import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

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
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: StrategyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { tool, client_name, client_data, brief, period } = body

  const clientName = client_name ?? 'the client'
  const industry = client_data?.brand_identity?.industry ?? client_data?.industry ?? 'unspecified'
  const brandVoice = client_data?.brand_identity?.tone_of_voice ?? 'professional'
  const audience = client_data?.brand_identity?.target_audience ?? 'general audience'
  const keyMessages = client_data?.brand_identity?.key_messages?.join('; ') ?? 'not specified'
  const competitors = client_data?.competitor_context?.join(', ') ?? 'not specified'
  const perf = client_data?.performance_intel

  let prompt = ''

  switch (tool) {
    case 'market_position':
      prompt = `You are a senior strategic marketing consultant with 20+ years of experience advising category-leading brands. You think with the precision of McKinsey and the creative intuition of a seasoned CMO.

CLIENT INTELLIGENCE BRIEF
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

Deliver a rigorous market position analysis structured as follows:

**COMPETITIVE POSITION ASSESSMENT**
Where does ${clientName} sit on the Value vs. Perception matrix right now? Be precise — name the quadrant and the specific evidence from the data above that places them there.

**STRATEGIC DIFFERENTIATION ANALYSIS**
Apply the Blue Ocean Strategy framework. What do all competitors in the ${industry} space compete on identically? What is the one axis none of them own? How does ${clientName} currently exploit or miss this whitespace?

**BRAND EQUITY AUDIT**
Assess ${clientName}'s brand equity across three dimensions: Awareness Architecture (how known vs. how understood), Preference Driver (why audiences choose them over competitors), and Loyalty Depth (signals of repeat vs. transactional relationships). Rate each Low / Medium / High and explain why.

**POSITIONING GAP ANALYSIS**
Identify the single most significant positioning gap — the space between who ${clientName} says they are and who their audience perceives them to be. Quantify the risk of this gap if left unaddressed.

**STRATEGIC POSITIONING STATEMENT (Internal)**
Draft a one-paragraph internal positioning statement using the format:
"For [specific audience segment], [client name] is the only [category] brand that [unique benefit] because [single reason to believe]."
This is a strategic tool, not ad copy — it must be defensible, specific, and based on evidence in this brief.

**THE CEO TAKE**
One paragraph. No hedging. What is the single most important thing the CEO needs to know about where this brand stands right now, and what happens if the current trajectory continues unchanged?

Rules: No hashtags. No emojis. No bullet-point padding. Write in executive prose.`
      break

    case 'campaign_concepts':
      if (!brief) {
        return NextResponse.json({ error: 'Brief is required for campaign concepts.' }, { status: 400 })
      }
      prompt = `You are a Creative Director and Brand Strategist at a world-class social media agency. You have built award-winning campaigns for brands across the ${industry} sector. You think in cultural tension, not just messaging.

CAMPAIGN BRIEF
${brief}

TARGET AUDIENCE: ${audience}
BRAND VOICE: ${brandVoice}
KEY MESSAGES: ${keyMessages}
CLIENT: ${clientName}
INDUSTRY: ${industry}

Generate three distinctly different campaign concepts. Each concept must be strategically grounded, culturally intelligent, and immediately executable. They must differ not just in tone but in fundamental strategic logic.

---

CONCEPT 1 — [GIVE THIS CONCEPT A POWERFUL 3-5 WORD CAMPAIGN NAME]

**Strategic Logic**
What cultural tension, human truth, or market whitespace does this concept exploit? Name the insight precisely — not a category observation, but a specific human behaviour or belief that this campaign leverages.

**Campaign Platform**
One sentence: the single idea that everything else hangs off. This is the thought, not the tagline.

**Narrative Architecture**
How does the campaign unfold across a 4-week content arc? What happens in Week 1 (attention), Week 2 (engagement), Week 3 (conversion), Week 4 (loyalty)? Be specific about the type of content and the emotional journey.

**Hero Content Concept**
Describe the single piece of content that would anchor this campaign — the one asset that, if it went viral, would define the campaign. Platform, format, opening scene, and the moment that makes people stop scrolling.

**Why This Will Work**
The specific psychological mechanism (Cialdini principle, Berger STEPPS element, Kahneman system) this concept activates, and why that mechanism is particularly powerful for ${audience}.

---

CONCEPT 2 — [GIVE THIS CONCEPT A POWERFUL 3-5 WORD CAMPAIGN NAME]

[Same structure as Concept 1]

---

CONCEPT 3 — [GIVE THIS CONCEPT A POWERFUL 3-5 WORD CAMPAIGN NAME]

[Same structure as Concept 1]

---

**CONCEPT COMPARISON MATRIX**
Brief table comparing the three concepts across: Risk Level (1-5), Cultural Resonance (1-5), Production Complexity (1-5), Expected Reach, Expected Engagement.

**CEO RECOMMENDATION**
Which concept to greenlight, and the single most important reason why. No hedging.

Rules: No hashtags. No emojis. Executive-grade writing throughout.`
      break

    case 'content_audit':
      prompt = `You are a Chief Content Officer conducting a quarterly content strategy performance review. You apply data science, behavioural psychology, and platform algorithm expertise to audit content strategy effectiveness.

CLIENT INTELLIGENCE
Client: ${clientName}
Industry: ${industry}
Audience: ${audience}
Brand Voice: ${brandVoice}
Key Messages: ${keyMessages}
Period Under Review: ${period ?? 'last quarter'}
Viral Patterns Observed: ${perf?.viral_patterns?.join('; ') ?? 'not assessed'}
Failure Patterns Observed: ${perf?.failure_patterns?.join('; ') ?? 'not assessed'}
Engagement Trend: ${perf?.engagement_trend ?? 'not assessed'}
Content Gaps Identified: ${Array.isArray(perf) ? '' : (perf as typeof perf & { content_gap?: string[] })?.content_gap?.join('; ') ?? 'not assessed'}

Deliver a rigorous content strategy audit structured as follows:

**STRATEGY ALIGNMENT SCORE**
Rate how well the content strategy is aligned to the stated brand positioning. Score 0-100 with a calibrated verdict: 85+ = highly aligned, 60-85 = partially aligned, below 60 = misaligned. Support the score with specific evidence from the patterns above.

**CONTENT PILLAR PERFORMANCE ANALYSIS**
Break down performance across the three standard pillars: Value/Education, Brand/Storytelling, Direct Promotion. Which pillar is overrepresented? Which is underperforming relative to its strategic purpose? What is the ideal rebalance for ${clientName}?

**AUDIENCE RESONANCE AUDIT**
Based on the patterns observed, which audience segment is ${clientName} actually reaching versus the intended target (${audience})? If there is a gap, what is causing it and what content shift would close it?

**CONTENT FORMAT EFFECTIVENESS**
Which formats are driving the highest engagement per impression? Which formats are consuming production resource without proportional return? Specific recommendation on format mix for the next quarter.

**MESSAGE PENETRATION ASSESSMENT**
Are the key messages (${keyMessages}) actually being communicated through the content? Which messages are landing? Which are absent or diluted? What is the strategic risk of continued message dilution?

**90-DAY STRATEGIC PIVOT RECOMMENDATIONS**
Three specific, prioritised recommendations. Each must include: the change, the reasoning, the expected metric impact, and the implementation timeline. Prioritised by highest expected ROI.

**WHAT TO STOP IMMEDIATELY**
The single content type, theme, or approach that should be discontinued now, with the reason why continuing it is actively harmful to the brand.

Rules: No hashtags. No emojis. No vague observations — every statement must be evidence-based or clearly marked as an inference.`
      break

    case 'quarterly_narrative':
      prompt = `You are a strategic communications advisor to the CEO of a social media agency. You have written executive narratives for Fortune 500 brands. You understand that a CEO narrative must be simultaneously honest, forward-looking, and confidence-instilling.

CLIENT CONTEXT
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

Produce a CEO-ready quarterly narrative for the ${clientName} account. This is a strategic communication tool — it will be used by the CEO to brief senior stakeholders, frame the quarterly results, and set direction for the next quarter.

**QUARTERLY EXECUTIVE SUMMARY**
Three paragraphs. Paragraph 1: Where we started this quarter and what the strategic intent was. Paragraph 2: What the data tells us — what worked, what did not, and the honest interpretation (no spin). Paragraph 3: What this means for where we go next — the one insight that changes how we approach this account.

**THE HEADLINE RESULT**
One sentence. The single most important thing that happened this quarter for ${clientName}, expressed as a strategic outcome, not a metric. This is the sentence the CEO reads at the top of a board slide.

**STRATEGIC NARRATIVE FOR CLIENT COMMUNICATION**
A polished 2-paragraph narrative the CEO can use directly in a client-facing quarterly review. Tone: confident, transparent, forward-looking. Acknowledges where performance fell short of targets without being defensive. Frame challenges as informed pivots, not failures.

**THE 90-DAY STRATEGIC COMMITMENT**
Three specific strategic commitments for the next quarter — not tactics, not KPIs, but the directional choices the team is committing to. Each should be a single clear sentence that could appear on a strategy slide.

**RISK DISCLOSURE (INTERNAL ONLY)**
One paragraph, maximum 4 sentences. The honest assessment of the biggest risk to ${clientName}'s growth trajectory next quarter and what the team needs to watch. This section is for internal CEO use only — direct, no softening.

Rules: No hashtags. No emojis. Executive prose only — no bullet points except where explicitly structured above. This must read like a McKinsey partner wrote it.`
      break

    default:
      return NextResponse.json({ error: `Unknown strategy tool: ${String(tool)}` }, { status: 400 })
  }

  try {
    const result = await callGemini(prompt)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
