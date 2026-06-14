// ============================================================
// POST /api/user/activity  — upsert current user's last_seen + page
// GET  /api/user/activity  — admin/CEO: full team activity dashboard data
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

    const db = createAdminClient()
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

// GET — full team activity data for the admin monitoring page.
export async function GET(_req: NextRequest) {
  try {
    const { user, supabase } = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single()

    if (!profile || !['admin', 'ceo'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = createAdminClient()
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // All queries run in parallel
    const [
      { data: users },
      { data: activity },
      { data: usageToday },
      { data: usageMonth },
      { data: auditRecent },
      { data: studioToday },
      { data: docsToday },
    ] = await Promise.all([
      db.from('users')
        .select('id, name, email, role')
        .order('name'),

      db.from('user_activity')
        .select('user_id, last_seen, current_page'),

      // Today's AI usage — cost + call count per user
      db.from('api_usage')
        .select('user_id, cost_usd, endpoint, was_cached')
        .gte('created_at', todayStart.toISOString()),

      // Month's AI usage — cost + call count per user
      db.from('api_usage')
        .select('user_id, cost_usd')
        .gte('created_at', monthStart.toISOString()),

      // Last 40 audit log entries with user info
      db.from('audit_log')
        .select('id, user_id, action, entity_type, entity_id, metadata, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(40),

      // Studio sessions started today
      db.from('studio_sessions')
        .select('user_id')
        .gte('created_at', todayStart.toISOString()),

      // Documents created today
      db.from('documents')
        .select('created_by')
        .gte('created_at', todayStart.toISOString()),
    ])

    // ── Build per-user stats ─────────────────────────────────────────────────

    const activityMap = new Map(
      (activity ?? []).map(a => [a.user_id, a])
    )

    // Today: calls + cost + agent breakdown per user
    interface AgentCount { [agent: string]: number }
    const todayStatsMap = new Map<string, { calls: number; cost: number; agents: AgentCount; cached: number }>()
    for (const row of usageToday ?? []) {
      if (!row.user_id) continue
      const prev = todayStatsMap.get(row.user_id) ?? { calls: 0, cost: 0, agents: {}, cached: 0 }
      prev.calls++
      prev.cost += row.cost_usd ?? 0
      prev.agents[row.endpoint] = (prev.agents[row.endpoint] ?? 0) + 1
      if (row.was_cached) prev.cached++
      todayStatsMap.set(row.user_id, prev)
    }

    // Month: calls + cost per user
    const monthStatsMap = new Map<string, { calls: number; cost: number }>()
    for (const row of usageMonth ?? []) {
      if (!row.user_id) continue
      const prev = monthStatsMap.get(row.user_id) ?? { calls: 0, cost: 0 }
      prev.calls++
      prev.cost += row.cost_usd ?? 0
      monthStatsMap.set(row.user_id, prev)
    }

    // Studio sessions today per user
    const studioTodayMap = new Map<string, number>()
    for (const row of studioToday ?? []) {
      if (!row.user_id) continue
      studioTodayMap.set(row.user_id, (studioTodayMap.get(row.user_id) ?? 0) + 1)
    }

    // Documents created today per user
    const docsTodayMap = new Map<string, number>()
    for (const row of docsToday ?? []) {
      if (!row.created_by) continue
      docsTodayMap.set(row.created_by, (docsTodayMap.get(row.created_by) ?? 0) + 1)
    }

    // Assemble user records
    const userRecords = (users ?? []).map(u => {
      const act = activityMap.get(u.id)
      const todayAI = todayStatsMap.get(u.id)
      const monthAI = monthStatsMap.get(u.id)
      const monthCalls = monthAI?.calls ?? 0
      return {
        id:            u.id,
        name:          u.name,
        email:         u.email,
        role:          u.role,
        avatar_url:    null,
        last_seen:     act?.last_seen ?? null,
        current_page:  act?.current_page ?? null,
        today_ai_calls:      todayAI?.calls ?? 0,
        today_ai_cost_usd:   Math.round((todayAI?.cost ?? 0) * 10000) / 10000,
        today_ai_agents:     todayAI?.agents ?? {},
        today_ai_cached:     todayAI?.cached ?? 0,
        today_studio_sessions: studioTodayMap.get(u.id) ?? 0,
        today_docs_created:  docsTodayMap.get(u.id) ?? 0,
        month_ai_calls:      monthCalls,
        month_ai_cost_usd:   Math.round((monthAI?.cost ?? 0) * 10000) / 10000,
        api_calls_this_month: monthCalls,
      }
    })

    // ── Agency-wide totals ────────────────────────────────────────────────────

    const totals = {
      today_ai_calls:    (usageToday ?? []).length,
      today_ai_cost_usd: Math.round((usageToday ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0) * 10000) / 10000,
      month_ai_calls:    (usageMonth ?? []).length,
      month_ai_cost_usd: Math.round((usageMonth ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0) * 10000) / 10000,
      online_now:        (activity ?? []).filter(a => new Date(a.last_seen) > new Date(now.getTime() - 5 * 60 * 1000)).length,
    }

    // ── Agent breakdown for today (agency-wide) ───────────────────────────────

    const agentBreakdown: Record<string, number> = {}
    for (const row of usageToday ?? []) {
      agentBreakdown[row.endpoint] = (agentBreakdown[row.endpoint] ?? 0) + 1
    }
    const agentBreakdownSorted = Object.entries(agentBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([agent, count]) => ({ agent, count }))

    // ── Attach user names to audit log ────────────────────────────────────────

    const userNameMap = new Map((users ?? []).map(u => [u.id, u.name]))
    const auditWithNames = (auditRecent ?? []).map(entry => ({
      ...entry,
      user_name: entry.user_id ? (userNameMap.get(entry.user_id) ?? 'System') : 'System',
    }))

    return NextResponse.json({
      users:           userRecords,
      totals,
      agent_breakdown: agentBreakdownSorted,
      audit_log:       auditWithNames,
      fetched_at:      now.toISOString(),
    })
  } catch (err) {
    console.error('[user/activity] GET error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
