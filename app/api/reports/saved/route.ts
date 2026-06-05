import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

function adminClient() {
  return createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )
}

// ─── GET — list all saved reports ─────────────────────────────────────────────

export async function GET() {
  const db = adminClient()

  const { data, error } = await db
    .from('reports')
    .select('id, client_id, period_start, period_end, generated_at, data_json, clients(name)')
    .order('generated_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reports = (data ?? []).map(r => {
    const dj = (r.data_json ?? {}) as Record<string, unknown>
    const stats = (dj.stats ?? {}) as Record<string, number>
    return {
      id: r.id,
      client_id: r.client_id,
      client_name: (r.clients as unknown as { name: string } | null)?.name ?? 'Unknown Client',
      period: (dj.period as string | undefined) ?? `${r.period_start} – ${r.period_end}`,
      period_start: r.period_start,
      period_end:   r.period_end,
      generated_at: r.generated_at,
      preview: {
        reach: Number(stats.reach ?? 0),
        likes: Number(stats.likes ?? 0),
        posts: Number(stats.posts ?? 0),
      },
    }
  })

  return NextResponse.json({ reports })
}

// ─── POST — create (or replace) a saved report ────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    client_id?: string
    period?: string
    period_start?: string
    period_end?: string
    data_json?: Record<string, unknown>
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { client_id, period, period_start, period_end, data_json } = body

  if (!client_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'client_id, period_start, period_end required' }, { status: 400 })
  }

  const db = adminClient()

  // Replace any existing report for the same client + period
  await db
    .from('reports')
    .delete()
    .eq('client_id', client_id)
    .eq('period_start', period_start)
    .eq('period_end', period_end)

  const { data, error } = await db
    .from('reports')
    .insert({
      client_id,
      period_start,
      period_end,
      type: 'monthly',
      generated_at: new Date().toISOString(),
      data_json: { period, ...data_json },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data?.id })
}
