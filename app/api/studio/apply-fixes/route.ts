import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { geminiJson } from '@/lib/gemini'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import type { StrategyDocument } from '@/lib/studio-types'

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

  let body: {
    tool: string
    strategy_doc: StrategyDocument
    gaps?: string[]
    risks?: string[]
    thin_periods?: string[]
    quick_fixes: string[]
    client_id?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { tool, strategy_doc, gaps = [], risks = [], thin_periods = [], quick_fixes, client_id } = body

  if (tool !== 'strategy') {
    return NextResponse.json({ error: 'Only the strategy tool is currently supported' }, { status: 400 })
  }
  if (!strategy_doc || !quick_fixes?.length) {
    return NextResponse.json({ error: 'strategy_doc and quick_fixes are required' }, { status: 400 })
  }

  const db = createAdminClient()

  let intelligenceBlock = ''
  if (client_id) {
    try { intelligenceBlock = await buildClientIntelligenceBlock(client_id, 'apply_fixes', db) } catch { /* non-critical */ }
  }

  // Compact serialisation of the existing strategy for AI context
  const lines: string[] = []
  if (strategy_doc.positioning_statement) lines.push(`Positioning: ${strategy_doc.positioning_statement}`)
  if (strategy_doc.campaign_line)         lines.push(`Campaign Line: ${strategy_doc.campaign_line}`)
  if (strategy_doc.quarter_role)          lines.push(`Quarter Role: ${strategy_doc.quarter_role}`)
  if (strategy_doc.north_star)            lines.push(`North Star: ${strategy_doc.north_star}`)
  if (strategy_doc.competitive_gap)       lines.push(`Competitive Gap: ${strategy_doc.competitive_gap}`)
  if (strategy_doc.creative_tension)      lines.push(`Creative Tension: ${strategy_doc.creative_tension}`)
  if (strategy_doc.audience_insight)      lines.push(`Audience Insight: ${strategy_doc.audience_insight}`)
  if (strategy_doc.content_pillars?.length) {
    lines.push(`Content Pillars (${strategy_doc.content_pillars.length}):`)
    strategy_doc.content_pillars.forEach(p => lines.push(`  - ${p.name}: ${p.description}`))
  }
  if (strategy_doc.monthly_tactics?.length) {
    lines.push('Monthly Tactics:')
    strategy_doc.monthly_tactics.forEach(m =>
      lines.push(`  - ${m.month}: ${m.theme_line} | Focus: ${(m.focus ?? []).join(', ')}`)
    )
  }
  if (strategy_doc.platform_roles?.length) {
    lines.push('Platform Roles:')
    strategy_doc.platform_roles.forEach(p => lines.push(`  - ${p.platform}: ${p.role}`))
  }
  const strategyText = lines.join('\n')

  const prompt = `You are a senior content strategist. A quarterly strategy has been audited and specific fixes have been identified. Apply ONLY the listed quick fixes to improve the document.

${intelligenceBlock ? `CLIENT CONTEXT:\n${intelligenceBlock}\n\n` : ''}IDENTIFIED ISSUES:
Gaps: ${gaps.length ? gaps.join(' | ') : 'none'}
Risks: ${risks.length ? risks.join(' | ') : 'none'}
Thin periods: ${thin_periods.length ? thin_periods.join(' | ') : 'none'}

QUICK FIXES TO APPLY:
${quick_fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}

CURRENT STRATEGY:
${strategyText.slice(0, 5000)}

TASK: Apply each quick fix to the relevant section of the strategy. Return a JSON object containing ONLY the fields you are modifying — do not return unchanged fields.

Fields you may update:
- positioning_statement (string)
- campaign_line (string)
- quarter_role (string)
- north_star (string)
- competitive_gap (string)
- creative_tension (string)
- audience_insight (string)
- content_pillars (full array — include all pillars, modified and unchanged)
- monthly_tactics (full array — include all months, modified and unchanged)
- platform_roles (full array — include all platforms, modified and unchanged)
- format_roles (object)
- tenant_integration (string array)

Rules:
- For arrays (content_pillars, monthly_tactics, platform_roles): return the COMPLETE updated array
- Only change what the quick fix requires — preserve everything else
- No hashtags or emojis
- Be specific and actionable — add real content, not placeholders
- Return valid JSON only, no markdown fences, no explanation

JSON:`

  try {
    let patch: Partial<StrategyDocument>

    if (process.env.ANTHROPIC_API_KEY) {
      const response = await anthropic.messages.create({
        model: AI_MODELS.primary,
        max_tokens: 6000,
        system: 'You are a senior content strategist. Return only valid JSON. No markdown fences, no prose.',
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in Claude response')
      patch = JSON.parse(jsonMatch[0]) as Partial<StrategyDocument>
    } else {
      patch = await geminiJson<Partial<StrategyDocument>>(
        prompt,
        'You are a senior content strategist. Return only valid JSON matching the exact schema requested. No markdown.',
        { temperature: 0.5, maxOutputTokens: 6000 },
      )
    }

    const fixCount = quick_fixes.length
    return NextResponse.json({
      patch,
      message: `${fixCount} fix${fixCount !== 1 ? 'es' : ''} applied to strategy`,
    })
  } catch (err) {
    console.error('[apply-fixes]', err)
    return NextResponse.json({ error: 'Failed to apply fixes' }, { status: 500 })
  }
}
