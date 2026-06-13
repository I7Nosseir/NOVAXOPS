'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const HEARTBEAT_MS = 4 * 60 * 1000 // 4 min — online threshold is 5 min

export function useActivityTracker(userId: string | undefined) {
  const pathname      = usePathname()
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPageRef   = useRef<string | null>(null)

  const ping = useCallback((page: string) => {
    void fetch('/api/user/activity', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ current_page: page }),
    }).catch(() => { /* non-critical */ })
  }, [])

  // Fire on every page navigation (debounced 1.5s to ignore rapid transitions)
  useEffect(() => {
    if (!userId || pathname === lastPageRef.current) return
    lastPageRef.current = pathname
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => ping(pathname), 1_500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [userId, pathname, ping])

  // Heartbeat: keep last_seen fresh while user stays on the same page
  useEffect(() => {
    if (!userId) return
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      if (lastPageRef.current) ping(lastPageRef.current)
    }, HEARTBEAT_MS)
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current) }
  }, [userId, ping])
}
