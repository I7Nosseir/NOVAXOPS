// Shared server-side utility for injecting client intelligence into AI prompts.
// Called by /api/ai, /api/assistant/chat, and all /api/studio/* routes.
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ClientNormalizedProfile } from '@/lib/types'

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

  return blocks.length > 0 ? `\n\n${blocks.join('\n\n')}` : ''
}

/**
 * Returns a competitive context block for injection into studio AI prompts.
 * Reads the cached competitor analysis from ai_generation_cache (24h TTL).
 * Returns empty string if no analysis exists yet.
 */
export async function buildCompetitorContextBlock(
  clientId: string,
  db: SupabaseClient
): Promise<string> {
  const cacheKey = `competitor_analysis_${clientId}`

  const { data: cached } = await db
    .from('ai_generation_cache')
    .select('response_text, created_at')
    .eq('prompt_hash', cacheKey)
    .single()

  if (!cached) return ''

  // Only use if within 7 days
  const age = Date.now() - new Date(cached.created_at as string).getTime()
  if (age > 7 * 24 * 60 * 60 * 1000) return ''

  try {
    const analysis = JSON.parse(cached.response_text as string) as {
      opportunities?: string[]
      hooks_to_avoid?: string[]
      hooks_to_try?: string[]
      recommended_formats?: string[]
      landscape?: Array<{ handle: string; platform: string; followers: number; avg_er: number }>
    }

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

    if (lines.length === 0) return ''
    return `\n\n── COMPETITIVE CONTEXT (as of ${new Date(cached.created_at as string).toLocaleDateString()}) ──\n${lines.join('\n')}\nYour output must be clearly differentiated from the competitor patterns above.`
  } catch {
    return ''
  }
}
