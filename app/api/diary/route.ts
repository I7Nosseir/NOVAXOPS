import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function err(msg: string, status = 500): NextResponse {
  console.error('[/api/diary]', msg)
  return NextResponse.json({ error: msg }, { status })
}

/**
 * GET /api/diary
 * ?userId=<uuid>   — admin only: fetch a specific user's entries
 * ?date=YYYY-MM-DD — return the single entry for that date
 * Default: return all entries for the requesting user, ordered newest first.
 *
 * The admin identity is resolved from the x-user-id / x-user-role headers
 * that the client passes in every authenticated request.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const requestingRole = req.headers.get('x-user-role') ?? ''
    const requestingId   = req.headers.get('x-user-id')  ?? ''
    const targetUserId   = searchParams.get('userId')
    const date           = searchParams.get('date')

    if (!requestingId) return err('Unauthenticated', 401)

    // Non-admins may only read their own diary
    const resolvedUserId =
      targetUserId && requestingRole === 'admin' ? targetUserId : requestingId

    const db = createAdminClient()

    let query = db
      .from('work_diaries')
      .select(`
        *,
        user:users(name, color, initials, role)
      `)
      .eq('user_id', resolvedUserId)
      .order('date', { ascending: false })

    if (date) query = query.eq('date', date)

    const { data, error } = date
      ? await query.maybeSingle()
      : await query

    if (error) return err(error.message)

    return NextResponse.json(data ?? (date ? null : []))
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/**
 * POST /api/diary
 * Creates or upserts the diary entry for a given date.
 * Body: Partial<WorkDiary> — must include `date`.
 */
export async function POST(req: NextRequest) {
  try {
    const requestingId   = req.headers.get('x-user-id')  ?? ''
    const requestingRole = req.headers.get('x-user-role') ?? ''

    if (!requestingId) return err('Unauthenticated', 401)

    const body = await req.json()
    const { date, userId: bodyUserId, ...fields } = body

    if (!date) return err('date is required', 400)

    // Admin can write on behalf of another user
    const targetUserId =
      bodyUserId && requestingRole === 'admin' ? bodyUserId : requestingId

    const db = createAdminClient()

    const { data, error } = await db
      .from('work_diaries')
      .upsert(
        {
          user_id:           targetUserId,
          date,
          tasks_worked:      fields.tasks_worked      ?? [],
          blockers:          fields.blockers           ?? [],
          blockers_notes:    fields.blockers_notes     ?? null,
          highlights:        fields.highlights         ?? null,
          energy_score:      fields.energy_score       ?? null,
          ai_feedback_notes: fields.ai_feedback_notes  ?? [],
          free_notes:        fields.free_notes         ?? null,
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()

    if (error) return err(error.message)

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Unexpected error')
  }
}
