// Shared server-side utility for injecting client intelligence into AI prompts.
// Called by /api/ai, /api/assistant/chat, and all /api/studio/* routes.
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ClientNormalizedProfile } from '@/lib/types'

export interface ClientIntelligenceSummary {
  voice?: string
  avoid?: string[]
  goal?: string
  competitor_note?: string
  quarter_theme?: string
}

export function adminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface ContextEntry {
  category: string
  summary: string
  created_at: string
}

interface FeedbackEntry {
  tags: string[]
  correction_text: string
  edited_version: string
}

// ── Pinterest element guidance ────────────────────────────────────────────────
const PINTEREST_ELEMENT_GUIDANCE: Record<string, string> = {
  hook_structure:     'pattern-interrupt openings with structural specificity',
  sentence_rhythm:    'alternate long and punchy sentences for human rhythm',
  cta_pattern:        'action-first CTAs with social-proof framing',
  opening_line:       'bold declarative addressed directly to the reader',
  tone_voice:         'conversational peer-to-peer tone throughout',
  structural_formula: 'follow the overall narrative arc from these references',
}

async function buildPinterestInspirationBlock(
  clientId: string,
  db: SupabaseClient
): Promise<string> {
  // Only use refs from the last 90 days so the signal stays fresh
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = await db
    .from('copy_sessions')
    .select('id')
    .eq('client_id', clientId)
    .gte('created_at', cutoff)

  if (!sessions?.length) return ''

  const sessionIds = (sessions as { id: string }[]).map(s => s.id)

  const { data: links } = await db
    .from('copy_inspiration_links')
    .select('element_borrowed, copy_session_id')
    .in('copy_session_id', sessionIds)

  if (!links?.length || links.length < 2) return ''

  // Aggregate counts per element_borrowed value
  const counts: Record<string, number> = {}
  for (const l of links as { element_borrowed: string | null; copy_session_id: string }[]) {
    const el = l.element_borrowed?.trim() || 'structural_formula'
    counts[el] = (counts[el] ?? 0) + 1
  }

  const sessionCount = new Set(
    (links as { copy_session_id: string }[]).map(l => l.copy_session_id)
  ).size
  const totalRefs = links.length

  const topElements = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const lines = topElements.map(([el, count]) => {
    const guidance = PINTEREST_ELEMENT_GUIDANCE[el] ?? el.replace(/_/g, ' ')
    const label    = el.replace(/_/g, ' ')
    return `• ${label} × ${count} — ${guidance}`
  })

  return [
    `── PINTEREST STYLE LEARNING (${totalRefs} saved ref${totalRefs !== 1 ? 's' : ''} across ${sessionCount} session${sessionCount !== 1 ? 's' : ''}) ──`,
    `Structural patterns this client's team saved as references — apply these preferences:`,
    lines.join('\n'),
    `Extract structural DNA only — never copy words verbatim from any reference.`,
  ].join('\n')
}

const PRICE_LABELS: Record<string, string> = {
  ultra_premium: 'Ultra-premium',
  premium: 'Premium',
  mid_market: 'Mid-market',
  value: 'Value / Mass-market',
}

const FORMALITY_LABELS: Record<string, string> = {
  very_formal: 'Very formal',
  professional: 'Professional',
  balanced: 'Balanced',
  friendly: 'Friendly',
  very_casual: 'Very casual',
}

const GOAL_LABELS: Record<string, string> = {
  awareness: 'Brand awareness',
  lead_gen: 'Lead generation',
  sales: 'Sales / conversions',
  retention: 'Retention / loyalty',
  launch: 'Product launch',
  community: 'Community building',
}

function buildProfileBlock(p: ClientNormalizedProfile): string {
  const lines: string[] = []

  // Positioning
  if (p.positioning_statement) lines.push(`Positioning: ${p.positioning_statement}`)
  const posLine = [
    p.primary_offering && `Offering: ${p.primary_offering}`,
    p.key_differentiator && `Differentiator: ${p.key_differentiator}`,
    p.price_positioning && `Price: ${PRICE_LABELS[p.price_positioning] ?? p.price_positioning}`,
  ].filter(Boolean).join(' | ')
  if (posLine) lines.push(posLine)

  // Audience
  const audLine = [
    p.audience_age_range && `Age: ${p.audience_age_range}`,
    p.audience_gender_skew && `Gender skew: ${p.audience_gender_skew}`,
    p.audience_location && `Location: ${p.audience_location}`,
  ].filter(Boolean).join(' | ')
  if (audLine) lines.push(audLine)
  if (p.audience_psychographic) lines.push(`Audience mindset: ${p.audience_psychographic}`)

  // Voice & language
  const voiceLine = [
    p.brand_voice?.length && `Voice: ${p.brand_voice.join(', ')}`,
    p.formality && `Tone: ${FORMALITY_LABELS[p.formality] ?? p.formality}`,
    p.language && `Language: ${p.language.replace('_', ' ')}`,
  ].filter(Boolean).join(' | ')
  if (voiceLine) lines.push(voiceLine)
  if (p.arabic_dialect) lines.push(`Arabic dialect: ${p.arabic_dialect}`)

  // Content rules
  const goalLine = [
    p.content_goal && `Goal: ${GOAL_LABELS[p.content_goal] ?? p.content_goal}`,
    p.primary_cta && `CTA: ${p.primary_cta}`,
    p.emoji_policy && `Emojis: ${p.emoji_policy.replace('_', ' ')}`,
    p.hashtag_policy && `Hashtags: ${p.hashtag_policy.replace('_', ' ')}`,
  ].filter(Boolean).join(' | ')
  if (goalLine) lines.push(goalLine)
  if (p.banned_topics) lines.push(`Never mention: ${p.banned_topics}`)

  // Social
  const platforms = [
    p.primary_platform && `${p.primary_platform} (primary)`,
    ...(p.secondary_platforms ?? []),
  ].filter(Boolean).join(', ')
  if (platforms) lines.push(`Platforms: ${platforms}`)
  const cadence = [
    p.posts_per_week && `${p.posts_per_week} posts/week`,
    p.best_posting_times && `best at ${p.best_posting_times}`,
  ].filter(Boolean).join(', ')
  if (cadence) lines.push(`Cadence: ${cadence}`)

  return lines.join('\n')
}

export async function buildClientIntelligenceBlock(
  clientId: string,
  agentType: string,
  db: SupabaseClient
): Promise<string> {
  const blocks: string[] = []

  // 0. Normalized profile — structural foundation for every AI call
  const { data: clientRow } = await db
    .from('clients')
    .select('normalized_profile')
    .eq('id', clientId)
    .single()

  const profile = clientRow?.normalized_profile as ClientNormalizedProfile | undefined
  if (profile && Object.keys(profile).length > 0) {
    const profileText = buildProfileBlock(profile)
    if (profileText.trim()) {
      blocks.push(`── CLIENT CORE PROFILE ──\n${profileText}`)
    }
  }

  // 1. Context bank — last 10 active entries
  const { data: ctxRows } = await db
    .from('client_context_bank')
    .select('category, summary, created_at')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10)

  if (ctxRows && ctxRows.length > 0) {
    const lines = (ctxRows as ContextEntry[]).map(
      r => `[${r.category}] ${r.summary}`
    )
    blocks.push(`── CLIENT MEMORY ──\n${lines.join('\n')}`)
  }

  // 2. AI feedback — last 8 negative corrections for this agent type
  const { data: fbRows } = await db
    .from('ai_feedback')
    .select('tags, correction_text, edited_version')
    .eq('client_id', clientId)
    .eq('agent_type', agentType)
    .eq('rating', 'negative')
    .order('created_at', { ascending: false })
    .limit(8)

  if (fbRows && fbRows.length > 0) {
    const lines = (fbRows as FeedbackEntry[])
      .filter(r => r.correction_text || r.tags?.length)
      .map(r => {
        const tagStr = r.tags?.length ? `(${r.tags.join(', ')})` : ''
        return `- ${tagStr} ${r.correction_text || 'avoid this style'}`.trim()
      })
    if (lines.length > 0) {
      blocks.push(
        `── LEARNED FROM PAST CORRECTIONS FOR THIS CLIENT ──\n${lines.join('\n')}`
      )
    }
  }

  // 3. Active quarter strategy excerpt (first 800 chars)
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  const { data: stratRow } = await db
    .from('client_quarterly_strategies')
    .select('goals, themes, kpis')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('quarter', quarter)
    .maybeSingle()

  if (stratRow && (stratRow.goals || stratRow.themes)) {
    const excerpt = [
      stratRow.goals ? `Goals: ${stratRow.goals}` : '',
      stratRow.themes ? `Themes: ${stratRow.themes}` : '',
      stratRow.kpis ? `KPIs: ${stratRow.kpis}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 800)
    blocks.push(`── QUARTER STRATEGY (Q${quarter} ${year}) ──\n${excerpt}`)
  }

  // 4. Pinterest inspiration learning — aggregated structural preferences from past copy sessions
  try {
    const pinterestBlock = await buildPinterestInspirationBlock(clientId, db)
    if (pinterestBlock) blocks.push(pinterestBlock)
  } catch { /* non-critical — inspiration data is supplementary */ }

  if (blocks.length === 0) return ''
  const joined = `\n\n${blocks.join('\n\n')}`
  // Hard cap — prevents unbounded context from consuming the model's output budget
  const MAX_CHARS = 3000
  if (joined.length > MAX_CHARS) {
    return joined.slice(0, MAX_CHARS) + '\n[...client context truncated]'
  }
  return joined
}

type CompetitorAnalysisShape = {
  opportunities?: string[]
  hooks_to_avoid?: string[]
  hooks_to_try?: string[]
  recommended_formats?: string[]
  landscape?: Array<{ handle: string; platform: string; followers: number; avg_er: number }>
  summary?: string
}

function formatCompetitorBlock(analysis: CompetitorAnalysisShape, asOf: string): string {
  const lines: string[] = []

  if (analysis.landscape && analysis.landscape.length > 0) {
    const top = analysis.landscape.slice(0, 3)
    lines.push(`Top competitors: ${top.map(c => `${c.handle} (${c.platform}, ${c.avg_er}% ER)`).join(', ')}`)
  }
  if (analysis.hooks_to_avoid && analysis.hooks_to_avoid.length > 0) {
    lines.push(`Hook patterns to differentiate from: ${analysis.hooks_to_avoid.slice(0, 3).join('; ')}`)
  }
  if (analysis.hooks_to_try && analysis.hooks_to_try.length > 0) {
    lines.push(`Underused hook opportunities: ${analysis.hooks_to_try.slice(0, 3).join('; ')}`)
  }
  if (analysis.recommended_formats && analysis.recommended_formats.length > 0) {
    lines.push(`Recommended formats (competitor gap): ${analysis.recommended_formats.slice(0, 3).join(', ')}`)
  }
  if (analysis.opportunities && analysis.opportunities.length > 0) {
    lines.push(`Key opportunities: ${analysis.opportunities.slice(0, 2).join('; ')}`)
  }
  if (analysis.summary) {
    lines.push(`Intelligence: ${analysis.summary}`)
  }

  if (lines.length === 0) return ''
  return `\n\n── COMPETITIVE CONTEXT (as of ${asOf}) ──\n${lines.join('\n')}\nYour output must be clearly differentiated from the competitor patterns above.`
}

export async function buildClientIntelligenceSummary(
  clientId: string,
  db: SupabaseClient
): Promise<ClientIntelligenceSummary> {
  const summary: ClientIntelligenceSummary = {}

  const { data: clientRow } = await db
    .from('clients')
    .select('normalized_profile, brand_identity_json')
    .eq('id', clientId)
    .single()

  const profile = clientRow?.normalized_profile as ClientNormalizedProfile | undefined
  if (profile?.brand_voice?.length) {
    summary.voice = Array.isArray(profile.brand_voice) ? profile.brand_voice.join(', ') : String(profile.brand_voice)
  } else {
    const bi = clientRow?.brand_identity_json as { tone_of_voice?: string } | undefined
    if (bi?.tone_of_voice) summary.voice = bi.tone_of_voice
  }

  const { data: ctxRows } = await db
    .from('client_context_bank')
    .select('category, summary')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20)

  const avoidItems: string[] = []
  for (const row of (ctxRows ?? []) as { category: string; summary: string }[]) {
    if (row.category === 'Client Instructions' && avoidItems.length < 3) {
      avoidItems.push(row.summary.slice(0, 80))
    } else if (row.category === 'Campaign Feedback' && !summary.goal) {
      summary.goal = row.summary.slice(0, 100)
    } else if (row.category === 'Competitor Intel' && !summary.competitor_note) {
      summary.competitor_note = row.summary.slice(0, 100)
    }
  }
  if (avoidItems.length > 0) summary.avoid = avoidItems

  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  const { data: stratRow } = await db
    .from('client_quarterly_strategies')
    .select('themes')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('quarter', quarter)
    .maybeSingle()

  if (stratRow?.themes) {
    summary.quarter_theme = String(stratRow.themes).slice(0, 100)
  }

  return summary
}

/**
 * Returns a competitive context block for injection into studio AI prompts.
 * Primary source: competitor_intelligence_reports (typed JSONB table, from migration 034).
 * Fallback: ai_generation_cache (legacy text cache).
 * TTL: 7 days on either source.
 * Returns empty string if no analysis exists or data is stale.
 */
export async function buildCompetitorContextBlock(
  clientId: string,
  db: SupabaseClient
): Promise<string> {
  const TTL_MS = 7 * 24 * 60 * 60 * 1000

  // Primary: competitor_intelligence_reports (typed, proper FK, from 034 migration)
  try {
    const { data: report } = await db
      .from('competitor_intelligence_reports')
      .select('report_json, generated_at')
      .eq('client_id', clientId)
      .single()

    if (report) {
      const age = Date.now() - new Date(report.generated_at as string).getTime()
      if (age <= TTL_MS) {
        const analysis = report.report_json as CompetitorAnalysisShape
        const block = formatCompetitorBlock(analysis, new Date(report.generated_at as string).toLocaleDateString())
        if (block) return block
      }
    }
  } catch { /* table may not exist yet — fall through to cache */ }

  // Fallback: ai_generation_cache (legacy path — pre-034 reports)
  try {
    const cacheKey = `competitor_analysis_${clientId}`
    const { data: cached } = await db
      .from('ai_generation_cache')
      .select('response_text, created_at')
      .eq('prompt_hash', cacheKey)
      .single()

    if (!cached) return ''

    const age = Date.now() - new Date(cached.created_at as string).getTime()
    if (age > TTL_MS) return ''

    const analysis = JSON.parse(cached.response_text as string) as CompetitorAnalysisShape
    return formatCompetitorBlock(analysis, new Date(cached.created_at as string).toLocaleDateString())
  } catch {
    return ''
  }
}
