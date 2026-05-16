import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ApprovalRequest {
  id: string
  client_id: string
  title: string
  token: string
  post_ids: string[]
  status: 'pending' | 'approved' | 'changes_requested'
  client_note: string
  created_by: string
  created_at: string
  expires_at: string
  post_statuses: Record<string, string>
}

interface RawApprovalRow {
  id: string
  client_id: string
  title: string
  token: string
  post_ids: string[]
  status: string
  client_note: string
  created_by: string
  created_at: string
  expires_at: string
  approval_post_statuses: { post_id: string; status: string }[]
}

function mapRequest(row: RawApprovalRow): ApprovalRequest {
  const post_statuses: Record<string, string> = {}
  for (const ps of row.approval_post_statuses ?? []) {
    post_statuses[ps.post_id] = ps.status
  }
  return {
    id: row.id,
    client_id: row.client_id,
    title: row.title,
    token: row.token,
    post_ids: row.post_ids ?? [],
    status: row.status as ApprovalRequest['status'],
    client_note: row.client_note ?? '',
    created_by: row.created_by,
    created_at: row.created_at,
    expires_at: row.expires_at,
    post_statuses,
  }
}

export function useApprovalRequests() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['approval-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*, approval_post_statuses(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as RawApprovalRow[]).map(mapRequest)
    },
  })
  return { requests, isLoading }
}

export function useCreateApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      client_id: string
      title: string
      post_ids: string[]
      expiry_days: number
    }): Promise<{ id: string; token: string }> => {
      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create approval request')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
    },
  })
}

export function useSubmitApprovalReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      token: string
      decisions: Record<string, { status: 'approved' | 'changes_requested'; note: string }>
      client_note: string
    }) => {
      const res = await fetch('/api/approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit review')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
    },
  })
}
