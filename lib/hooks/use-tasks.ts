import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, PipelineStage, Priority, TaskStatus, ChecklistItem, TaskRelation, TaskTimeLog } from '@/lib/types'

export type { TaskRelation, TaskTimeLog }

export interface TaskFilters {
  clientIds?: string[]
  projectId?: string
  assignedTo?: string[]
  priorities?: Priority[]
  stages?: PipelineStage[]
  statuses?: TaskStatus[]
  subTypes?: string[]
  dueDatePreset?: 'overdue' | 'today' | 'this_week' | ''
  /** When true, return ONLY templates. When false/undefined, exclude templates. */
  templatesOnly?: boolean
}

export type CreateTaskPayload = {
  title: string
  description: string
  final_submission?: string | null
  client_id: string
  project_id: string | null
  assigned_to: string | null
  created_by?: string | null
  pipeline_stage: PipelineStage
  priority: Priority
  status: TaskStatus
  sub_type?: string | null
  due_date: string | null
  due_time?: string | null
  start_date?: string | null
  estimated_hours?: number | null
  tags: string[]
  linked_doc_ids?: string[]
  is_template?: boolean
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    project_id: (row.project_id as string) ?? null,
    client_id: row.client_id as string,
    assigned_to: (row.assigned_to as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? '',
    final_submission: (row.final_submission as string) ?? null,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    sub_type: (row.sub_type as string) ?? null,
    due_date: (row.due_date as string) ?? null,
    due_time: (row.due_time as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    seen_at: (row.seen_at as string) ?? null,
    seen_by: (row.seen_by as string) ?? null,
    read_at: (row.read_at as string) ?? null,
    read_by: (row.read_by as string) ?? null,
    linked_doc_ids: (row.linked_doc_ids as string[]) ?? [],
    work_submission: (row.work_submission as string | null) ?? null,
    checklist: (row.checklist as ChecklistItem[] | null) ?? [],
    watchers: (row.watchers as string[] | null) ?? [],
    description_json: (row.description_json as Record<string, unknown> | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    estimated_hours: (row.estimated_hours as number | null) ?? null,
    is_pinned: (row.is_pinned as boolean | null) ?? false,
    is_template: (row.is_template as boolean | null) ?? false,
  }
}

export function useTasks(filters?: TaskFilters) {
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      // clientIds: undefined = no restriction; [] = user has no assigned clients (return nothing)
      if (filters?.clientIds !== undefined && filters.clientIds.length === 0) return [] as Task[]
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false })
      if (filters?.templatesOnly) {
        query = query.eq('is_template', true)
      } else {
        query = query.eq('is_template', false)
      }
      if (filters?.clientIds?.length) query = query.in('client_id', filters.clientIds)
      if (filters?.projectId) query = query.eq('project_id', filters.projectId)
      if (filters?.assignedTo?.length) query = query.in('assigned_to', filters.assignedTo)
      if (filters?.priorities?.length) query = query.in('priority', filters.priorities)
      if (filters?.stages?.length) query = query.in('pipeline_stage', filters.stages)
      if (filters?.statuses?.length) query = query.in('status', filters.statuses)
      if (filters?.subTypes?.length) query = query.in('sub_type', filters.subTypes)
      if (filters?.dueDatePreset === 'overdue') {
        query = query.lt('due_date', new Date().toISOString().split('T')[0])
      } else if (filters?.dueDatePreset === 'today') {
        const today = new Date().toISOString().split('T')[0]
        query = query.eq('due_date', today)
      } else if (filters?.dueDatePreset === 'this_week') {
        const end = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]
        query = query.lte('due_date', end)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(mapTask)
    },
  })
  return { tasks, isLoading, error }
}

export function useUpdateTaskStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, stage }: { taskId: string; stage: PipelineStage }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

async function notifyWatchers(
  taskId: string,
  watchers: string[],
  actorId: string,
  changeDescription: string,
  taskTitle: string,
) {
  if (!watchers.length) return
  const recipients = watchers.filter(w => w !== actorId)
  if (!recipients.length) return
  const rows = recipients.map(userId => ({
    action: 'task.watcher_update',
    entity_type: 'task',
    entity_id: taskId,
    user_id: userId,
    metadata: { change: changeDescription, task_title: taskTitle },
  }))
  await supabase.from('audit_log').insert(rows)
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      // Fetch current task for watcher notification context
      const { data: current } = await supabase
        .from('tasks')
        .select('watchers, title, pipeline_stage, status, assigned_to, created_by')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      // Assignment notification (existing behaviour)
      if (updates.assigned_to) {
        fetch('/api/tasks/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: id, assignedTo: updates.assigned_to }),
        }).catch(() => {})
      }

      // Watcher notifications for meaningful field changes
      if (current) {
        const watchers = (current.watchers as string[] | null) ?? []
        const actorId = current.created_by as string ?? ''
        const title = current.title as string ?? ''
        if (updates.pipeline_stage && updates.pipeline_stage !== current.pipeline_stage) {
          notifyWatchers(id, watchers, actorId, `Moved to ${updates.pipeline_stage}`, title).catch(() => {})
        } else if (updates.status && updates.status !== current.status) {
          notifyWatchers(id, watchers, actorId, `Status changed to ${updates.status}`, title).catch(() => {})
        } else if ('assigned_to' in updates && updates.assigned_to !== current.assigned_to) {
          notifyWatchers(id, watchers, actorId, 'Reassigned', title).catch(() => {})
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      // Seed watchers: creator + assignee (deduplicated)
      const initialWatchers = [...new Set([
        payload.created_by,
        payload.assigned_to,
      ].filter(Boolean) as string[])]

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, watchers: initialWatchers }),
      })
      const json = await res.json() as Record<string, unknown>
      if (!res.ok) {
        throw new Error((json.error as string | undefined) ?? 'Failed to create task.')
      }
      const task = mapTask(json)

      // Fire-and-forget assignment notification — does not block task creation
      if (payload.assigned_to) {
        fetch('/api/tasks/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, assignedTo: payload.assigned_to }),
        }).catch(() => {})
      }

      return task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

// ── Task Relations ────────────────────────────────────────────────────────────

export function useTaskRelations(taskId: string) {
  return useQuery({
    queryKey: ['task-relations', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const [{ data: asFrom }, { data: asTo }] = await Promise.all([
        supabase
          .from('task_relations')
          .select('*, linked_task:to_task_id(id, title, pipeline_stage, status, client_id)')
          .eq('from_task_id', taskId),
        supabase
          .from('task_relations')
          .select('*, linked_task:from_task_id(id, title, pipeline_stage, status, client_id)')
          .eq('to_task_id', taskId),
      ])
      return {
        outgoing: (asFrom ?? []) as TaskRelation[],
        incoming: (asTo ?? []) as TaskRelation[],
      }
    },
  })
}

export function useCreateTaskRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ fromId, toId, type }: { fromId: string; toId: string; type: 'blocks' | 'related' }) => {
      const { error } = await supabase.from('task_relations').insert({
        from_task_id: fromId,
        to_task_id: toId,
        relation_type: type,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.fromId] })
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.toId] })
    },
  })
}

export function useDeleteTaskRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ relationId, fromId, toId }: { relationId: string; fromId: string; toId: string }) => {
      const { error } = await supabase.from('task_relations').delete().eq('id', relationId)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.fromId] })
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.toId] })
    },
  })
}

// ── Time Logs ─────────────────────────────────────────────────────────────────

export function useTaskTimeLogs(taskId: string) {
  return useQuery({
    queryKey: ['time-logs', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .select('*, user:user_id(id, name, initials, color)')
        .eq('task_id', taskId)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TaskTimeLog[]
    },
  })
}

export function useCreateTimeLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, userId, hours, note, loggedAt }: {
      taskId: string; userId: string; hours: number; note?: string; loggedAt?: string
    }) => {
      const { error } = await supabase.from('task_time_logs').insert({
        task_id: taskId,
        user_id: userId,
        hours,
        note: note ?? null,
        logged_at: loggedAt ?? new Date().toISOString().split('T')[0],
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['time-logs', vars.taskId] })
    },
  })
}

export function useDeleteTimeLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, taskId }: { logId: string; taskId: string }) => {
      const { error } = await supabase.from('task_time_logs').delete().eq('id', logId)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['time-logs', vars.taskId] })
    },
  })
}
