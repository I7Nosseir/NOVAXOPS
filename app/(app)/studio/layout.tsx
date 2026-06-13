'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { canSeePage } from '@/lib/page-permissions'

function hasStudioAccess(user: { role: string; page_permissions?: string[] | null }): boolean {
  if (user.role === 'admin' || user.role === 'ceo') return true
  return canSeePage('studio', user.page_permissions)
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !hasStudioAccess(user)) {
      router.replace('/dashboard')
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!hasStudioAccess(user)) return null

  return <>{children}</>
}
