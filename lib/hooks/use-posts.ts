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
    metricool_post_id: row.metricool_post_id as string | undefined,
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

export interface SchedulePostInput {
  client_id: string
  platforms: SocialPlatform[]
  caption: string
  caption_ar?: string
  media_url?: string
  media_urls?: string[]
  thumbnail_url?: string
  is_video?: boolean
  scheduled_at: string
  task_id?: string
  instagram_post_type?: 'POST' | 'REEL' | 'STORY'
  facebook_post_type?:  'POST' | 'REEL' | 'STORY'
}

/** Sends a post to Metricool for scheduling. Saves to DB first; falls back to draft if Metricool fails. */
export function useSchedulePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SchedulePostInput): Promise<{ post_id: string; metricool_post_id?: string; saved_as_draft?: boolean; error?: string }> => {
      const res = await fetch('/api/metricool/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok && !data.saved_as_draft) {
        throw new Error(data.error ?? 'Scheduling failed')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

/** Saves a post directly to DB as draft (no Metricool call). */
export function useSaveDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SchedulePostInput): Promise<ScheduledPost> => {
      const enPart = input.caption?.trim() ?? ''
      const arPart = input.caption_ar?.trim() ?? ''
      const finalCaption = enPart && arPart ? `${enPart}\n\n${arPart}` : enPart || arPart
      const dbMediaUrls = input.media_urls?.filter(Boolean).length
        ? input.media_urls.filter(Boolean)
        : input.media_url ? [input.media_url] : []
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          client_id: input.client_id,
          task_id: input.task_id ?? null,
          platforms: input.platforms,
          caption: finalCaption,
          media_urls: dbMediaUrls,
          scheduled_at: input.scheduled_at || null,
          status: 'draft',
        })
        .select()
        .single()
      if (error) throw error
      return mapPost(data as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
