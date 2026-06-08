import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Asset } from '@/lib/types'

function mapAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    source: row.source as Asset['source'],
    type: row.type as Asset['type'],
    title: row.title as string,
    file_url: row.file_url as string,
    thumbnail_url: row.thumbnail_url as string,
    license_info: row.license_info as string,
    created_at: row.created_at as string,
  }
}

export function useAssets(clientId?: string, source?: Asset['source']) {
  const { data: assets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['assets', clientId, source],
    queryFn: async () => {
      let query = supabase.from('assets').select('*').order('created_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      if (source) query = query.eq('source', source)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(mapAsset)
    },
  })
  return { assets, isLoading, error, refetch }
}

export function useAIGenerations(clientId?: string) {
  return useAssets(clientId, 'ai')
}
