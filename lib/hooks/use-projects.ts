import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

function mapProject(row: Record<string, unknown>): Project {
  const qs = (row.quarter_strategy as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    name: row.name as string,
    status: row.status as Project['status'],
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    quarter_strategy: {
      goals: (qs.goals as string[]) ?? [],
      themes: (qs.themes as string[]) ?? [],
      kpis: (qs.kpis as string[]) ?? [],
    },
    created_at: row.created_at as string,
  }
}

export interface CreateProjectInput {
  name: string
  client_id: string
  start_date: string
  end_date: string
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: input.name,
          client_id: input.client_id,
          status: 'active',
          start_date: input.start_date,
          end_date: input.end_date,
          quarter_strategy: { goals: [], themes: [], kpis: [] },
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useProjects(clientId?: string) {
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', clientId],
    queryFn: async () => {
      let query = supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(mapProject)
    },
  })
  return { projects, isLoading, error }
}
