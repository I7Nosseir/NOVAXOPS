// ============================================================
// GET /api/assistant/context?q=...&types=document,session,task&recent=true
// Lightweight search for @ mention dropdown in the AI assistant.
// When recent=true, returns most-recently-touched items without filtering.
// Client context is set via the header dropdown, not @mention.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ContextSearchResult {
  id:       string
  type:     'client' | 'document' | 'session' | 'task'
  label:    string
  sublabel: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q      = (searchParams.get('q') ?? '').trim().toLowerCase()
  const types  = (searchParams.get('types') ?? 'document,session,task').split(',')
  const recent = searchParams.get('recent') === 'true'

  // Recent mode: return top 3 per type ordered by latest activity, no query filter
  const limit = recent ? 3 : 6

  const supabase = db()
  const results: ContextSearchResult[] = []

  await Promise.all([
    // Clients (only when explicitly requested — not in default @mention flow)
    types.includes('client') && (async () => {
      let query = supabase.from('clients').select('id,name,brand_identity_json').limit(limit)
      if (q && !recent) query = query.ilike('name', `%${q}%`)
      const { data } = await query
      for (const row of data ?? []) {
        const b = row.brand_identity_json as Record<string, unknown> | null
        results.push({
          id:       row.id,
          type:     'client',
          label:    row.name,
          sublabel: String(b?.industry ?? 'Client'),
        })
      }
    })(),

    // Documents — ordered by most recent
    types.includes('document') && (async () => {
      let query = supabase
        .from('documents')
        .select('id,title,doc_type')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (q && !recent) query = query.ilike('title', `%${q}%`)
      const { data } = await query
      for (const row of data ?? []) {
        results.push({
          id:       row.id,
          type:     'document',
          label:    row.title ?? 'Untitled',
          sublabel: row.doc_type ?? 'Document',
        })
      }
    })(),

    // Studio sessions — ordered by most recent
    types.includes('session') && (async () => {
      let query = supabase
        .from('studio_sessions')
        .select('id,title,tool_type')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (q && !recent) query = query.ilike('title', `%${q}%`)
      const { data } = await query
      for (const row of data ?? []) {
        results.push({
          id:       row.id,
          type:     'session',
          label:    row.title ?? 'Studio Session',
          sublabel: row.tool_type ?? 'Session',
        })
      }
    })(),

    // Tasks — ordered by most recent activity
    types.includes('task') && (async () => {
      let query = supabase
        .from('tasks')
        .select('id,title,pipeline_stage')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (q && !recent) query = query.ilike('title', `%${q}%`)
      const { data } = await query
      for (const row of data ?? []) {
        results.push({
          id:       row.id,
          type:     'task',
          label:    row.title,
          sublabel: row.pipeline_stage ?? 'Task',
        })
      }
    })(),
  ])

  // Return documents first, then sessions, then tasks (clients last if present)
  const typeOrder: Record<string, number> = { document: 0, session: 1, task: 2, client: 3 }
  results.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9))

  return NextResponse.json({ results })
}
