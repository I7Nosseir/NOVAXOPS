import { NextRequest, NextResponse } from 'next/server'

const HAS_DB    = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const APIFY_KEY = process.env.APIFY_API_KEY ?? ''

/**
 * GET /api/cron/sync-competitors
 * Daily cron: syncs all tracked competitor snapshots via Apify.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!APIFY_KEY) return NextResponse.json({ skipped: true, reason: 'APIFY_API_KEY not set' })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: snapshots, error } = await supabase
    .from('competitor_snapshots')
    .select('id, client_id, competitor_handle, platform')
    .order('captured_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[sync-competitors] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.novaxops.com'
  let synced = 0
  let failed = 0

  for (const snap of (snapshots ?? [])) {
    const s = snap as { id: string; client_id: string; competitor_handle: string; platform: string }
    try {
      const res = await fetch(`${base}/api/competitors/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: s.client_id, handle: s.competitor_handle, platform: s.platform }),
      })
      if (res.ok) synced++
      else failed++
    } catch {
      failed++
    }
    // Brief delay to avoid hammering Apify
    await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json({ synced, failed, total: (snapshots ?? []).length })
}
