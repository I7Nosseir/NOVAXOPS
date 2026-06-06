// ============================================================
// POST /api/studio/inspiration-analysis
// Analyzes a batch of trending content items and extracts
// reusable content formulas, hook templates, and an
// adaptation guide for the given niche + region.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { geminiJson }                from '@/lib/gemini'
import type { TrendingContentItem }  from '@/app/api/studio/trending-content/route'

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

export interface ContentFormula {
  name:       string  // e.g. "The Before/After Transformation"
  pattern:    string  // structural description of the format
  example:    string  // direct title quote from the analyzed content
  psychology: string  // why it works emotionally/psychologically
}

export interface ContentAnalysis {
  top_formulas:     ContentFormula[]
  hook_templates:   string[]            // 5 reusable hook structures
  success_drivers:  string[]            // 4 specific insights on what drives performance
  format_breakdown: Record<string, number> // format → % share
  adaptation_guide: string              // actionable summary for this niche + region
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      items:    TrendingContentItem[]
      industry: string
      region:   string
    }

    const { items, industry, region } = body

    if (!items?.length) {
      return NextResponse.json({ error: 'No items to analyze' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    // Take top-performing items for analysis (AI-scored or by view count)
    const toAnalyze = [...items]
      .sort((a, b) => {
        const scoreA = a.ai_score ?? 0
        const scoreB = b.ai_score ?? 0
        if (scoreA !== scoreB) return scoreB - scoreA
        return (b.view_count ?? b.save_count ?? 0) - (a.view_count ?? a.save_count ?? 0)
      })
      .slice(0, 24)

    const contentList = toAnalyze
      .map((it, i) => {
        const views = it.view_count
          ? `${formatCount(it.view_count)} views`
          : it.save_count
            ? `${formatCount(it.save_count)} saves`
            : ''
        const format = it.content_format ? `[${it.content_format}]` : ''
        const score  = it.ai_score != null ? `score:${it.ai_score}/10` : ''
        const insight = it.ai_insight || it.why_trending || ''
        return `${i + 1}. [${it.platform.toUpperCase()}] ${format} "${it.title}" ${views} ${score} — ${insight}`
      })
      .join('\n')

    const prompt = `You are an expert content strategist analyzing the top performing content in the "${industry}" niche for the ${region} market.

Analyze these ${toAnalyze.length} viral content pieces and extract actionable patterns a brand can immediately replicate.

CONTENT TO ANALYZE:
${contentList}

Extract insights as JSON:
{
  "top_formulas": [
    {
      "name": "Short memorable formula name (e.g. The Before/After Proof)",
      "pattern": "Structural description: how the content is built (opening → middle → close)",
      "example": "Quote the most relevant title from the list above verbatim",
      "psychology": "Why this triggers engagement — the emotional or psychological mechanism"
    }
  ],
  "hook_templates": [
    "Hook template 1 — specific to ${industry}",
    "Hook template 2",
    "Hook template 3",
    "Hook template 4",
    "Hook template 5"
  ],
  "success_drivers": [
    "Specific insight 1 about what drives performance in this niche content",
    "Specific insight 2",
    "Specific insight 3",
    "Specific insight 4"
  ],
  "format_breakdown": {
    "Tutorial": 30,
    "Transformation": 25,
    "Review": 20,
    "Case Study": 15,
    "Other": 10
  },
  "adaptation_guide": "2-3 sentences: how a ${industry} brand targeting ${region} can immediately apply the top 2 formulas above. Be specific and actionable."
}

Rules:
- top_formulas: exactly 3, ordered by frequency/impact in the analyzed content
- hook_templates: exactly 5, written as fill-in-the-blank templates using [brackets] for variables
- success_drivers: exactly 4, specific to "${industry}" — not generic marketing advice
- format_breakdown: percentages must sum to 100, use only formats actually present in the content
- No hashtags, no emojis anywhere in the output
- adaptation_guide: concrete, mentions the region and specific tactics from the formulas`

    const analysis = await geminiJson<ContentAnalysis>(prompt, undefined, {
      temperature:     0.3,
      maxOutputTokens: 2000,
    })

    // Persist to ai_generation_cache (fire-and-forget)
    if (HAS_DB) {
      const db = adminSupabase()
      void db.from('ai_generation_cache').insert({
        generation_type: 'inspiration_analysis',
        context_id: `${industry}|${region}`,
        output_json: { analysis, analyzed_count: toAnalyze.length, industry, region },
      })
    }

    return NextResponse.json({
      analysis,
      analyzed_count: toAnalyze.length,
      industry,
      region,
    })
  } catch (err) {
    console.error('[inspiration-analysis] Error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
