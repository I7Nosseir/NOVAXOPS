// ============================================================
// POST /api/studio/media-buying/generate
// 10-step media buying plan pipeline.
// Returns a MediaBuyingPlan ready for PDF rendering.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson } from '@/lib/gemini'
import type { MediaBuyingPlan } from '@/lib/media-buying-pdf'

export const maxDuration = 180

interface GenerateBody {
  client_name: string
  client_handle?: string
  industry: string
  market?: string
  objective: string
  platforms: string[]
  option1_budget: number
  option2_budget: number
  additional_context?: string
}

// Saudi market benchmark CPL (cost per lead) by platform and industry type
const BENCHMARKS: Record<string, Record<string, { cpl_min: number; cpl_max: number; metric: string }>> = {
  dental: {
    'Instagram':   { cpl_min: 20, cpl_max: 35,  metric: 'Messages' },
    'Snapchat':    { cpl_min: 30, cpl_max: 50,   metric: 'Messages' },
    'TikTok':      { cpl_min: 35, cpl_max: 65,   metric: 'Messages' },
    'Google Ads':  { cpl_min: 12, cpl_max: 22,   metric: 'Calls' },
    'Facebook':    { cpl_min: 18, cpl_max: 32,   metric: 'Messages' },
  },
  aesthetic: {
    'Instagram':   { cpl_min: 18, cpl_max: 32,  metric: 'Messages' },
    'Snapchat':    { cpl_min: 25, cpl_max: 45,  metric: 'Messages' },
    'TikTok':      { cpl_min: 30, cpl_max: 55,  metric: 'Messages' },
    'Google Ads':  { cpl_min: 10, cpl_max: 20,  metric: 'Calls' },
    'Facebook':    { cpl_min: 16, cpl_max: 28,  metric: 'Messages' },
  },
  ecommerce: {
    'Instagram':   { cpl_min: 8,  cpl_max: 18,  metric: 'Messages' },
    'Snapchat':    { cpl_min: 12, cpl_max: 25,  metric: 'Messages' },
    'TikTok':      { cpl_min: 10, cpl_max: 22,  metric: 'Messages' },
    'Google Ads':  { cpl_min: 5,  cpl_max: 12,  metric: 'Clicks' },
    'Facebook':    { cpl_min: 7,  cpl_max: 16,  metric: 'Messages' },
  },
  default: {
    'Instagram':   { cpl_min: 20, cpl_max: 38,  metric: 'Messages' },
    'Snapchat':    { cpl_min: 28, cpl_max: 48,  metric: 'Messages' },
    'TikTok':      { cpl_min: 32, cpl_max: 58,  metric: 'Messages' },
    'Google Ads':  { cpl_min: 14, cpl_max: 24,  metric: 'Calls' },
    'Facebook':    { cpl_min: 18, cpl_max: 30,  metric: 'Messages' },
  },
}

function detectIndustryBenchmarks(industry: string) {
  const lower = industry.toLowerCase()
  if (lower.includes('dent')) return BENCHMARKS.dental
  if (lower.includes('aesth') || lower.includes('cosm') || lower.includes('skin') || lower.includes('clinic')) return BENCHMARKS.aesthetic
  if (lower.includes('ecomm') || lower.includes('store') || lower.includes('shop')) return BENCHMARKS.ecommerce
  return BENCHMARKS.default
}

function allocateBudget(budget: number, platforms: string[]): Array<{ platform: string; amount: number }> {
  // Weights by typical platform performance role
  const weights: Record<string, number> = {
    'Instagram':  0.40,
    'Google Ads': 0.22,
    'Snapchat':   0.20,
    'TikTok':     0.18,
    'Facebook':   0.25,
    'YouTube':    0.20,
    'X':          0.15,
  }
  const total = platforms.reduce((s, p) => s + (weights[p] ?? 0.2), 0)
  const raw = platforms.map(p => ({
    platform: p,
    amount: Math.round((budget * (weights[p] ?? 0.2)) / total / 100) * 100,
  }))
  // Adjust last item so total is exact
  const allocated = raw.reduce((s, r) => s + r.amount, 0)
  if (raw.length > 0) raw[0].amount += budget - allocated
  return raw
}

function forecastLeads(
  allocation: Array<{ platform: string; amount: number }>,
  benchmarks: Record<string, { cpl_min: number; cpl_max: number; metric: string }>,
) {
  return allocation.map(a => {
    const bm = benchmarks[a.platform] ?? { cpl_min: 20, cpl_max: 40, metric: 'Messages' }
    return {
      platform: a.platform,
      metric: bm.metric,
      min: Math.max(1, Math.floor(a.amount / bm.cpl_max)),
      max: Math.max(1, Math.floor(a.amount / bm.cpl_min)),
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody
    const {
      client_name,
      client_handle,
      industry,
      market = 'Saudi Arabia',
      objective,
      platforms,
      option1_budget,
      option2_budget,
      additional_context,
    } = body

    if (!client_name || !industry || !objective || !platforms?.length || !option1_budget || !option2_budget) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Deterministic budget math (Steps 7–8)
    const benchmarks    = detectIndustryBenchmarks(industry)
    const alloc1        = allocateBudget(option1_budget, platforms)
    const alloc2        = allocateBudget(option2_budget, platforms)
    const results1      = forecastLeads(alloc1, benchmarks)
    const results2      = forecastLeads(alloc2, benchmarks)
    const totalLeads1   = { min: results1.reduce((s, r) => s + r.min, 0), max: results1.reduce((s, r) => s + r.max, 0) }
    const totalLeads2   = { min: results2.reduce((s, r) => s + r.min, 0), max: results2.reduce((s, r) => s + r.max, 0) }

    // ─── AI: narrative, avatars, key factors ─────────────────

    const prompt = `You are a senior media buying strategist specialising in digital advertising in ${market}.
Your task: generate a comprehensive media buying plan for a client, following this exact 10-step methodology:
1. Market understanding — demand, consumer behavior, competitive landscape
2. Customer research — demographics, psychographics, pain points, desired outcomes
3. Customer avatar development — 3–5 distinct segments
4. Target audience structuring — behavioral signals, platform usage, intent levels
5. Platform selection — assign each platform a specific funnel role
6. Funnel design — awareness → consideration → conversion stages
7. Budget planning — already computed (provided below)
8. Performance forecasting — already computed (provided below)
9. Simplification for client presentation
10. Final document structuring

CLIENT:
- Name: ${client_name}${client_handle ? ` (${client_handle})` : ''}
- Industry: ${industry}
- Market: ${market}
- Campaign Objective: ${objective}
- Platforms: ${platforms.join(', ')}
${additional_context ? `- Additional Context: ${additional_context}` : ''}

BUDGET (already computed — do NOT change numbers):
Option 1 (${option1_budget} SAR): ${alloc1.map(a => `${a.platform}: ${a.amount} SAR`).join(', ')}
Option 2 (${option2_budget} SAR): ${alloc2.map(a => `${a.platform}: ${a.amount} SAR`).join(', ')}

FORECASTED LEADS (already computed — do NOT change numbers):
Option 1: ${results1.map(r => `${r.platform} → ${r.min}–${r.max} ${r.metric}`).join(', ')} | Total: ${totalLeads1.min}–${totalLeads1.max}
Option 2: ${results2.map(r => `${r.platform} → ${r.min}–${r.max} ${r.metric}`).join(', ')} | Total: ${totalLeads2.min}–${totalLeads2.max}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "executive_summary": "3–4 sentence overview of the plan. Split into paragraphs with \\n between them.",
  "campaign_objective": {
    "primary_goal": "One sentence describing the primary goal",
    "kpis": ["KPI 1", "KPI 2", "KPI 3"],
    "secondary_goal": "One sentence secondary goal"
  },
  "platforms": [
    { "name": "Platform Name", "role_description": "25-word max description of its specific role", "funnel_stage": "Awareness|Consideration|Conversion" }
  ],
  "customer_avatars": [
    { "name": "Avatar segment name (e.g. Brides-to-be)", "motivation": "One sentence describing their primary motivation and pain point" }
  ],
  "option1_summary": "One to two sentences. This is the testing/validation phase summary.",
  "option2_summary": "One to two sentences. This is the scaling/optimization phase summary.",
  "key_factors": [
    { "number": "01", "title": "Factor Title", "description": "One to two sentence explanation of why this factor matters." },
    { "number": "02", "title": "Factor Title", "description": "..." },
    { "number": "03", "title": "Factor Title", "description": "..." }
  ]
}

Rules:
- No emojis, no hashtags
- Write in clear, professional English
- Platform names must exactly match: ${platforms.join(', ')}
- Generate exactly ${platforms.length} platform objects
- Generate 3–5 customer avatar objects appropriate for the ${industry} industry in ${market}
- Keep all text concise and client-presentation ready (non-technical)
`

    const aiData = await geminiJson<{
      executive_summary: string
      campaign_objective: { primary_goal: string; kpis: string[]; secondary_goal: string }
      platforms: Array<{ name: string; role_description: string; funnel_stage: string }>
      customer_avatars: Array<{ name: string; motivation: string }>
      option1_summary: string
      option2_summary: string
      key_factors: Array<{ number: string; title: string; description: string }>
    }>(prompt)

    const plan: MediaBuyingPlan = {
      client_name,
      client_handle,
      objective,
      market,
      executive_summary: aiData.executive_summary ?? '',
      campaign_objective: aiData.campaign_objective ?? { primary_goal: '', kpis: [], secondary_goal: '' },
      platforms: aiData.platforms ?? platforms.map(p => ({ name: p, role_description: '', funnel_stage: '' })),
      customer_avatars: aiData.customer_avatars ?? [],
      option1: {
        budget_sar: option1_budget,
        allocation: alloc1,
        expected_results: results1,
        total_leads_min: totalLeads1.min,
        total_leads_max: totalLeads1.max,
        summary: aiData.option1_summary ?? '',
      },
      option2: {
        budget_sar: option2_budget,
        allocation: alloc2,
        expected_results: results2,
        total_leads_min: totalLeads2.min,
        total_leads_max: totalLeads2.max,
        summary: aiData.option2_summary ?? '',
      },
      key_factors: aiData.key_factors ?? [],
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[media-buying/generate]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
