import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { User, UserRole } from '@/lib/types'

export interface PendingInvitation {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

export interface InviteResult {
  ok: boolean
  emailSent: boolean
  emailError?: string
  fallbackCredentials?: { email: string; tempPassword: string }
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as UserRole,
    department: row.department as User['department'],
    initials: row.initials as string,
    color: row.color as string,
  }
}

export function useUsers() {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, initials, color')
        .order('name')
      if (error) throw error
      return (data ?? []).map(mapUser)
    },
  })
  return { users, isLoading, error }
}

export function usePendingInvitations() {
  const { data: invitations = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const res = await fetch('/api/auth/invitations')
      if (!res.ok) return []
      const data = await res.json() as { invitations: PendingInvitation[] }
      return data.invitations ?? []
    },
    staleTime: 30_000,
  })
  return { invitations, isLoading, refetch }
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, name, role }: { email: string; name: string; role: UserRole }): Promise<InviteResult> => {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      })
      const data = await res.json() as InviteResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/auth/invitations/${id}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Cancel failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
  })
}

export function useResendInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, inviterName }: { id: string; inviterName?: string }): Promise<InviteResult> => {
      const res = await fetch(`/api/auth/invitations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviterName }),
      })
      const data = await res.json() as InviteResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Resend failed')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
  })
}
