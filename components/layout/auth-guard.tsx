'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, needsOnboarding } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && needsOnboarding) {
      router.replace('/onboarding')
    }
  }, [loading, needsOnboarding, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 text-novax animate-spin" />
      </div>
    )
  }

  if (needsOnboarding) return null

  return <>{children}</>
}
