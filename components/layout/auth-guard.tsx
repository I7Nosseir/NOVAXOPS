'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

// ── Animated loading screen ────────────────────────────────────────────────────
function LoadingScreen() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#0f1a19' }}
    >
      {/* Animated bars */}
      <div className="flex items-end gap-1.5 mb-8" style={{ height: 40 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-1.5 rounded-full transition-all"
            style={{
              height: tick === i || tick === (i + 2) % 5
                ? 40
                : tick === (i + 1) % 5 || tick === (i + 3) % 5
                  ? 24
                  : 14,
              background: tick === i
                ? '#5BB4AE'
                : '#2A6B62',
              transitionDuration: '300ms',
            }}
          />
        ))}
      </div>

      {/* NOVAX wordmark */}
      <div className="flex items-center gap-2 mb-3">
        {/* Logo mark — teal N */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="#1B3D38"/>
          <path
            d="M8 20V8l8 10V8"
            stroke="#5BB4AE"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span
          className="text-xl font-bold tracking-widest"
          style={{ color: '#EBF4F3', letterSpacing: '0.18em' }}
        >
          NOVAX
        </span>
      </div>

      {/* Dot pulse below */}
      <div className="flex gap-1.5 mt-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1 h-1 rounded-full transition-all"
            style={{
              background: tick % 3 === i ? '#5BB4AE' : '#2A6B62',
              transform: tick % 3 === i ? 'scale(1.4)' : 'scale(1)',
              transitionDuration: '300ms',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Guard ──────────────────────────────────────────────────────────────────────
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user, needsOnboarding } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (needsOnboarding) {
      router.replace('/onboarding')
      return
    }
    if (!user) {
      router.replace('/login')
    }
  }, [loading, user, needsOnboarding, router])

  if (loading)         return <LoadingScreen />
  if (needsOnboarding) return null
  if (!user)           return <LoadingScreen />

  return <>{children}</>
}
