import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SessionPerformance, PerformanceVerdict } from '@/lib/studio-types'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Verdict computation ───────────────────────────────────────

function computeVerdict(vsClientAverage: number): PerformanceVerdict {
  if (vsClientAverage > 20) return 'exceeded'
  if (vsClientAverage > 0) return 'met'
  if (vsClientAverage > -20) return 'below'
  return 'significantly_below'
}

// ── PATCH /api/studio/session/[id]/performance ────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'session id required' }, { status: 400 })
  }

  let body: Partial<SessionPerformance>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate required fields
  if (typeof body.vs_client_average !== 'number') {
    return NextResponse.json(
      { error: 'vs_client_average (number) is required to compute verdict' },
      { status: 422 }
    )
  }

  if (!body.metrics || typeof body.metrics.engagement_rate !== 'number') {
    return NextResponse.json(
      { error: 'metrics.engagement_rate is required' },
      { status: 422 }
    )
  }

  const performance: SessionPerformance = {
    post_id: body.post_id ?? '',
    platform: body.platform ?? 'unknown',
    published_at: body.published_at ?? new Date().toISOString(),
    measured_at: body.measured_at ?? new Date().toISOString(),
    metrics: {
      reach: body.metrics.reach ?? 0,
      impressions: body.metrics.impressions ?? 0,
      engagement_rate: body.metrics.engagement_rate,
      saves: body.metrics.saves ?? 0,
      shares: body.metrics.shares ?? 0,
      comments: body.metrics.comments ?? 0,
      ...(body.metrics.link_clicks !== undefined ? { link_clicks: body.metrics.link_clicks } : {}),
    },
    performance_verdict: computeVerdict(body.vs_client_average),
    vs_client_average: body.vs_client_average,
    vs_industry_benchmark: body.vs_industry_benchmark ?? 0,
  }

  const verdict = computeVerdict(body.vs_client_average)

  if (!HAS_DB) {
    // Mock mode — return the computed result without persisting
    return NextResponse.json({
      id,
      performance,
      performance_verdict: verdict,
      updated_at: new Date().toISOString(),
      _mock: true,
    })
  }

  const db = adminSupabase()

  const { data, error } = await db
    .from('studio_sessions')
    .update({
      performance,
      performance_verdict: verdict,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, tool, performance, performance_verdict, updated_at')
    .single()

  if (error) {
    // Table schema may not yet have these columns — return graceful fallback
    if (error.code === '42703' || error.code === '42P01') {
      return NextResponse.json({
        id,
        performance,
        performance_verdict: verdict,
        updated_at: new Date().toISOString(),
        _mock: true,
        _db_error: 'column_or_table_missing',
      })
    }

    console.error('[session/performance] DB update failed:', error)
    return NextResponse.json(
      { error: 'Failed to update session performance', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
