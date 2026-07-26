import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
  reactions?: Record<string, string[]>
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

async function dispatchMentionNotifications(
  body: string,
  taskId: string,
  taskTitle: string,
  commenterName: string,
) {
  const mentions = body.match(/@(\w+)/g)?.map(m => m.slice(1)) ?? []
  if (!mentions.length) return
  const { data: users } = await supabase.from('users').select('id, name')
  if (!users?.length) return
  const bodyPreview = body.slice(0, 120)
  const rows = mentions
    .map(first => users.find(u => (u.name as string).split(' ')[0].toLowerCase() === first.toLowerCase()))
    .filter(Boolean)
    .map(u => ({
      action: 'comment.mentioned',
      entity_type: 'task',
      entity_id: taskId,
      user_id: (u as { id: string }).id,
      metadata: { task_title: taskTitle, commenter_name: commenterName, body_preview: bodyPreview },
    }))
  if (rows.length) await supabase.from('audit_log').insert(rows)
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      task_id: string
      user_id: string
      body: string
      organization_id?: string | null
      task_title?: string
      commenter_name?: string
    }) => {
      const { task_title, commenter_name, ...insertPayload } = payload
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ ...insertPayload, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      // Fire @mention notifications without blocking
      if (task_title && commenter_name) {
        dispatchMentionNotifications(payload.body, payload.task_id, task_title, commenter_name).catch(() => {})
      }
      return data as TaskComment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', data.task_id] })
    },
  })
}

export function useToggleCommentReaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ commentId, taskId, emoji, userId, currentReactions }: {
      commentId: string
      taskId: string
      emoji: string
      userId: string
      currentReactions: Record<string, string[]>
    }) => {
      const next = { ...currentReactions }
      const users = next[emoji] ?? []
      if (users.includes(userId)) {
        next[emoji] = users.filter(u => u !== userId)
        if (!next[emoji].length) delete next[emoji]
      } else {
        next[emoji] = [...users, userId]
      }
      const { error } = await supabase
        .from('task_comments')
        .update({ reactions: next })
        .eq('id', commentId)
      if (error) throw error
      return { taskId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', data.taskId] })
    },
  })
}
