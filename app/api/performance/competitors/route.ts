import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/performance/competitors?client_id=
 * Returns stored competitor snapshots for a client.
 *
 * POST /api/performance/competitors
 * Body: { client_id, competitor_handle, platform, followers?, avg_er?, posting_frequency?, top_content_types?, notes? }
 * Upserts a competitor snapshot.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('competitor_snapshots')
    .select('*')
    .eq('client_id', client_id)
    .order('captured_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitors: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: {
    client_id?: string
    competitor_handle?: string
    platform?: string
    followers?: number
    avg_er?: number
    posting_frequency?: number
    top_content_types?: Record<string, number>
    notes?: string
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, competitor_handle, platform, ...rest } = body
  if (!client_id || !competitor_handle || !platform) {
    return NextResponse.json({ error: 'client_id, competitor_handle, and platform are required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('competitor_snapshots')
    .upsert({
      client_id,
      competitor_handle,
      platform,
      followers: rest.followers ?? 0,
      avg_er: rest.avg_er ?? 0,
      posting_frequency: rest.posting_frequency ?? 0,
      top_content_types: rest.top_content_types ?? {},
      notes: rest.notes ?? null,
      captured_at: new Date().toISOString(),
    }, { onConflict: 'client_id,competitor_handle,platform' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('competitor_snapshots')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
