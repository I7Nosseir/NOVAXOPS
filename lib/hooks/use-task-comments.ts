import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
}

export function useTaskComments(taskId: string) {
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['task_comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TaskComment[]
    },
    enabled: !!taskId,
  })
  return { comments, isLoading }
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { task_id: string; user_id: string; body: string }) => {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data as TaskComment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', data.task_id] })
    },
  })
}
