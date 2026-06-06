// Shared server-side utility for injecting client intelligence into AI prompts.
// Called by /api/ai, /api/assistant/chat, and all /api/studio/* routes.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

export async function buildClientIntelligenceBlock(
  clientId: string,
  agentType: string,
  db: SupabaseClient
): Promise<string> {
  const blocks: string[] = []

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
