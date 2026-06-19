'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2, AlertTriangle, BarChart2, Shield, Home, ChevronRight,
} from 'lucide-react'

const NAV = [
  { href: '/admin',             icon: Home,          label: 'Overview' },
  { href: '/admin/organizations',icon: Building2,    label: 'Organizations' },
  { href: '/admin/errors',       icon: AlertTriangle, label: 'Error Bank' },
  { href: '/admin/usage',        icon: BarChart2,     label: 'Usage' },
]

function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 bg-slate-900 text-slate-200 min-h-screen flex flex-col border-r border-slate-800">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-novax-accent" />
          <span className="font-bold text-sm tracking-wide">NOVAX Admin</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Super admin panel</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-2">
          <ChevronRight size={12} />
          Back to App
        </Link>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { realUser, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !realUser?.is_super_admin) {
      router.replace('/dashboard')
    }
  }, [realUser, loading, router])

  if (loading || !realUser?.is_super_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">Checking access...</p>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex bg-slate-950 text-slate-100">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}
