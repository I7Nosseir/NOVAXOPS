import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function err(msg: string, status = 500): NextResponse {
  console.error('[/api/diary/[id]]', msg)
  return NextResponse.json({ error: msg }, { status })
}

/** PATCH /api/diary/[id] — partial update of an existing entry */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const requestingId   = req.headers.get('x-user-id')  ?? ''
    const requestingRole = req.headers.get('x-user-role') ?? ''

    if (!requestingId) return err('Unauthenticated', 401)

    const { id } = await params
    const body = await req.json()

    const db = createAdminClient()

    // Verify ownership before updating (unless admin)
    if (requestingRole !== 'admin') {
      const { data: existing, error: fetchErr } = await db
        .from('work_diaries')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchErr || !existing) return err('Entry not found', 404)
      if (existing.user_id !== requestingId) return err('Forbidden', 403)
    }

    const allowed = [
      'tasks_worked', 'blockers', 'blockers_notes',
      'highlights', 'energy_score', 'efficiency_score', 'content_quality_score',
      'pulse_signals', 'ai_feedback_notes', 'free_notes',
    ]
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }

    if (Object.keys(patch).length === 0) return err('No valid fields to update', 400)

    const { data, error } = await db
      .from('work_diaries')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) return err(error.message)

    return NextResponse.json(data)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** DELETE /api/diary/[id] — remove an entry (admin or owner) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const requestingId   = req.headers.get('x-user-id')  ?? ''
    const requestingRole = req.headers.get('x-user-role') ?? ''

    if (!requestingId) return err('Unauthenticated', 401)

    const { id } = await params
    const db = createAdminClient()

    if (requestingRole !== 'admin') {
      const { data: existing, error: fetchErr } = await db
        .from('work_diaries')
        .select('user_id')
        .eq('id', id)
        .single()
      if (fetchErr || !existing) return err('Entry not found', 404)
      if (existing.user_id !== requestingId) return err('Forbidden', 403)
    }

    const { error } = await db.from('work_diaries').delete().eq('id', id)
    if (error) return err(error.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Unexpected error')
  }
}
