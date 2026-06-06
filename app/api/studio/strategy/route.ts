import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'

interface StrategyRequest {
  client_id: string
  client_name: string
  industry?: string
  brand_voice?: string
  key_messages?: string[]
  competitors?: string[]
  platforms?: string[]
  goals?: string
  meta: 'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize'
  existing_data?: Record<string, unknown>
}

const META_PROMPTS: Record<string, (d: StrategyRequest) => string> = {
  intelligence: (d) => `You are a senior marketing strategist conducting a comprehensive business intelligence analysis.

Client: ${d.client_name}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.brand_voice ? `Brand voice: ${d.brand_voice}` : ''}
${d.competitors?.length ? `Known competitors: ${d.competitors.join(', ')}` : ''}
${d.platforms?.length ? `Active platforms: ${d.platforms.join(', ')}` : ''}
${d.goals ? `Goals: ${d.goals}` : ''}

Generate a comprehensive intelligence analysis covering:
1. Business intelligence (market position, strengths, weaknesses)
2. Market analysis (size, trends, opportunities, threats)
3. Audience psychology (who they are, what drives them, what holds them back)

Return JSON:
{
  "market_position": "Current position in the market",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "market_size": "Estimated addressable market description",
  "key_trends": ["Trend shaping this industry...", "..."],
  "opportunities": ["Opportunity 1 with brief why", "..."],
  "threats": ["Threat 1 with brief why", "..."],
  "primary_audience": {
    "demographics": "Age, location, income bracket description",
    "psychographics": "Values, lifestyle, aspirations",
    "pain_points": ["Pain 1", "Pain 2", "Pain 3"],
    "buying_triggers": ["What makes them buy...", "..."]
  },
  "swot_summary": "2-3 sentence SWOT narrative",
  "strategic_priority": "The single most important strategic priority based on this analysis"
}

Return ONLY valid JSON.`,

  positioning: (d) => `You are a brand positioning strategist. Create a positioning strategy for this client.

Client: ${d.client_name}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.brand_voice ? `Brand voice: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `Current key messages: ${d.key_messages.join(', ')}` : ''}
${d.existing_data ? `Intelligence data: ${JSON.stringify(d.existing_data).slice(0, 800)}` : ''}

Return JSON:
{
  "brand_archetype": "e.g. The Hero / The Creator / The Sage",
  "archetype_narrative": "Why this archetype fits and how to embody it",
  "positioning_statement": "For [audience] who [need], [brand] is the [category] that [benefit] because [reason to believe]",
  "uvp": "Unique value proposition in one punchy sentence",
  "competitive_differentiation": ["How we're different from competitor type 1...", "..."],
  "offer_optimization": "Key recommendation to strengthen the core offer",
  "customer_journey": {
    "awareness": "How they first encounter the brand",
    "consideration": "What makes them consider seriously",
    "conversion": "The final trigger to purchase",
    "advocacy": "What makes them recommend"
  },
  "messaging_hierarchy": {
    "primary_message": "The one message that must land every time",
    "secondary_messages": ["Supporting message 1", "Supporting message 2"],
    "proof_points": ["Proof point 1", "Proof point 2"]
  }
}

Return ONLY valid JSON.`,

  execution: (d) => `You are a content strategy director. Build a content execution system for this client.

Client: ${d.client_name}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.platforms?.length ? `Platforms: ${d.platforms.join(', ')}` : ''}
${d.brand_voice ? `Brand voice: ${d.brand_voice}` : ''}
${d.existing_data ? `Strategy so far: ${JSON.stringify(d.existing_data).slice(0, 600)}` : ''}

Return JSON:
{
  "content_pillars": [
    { "name": "Authority", "description": "...", "content_types": ["..."], "posting_frequency": "2x/week", "example_topics": ["...", "..."] },
    { "name": "Emotional", "description": "...", "content_types": ["..."], "posting_frequency": "2x/week", "example_topics": ["...", "..."] },
    { "name": "Proof", "description": "...", "content_types": ["..."], "posting_frequency": "1x/week", "example_topics": ["...", "..."] },
    { "name": "Viral", "description": "...", "content_types": ["..."], "posting_frequency": "1x/week", "example_topics": ["...", "..."] },
    { "name": "Conversion", "description": "...", "content_types": ["..."], "posting_frequency": "1x/week", "example_topics": ["...", "..."] }
  ],
  "platform_strategy": {
    "primary_platform": "Best platform for this brand and why",
    "platform_notes": { "Instagram": "...", "LinkedIn": "..." }
  },
  "posting_cadence": "Total recommended posts per week with breakdown",
  "lead_generation_system": "How content converts to leads for this specific client",
  "seasonal_moments": ["Ramadan 2027 — opportunity...", "Industry event — opportunity..."],
  "content_mix": { "video": 40, "carousel": 30, "static": 20, "text": 10 }
}

Return ONLY valid JSON.`,

  scale: (d) => `You are a growth strategist. Design a community and paid advertising strategy.

Client: ${d.client_name}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.existing_data ? `Strategy context: ${JSON.stringify(d.existing_data).slice(0, 600)}` : ''}

Return JSON:
{
  "community_architecture": {
    "loyalty_mechanism": "How to build brand loyalty beyond transactions",
    "ugc_strategy": "How to generate user-generated content",
    "participation_loops": ["Loop 1: ...", "Loop 2: ..."]
  },
  "paid_strategy": {
    "recommended_budget_split": { "awareness": 40, "retargeting": 35, "conversion": 25 },
    "creative_brief": "What ad creative to produce first",
    "targeting_approach": "How to target and which audiences to build",
    "primary_platform": "Best paid platform for this brand"
  },
  "retargeting_architecture": "3-step retargeting funnel description",
  "kpis_to_track": ["KPI 1 with target", "KPI 2 with target", "KPI 3 with target"],
  "scale_triggers": ["When to scale budget...", "When to expand to new platform..."]
}

Return ONLY valid JSON.`,

  optimize: (d) => `You are a performance optimization strategist.

Client: ${d.client_name}
${d.industry ? `Industry: ${d.industry}` : ''}
${d.existing_data ? `Full strategy data: ${JSON.stringify(d.existing_data).slice(0, 800)}` : ''}

Return JSON:
{
  "ab_test_roadmap": [
    { "test": "Hook type A vs B", "hypothesis": "...", "metric": "...", "duration": "2 weeks" },
    { "test": "...", "hypothesis": "...", "metric": "...", "duration": "..." }
  ],
  "format_experiments": ["Try long-form LinkedIn articles for authority content", "..."],
  "category_ownership_strategy": "How to own the conversation in this niche within 12 months",
  "iteration_roadmap": {
    "month_1_3": "Focus and actions",
    "month_4_6": "Focus and actions",
    "month_7_12": "Focus and actions"
  },
  "performance_benchmarks": {
    "instagram_er_target": "4-6%",
    "linkedin_er_target": "2-4%",
    "monthly_reach_growth": "15-20%"
  },
  "quarterly_review_triggers": ["Review if ER drops below X...", "Pivot if reach growth < Y%..."]
}

Return ONLY valid JSON.`,
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: StrategyRequest
  try {
    body = await req.json() as StrategyRequest
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.client_name || !body.meta) {
    return NextResponse.json({ error: 'client_name and meta are required' }, { status: 400 })
  }

  const promptFn = META_PROMPTS[body.meta]
  if (!promptFn) {
    return NextResponse.json({ error: 'Invalid meta phase' }, { status: 400 })
  }

  let prompt = promptFn(body)
  let raw = ''

  // Inject client intelligence
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const block = await buildClientIntelligenceBlock(body.client_id, 'strategy', db).catch(() => '')
      if (block) prompt = prompt + block
    }
  }

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
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
    return NextResponse.json({ error: 'Failed to parse strategy from AI', raw }, { status: 502 })
  }

  let result: unknown
  try {
    result = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  return NextResponse.json({ data: result, meta: body.meta })
}
