'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// Roles that bypass client assignment filtering — always see all clients
const BYPASS_ROLES = ['admin', 'ceo', 'creative_director'] as const

/**
 * Returns the current user's assigned client IDs.
 * - null  → user is admin/ceo/creative_director, no restriction (sees everything)
 * - []    → user has no assignments (sees nothing)
 * - [...] → user is restricted to these client IDs
 */
export function useMyAssignedClientIds(): string[] | null {
  const { user } = useAuth()
  const isBypass = !!user?.role && (BYPASS_ROLES as readonly string[]).includes(user.role)

  const { data } = useQuery({
    queryKey: ['client-assignments', 'mine', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('user_id', user!.id)
      if (error) return [] as string[]
      return (data ?? []).map(r => r.client_id as string)
    },
    enabled: !!user && !isBypass,
    staleTime: 60_000,
  })

  if (!user) return null
  if (isBypass) return null
  // Still loading — treat as unrestricted
  if (data === undefined) return null
  // No assignments yet — treat as unrestricted (explicit assignment restricts access)
  if (data.length === 0) return null
  return data
}

// Admin: fetch assignments for a specific user
export function useUserAssignments(userId: string | null) {
  const { data: clientIds = [], isLoading } = useQuery({
    queryKey: ['client-assignments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('user_id', userId!)
      if (error) return [] as string[]
      return (data ?? []).map(r => r.client_id as string)
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
  return { clientIds, isLoading }
}

// Admin mutation: replace a user's full client assignment list atomically
export function useSaveClientAssignments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, clientIds }: { userId: string; clientIds: string[] }) => {
      // Remove all existing assignments first
      const { error: delError } = await supabase
        .from('client_assignments')
        .delete()
        .eq('user_id', userId)
      if (delError) throw delError

      // Insert new assignments
      if (clientIds.length > 0) {
        const { error: insError } = await supabase
          .from('client_assignments')
          .insert(clientIds.map(cid => ({ user_id: userId, client_id: cid })))
        if (insError) throw insError
      }
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['client-assignments', userId] })
      queryClient.invalidateQueries({ queryKey: ['client-assignments', 'mine'] })
    },
  })
}
