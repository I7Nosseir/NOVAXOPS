'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Search, Plus, Sun, Moon, Menu, Eye, ChevronDown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme-context'
import { NotificationsPanel } from '@/components/layout/notifications-panel'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { useAuth } from '@/lib/auth-context'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { useSidebar } from '@/lib/sidebar-context'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/pipeline':      'Pipeline',
  '/tasks':         'Tasks',
  '/clients':       'Clients',
  '/projects':      'Projects',
  '/publishing':    'Publishing',
  '/approval':      'Approval Portal',
  '/moderation':    'Moderation',
  '/assets':        'Assets',
  '/creative-eval':  'Creative Evaluation',
  '/strategy-eval':  'Strategy & Content Eval',
  '/workload':      'Team Workload',
  '/library':       'Content Library',
  '/reports':       'Reports',
  '/settings':      'Settings',
  '/docs':          'Documents',
  '/ai-image':      'AI Image',
  '/tools':         'Tools',
  '/performance':   'Performance',
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ceo',               label: 'CEO' },
  { value: 'creative_director', label: 'Creative Director' },
  { value: 'account_manager',   label: 'Account Manager' },
  { value: 'strategist',        label: 'Strategist' },
  { value: 'copywriter',        label: 'Copywriter' },
  { value: 'designer',          label: 'Designer' },
  { value: 'video_editor',      label: 'Video Editor' },
  { value: 'web_developer',     label: 'Web Developer' },
  { value: 'social_manager',    label: 'Social Manager' },
]

const ROLE_LABELS: Record<UserRole, string> = {
  admin:             'Admin',
  ceo:               'CEO',
  creative_director: 'Creative Director',
  account_manager:   'Account Manager',
  strategist:        'Strategist',
  copywriter:        'Copywriter',
  designer:          'Designer',
  video_editor:      'Video Editor',
  web_developer:     'Web Developer',
  social_manager:    'Social Manager',
}

export function Header() {
  const pathname = usePathname()
  const base = '/' + (pathname.split('/')[1] || 'dashboard')
  const title = PAGE_TITLES[base] ?? 'NOVAX Ops'
  const { theme, toggle } = useTheme()
  const { user, realUser, previewRole, setPreviewRole, isPreviewMode } = useAuth()
  const { toggle: toggleSidebar } = useSidebar()
  const { unreadCount } = useNotifications()
  const [showNotifs, setShowNotifs]         = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const rolePickerRef = useRef<HTMLDivElement>(null)

  // Close role picker on outside click
  useEffect(() => {
    if (!showRolePicker) return
    function handleClick(e: MouseEvent) {
      if (rolePickerRef.current && !rolePickerRef.current.contains(e.target as Node)) {
        setShowRolePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showRolePicker])

  return (
    <>
      <header className="h-14 fixed top-0 left-0 lg:left-64 right-0 z-40 flex items-center justify-between px-4 lg:px-6 header-glass">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400 shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-slate-900 dark:text-slate-100 font-semibold text-base truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search — only on wide screens (1280px+) so it doesn't crowd Mac laptop headers */}
          <div className="relative hidden xl:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              placeholder="Search tasks, clients…"
              className="w-44 2xl:w-52 pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-white/[0.06] dark:backdrop-blur border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-novax-muted dark:focus:border-novax-border/60 focus:ring-2 focus:ring-novax-light dark:focus:ring-novax/20 transition-all"
            />
          </div>

          {/* New Task — always visible */}
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 btn-novax-glow text-white text-sm font-medium rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Task</span>
          </button>

          {/* Admin: Preview as Role — only on wide screens (1280px+) */}
          {realUser?.role === 'admin' && (
            <div className="relative hidden xl:block" ref={rolePickerRef}>
              <button
                onClick={() => setShowRolePicker(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all',
                  isPreviewMode
                    ? 'border-novax-border/60 text-novax-accent dark:text-novax-accent'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-slate-200',
                  isPreviewMode
                    ? 'bg-novax-light dark:bg-novax/12'
                    : 'bg-transparent'
                )}
                title="Preview the platform as a specific role"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="max-w-[100px] truncate">
                  {isPreviewMode ? ROLE_LABELS[previewRole!] : 'Preview'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showRolePicker && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1318] shadow-2xl z-50 p-1.5 overflow-hidden">
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-2.5 pt-1.5 pb-2 text-slate-400 dark:text-slate-500">
                    View platform as
                  </p>
                  {ROLE_OPTIONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setPreviewRole(r.value); setShowRolePicker(false) }}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors',
                        previewRole === r.value
                          ? 'bg-novax-light dark:bg-novax/18 text-novax dark:text-novax-accent font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                  {isPreviewMode && (
                    <>
                      <div className="h-px bg-slate-100 dark:bg-white/6 mx-1 my-1" />
                      <button
                        onClick={() => { setPreviewRole(null); setShowRolePicker(false) }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        Exit preview mode
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowNotifs(v => !v)}
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>

          {/* User avatar — shows real user initials always */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer shrink-0 ring-2 ring-transparent hover:ring-novax-border/50 transition-all"
            style={{ background: realUser?.color ?? '#1B3D38' }}
            title={realUser?.name}
          >
            {realUser?.initials ?? '—'}
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
