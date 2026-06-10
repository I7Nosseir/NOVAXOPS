'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Fires on mount and on every pathname change.
// Debounced to avoid hammering the API during rapid navigation.
export function useActivityTracker(userId: string | undefined) {
  const pathname    = usePathname()
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPageRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    if (pathname === lastPageRef.current) return

    lastPageRef.current = pathname

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      void fetch('/api/user/activity', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, current_page: pathname }),
      }).catch(() => { /* non-critical */ })
    }, 1_500) // 1.5s debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [userId, pathname])
}
