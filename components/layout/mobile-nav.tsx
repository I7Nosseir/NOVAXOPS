'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Kanban, ListTodo, Send, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'

const BOTTOM_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline',   icon: Kanban,           label: 'Pipeline'  },
  { href: '/tasks',      icon: ListTodo,         label: 'Tasks'     },
  { href: '/publishing', icon: Send,             label: 'Publish'   },
]

export function MobileNav() {
  const pathname = usePathname()
  const { toggle } = useSidebar()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch h-16 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#090c13]">
      {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              active
                ? 'text-novax dark:text-novax-accent'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        )
      })}

      {/* More — opens full sidebar */}
      <button
        onClick={toggle}
        className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
        More
      </button>
    </nav>
  )
}
