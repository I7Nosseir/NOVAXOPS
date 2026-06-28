'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useMyAssignedClientIds } from '@/lib/hooks/use-client-assignments'
import { useAuth } from '@/lib/auth-context'
import { useCallback } from 'react'

export interface AppNotification {
  id: string
  type: 'task' | 'approval' | 'moderation' | 'ai' | 'published'
  title: string
  body: string
  read: boolean
  time: string        // relative display string, e.g. "2m ago"
  created_at: string  // ISO timestamp
}

function getLastReadAt(userId: string | undefined): number {
  if (typeof window === 'undefined' || !userId) return 0
  const raw = localStorage.getItem(`novax_notif_last_read_${userId}`)
  return raw ? parseInt(raw, 10) : 0
}

function setLastReadAt(userId: string | undefined, ts: number) {
  if (typeof window === 'undefined' || !userId) return
  localStorage.setItem(`novax_notif_last_read_${userId}`, String(ts))
}

function mapAuditToNotification(
  row: Record<string, unknown>,
  lastReadAt: number,
): AppNotification {
  const action = String(row.action ?? '')
  const entityType = String(row.entity_type ?? '')

  let type: AppNotification['type'] = 'task'
  if (action.includes('approval') || action.includes('approve')) type = 'approval'
  else if (action.includes('moderation') || action.includes('comment') || entityType === 'moderation') type = 'moderation'
  else if (action.includes('publish') || action.includes('post') || entityType === 'post') type = 'published'
  else if (action.includes('ai') || action.includes('generate')) type = 'ai'

  const title = action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  const body =
    String(metadata.description ?? metadata.note ?? metadata.message ?? '').trim() ||
    (row.entity_type ? `${String(row.entity_type)} action recorded` : 'Activity logged')

  const createdAt = String(row.created_at ?? '')
  const createdMs = new Date(createdAt).getTime()
  const diffMs = Date.now() - createdMs
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const time =
    diffMin < 1 ? 'just now' :
    diffMin < 60 ? `${diffMin}m ago` :
    diffHr < 24 ? `${diffHr}h ago` :
    `${Math.floor(diffHr / 24)}d ago`

  return {
    id: String(row.id),
    type,
    title,
    body,
    read: createdMs <= lastReadAt,
    time,
    created_at: createdAt,
  }
}

export function useNotifications() {
  const { user } = useAuth()
  const userId = user?.id
  const qc = useQueryClient()

  useRealtime('audit_log', ['notifications'])
  const assignedClientIds = useMyAssignedClientIds()

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications', assignedClientIds, userId],
    queryFn: async () => {
      const lastReadAt = getLastReadAt(userId)

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, entity_type, entity_id, metadata, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return [] as AppNotification[]
      const all = (data ?? []).map(row =>
        mapAuditToNotification(row as Record<string, unknown>, lastReadAt)
      )

      if (assignedClientIds === null) return all.slice(0, 20)
      return all
        .filter(n => {
          const meta = (data?.find(r => String(r.id) === n.id)?.metadata ?? {}) as Record<string, unknown>
          const clientId = meta.client_id as string | undefined
          if (!clientId) return true
          return assignedClientIds.includes(clientId)
        })
        .slice(0, 20)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const markAllRead = useCallback(() => {
    setLastReadAt(userId, Date.now())
    void qc.invalidateQueries({ queryKey: ['notifications'] })
  }, [userId, qc])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, isLoading, error, markAllRead, unreadCount }
}
