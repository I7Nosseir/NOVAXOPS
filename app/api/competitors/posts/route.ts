import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/**
 * GET /api/competitors/posts?client_id=&handle=&limit=
 * Returns competitor_post_samples for a client, optionally filtered by handle.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const handle    = searchParams.get('handle')
  const limit     = parseInt(searchParams.get('limit') ?? '30', 10)

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('competitor_post_samples')
    .select('*')
    .eq('client_id', client_id)
    .order('engagement_rate', { ascending: false })
    .limit(limit)

  if (handle) query = query.eq('competitor_handle', handle)

  const { data, error } = await query

  if (error) {
    console.error('[competitors/posts]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data ?? [] })
}
