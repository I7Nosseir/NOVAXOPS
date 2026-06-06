// ============================================================
// GET    /api/studio/session/[id]   — fetch single session
// PATCH  /api/studio/session/[id]   — partial update / phase save
// DELETE /api/studio/session/[id]   — remove session
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { StudioSession } from '@/lib/studio-types'

// ─── DB helpers ──────────────────────────────────────────────

const HAS_DB = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Route params type ────────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET /api/studio/session/[id] ────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  if (!HAS_DB) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const db = adminSupabase()
  const { data, error } = await db
    .from('studio_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ session: data as StudioSession })
}

// ─── PATCH /api/studio/session/[id] ──────────────────────────
//
// Two usage patterns:
//   1. Phase save:  { phase: 'hooks', output: { ... } }
//      → merges into session.outputs.hooks
//   2. Full partial: any subset of StudioSession fields
//

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Detect phase-save shape: { phase: string; output: object }
  const isPhaseShape =
    typeof body.phase === 'string' &&
    body.output !== undefined &&
    Object.keys(body).length === 2

  if (!HAS_DB) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  // ─── DB mode ─────────────────────────────────────────────
  const db = adminSupabase()

  if (isPhaseShape) {
    // Read existing outputs, merge, write back
    const { data: existing, error: fetchErr } = await db
      .from('studio_sessions')
      .select('outputs')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const mergedOutputs = {
      ...(existing.outputs as Record<string, unknown>),
      [body.phase as string]: body.output,
    }

    const { data, error } = await db
      .from('studio_sessions')
      .update({ outputs: mergedOutputs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as StudioSession)
  }

  // Standard partial update
  const { data, error } = await db
    .from('studio_sessions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as StudioSession)
}

// ─── DELETE /api/studio/session/[id] ─────────────────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  if (!HAS_DB) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const db = adminSupabase()
  const { error } = await db.from('studio_sessions').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
