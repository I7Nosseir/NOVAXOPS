import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, PipelineStage } from '@/lib/types'

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    client_id: row.client_id as string,
    assigned_to: row.assigned_to as string,
    title: row.title as string,
    description: row.description as string,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    due_date: row.due_date as string,
    tags: (row.tags as string[]) ?? [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function useTasks(filters?: { clientId?: string; projectId?: string; assignedTo?: string }) {
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false })
      if (filters?.clientId) query = query.eq('client_id', filters.clientId)
      if (filters?.projectId) query = query.eq('project_id', filters.projectId)
      if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
