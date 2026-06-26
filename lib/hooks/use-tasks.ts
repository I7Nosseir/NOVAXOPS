import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, PipelineStage, Priority, TaskStatus } from '@/lib/types'

export interface TaskFilters {
  clientIds?: string[]
  projectId?: string
  assignedTo?: string[]
  priorities?: Priority[]
  stages?: PipelineStage[]
  statuses?: TaskStatus[]
  subTypes?: string[]
  dueDatePreset?: 'overdue' | 'today' | 'this_week' | ''
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
  tags: string[]
  linked_doc_ids?: string[]
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
    tags: (row.tags as string[]) ?? [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    seen_at: (row.seen_at as string) ?? null,
    seen_by: (row.seen_by as string) ?? null,
    read_at: (row.read_at as string) ?? null,
    read_by: (row.read_by as string) ?? null,
    linked_doc_ids: (row.linked_doc_ids as string[]) ?? [],
    work_submission: (row.work_submission as string | null) ?? null,
  }
}

export function useTasks(filters?: TaskFilters) {
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      // clientIds: undefined = no restriction; [] = user has no assigned clients (return nothing)
      if (filters?.clientIds !== undefined && filters.clientIds.length === 0) return [] as Task[]
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false })
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

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      // Fire assignment notification when a task is reassigned
      if (updates.assigned_to) {
        fetch('/api/tasks/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: id, assignedTo: updates.assigned_to }),
        }).catch(() => {})
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
      const now = new Date().toISOString()

      // Race against a 15-second timeout so the button never freezes forever
      const insertPromise = supabase
        .from('tasks')
        .insert({ ...payload, created_at: now, updated_at: now })
        .select()
        .single()

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Task creation timed out — check your connection and try again.')), 15_000)
      )

      const { data, error } = await Promise.race([insertPromise, timeoutPromise])
      if (error) {
        // Surface the real Supabase message so the user knows exactly what failed
        throw new Error(error.message ?? 'Failed to create task.')
      }
      const task = mapTask(data as Record<string, unknown>)

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
