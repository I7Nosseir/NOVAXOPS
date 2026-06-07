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
  metricool_blog_id?: string
  posts_per_week?: number
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateClientInput): Promise<Client> => {
      const initials = input.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

      const toneDesc = [
        input.tone_formal > 60 ? 'formal' : input.tone_formal < 40 ? 'casual' : 'balanced',
        input.tone_energy > 60 ? 'playful' : input.tone_energy < 40 ? 'serious' : 'measured',
      ].join(', ')

      const competitorHandles = (input.competitors ?? []).map(c => `${c.handle} (${c.platform})`)

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: input.name,
          initials,
          color: input.primary_color,
          status: 'active',
          metricool_blog_id: input.metricool_blog_id || null,
          brand_identity_json: {
            primary_color: input.primary_color,
            secondary_color: '#FFFFFF',
            tone_of_voice: `${toneDesc.charAt(0).toUpperCase() + toneDesc.slice(1)}. ${input.audience}`,
            target_audience: input.audience,
            key_messages: input.key_messages.filter(Boolean),
            industry: input.industry,
            language: input.language,
            dialect: input.dialect ?? 'msa',
            website: input.website ?? '',
            platforms: input.platforms,
            posts_per_week: input.posts_per_week ?? 4,
          },
          competitor_context_json: competitorHandles,
          reference_links: [],
        })
        .select()
        .single()

      if (error) throw error
      const client = mapClient(data as Record<string, unknown>)

      // Seed competitor_snapshots for each competitor added during onboarding
      if (input.competitors && input.competitors.length > 0) {
        await supabase.from('competitor_snapshots').insert(
          input.competitors.map(c => ({
            client_id: client.id,
            competitor_handle: c.handle,
            platform: c.platform,
            followers: 0,
            avg_er: 0,
            posting_frequency: 0,
            top_content_types: {},
            captured_at: new Date().toISOString(),
          }))
        )
      }

      return client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
