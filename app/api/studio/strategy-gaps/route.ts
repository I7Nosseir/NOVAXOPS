import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'

interface StrategyGapsResult {
  gaps:        string[]
  risks:       string[]
  thin_periods: string[]
  quick_fixes: string[]
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { strategy_text: string; client_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { strategy_text, client_id } = body
  if (!strategy_text?.trim()) return NextResponse.json({ error: 'strategy_text is required' }, { status: 400 })

  const db = createAdminClient()

  let intelligenceBlock = ''
  if (client_id) {
    try {
      intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'strategy_gaps', db)
    } catch { /* non-critical */ }
  }

  const prompt = `You are a senior strategist auditing a completed quarterly content strategy for gaps. Your job is to find what is missing, thin, or risky — not to praise what's there.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}STRATEGY DOCUMENT:
${strategy_text.slice(0, 8000)}

Audit this strategy for:

1. GAPS — Topics, formats, audience segments, or platforms that a complete strategy should address but this one doesn't. Be specific ("no community-building tactics" not "missing some content").

2. RISKS — Things in this strategy that could backfire: over-reliance on one format, audience assumptions that may be wrong, competitive threats not acknowledged, trend timing that's risky.

3. THIN PERIODS — Months or quarters where the tactic density is low or where the content types repeat without variety. Name the specific period.

4. QUICK FIXES — For each major gap or risk, one concrete addition that would resolve it. Each fix should be actionable (something that can be added to the strategy in one sentence or paragraph).

Rules:
- Be direct. If the strategy is incomplete, say so clearly.
- Don't list generic strategy advice — only gaps specific to THIS strategy.
- Maximum 5 items per category. Only list what actually matters.
- If a category has no real issues, return an empty array.

JSON only:
{
  "gaps":         ["string"],
  "risks":        ["string"],
  "thin_periods": ["string"],
  "quick_fixes":  ["string"]
}`

  try {
    const result = await geminiJson<StrategyGapsResult>(
      prompt,
      'You are a senior strategist. Return only valid JSON matching the exact schema requested.',
      { temperature: 0.4, maxOutputTokens: 4096 },
    )
    return NextResponse.json({
      gaps:         Array.isArray(result.gaps)         ? result.gaps.slice(0, 5)         : [],
      risks:        Array.isArray(result.risks)        ? result.risks.slice(0, 5)        : [],
      thin_periods: Array.isArray(result.thin_periods) ? result.thin_periods.slice(0, 5) : [],
      quick_fixes:  Array.isArray(result.quick_fixes)  ? result.quick_fixes.slice(0, 5)  : [],
    })
  } catch (err) {
    console.error('[strategy-gaps]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
