'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Zap, Wand2, Brain, Flame, BarChart2, Target, TrendingUp,
  ArrowRight, Sparkles, BookOpen,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import { cn } from '@/lib/utils'
import type { StudioSession } from '@/lib/studio-types'

const TOOLS = [
  {
    href: '/studio/content',
    icon: Zap,
    title: 'Content Creation Studio',
    description: 'Signal-grounded pipeline. Brief to Boss Brief. Every recommendation cited.',
    badge: 'Flagship',
    badgeColor: 'bg-white/20 text-white',
    gradient: true,
    dark: false,
    cta: 'Create Content',
  },
  {
    href: '/studio/hooks',
    icon: Wand2,
    title: 'Hook Lab',
    description: 'Two-pass generation: divergent (no filter), then convergent (3C scoring + SCAMPER).',
    badge: 'Sprint 3',
    badgeColor: 'bg-novax-light text-novax-muted border border-novax-border',
    gradient: false,
    dark: false,
    cta: 'Write Hooks',
  },
  {
    href: '/studio/strategy',
    icon: Brain,
    title: 'Strategy Command Center',
    description: 'Double Diamond pipeline. Intelligence, Positioning, Execution, Scale, Optimize.',
    badge: 'Sprint 4',
    badgeColor: 'bg-novax-light text-novax-muted border border-novax-border',
    gradient: false,
    dark: false,
    cta: 'Build Strategy',
  },
  {
    href: '/studio/campaign',
    icon: Flame,
    title: 'Campaign Igniter',
    description: 'Cultural tensions + constraint inversion + cross-domain thinking. 5 execution-ready briefs.',
    badge: 'Sprint 5',
    badgeColor: 'bg-slate-700 text-slate-300',
    gradient: false,
    dark: true,
    cta: 'Ignite Campaign',
  },
  {
    href: '/studio/inspiration',
    icon: BookOpen,
    title: 'Inspiration Library',
    description: 'Live trending content from YouTube, TikTok and across the web. Save to per-client boards.',
    badge: 'Live',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    gradient: false,
    dark: false,
    cta: 'Browse Trends',
  },
]

const QUICK_LINKS = [
  { href: '/performance', icon: TrendingUp, label: 'Performance',  description: 'Content analytics and pattern intelligence' },
  { href: '/tasks',       icon: Target,    label: 'My Tasks',      description: 'Tasks assigned to you' },
  { href: '/publishing',  icon: BarChart2, label: 'Publishing',    description: 'Manage and schedule your content queue' },
]

export default function StudioPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    setSessionsLoading(true)
    fetch(`/api/studio/session?created_by=${user.id}&limit=10`)
      .then(r => r.json())
      .then((data: { sessions?: StudioSession[] }) => setSessions(data.sessions ?? []))
      .catch(() => {})
      .finally(() => setSessionsLoading(false))
  }, [user?.id])

  function handleSessionClick(session: StudioSession) {
    const routes: Record<string, string> = {
      content:    '/studio/content',
      hooks:      '/studio/hooks',
      strategy:   '/studio/strategy',
      campaign:   '/studio/campaign',
      postmortem: '/studio/postmortem',
    }
    const route = routes[session.tool]
    if (route) router.push(`${route}?session_id=${session.id}`)
  }

  function handleNewSession() {
    router.push('/studio/content')
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-novax-accent" />
          <h1 className="text-xl font-bold text-slate-900">Studio</h1>
        </div>
        <p className="text-sm text-slate-500">
          The production layer. Signal-grounded, methodology-backed, client-aware.
        </p>
      </div>

      {/* Recent sessions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Sessions</p>
        <StudioSessionList
          sessions={sessions}
          onSessionClick={handleSessionClick}
          onNewSession={handleNewSession}
          isLoading={sessionsLoading}
        />
      </div>

      {/* Power tools */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Power Tools</p>
        <div className="grid grid-cols-1 gap-4">
          {TOOLS.map(tool => (
            <Link
              key={tool.href}
              href={tool.href}
              className={cn(
                'group flex items-center gap-5 p-5 rounded-2xl border transition-all',
                tool.gradient
                  ? 'bg-gradient-to-r from-[#1B3D38] to-[#2A6B62] border-transparent hover:shadow-lg'
                  : tool.dark
                  ? 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:shadow-sm'
                  : 'bg-white border-slate-200 hover:border-novax-border hover:shadow-sm',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                  tool.gradient ? 'bg-white/10' : tool.dark ? 'bg-slate-800' : 'bg-novax-light',
                )}
              >
                <tool.icon
                  className={cn(
                    'w-5 h-5',
                    tool.gradient ? 'text-white' : tool.dark ? 'text-slate-300' : 'text-novax-muted',
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      'font-semibold transition-colors',
                      tool.gradient ? 'text-white' : tool.dark ? 'text-slate-200' : 'text-slate-900 group-hover:text-novax',
                    )}
                  >
                    {tool.title}
                  </span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', tool.badgeColor)}>
                    {tool.badge}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-sm leading-snug',
                    tool.gradient ? 'text-white/70' : tool.dark ? 'text-slate-400' : 'text-slate-500',
                  )}
                >
                  {tool.description}
                </p>
              </div>
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all shrink-0',
                  tool.gradient
                    ? 'bg-white/10 text-white group-hover:bg-white/20'
                    : tool.dark
                    ? 'bg-slate-800 text-slate-300 group-hover:bg-slate-700 border border-slate-600'
                    : 'bg-slate-50 group-hover:bg-novax-light border border-slate-200 group-hover:border-novax-border text-slate-600 group-hover:text-novax',
                )}
              >
                {tool.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick navigation */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-novax-border hover:bg-novax-light/50 transition-all group"
            >
              <link.icon className="w-4 h-4 text-slate-400 group-hover:text-novax-muted transition-colors" />
              <div>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-novax transition-colors">{link.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
