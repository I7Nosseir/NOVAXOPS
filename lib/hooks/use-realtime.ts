'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Subscribes to Postgres changes on a single table and invalidates the
 * given TanStack Query key whenever any row is inserted, updated, or deleted.
 *
 * The existing data-fetching hooks (useTasks, useApprovals, etc.) handle
 * all refetching automatically — this hook just triggers invalidation.
 *
 * Usage:
 *   useRealtime('tasks', ['tasks'])
 *   useRealtime('moderation_items', ['moderation'])
 */
export function useRealtime(table: string, queryKey: unknown[]) {
  const queryClient = useQueryClient()
  const keyRef = useRef(queryKey)
  keyRef.current = queryKey

  useEffect(() => {
    const channelName = `realtime:${table}:${Math.random().toString(36).slice(2)}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          queryClient.invalidateQueries({ queryKey: keyRef.current })
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [table, queryClient])
}

/**
 * Wire multiple tables at once.
 * useRealtimeMulti([
 *   { table: 'tasks',             queryKey: ['tasks'] },
 *   { table: 'approval_requests', queryKey: ['approvals'] },
 * ])
 */
export function useRealtimeMulti(
  subscriptions: { table: string; queryKey: unknown[] }[],
) {
  const queryClient = useQueryClient()
  // Keep a mutable ref so handlers always read the latest queryKeys even if
  // the subscriptions array reference changes between renders.
  const subsRef = useRef(subscriptions)
  subsRef.current = subscriptions

  useEffect(() => {
    const channels = subsRef.current.map(({ table }, i) => {
      const name = `realtime:${table}:${Math.random().toString(36).slice(2)}`
      return supabase
        .channel(name)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          queryClient.invalidateQueries({ queryKey: subsRef.current[i]?.queryKey })
        })
        .subscribe()
    })

    return () => {
      channels.forEach(ch => { ch.unsubscribe(); supabase.removeChannel(ch) })
    }
  }, [queryClient])
}
