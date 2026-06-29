import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

function err(msg: string, status = 500): NextResponse {
  console.error('[/api/diary]', msg)
  return NextResponse.json({ error: msg }, { status })
}

async function getAuthUser(): Promise<{ id: string; role: string } | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = createAdminClient()
  const { data: profile } = await db
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null
  return { id: profile.id as string, role: profile.role as string }
}

/**
 * GET /api/diary
 * ?userId=<uuid>   — admin only: fetch a specific user's entries
 * ?date=YYYY-MM-DD — return the single entry for that date
 * Default: return all entries for the requesting user, ordered newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return err('Unauthenticated', 401)

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')
    const date         = searchParams.get('date')

    // Non-admins may only read their own diary
    const resolvedUserId =
      targetUserId && authUser.role === 'admin' ? targetUserId : authUser.id

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
    const authUser = await getAuthUser()
    if (!authUser) return err('Unauthenticated', 401)

    const body = await req.json()
    const { date, userId: bodyUserId, ...fields } = body

    if (!date) return err('date is required', 400)

    // Admin can write on behalf of another user
    const targetUserId =
      bodyUserId && authUser.role === 'admin' ? bodyUserId : authUser.id

    const db = createAdminClient()

    const { data, error } = await db
      .from('work_diaries')
      .upsert(
        {
          user_id:               targetUserId,
          date,
          tasks_worked:          fields.tasks_worked           ?? [],
          blockers:              fields.blockers                ?? [],
          blockers_notes:        fields.blockers_notes          ?? null,
          highlights:            fields.highlights              ?? null,
          energy_score:          fields.energy_score            ?? null,
          efficiency_score:      fields.efficiency_score        ?? null,
          content_quality_score: fields.content_quality_score   ?? null,
          pulse_signals:         fields.pulse_signals           ?? [],
          ai_feedback_notes:     fields.ai_feedback_notes       ?? [],
          free_notes:            fields.free_notes              ?? null,
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
