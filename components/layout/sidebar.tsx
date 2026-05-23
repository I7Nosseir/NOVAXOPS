'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Kanban, Building2, FolderKanban,
  Send, MessageSquare, Image, BarChart2, Settings,
  ChevronRight, CheckSquare, Users, Sparkles, BookMarked, LogOut, X, TrendingUp, Wand2, ListTodo, ScanSearch, FileText,
  Zap, Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/pipeline',    icon: Kanban,           label: 'Pipeline' },
      { href: '/tasks',       icon: ListTodo,         label: 'Tasks' },
      { href: '/clients',     icon: Building2,        label: 'Clients' },
      { href: '/projects',    icon: FolderKanban,     label: 'Projects' },
      { href: '/publishing',  icon: Send,             label: 'Publishing' },
      { href: '/approval',    icon: CheckSquare,      label: 'Approval', badge: 4 },
      { href: '/moderation',  icon: MessageSquare,    label: 'Moderation', badge: 3 },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/studio',         icon: Zap,       label: 'Studio' },
      { href: '/studio/content', icon: Sparkles,  label: 'Content Studio' },
      { href: '/studio/hooks',   icon: Wand2,     label: 'Hook Lab' },
      { href: '/studio/strategy',icon: Brain,     label: 'Strategy' },
    ],
  },
  {
    label: 'Creative',
    items: [
      { href: '/assets',         icon: Image,      label: 'Assets' },
      { href: '/ai-image',       icon: Wand2,      label: 'AI Image' },
      { href: '/tools/resize',   icon: ScanSearch, label: 'Smart Resize' },
      { href: '/creative-eval',  icon: Sparkles,   label: 'Creative Eval' },
      { href: '/docs',           icon: FileText,   label: 'Documents' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/performance', icon: TrendingUp, label: 'Performance' },
      { href: '/workload',    icon: Users,      label: 'Workload' },
      { href: '/library',     icon: BookMarked, label: 'Content Library' },
      { href: '/reports',     icon: BarChart2,  label: 'Reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

function NovaxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="16" r="16" fill="#1B3D38"/>
      <path d="M7 23V9l5.5 9L18 9v14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 9l5 7-5 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 16.5l3.5-3" stroke="#5BB4AE" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { open, setOpen } = useSidebar()
  const isAdmin = user?.role === 'admin'

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    setOpen(false)
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'flex flex-col w-64 h-screen fixed left-0 top-0 z-50 transition-transform duration-300',
          // Mobile: hidden by default, slides in when open
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible
          'lg:translate-x-0',
        )}
        style={{
          background: 'linear-gradient(180deg, #090c13 0%, #070a10 55%, #060910 100%)',
          borderRight: '1px solid rgba(255,255,255,0.042)',
        }}
      >
        {/* Top ambient teal glow — visible in dark UIs */}
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(91,180,174,0.09) 0%, transparent 70%)' }}
          aria-hidden
        />

        {/* Logo + mobile close */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5 relative">
          <NovaxMark className="w-8 h-8 shrink-0" />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">NOVAX</p>
            <p className="text-slate-500 text-xs">Operations Platform</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors p-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV_SECTIONS.filter(s => s.label !== 'Studio' || isAdmin).map((section, si) => (
            <div key={section.label} className={si > 0 ? 'mt-4' : ''}>
              <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: 'rgba(91,180,174,0.5)' }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, icon: Icon, label, badge }) => {
                  const active = pathname === href || (href !== '/dashboard' && href !== '/studio' && pathname.startsWith(href))
                    || (href === '/studio' && pathname === '/studio')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={handleNavClick}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                        active ? 'text-white sidebar-item-active' : 'text-slate-400 hover:text-slate-200'
                      )}
                      style={active ? {
                        background: 'linear-gradient(135deg, rgba(91,180,174,0.11) 0%, rgba(27,61,56,0.18) 100%)',
                        color: 'var(--sidebar-text-active)',
                        boxShadow: 'inset 0 1px 0 rgba(91,180,174,0.08)',
                      } : {}}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.048)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = '' }}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-novax-accent' : 'text-slate-500 group-hover:text-slate-300')} />
                        <span>{label}</span>
                      </div>
                      {badge ? (
                        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-novax text-white text-[10px] font-bold">
                          {badge}
                        </span>
                      ) : active ? (
                        <ChevronRight className="w-3.5 h-3.5 text-novax-accent opacity-60" />
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile */}
        <div className="px-3 py-4 border-t border-white/5">
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.042)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: user?.color ?? '#1B3D38' }}
            >
              {user?.initials ?? '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium truncate">{user?.name ?? 'Loading…'}</p>
              <p className="text-slate-500 text-[10px] truncate capitalize">{user?.role?.replace('_', ' ') ?? ''}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
