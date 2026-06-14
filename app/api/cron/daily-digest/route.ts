import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendDailyDigest, type DailyDigestStats } from '@/lib/email'

/**
 * GET /api/cron/daily-digest
 *
 * Vercel Cron: runs daily at 06:00 UTC (= 08:00 Cairo time, see vercel.json).
 * Gathers platform-wide stats from Supabase and emails the CEO a rich digest.
 */
export async function GET(req: NextRequest) {
  // Security: verify cron secret
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // -------------------------------------------------------------------------
  // Run all queries in parallel, handling missing tables gracefully
  // -------------------------------------------------------------------------

  const [
    activeTasksRes,
    createdTodayRes,
    overdueRes,
    tasksByStageRes,
    postsScheduledRes,
    postsPublishedRes,
    moderationRes,
    crisisClientsRes,
    assigneesRes,
    allClientsRes,
    postsThisMonthRes,
    apiCostRes,
  ] = await Promise.all([
    // 1. Total active tasks
    db.from('tasks')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'completed'),

    // 2. Tasks created today
    db.from('tasks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today),

    // 3. Overdue tasks
    db.from('tasks')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', today)
      .neq('status', 'completed'),

    // 4. Tasks by stage (need the rows, not a count)
    db.from('tasks')
      .select('pipeline_stage')
      .neq('status', 'completed'),

    // 5. Posts scheduled for today only (not future dates)
    db.from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('scheduled_at', today)
      .lt('scheduled_at', tomorrowStr),

    // 6. Posts published today only
    db.from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', today)
      .lt('published_at', tomorrowStr),

    // 7. Pending moderation items
    db.from('moderation_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // 8. Clients in crisis mode
    db.from('clients')
      .select('name')
      .eq('is_in_crisis', true),

    // 9. Active task assignees (for top-3 calculation)
    db.from('tasks')
      .select('assigned_to')
      .neq('status', 'completed')
      .not('assigned_to', 'is', null),

    // 10. All active clients with normalized_profile for posts_per_week
    db.from('clients')
      .select('id, name, normalized_profile')
      .eq('status', 'active'),

    // 11. Posts published or scheduled this month (for monthly requirements)
    db.from('scheduled_posts')
      .select('client_id, status')
      .in('status', ['published', 'scheduled'])
      .gte('scheduled_at', monthStart),

    // 12. API cost this month
    db.from('api_usage')
      .select('cost_usd')
      .gte('created_at', monthStart),
  ])

  // -------------------------------------------------------------------------
  // Process stage counts
  // -------------------------------------------------------------------------
  const stageCounts = (tasksByStageRes.data ?? []).reduce(
    (acc: Record<string, number>, t: { pipeline_stage: string }) => {
      acc[t.pipeline_stage] = (acc[t.pipeline_stage] ?? 0) + 1
      return acc
    },
    {},
  )
  const tasksByStage = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }))

  // -------------------------------------------------------------------------
  // Process top assignees
  // -------------------------------------------------------------------------
  const assigneeCounts = (assigneesRes.data ?? []).reduce(
    (acc: Record<string, number>, t: { assigned_to: string }) => {
      acc[t.assigned_to] = (acc[t.assigned_to] ?? 0) + 1
      return acc
    },
    {},
  )
  const top3Ids = Object.entries(assigneeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)

  let topAssignees: { name: string; tasks: number }[] = []
  if (top3Ids.length > 0) {
    const { data: topUsers } = await db
      .from('users')
      .select('id, name')
      .in('id', top3Ids)

    topAssignees = top3Ids
      .map(id => {
        const user = (topUsers ?? []).find((u: { id: string; name: string }) => u.id === id)
        return {
          name: user?.name ?? 'Unknown',
          tasks: assigneeCounts[id] ?? 0,
        }
      })
      .filter(a => a.name !== 'Unknown' || a.tasks > 0)
  }

  // -------------------------------------------------------------------------
  // Determine CEO name and email
  // -------------------------------------------------------------------------
  const ceoEmail = process.env.CEO_EMAIL ?? 'mostafaatef7@gmail.com'

  let ceoName = 'CEO'
  const { data: ceoUser } = await db
    .from('users')
    .select('name')
    .eq('role', 'ceo')
    .limit(1)
    .single()
  if (ceoUser?.name) ceoName = ceoUser.name

  // -------------------------------------------------------------------------
  // Monthly requirements per client
  // -------------------------------------------------------------------------
  const postsThisMonthByClient = (postsThisMonthRes.data ?? []).reduce(
    (acc: Record<string, number>, p: { client_id: string }) => {
      acc[p.client_id] = (acc[p.client_id] ?? 0) + 1
      return acc
    },
    {},
  )

  const monthlyRequirements = (allClientsRes.data ?? []).map((c: { id: string; name: string; normalized_profile?: Record<string, unknown> }) => {
    const postsPerWeek = (c.normalized_profile?.posts_per_week as number | undefined) ?? 4
    const target = postsPerWeek * 4
    const actual = postsThisMonthByClient[c.id] ?? 0
    return { name: c.name, target, actual }
  })

  // -------------------------------------------------------------------------
  // API cost this month
  // -------------------------------------------------------------------------
  const apiCostThisMonth = (apiCostRes.data ?? []).reduce(
    (sum: number, row: { cost_usd: number }) => sum + (Number(row.cost_usd) || 0),
    0,
  )

  // -------------------------------------------------------------------------
  // Build stats object
  // -------------------------------------------------------------------------
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const stats: DailyDigestStats = {
    date: dateLabel,
    totalActiveTasks: activeTasksRes.count ?? 0,
    tasksCreatedToday: createdTodayRes.count ?? 0,
    overdueTasks: overdueRes.count ?? 0,
    tasksByStage,
    postsScheduledToday: postsScheduledRes.count ?? 0,
    postsPublishedToday: postsPublishedRes.count ?? 0,
    pendingModeration: moderationRes.count ?? 0,
    clientsInCrisis: (crisisClientsRes.data ?? []).map((c: { name: string }) => c.name),
    topAssignees,
    monthlyRequirements,
    apiCostThisMonth,
  }

  // -------------------------------------------------------------------------
  // Send email
  // -------------------------------------------------------------------------
  const result = await sendDailyDigest({ ceoEmail, ceoName, stats })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent_to: ceoEmail })
}
