// ============================================================
// GET /api/assistant/context?q=...&types=client,document,session
// Lightweight search for @ mention dropdown in the AI assistant
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
  const q       = (searchParams.get('q') ?? '').trim().toLowerCase()
  const types   = (searchParams.get('types') ?? 'client,document,session').split(',')

  const supabase = db()
  const results: ContextSearchResult[] = []

  await Promise.all([
    // Clients
    types.includes('client') && (async () => {
      let query = supabase.from('clients').select('id,name,brand_identity_json').limit(6)
      if (q) query = query.ilike('name', `%${q}%`)
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

    // Documents
    types.includes('document') && (async () => {
      let query = supabase.from('documents').select('id,title,doc_type').order('created_at', { ascending: false }).limit(6)
      if (q) query = query.ilike('title', `%${q}%`)
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

    // Studio sessions
    types.includes('session') && (async () => {
      let query = supabase.from('studio_sessions').select('id,title,tool_type').order('created_at', { ascending: false }).limit(6)
      if (q) query = query.ilike('title', `%${q}%`)
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

    // Tasks
    types.includes('task') && (async () => {
      let query = supabase.from('tasks').select('id,title,pipeline_stage').limit(6)
      if (q) query = query.ilike('title', `%${q}%`)
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

  return NextResponse.json({ results })
}
