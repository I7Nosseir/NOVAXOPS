import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
    page_permissions: (row.page_permissions as string[] | null) ?? null,
    phone_number: (row.phone_number as string | null) ?? null,
    needs_onboarding: (row.needs_onboarding as boolean) ?? false,
    is_super_admin: (row.is_super_admin as boolean) ?? false,
    organization_id: row.organization_id as string | undefined,
  }
}

export function useUsers() {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, initials, color, page_permissions, phone_number, needs_onboarding, is_super_admin, organization_id')
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
    mutationFn: async ({ email, name, role, page_permissions }: { email: string; name: string; role: UserRole; page_permissions?: string[] | null }): Promise<InviteResult> => {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 20_000)
      try {
        const res = await fetch('/api/auth/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, role, page_permissions }),
          signal: ac.signal,
        })
        const data = await res.json() as InviteResult & { error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Invite failed')
        return data
      } catch (fetchErr) {
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Request timed out — please try again')
        }
        throw fetchErr
      } finally {
        clearTimeout(timer)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Something went wrong')
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
    onError: (err: Error) => {
      toast.error(err.message ?? 'Something went wrong')
    },
  })
}

export function useResendInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, inviterName }: { id: string; inviterName?: string }): Promise<InviteResult> => {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 15_000)
      try {
        const res = await fetch(`/api/auth/invitations/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviterName }),
          signal: ac.signal,
        })
        const data = await res.json() as InviteResult & { error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Resend failed')
        return data
      } catch (fetchErr) {
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Request timed out — please try again')
        }
        throw fetchErr
      } finally {
        clearTimeout(timer)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Something went wrong')
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Something went wrong')
    },
  })
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, page_permissions }: { userId: string; page_permissions: string[] | null }) => {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_permissions }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Something went wrong')
    },
  })
}
