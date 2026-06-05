import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/**
 * GET /api/performance/intelligence?client_id=
 *
 * Returns the pre-computed performance intelligence JSONB from the clients table.
 * Includes last_analyzed_at so the UI can show staleness.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('clients')
    .select('performance_intel, performance_analyzed_at')
    .eq('id', client_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({
    intel: data.performance_intel ?? null,
    analyzed_at: data.performance_analyzed_at ?? null,
  })
}
