// ============================================================
// POST /api/user/activity  — upsert current user's last_seen + page
// GET  /api/user/activity  — admin/CEO: all users with activity + API usage
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// POST — called by the client-side activity tracker on navigation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { user_id?: string; current_page?: string }
    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const db  = createAdminClient()
    const now = new Date().toISOString()

    const { error } = await db
      .from('user_activity')
      .upsert(
        {
          user_id:      body.user_id,
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

// GET — returns all users joined with their activity + API call count this month
export async function GET(_req: NextRequest) {
  try {
    const db = createAdminClient()

    // Fetch all users
    const { data: users, error: usersErr } = await db
      .from('users')
      .select('id, name, email, role, avatar_url')
      .order('name')

    if (usersErr) {
      return NextResponse.json({ error: usersErr.message }, { status: 500 })
    }

    // Fetch all activity rows
    const { data: activity } = await db
      .from('user_activity')
      .select('user_id, last_seen, current_page')

    const activityMap = new Map(
      (activity ?? []).map(a => [a.user_id, a])
    )

    // Fetch per-user API call counts this month from api_usage
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: usageCounts } = await db
      .from('api_usage')
      .select('user_id')
      .gte('created_at', monthStart.toISOString())

    // Count calls per user
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
