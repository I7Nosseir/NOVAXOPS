import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/performance/competitors?client_id=
 * Returns all competitor snapshots for a client (ordered: local first, then global, by followers desc).
 *
 * POST /api/performance/competitors
 * Body: { client_id, competitor_handle, platform, scope?, followers?, avg_er?,
 *         posting_frequency?, top_content_types?, social_url?, platform_strategy?, notes? }
 * Upserts a competitor snapshot.
 *
 * DELETE /api/performance/competitors?id=
 * Removes a competitor by snapshot id.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('competitor_snapshots')
    .select('*')
    .eq('client_id', client_id)
    .order('followers', { ascending: false })

  if (error) {
    console.error('[performance/competitors] GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sort: local first, then global, each group by followers desc
  const sorted = (data ?? []).sort((a, b) => {
    if (a.scope === 'local' && b.scope !== 'local') return -1
    if (a.scope !== 'local' && b.scope === 'local') return 1
    return (b.followers ?? 0) - (a.followers ?? 0)
  })

  return NextResponse.json({ competitors: sorted })
}

export async function POST(req: NextRequest) {
  let body: {
    client_id?: string
    competitor_handle?: string
    platform?: string
    scope?: string
    followers?: number
    avg_er?: number
    posting_frequency?: number
    top_content_types?: Record<string, number>
    social_url?: string
    platform_strategy?: string
    brand_positioning?: string
    notes?: string
  }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, competitor_handle, platform, ...rest } = body
  if (!client_id || !competitor_handle || !platform) {
    return NextResponse.json({ error: 'client_id, competitor_handle, platform required' }, { status: 400 })
  }
  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('competitor_snapshots')
    .upsert({
      client_id,
      competitor_handle: competitor_handle.startsWith('@') ? competitor_handle : `@${competitor_handle}`,
      platform:          platform.toLowerCase(),
      scope:             rest.scope ?? 'global',
      followers:         rest.followers          ?? 0,
      avg_er:            rest.avg_er             ?? 0,
      posting_frequency: rest.posting_frequency  ?? 0,
      top_content_types: rest.top_content_types  ?? {},
      social_url:        rest.social_url         ?? null,
      platform_strategy: rest.platform_strategy  ?? null,
      brand_positioning: rest.brand_positioning  ?? null,
      notes:             rest.notes              ?? null,
      captured_at:       new Date().toISOString(),
    }, { onConflict: 'client_id,competitor_handle,platform' })
    .select()
    .single()

  if (error) {
    console.error('[performance/competitors] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: true, competitor: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id)     return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const supabase = getSupabase()

  const { error } = await supabase
    .from('competitor_snapshots')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[performance/competitors] DELETE error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
