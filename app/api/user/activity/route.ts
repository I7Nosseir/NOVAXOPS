// ============================================================
// POST /api/user/activity  — upsert current user's last_seen + page
// GET  /api/user/activity  — admin/CEO: all users with activity + API usage
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

async function getSessionUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// POST — upserts the authenticated user's last_seen + current_page.
// user_id from the body is IGNORED — always derived from the session.
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { current_page?: string }

    // Resolve the internal profile id from auth_id
    const db  = createAdminClient()
    const { data: profile } = await db
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

    const now = new Date().toISOString()
    const { error } = await db
      .from('user_activity')
      .upsert(
        {
          user_id:      profile.id,
          last_seen:    now,
          current_page: body.current_page ?? null,
          updated_at:   now,
        },
        { onConflict: 'user_id' },
      )

    if (error) {
      console.error('[user/activity] upsert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[user/activity] POST error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// GET — returns all users with activity + API usage. Admin/CEO only.
export async function GET(_req: NextRequest) {
  try {
    const { user, supabase } = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single()

    if (!profile || !['admin', 'ceo'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = createAdminClient()

    const { data: users, error: usersErr } = await db
      .from('users')
      .select('id, name, email, role, avatar_url')
      .order('name')

    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

    const { data: activity } = await db
      .from('user_activity')
      .select('user_id, last_seen, current_page')

    const activityMap = new Map(
      (activity ?? []).map(a => [a.user_id, a])
    )

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: usageCounts } = await db
      .from('api_usage')
      .select('user_id')
      .gte('created_at', monthStart.toISOString())

    const callCountMap = new Map<string, number>()
    for (const row of usageCounts ?? []) {
      if (row.user_id) {
        callCountMap.set(row.user_id, (callCountMap.get(row.user_id) ?? 0) + 1)
      }
    }

    const result = (users ?? []).map(u => {
      const act = activityMap.get(u.id)
      return {
        ...u,
        last_seen:    act?.last_seen    ?? null,
        current_page: act?.current_page ?? null,
        api_calls_this_month: callCountMap.get(u.id) ?? 0,
      }
    })

    return NextResponse.json({ users: result })
  } catch (err) {
    console.error('[user/activity] GET error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
