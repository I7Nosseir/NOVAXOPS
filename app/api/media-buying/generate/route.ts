import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

interface CampaignInput {
  platform: string
  objective: string
  budget: string
  startDate?: string
  endDate?: string
  targetAudience?: string
  notes?: string
}

// CPM benchmarks by platform (USD) — used for estimation context
const CPM_BENCHMARKS: Record<string, { cpm: number; ctr: number; cpc: number }> = {
  'Meta Ads':     { cpm: 12.00, ctr: 1.1,  cpc: 1.10 },
  'TikTok Ads':   { cpm: 8.50,  ctr: 0.9,  cpc: 0.95 },
  'Google Ads':   { cpm: 5.00,  ctr: 2.0,  cpc: 0.25 },
  'Snapchat Ads': { cpm: 3.50,  ctr: 0.6,  cpc: 0.58 },
  'LinkedIn Ads': { cpm: 35.00, ctr: 0.8,  cpc: 4.37 },
  'YouTube Ads':  { cpm: 9.00,  ctr: 0.4,  cpc: 2.25 },
}

// Currency conversion factors relative to USD (approximate)
const CURRENCY_FACTOR: Record<string, number> = {
  USD: 1,
  SAR: 3.75,
  AED: 3.67,
  EGP: 48.5,
  KWD: 0.31,
  EUR: 0.92,
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function estimateKpis(campaign: CampaignInput, currency: string): { metric: string; value: string; basis: string }[] {
  const bench = CPM_BENCHMARKS[campaign.platform] ?? { cpm: 10, ctr: 1.0, cpc: 1.0 }
  const factor = CURRENCY_FACTOR[currency] ?? 1
  const budgetUsd = Number(campaign.budget) / factor
  const cpmUsd = bench.cpm
  const impressions = Math.round((budgetUsd / cpmUsd) * 1000)
  const clicks = Math.round(impressions * (bench.ctr / 100))
  const cpc = clicks > 0 ? (Number(campaign.budget) / clicks).toFixed(2) : '—'
  const reach = Math.round(impressions * 0.75)

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)

  const kpis: { metric: string; value: string; basis: string }[] = [
    { metric: 'Estimated Impressions', value: fmt(impressions), basis: `Based on ${campaign.platform} avg CPM of ${currency} ${(cpmUsd * factor).toFixed(2)}` },
    { metric: 'Estimated Reach', value: fmt(reach), basis: `~75% of impressions (unique people)` },
    { metric: 'Estimated Clicks', value: fmt(clicks), basis: `${bench.ctr}% CTR benchmark for ${campaign.platform}` },
    { metric: 'Cost Per Click', value: `${currency} ${cpc}`, basis: `Budget / estimated clicks` },
    { metric: 'CPM', value: `${currency} ${(cpmUsd * factor).toFixed(2)}`, basis: `Industry benchmark for ${campaign.platform}` },
  ]
  return kpis
}

export async function POST(req: NextRequest) {
  let body: {
    clientId?: string
    clientName?: string
    currency?: string
    period?: string
    campaigns?: CampaignInput[]
    images?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { clientName = 'Client', currency = 'SAR', period = '', campaigns = [], images = [] } = body

  if (!campaigns.length || campaigns.length < 2) {
    return NextResponse.json({ error: 'At least 2 campaign options required' }, { status: 400 })
  }

  // Pre-compute KPI estimates for each campaign
  const kpiEstimates = campaigns.map(c => estimateKpis(c, currency))

  const campaignDescriptions = campaigns.map((c, i) => {
    const k = kpiEstimates[i]
    return `Option ${i + 1}:
  Platform: ${c.platform}
  Objective: ${c.objective}
  Budget: ${currency} ${Number(c.budget).toLocaleString()}
  ${c.startDate && c.endDate ? `Flight: ${c.startDate} to ${c.endDate}` : ''}
  ${c.targetAudience ? `Target Audience: ${c.targetAudience}` : ''}
  ${c.notes ? `Notes: ${c.notes}` : ''}
  KPI Estimates:
  ${k.map(kpi => `  - ${kpi.metric}: ${kpi.value}`).join('\n')}`
  }).join('\n\n')

  const prompt = `You are a senior media buying strategist at NOVAX, a creative marketing agency.
Analyse these ${campaigns.length} paid media campaign options for ${clientName} during ${period || 'the campaign period'}.
Currency: ${currency}
${images.length > 0 ? `Creative references: ${images.length} images provided.` : ''}

CAMPAIGN OPTIONS:
${campaignDescriptions}

CPM BENCHMARKS USED FOR ESTIMATES:
${Object.entries(CPM_BENCHMARKS).map(([p, b]) => `${p}: CPM $${b.cpm} USD, CTR ${b.ctr}%, CPC $${b.cpc} USD`).join('\n')}

STRICT RULES:
- No hashtags, no emojis
- All figures must be in ${currency} (already converted in KPI estimates above)
- Do not recommend "consider X" or "you should" — state facts and analysis only
- Be specific with numbers. Reference the KPI estimates in your analysis.

Return a JSON object with this exact structure:
{
  "executiveSummary": "2–3 sentence plain-language summary of the budget allocation landscape and which option offers the best value",
  "campaigns": [
    {
      "optionIndex": 0,
      "platform": "Meta Ads",
      "objective": "Brand Awareness",
      "budget": "10000",
      "currency": "${currency}",
      "headline": "One compelling sentence summarising this option's value proposition",
      "rationale": "2–3 sentences explaining what this option achieves and why the numbers make sense for the objective",
      "kpis": [
        { "metric": "Estimated Impressions", "value": "830K", "basis": "Based on Meta CPM benchmark" },
        { "metric": "Estimated Reach", "value": "620K", "basis": "75% of impressions (unique accounts)" },
        { "metric": "Estimated Clicks", "value": "9,100", "basis": "1.1% CTR benchmark" },
        { "metric": "Cost Per Click", "value": "${currency} 1.10", "basis": "Budget / estimated clicks" },
        { "metric": "CPM", "value": "${currency} 12.00", "basis": "Industry benchmark" }
      ],
      "strengths": ["Specific strength 1", "Specific strength 2"],
      "considerations": ["Specific watch-out 1", "Specific watch-out 2"],
      "recommended": false
    }
  ],
  "mediaBuyerGuide": [
    {
      "title": "Campaign Setup",
      "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"]
    },
    {
      "title": "Audience Configuration",
      "steps": ["Step 1", "Step 2"]
    },
    {
      "title": "Creative Requirements",
      "steps": ["Step 1", "Step 2"]
    },
    {
      "title": "Optimisation Schedule",
      "steps": ["Step 1", "Step 2"]
    },
    {
      "title": "Reporting & KPI Tracking",
      "steps": ["Step 1", "Step 2"]
    }
  ]
}

IMPORTANT:
- Exactly one campaign must have "recommended": true (the one with best budget efficiency for its objective)
- The mediaBuyerGuide must have 4–6 sections covering: setup, audience, creative, optimisation, reporting
- Each guide section must have 3–5 specific, actionable steps for the media buyer
- Return ONLY the JSON — no markdown, no code blocks, no extra text`

  let raw = ''
  try {
    raw = await callGemini(prompt)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI generation failed' }, { status: 503 })
  }

  // Parse JSON — strip markdown code blocks if present
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  let parsed: {
    executiveSummary?: string
    campaigns?: {
      optionIndex: number
      platform: string
      objective: string
      budget: string
      currency: string
      headline: string
      rationale: string
      kpis: { metric: string; value: string; basis: string }[]
      strengths: string[]
      considerations: string[]
      recommended: boolean
    }[]
    mediaBuyerGuide?: { title: string; steps: string[] }[]
  }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI returned malformed JSON — please retry' }, { status: 500 })
  }

  // Merge pre-computed KPIs with AI output (AI KPIs take priority if present)
  const mergedCampaigns = (parsed.campaigns ?? []).map((c, i) => ({
    ...c,
    kpis: c.kpis?.length ? c.kpis : (kpiEstimates[i] ?? []),
  }))

  return NextResponse.json({
    result: {
      clientName,
      period,
      currency,
      campaigns: mergedCampaigns,
      mediaBuyerGuide: parsed.mediaBuyerGuide ?? [],
      executiveSummary: parsed.executiveSummary ?? '',
    },
  })
}
