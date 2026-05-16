'use client'

import { useState } from 'react'
import { Bell, Search, Plus, Sun, Moon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme-context'
import { NotificationsPanel } from '@/components/layout/notifications-panel'
import { useAuth } from '@/lib/auth-context'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/pipeline':     'Pipeline',
  '/clients':      'Clients',
  '/projects':     'Projects',
  '/publishing':   'Publishing',
  '/approval':     'Approval Portal',
  '/moderation':   'Moderation',
  '/assets':       'Assets',
  '/creative-eval': 'Creative Evaluation',
  '/workload':     'Team Workload',
  '/library':      'Content Library',
  '/reports':      'Reports',
  '/settings':     'Settings',
}

export function Header() {
  const pathname = usePathname()
  const base = '/' + (pathname.split('/')[1] || 'dashboard')
  const title = PAGE_TITLES[base] ?? 'NOVAX Ops'
  const { theme, toggle } = useTheme()
  const { user } = useAuth()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)

  return (
    <>
      <header className="h-14 fixed top-0 left-64 right-0 z-40 flex items-center justify-between px-6 bg-white border-b border-slate-200">
        <h1 className="text-slate-900 font-semibold text-base">{title}</h1>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Search tasks, clients…"
              className="w-56 pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all"
            />
          </div>

          {/* New Task */}
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifs(v => !v)} className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>

          {/* User avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer shrink-0"
            style={{ background: user?.color ?? '#1B3D38' }}
            title={user?.name}
          >
            {user?.initials ?? '—'}
          </div>
        </div>
      </header>

      <CreateTaskDialog
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
      />
    </>
  )
}
