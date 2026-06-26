'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

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

  // Still resolving session or profile
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 text-novax animate-spin" />
      </div>
    )
  }

  // Redirecting to onboarding — render nothing while navigation runs
  if (needsOnboarding) return null

  // No authenticated user — redirect to login is in progress, show spinner
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 text-novax animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
