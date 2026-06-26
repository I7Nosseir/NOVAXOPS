import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ModerationItem, SocialPlatform } from '@/lib/types'
import { useRealtime } from '@/lib/hooks/use-realtime'

function mapItem(row: Record<string, unknown>): ModerationItem {
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    platform: row.platform as SocialPlatform,
    commenter_name: row.commenter_name as string,
    commenter_handle: (row.commenter_handle as string) ?? '',
    comment_text: row.comment_text as string,
    post_caption: (row.post_caption as string) ?? '',
    ai_suggested_reply: row.ai_suggested_reply as string | undefined,
    final_reply: row.final_reply as string | undefined,
    status: row.status as ModerationItem['status'],
    created_at: row.created_at as string,
  }
}

export function usePendingModerationCount() {
  useRealtime('moderation_items', ['moderation', 'pending-count'])
  return useQuery({
    queryKey: ['moderation', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('moderation_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) return 0
      return count ?? 0
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

export function useModerationItems(clientId?: string, clientIds?: string[]) {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['moderation', clientId, clientIds],
    queryFn: async () => {
      // If an explicit clientIds scope is provided and empty, return nothing
      if (clientIds !== undefined && clientIds.length === 0) return [] as ModerationItem[]

      let query = supabase
        .from('moderation_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (clientId) {
        query = query.eq('client_id', clientId)
      } else if (clientIds && clientIds.length > 0) {
        query = query.in('client_id', clientIds)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(mapItem)
    },
  })
  return { items, isLoading, error }
}

export function useUpdateModerationItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      finalReply,
    }: {
      id: string
      status?: ModerationItem['status']
      finalReply?: string
    }) => {
      const updates: Record<string, unknown> = {}
      if (status) updates.status = status
      if (finalReply !== undefined) {
        updates.final_reply = finalReply
        updates.resolved_at = new Date().toISOString()
      }
      const { error } = await supabase.from('moderation_items').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
    },
  })
}
