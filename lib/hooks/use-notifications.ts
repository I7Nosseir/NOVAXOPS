'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useMyAssignedClientIds } from '@/lib/hooks/use-client-assignments'

export interface AppNotification {
  id: string
  type: 'task' | 'approval' | 'moderation' | 'ai' | 'published'
  title: string
  body: string
  read: boolean
  time: string        // relative display string, e.g. "2m ago"
  created_at: string  // ISO timestamp
}

function mapAuditToNotification(row: Record<string, unknown>): AppNotification {
  const action = String(row.action ?? '')
  const entityType = String(row.entity_type ?? '')

  // Derive notification type from action + entity_type
  let type: AppNotification['type'] = 'task'
  if (action.includes('approval') || action.includes('approve')) type = 'approval'
  else if (action.includes('moderation') || action.includes('comment') || entityType === 'moderation') type = 'moderation'
  else if (action.includes('publish') || action.includes('post') || entityType === 'post') type = 'published'
  else if (action.includes('ai') || action.includes('generate')) type = 'ai'

  // Build a human-readable title from the action string (e.g. "task.stage_change" → "Task Stage Change")
  const title = action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  // Best-effort body: try metadata fields, then fall back to entity context
  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  const body =
    String(metadata.description ?? metadata.note ?? metadata.message ?? '').trim() ||
    (row.entity_type ? `${String(row.entity_type)} action recorded` : 'Activity logged')

  // Relative time
  const createdAt = String(row.created_at ?? '')
  const diffMs = Date.now() - new Date(createdAt).getTime()
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
    // audit_log has no read flag — treat all as read; unread tracking can be
    // added later via a separate user_notification_reads table
    read: true,
    time,
    created_at: createdAt,
  }
}

export function useNotifications() {
  useRealtime('audit_log', ['notifications'])
  const assignedClientIds = useMyAssignedClientIds()

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications', assignedClientIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, entity_type, entity_id, metadata, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50) // fetch more so we have enough after client-side filtering
      if (error) return [] as AppNotification[]
      const all = (data ?? []).map(row => mapAuditToNotification(row as Record<string, unknown>))

      // Scope to assigned clients: if metadata.client_id exists and user has restrictions, filter
      if (assignedClientIds === null) return all.slice(0, 20)
      return all
        .filter(n => {
          const meta = (data?.find(r => String(r.id) === n.id)?.metadata ?? {}) as Record<string, unknown>
          const clientId = meta.client_id as string | undefined
          // If no client_id in metadata, include (can't determine scope)
          if (!clientId) return true
          return assignedClientIds.includes(clientId)
        })
        .slice(0, 20)
    },
    staleTime: 30_000,
    // No polling — realtime subscription handles live updates
  })
  return { notifications, isLoading, error }
}
