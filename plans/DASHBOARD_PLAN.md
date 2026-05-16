# Dashboard — Action Plan

> **Goal:** Replace every hardcoded number, array, and list on the dashboard with real Supabase queries. Add realtime updates for live KPI changes.

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Real KPI queries | **DONE** | `lib/hooks/use-dashboard.ts` — active tasks, due today, pending moderation, AI cost, posts scheduled/published |
| Phase 2 — Real charts | **DONE** | `useWeeklyActivity()` queries real tasks + posts; pipeline distribution derived from `useTasks()` |
| Phase 3 — Recent tasks & top posts | **DONE** | Sorted from real `useTasks()` / `usePosts()` results |
| Phase 4 — Client health | **DONE** | `useClientHealth()` derived from real clients + tasks + posts |
| Phase 5 — Realtime updates | PENDING | No Supabase Realtime channel subscription wired to dashboard |

---

## Current State Audit

### What is hardcoded

| Element | How it's currently populated |
|---------|------------------------------|
| 8 KPI cards (Active Tasks, Due Today, etc.) | `getStats()` from `lib/mock-data.ts` — returns static numbers |
| Weekly Activity chart | `ACTIVITY_DATA` — hardcoded array of 7 days |
| Pipeline Distribution chart | `STAGE_DIST` — hardcoded array of 10 stage counts |
| Recent Tasks list | Sliced from `TASKS` mock array |
| Top Performing Posts | Sliced + sorted from `POSTS` mock array |
| Client Health section | Derived from mock clients + tasks |
| AI cost | Hardcoded `$47.23` |

### What already works

- `useTasks()` — real Supabase query (tasks are real if any exist)
- `usePosts()` — real Supabase query
- `useClients()` — real Supabase query

---

## Phase 1 — Real KPI Queries

### New hook: `useDashboardStats()`

**File to create:** `lib/hooks/use-dashboard.ts`

Each KPI is a separate targeted query. Batched into one hook for convenience:

```ts
export function useDashboardStats() {
  const queryClient = useQueryClient()

  const activeTasks = useQuery({
    queryKey: ['stats', 'active_tasks'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'completed')
      return count ?? 0
    },
  })

  const dueToday = useQuery({
    queryKey: ['stats', 'due_today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('due_date', today)
        .neq('status', 'completed')
      return count ?? 0
    },
  })

  const pendingApprovals = useQuery({
    queryKey: ['stats', 'pending_approvals'],
    queryFn: async () => {
      const { count } = await supabase
        .from('approvals')
        .select('*', { count: 'exact', head: true })
        .eq('overall_status', 'pending')
      return count ?? 0
    },
  })

  const pendingModeration = useQuery({
    queryKey: ['stats', 'pending_moderation'],
    queryFn: async () => {
      const { count } = await supabase
        .from('moderation_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      return count ?? 0
    },
  })

  const aiCostMonth = useQuery({
    queryKey: ['stats', 'ai_cost'],
    queryFn: async () => {
      const start = new Date()
      start.setDate(1); start.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('api_usage')
        .select('cost_usd')
        .gte('created_at', start.toISOString())
      return (data ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0)
    },
  })

  const postsScheduled = useQuery({
    queryKey: ['stats', 'posts_scheduled'],
    queryFn: async () => {
      const { count } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'scheduled')
      return count ?? 0
    },
  })

  const postsPublished = useQuery({
    queryKey: ['stats', 'posts_published'],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('published_at', start.toISOString())
      return count ?? 0
    },
  })

  return {
    activeTasks: activeTasks.data ?? 0,
    dueToday: dueToday.data ?? 0,
    pendingApprovals: pendingApprovals.data ?? 0,
    pendingModeration: pendingModeration.data ?? 0,
    aiCostMonth: aiCostMonth.data ?? 0,
    postsScheduled: postsScheduled.data ?? 0,
    postsPublished: postsPublished.data ?? 0,
    isLoading: activeTasks.isLoading || dueToday.isLoading,
  }
}
```

### Pipeline velocity

Pipeline velocity (avg days per stage) is complex to compute client-side. For now:

```ts
const pipelineVelocity = useQuery({
  queryKey: ['stats', 'velocity'],
  queryFn: async () => {
    // AVG of (updated_at - created_at) for tasks that changed stage this month
    // Approximate: (today - created_at) / pipeline_stage_index
    // This is a rough proxy — a proper velocity requires stage_history tracking
    return 3.2 // placeholder until stage history is built
  },
})
```

A proper pipeline velocity requires a `task_stage_history` table (tracks every stage transition with timestamp). That's a future addition.

---

## Phase 2 — Real Charts

### Weekly Activity chart

```ts
export function useWeeklyActivity() {
  return useQuery({
    queryKey: ['stats', 'weekly_activity'],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      // Tasks completed per day (updated to 'completed' status)
      const { data: taskData } = await supabase
        .from('tasks')
        .select('updated_at')
        .eq('status', 'completed')
        .gte('updated_at', days[0])

      // Posts published per day
      const { data: postData } = await supabase
        .from('scheduled_posts')
        .select('published_at')
        .eq('status', 'published')
        .gte('published_at', days[0])

      return days.map(day => ({
        day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
        tasks: (taskData ?? []).filter(t => t.updated_at.startsWith(day)).length,
        posts: (postData ?? []).filter(p => p.published_at?.startsWith(day)).length,
      }))
    },
  })
}
```

### Pipeline distribution chart

```ts
export function usePipelineDistribution() {
  const { tasks } = useTasks()

  // Derive from task list (already loaded for recent tasks — no extra query)
  return PIPELINE_STAGES.map(stage => ({
    stage: STAGE_CONFIG[stage].label,
    count: tasks.filter(t => t.pipeline_stage === stage).length,
    color: stage,
  }))
}
```

---

## Phase 3 — Recent Tasks & Top Posts (Real Data)

### Recent tasks

Already using `useTasks()` — just change from mock to real:

```ts
const { tasks } = useTasks()
const recentTasks = [...tasks]
  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  .slice(0, 6)
```

No new hook needed — `useTasks()` already returns the full list.

### Top performing posts

```ts
const { posts } = usePosts()
const topPosts = [...posts]
  .filter(p => p.performance?.engagement_rate)
  .sort((a, b) => (b.performance!.engagement_rate) - (a.performance!.engagement_rate))
  .slice(0, 4)
```

No new hook needed.

---

## Phase 4 — Client Health (Real Data)

### Current

`MOCK_CLIENT_HEALTH` in dashboard — hardcoded per client with `completionRate` and `scheduledPosts`.

### Real data

```ts
export function useClientHealth() {
  const { clients } = useClients()
  const { tasks } = useTasks()
  const { posts } = usePosts()

  return clients.map(client => {
    const clientTasks = tasks.filter(t => t.client_id === client.id)
    const completed = clientTasks.filter(t => t.status === 'completed').length
    const total = clientTasks.length
    const scheduled = posts.filter(p => p.client_id === client.id && p.status === 'scheduled').length

    return {
      client,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      scheduledPosts: scheduled,
      health: completed / total > 0.7 ? 'good' : completed / total > 0.4 ? 'warning' : 'at-risk',
    }
  })
}
```

All derived from already-loaded data — no extra queries.

---

## Phase 5 — Realtime Updates

**KPI cards should update live when tasks/posts change.**

### Implementation

Add Supabase Realtime subscriptions that invalidate the stats queries on change:

```ts
// In useDashboardStats() or in a separate useRealtimeDashboard() hook:
useEffect(() => {
  const channel = supabase
    .channel('dashboard_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_posts' }, () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moderation_items' }, () => {
      queryClient.invalidateQueries({ queryKey: ['stats', 'pending_moderation'] })
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [queryClient])
```

---

## Build Order

```
Phase 1a  Create lib/hooks/use-dashboard.ts
Phase 1b  useDashboardStats() — all 7 KPI queries
Phase 1c  Replace hardcoded stats in dashboard/page.tsx with hook data
Phase 1d  Add loading skeleton to KPI cards

Phase 2a  useWeeklyActivity() in use-dashboard.ts
Phase 2b  usePipelineDistribution() derived from useTasks()
Phase 2c  Replace ACTIVITY_DATA and STAGE_DIST in dashboard page

Phase 3a  Replace RECENT_TASKS with sorted useTasks() result
Phase 3b  Replace TOP_POSTS with sorted usePosts() result

Phase 4a  useClientHealth() derived from all loaded data
Phase 4b  Replace MOCK_CLIENT_HEALTH in dashboard page

Phase 5a  Add Realtime subscriptions to use-dashboard.ts
Phase 5b  Test: create a task → KPI card updates
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/hooks/use-dashboard.ts` | 1, 2, 4, 5 | Create |
| `app/(app)/dashboard/page.tsx` | 1, 2, 3, 4 | Edit |

---

## Scope Boundary

- **No pipeline velocity tracking** — requires `task_stage_history` table. Placeholder value for now.
- **No multi-org / workspace switching** — single-agency system.
- **No custom date range for dashboard** — always shows current month + last 7 days.
- **No export** — dashboard is read-only display.
