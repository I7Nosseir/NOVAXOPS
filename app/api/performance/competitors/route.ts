import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/competitors?client_id=xxx
 * Returns all competitor snapshots for a client.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id')

  if (!client_id) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('competitor_snapshots')
    .select('*')
    .eq('client_id', client_id)
    .order('captured_at', { ascending: false })

  if (error) {
    console.error('[performance/competitors] GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ competitors: data ?? [] })
}

/**
 * DELETE /api/performance/competitors?id=xxx
 * Removes a single competitor snapshot by id.
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('competitor_snapshots')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[performance/competitors] DELETE error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
