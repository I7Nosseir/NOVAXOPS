'use client'

import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations().then(registrations => {
      // Unregister all existing SWs first (clears any broken v1 SW),
      // then register the new fixed version
      Promise.all(registrations.map(r => r.unregister())).then(() => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      })
    })
  }, [])

  return null
}
