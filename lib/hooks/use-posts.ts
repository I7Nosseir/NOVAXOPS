import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ScheduledPost, PostPerformance, SocialPlatform } from '@/lib/types'

function mapPost(row: Record<string, unknown>): ScheduledPost {
  const perf = row.performance_data as Record<string, unknown>
  const mediaUrls = (row.media_urls as string[]) ?? []
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    client_id: row.client_id as string,
    platforms: (row.platforms as SocialPlatform[]) ?? [],
    caption: row.caption as string,
    media_url: mediaUrls[0],
    scheduled_at: row.scheduled_at as string,
    status: row.status as ScheduledPost['status'],
    performance: perf && Object.keys(perf).length > 0 ? (perf as unknown as PostPerformance) : undefined,
    published_at: row.published_at as string | undefined,
  }
}

export function usePosts(clientId?: string) {
  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ['posts', clientId],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(mapPost)
    },
  })
  return { posts, isLoading, error }
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledPost> & { id: string }) => {
      const { error } = await supabase.from('scheduled_posts').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
