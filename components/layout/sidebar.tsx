'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Kanban, Building2, FolderKanban,
  Send, MessageSquare, Image, BarChart2, Settings,
  ChevronRight, CheckSquare, Users, Sparkles, BookMarked, LogOut, X, TrendingUp, Wand2, ListTodo, ScanSearch, FileText,
  Zap, Brain, Crown, Clapperboard, Flame, Layers, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'
import { usePendingApprovalCount } from '@/lib/hooks/use-approvals'
import { usePendingModerationCount } from '@/lib/hooks/use-moderation'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  /** If set, the user must have this key in page_permissions to see this item */
  permKey?: string
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
      { href: '/clients',     icon: Building2,        label: 'Clients',    permKey: 'clients' },
      { href: '/projects',    icon: FolderKanban,     label: 'Projects',   permKey: 'projects' },
      { href: '/publishing',  icon: Send,             label: 'Publishing', permKey: 'publishing' },
      { href: '/approval',    icon: CheckSquare,      label: 'Approval',   permKey: 'approval' },
      { href: '/moderation',  icon: MessageSquare,    label: 'Moderation', permKey: 'moderation' },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/studio',               icon: Zap,         label: 'Studio',               permKey: 'studio' },
      { href: '/studio/content',       icon: Sparkles,    label: 'Content Studio',       permKey: 'studio-content' },
      { href: '/studio/hooks',         icon: Wand2,       label: 'Hook Lab',             permKey: 'studio-hooks' },
      { href: '/studio/strategy',      icon: Brain,       label: 'Strategy',             permKey: 'studio-strategy' },
      { href: '/studio/campaign',      icon: Flame,       label: 'Campaign Igniter',     permKey: 'studio-campaign' },
      { href: '/studio/visual',        icon: Clapperboard,label: 'Visual Engine',        permKey: 'studio-visual' },
      { href: '/studio/formats',       icon: Layers,      label: 'Peak Formats',         permKey: 'studio-formats' },
      { href: '/studio/copy',          icon: ScanSearch,  label: 'Copy Engine',          permKey: 'studio-copy' },
      { href: '/studio/media-buying',  icon: TrendingUp,  label: 'Media Buying Plan',    permKey: 'studio-media-buying' },
    ],
  },
  {
    label: 'Creative',
    items: [
      { href: '/assets',        icon: Image,      label: 'Assets',        permKey: 'assets' },
      { href: '/ai-image',      icon: Wand2,      label: 'AI Image',      permKey: 'ai-image' },
      { href: '/creative-eval',  icon: Sparkles,   label: 'Creative Eval',          permKey: 'creative-eval' },
      { href: '/strategy-eval', icon: Brain,      label: 'Strategy & Content Eval', permKey: 'strategy-eval' },
      { href: '/docs',          icon: FileText,   label: 'Documents',     permKey: 'docs' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/assistant',   icon: Sparkles,   label: 'AI Assistant',    permKey: 'assistant' },
      { href: '/performance', icon: TrendingUp, label: 'Performance',     permKey: 'performance' },
      { href: '/workload',    icon: Users,      label: 'Workload',        permKey: 'workload' },
      { href: '/library',     icon: BookMarked, label: 'Content Library', permKey: 'library' },
      { href: '/reports',     icon: BarChart2,  label: 'Reports',         permKey: 'reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

const CEO_NAV_ITEM: NavItem = { href: '/ceo', icon: Crown, label: 'CEO Hub' }

function NovaLogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.svg" alt="NOVAX" className={className} />
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { open, setOpen } = useSidebar()
  const isAdmin = user?.role === 'admin'
  const isCeoOrAdmin = user?.role === 'ceo' || user?.role === 'admin'
  const { data: pendingApprovals = 0 } = usePendingApprovalCount()
  const { data: pendingModeration = 0 } = usePendingModerationCount()

  const liveBadges: Record<string, number> = {
    '/approval':   pendingApprovals,
    '/moderation': pendingModeration,
  }

  // Returns true if the user is allowed to see an optional page.
  // Admins always see everything. null permissions = all pages visible.
  const canSee = (permKey?: string) => {
    if (!permKey) return true
    if (isAdmin) return true
    const perms = user?.page_permissions
    if (perms == null) return true
    return perms.includes(permKey)
  }

  const handleSignOut = async () => {
    await signOut()
    // Full page navigation clears SSR session cookies correctly
    window.location.href = '/login'
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
          <NovaLogoMark className="w-8 h-8 shrink-0" />
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-tight tracking-widest">NOVAX</p>
            <p className="text-slate-500 text-[11px] tracking-wide">Operations Platform</p>
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
          {isCeoOrAdmin && (() => {
            const item = CEO_NAV_ITEM
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: 'rgba(91,180,174,0.5)' }}>
                  Executive
                </p>
                <Link
                  href={item.href}
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
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-novax-accent opacity-60" />}
                </Link>
              </div>
            )
          })()}
          {/* Admin-only section */}
          {isAdmin && (() => {
            const href = '/activity'
            const active = pathname === href
            return (
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: 'rgba(91,180,174,0.5)' }}>
                  Admin
                </p>
                <Link
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
                    <Activity className={cn('w-4 h-4 shrink-0', active ? 'text-novax-accent' : 'text-slate-500 group-hover:text-slate-300')} />
                    <span>Team Activity</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-novax-accent opacity-60" />}
                </Link>
              </div>
            )
          })()}

          {NAV_SECTIONS
            .map((section, si) => {
              const visibleItems = section.items.filter(item => canSee(item.permKey))
              if (visibleItems.length === 0) return null
              return (
            <div key={section.label} className={si > 0 ? 'mt-4' : ''}>
              <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: 'rgba(91,180,174,0.5)' }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href || (href !== '/dashboard' && href !== '/studio' && pathname.startsWith(href))
                    || (href === '/studio' && pathname === '/studio')
                  const badge = liveBadges[href] ?? 0
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
                      {badge > 0 ? (
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
              )
            })}
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
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0 min-h-[36px]"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium lg:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
