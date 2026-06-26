import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Client, BrandIdentity, PerformanceIntel, DesignBrief, ClientNormalizedProfile } from '@/lib/types'

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
    performance_intel: (row.performance_intel as PerformanceIntel | undefined) ?? undefined,
    performance_analyzed_at: row.performance_analyzed_at as string | undefined,
    design_brief_json: (row.design_brief_json as DesignBrief | null | undefined) ?? null,
    normalized_profile: (row.normalized_profile as ClientNormalizedProfile | undefined) ?? undefined,
    chatwoot_inbox_id: (row.chatwoot_inbox_id as number | undefined) ?? undefined,
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

export interface SocialProfile {
  platform: string
  handle: string
  url: string
}

export interface CreateClientInput {
  name: string
  industry: string
  primary_color: string
  language: 'en' | 'ar' | 'both'
  dialect?: 'msa' | 'saudi' | 'egyptian' | 'gulf'
  website?: string
  tone_formal: number
  tone_energy: number
  audience: string
  key_messages: string[]
  platforms: string[]
  competitors?: { handle: string; platform: string }[]
  social_profiles?: SocialProfile[]
  metricool_blog_id?: string
  posts_per_week?: number
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateClientInput): Promise<Client> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      let res: Response
      try {
        res = await fetch('/api/clients/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        })
      } catch (fetchErr) {
        throw new Error(fetchErr instanceof Error && fetchErr.name === 'AbortError'
          ? 'Request timed out — check your connection'
          : String(fetchErr))
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` })) as { error?: string }
        throw new Error(err.error ?? `Server error ${res.status}`)
      }
      const { client } = await res.json() as { client: Record<string, unknown> }
      const mapped = mapClient(client)

      // Fire-and-forget: scrape own social profiles in background
      const profilesToScrape = (input.social_profiles ?? []).filter(p => p.handle)
      if (profilesToScrape.length > 0) {
        void fetch(`/api/clients/${mapped.id}/scrape-profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profiles: profilesToScrape }),
        }).catch(() => {})
      }

      return mapped
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
