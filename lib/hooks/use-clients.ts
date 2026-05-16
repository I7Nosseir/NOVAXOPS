import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Client, BrandIdentity } from '@/lib/types'

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    initials: row.initials as string,
    color: row.color as string,
    status: row.status as Client['status'],
    brand_identity: (row.brand_identity_json as BrandIdentity) ?? {} as BrandIdentity,
    competitor_context: (row.competitor_context_json as string[]) ?? [],
    reference_links: (row.reference_links as string[]) ?? [],
    metricool_blog_id: row.metricool_blog_id as string | undefined,
    respond_io_channel_id: row.respond_io_channel_id as string | undefined,
    crisis_mode: (row.crisis_mode as boolean | undefined) ?? false,
    created_at: row.created_at as string,
  }
}

export function useClients() {
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []).map(mapClient)
    },
  })
  return { clients, isLoading, error }
}

export function useClient(id: string | null | undefined) {
  const { data: client = null, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return mapClient(data)
    },
    enabled: !!id,
  })
  return { client, isLoading }
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { error } = await supabase.from('clients').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
