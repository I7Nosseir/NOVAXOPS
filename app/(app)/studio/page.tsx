'use client'

import Link from 'next/link'
import { Zap, Wand2, BarChart2, Brain, ArrowRight, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'

const TOOLS = [
  {
    href: '/studio/content',
    icon: Zap,
    title: 'Content Creation Studio',
    description: 'End-to-end content pipeline: define → AI research → hooks → script → visual direction → schedule.',
    badge: 'Flagship',
    badgeColor: 'bg-novax text-white',
    gradient: 'from-[#1B3D38] to-[#2A6B62]',
    cta: 'Create Content',
    accent: '#5BB4AE',
  },
  {
    href: '/studio/hooks',
    icon: Wand2,
    title: 'Hook Lab',
    description: 'Generate 20 scored hooks using the One Peak 3C framework. Save the best to your client\'s library.',
    badge: 'Sprint 3',
    badgeColor: 'bg-novax-light text-novax-muted border border-novax-border',
    gradient: 'from-slate-800 to-slate-700',
    cta: 'Write Hooks',
    accent: '#5BB4AE',
  },
  {
    href: '/studio/strategy',
    icon: Brain,
    title: 'Strategy Command Center',
    description: '17-phase marketing strategy as a living document per client. Intelligence, positioning, execution, and optimization.',
    badge: 'Sprint 4',
    badgeColor: 'bg-novax-light text-novax-muted border border-novax-border',
    gradient: 'from-slate-800 to-slate-700',
    cta: 'Build Strategy',
    accent: '#5BB4AE',
  },
]

const QUICK_LINKS = [
  { href: '/performance', icon: TrendingUp, label: 'Performance', description: 'View content analytics and pattern intelligence' },
  { href: '/tasks',       icon: Target,    label: 'My Tasks',    description: 'See all tasks assigned to you' },
  { href: '/publishing',  icon: BarChart2, label: 'Publishing',  description: 'Manage and schedule your content queue' },
]

export default function StudioPage() {
  const { user } = useAuth()
  const { tasks } = useTasks()
  const { clients } = useClients()

  const myTasks   = tasks.filter(t => t.assigned_to === user?.id && t.status === 'active')
  const inboxCount = myTasks.length

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-novax-accent" />
          <h1 className="text-xl font-bold text-slate-900">Studio</h1>
        </div>
        <p className="text-sm text-slate-500">
          The production layer. Turn intelligence into content, hooks into scripts, and strategy into scheduled posts.
        </p>
      </div>

      {/* Stats row */}
      {(inboxCount > 0 || clients.length > 0) && (
        <div className="flex items-center gap-4 p-4 bg-novax-light border border-novax-border rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-novax animate-pulse" />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-novax">{inboxCount}</span> task{inboxCount !== 1 ? 's' : ''} waiting for you
            </span>
          </div>
          {clients.length > 0 && (
            <>
              <div className="w-px h-4 bg-novax-border" />
              <span className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{clients.length}</span> active clients
              </span>
            </>
          )}
          <div className="ml-auto">
            <Link
              href="/studio/content"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Zap className="w-3 h-3" />
              New Session
            </Link>
          </div>
        </div>
      )}

      {/* Power tools */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Power Tools</p>
        <div className="grid grid-cols-1 gap-4">
          {TOOLS.map(tool => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex items-center gap-5 p-5 bg-white border border-slate-200 rounded-2xl hover:border-novax-border hover:shadow-sm transition-all"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${tool.gradient.replace('from-', '').replace('to-', ' ')})` }}
              >
                <tool.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-900 group-hover:text-novax transition-colors">
                    {tool.title}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-snug">{tool.description}</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 group-hover:bg-novax-light border border-slate-200 group-hover:border-novax-border text-slate-600 group-hover:text-novax text-sm font-medium rounded-lg transition-all shrink-0">
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
        <div className="grid grid-cols-3 gap-3">
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
