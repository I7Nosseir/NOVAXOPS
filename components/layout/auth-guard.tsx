'use client'

import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 text-novax animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
