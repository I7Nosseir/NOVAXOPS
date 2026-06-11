'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Activity, RefreshCw, Circle, Users, Zap, DollarSign,
  Clock, Monitor, BookOpen, Layers, ChevronDown, ChevronUp,
  AlertCircle, Loader2, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
  last_seen: string | null
  current_page: string | null
  today_ai_calls: number
  today_ai_cost_usd: number
  today_ai_agents: Record<string, number>
  today_ai_cached: number
  today_studio_sessions: number
  today_docs_created: number
  month_ai_calls: number
  month_ai_cost_usd: number
}

interface Totals {
  today_ai_calls: number
  today_ai_cost_usd: number
  month_ai_calls: number
  month_ai_cost_usd: number
  online_now: number
}

interface AgentBreakdownItem {
  agent: string
  count: number
}

interface AuditEntry {
  id: string
  user_id: string | null
  user_name: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface ActivityData {
  users: UserRecord[]
  totals: Totals
  agent_breakdown: AgentBreakdownItem[]
  audit_log: AuditEntry[]
  fetched_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ONLINE_THRESHOLD_MS  = 5  * 60 * 1000
const RECENT_THRESHOLD_MS  = 30 * 60 * 1000

function onlineStatus(lastSeen: string | null): 'online' | 'recent' | 'offline' {
  if (!lastSeen) return 'offline'
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < ONLINE_THRESHOLD_MS)  return 'online'
  if (diff < RECENT_THRESHOLD_MS) return 'recent'
  return 'offline'
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function prettifyPage(path: string | null): string {
  if (!path) return '—'
  const segments = path.replace(/^\//, '').split('/')
  if (segments.length === 0 || !segments[0]) return 'Dashboard'
  const label = segments[segments.length - 1] || segments[0]
  return label
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function prettifyAction(action: string): string {
  return action
    .replace(/\./g, ' → ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const ROLE_COLORS: Record<string, string> = {
  admin:             'bg-novax text-white',
  ceo:               'bg-amber-600 text-white',
  creative_director: 'bg-purple-600 text-white',
  account_manager:   'bg-blue-600 text-white',
  strategist:        'bg-teal-600 text-white',
  copywriter:        'bg-emerald-600 text-white',
  designer:          'bg-rose-600 text-white',
  social_manager:    'bg-orange-600 text-white',
}

const ROLE_LABELS: Record<string, string> = {
  admin:             'Admin',
  ceo:               'CEO',
  creative_director: 'CD',
  account_manager:   'AM',
  strategist:        'Strategist',
  copywriter:        'Copy',
  designer:          'Designer',
  social_manager:    'Social',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'online' | 'recent' | 'offline' }) {
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full shrink-0',
      status === 'online'  ? 'bg-emerald-500' :
      status === 'recent'  ? 'bg-amber-400' :
                             'bg-slate-300'
    )} />
  )
}

function UserAvatar({ user }: { user: UserRecord }) {
  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-novax flex items-center justify-center text-white text-[10px] font-bold shrink-0">
      {initials}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', color)}>
        <Icon className="w-4 h-4" style={{ width: 16, height: 16 }} />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Live Now panel ───────────────────────────────────────────────────────────

function LiveNowPanel({ users }: { users: UserRecord[] }) {
  const online  = users.filter(u => onlineStatus(u.last_seen) === 'online')
  const recent  = users.filter(u => onlineStatus(u.last_seen) === 'recent')
  const offline = users.filter(u => onlineStatus(u.last_seen) === 'offline')

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Circle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
          <p className="text-sm font-semibold text-slate-900">Live Now</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span><span className="font-semibold text-emerald-600">{online.length}</span> online</span>
          <span><span className="font-semibold text-amber-500">{recent.length}</span> recent</span>
          <span><span className="font-semibold text-slate-400">{offline.length}</span> offline</span>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {[...online, ...recent, ...offline].map(user => {
          const status = onlineStatus(user.last_seen)
          return (
            <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className="relative shrink-0">
                <UserAvatar user={user} />
                <StatusDot status={status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', ROLE_COLORS[user.role] ?? 'bg-slate-200 text-slate-600')}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {status !== 'offline' && user.current_page && (
                    <>
                      <Monitor className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 truncate">{prettifyPage(user.current_page)}</span>
                      <span className="text-slate-300">·</span>
                    </>
                  )}
                  <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className="text-xs text-slate-400">
                    {user.last_seen ? timeAgo(user.last_seen) : 'Never'}
                  </span>
                </div>
              </div>
              {user.today_ai_calls > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-novax">{user.today_ai_calls}</p>
                  <p className="text-[10px] text-slate-400">AI today</p>
                </div>
              )}
            </div>
          )
        })}
        {users.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No team members found.</div>
        )}
      </div>
    </div>
  )
}

// ─── Team Summary table ───────────────────────────────────────────────────────

function TeamSummaryTable({ users }: { users: UserRecord[] }) {
  const sorted = [...users].sort((a, b) => b.today_ai_calls - a.today_ai_calls)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Team Usage — Today</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5">Member</th>
              <th className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2.5">Status</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2.5">AI Calls</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2.5">AI Cost</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2.5">Studio</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2.5">Docs</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Month AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map(user => {
              const status = onlineStatus(user.last_seen)
              return (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <StatusDot status={status} />
                      <span className={cn('text-xs font-medium',
                        status === 'online'  ? 'text-emerald-600' :
                        status === 'recent'  ? 'text-amber-500' :
                                               'text-slate-400'
                      )}>
                        {status === 'online' ? 'Online' : status === 'recent' ? 'Recent' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-semibold', user.today_ai_calls > 0 ? 'text-novax' : 'text-slate-300')}>
                      {user.today_ai_calls}
                    </span>
                    {user.today_ai_cached > 0 && (
                      <span className="text-[10px] text-slate-400 ml-1">({user.today_ai_cached} cached)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-medium text-xs', user.today_ai_cost_usd > 0 ? 'text-slate-700' : 'text-slate-300')}>
                      {user.today_ai_cost_usd > 0 ? `$${user.today_ai_cost_usd.toFixed(4)}` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-medium', user.today_studio_sessions > 0 ? 'text-purple-600' : 'text-slate-300')}>
                      {user.today_studio_sessions || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-medium', user.today_docs_created > 0 ? 'text-blue-600' : 'text-slate-300')}>
                      {user.today_docs_created || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <p className={cn('font-semibold text-xs', user.month_ai_calls > 0 ? 'text-slate-700' : 'text-slate-300')}>
                        {user.month_ai_calls > 0 ? `${user.month_ai_calls} calls` : '—'}
                      </p>
                      {user.month_ai_cost_usd > 0 && (
                        <p className="text-[10px] text-slate-400">${user.month_ai_cost_usd.toFixed(3)}</p>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Agent Breakdown ──────────────────────────────────────────────────────────

function AgentBreakdown({ items, totalCalls }: { items: AgentBreakdownItem[]; totalCalls: number }) {
  if (items.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">AI Agent Usage — Today</p>
      </div>
      <div className="p-4 space-y-2.5">
        {items.map(({ agent, count }) => {
          const pct = totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0
          return (
            <div key={agent}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700 capitalize">{agent.replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-500">{count} <span className="text-slate-400">({pct}%)</span></span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-novax rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, 12)

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-sm text-slate-400">
        No activity in the last 7 days.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Recent Activity</p>
        <span className="text-xs text-slate-400">{entries.length} events · last 7 days</span>
      </div>
      <div className="divide-y divide-slate-50">
        {visible.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-novax-light flex items-center justify-center shrink-0 mt-0.5">
              <Activity className="w-3 h-3 text-novax" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900">
                <span className="font-medium">{entry.user_name}</span>
                {' — '}
                <span className="text-slate-600">{prettifyAction(entry.action)}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 capitalize">{entry.entity_type}</span>
                <span className="text-slate-200">·</span>
                <span className="text-[11px] text-slate-400">{timeAgo(entry.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {entries.length > 12 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-novax-muted hover:text-novax hover:bg-novax-light transition-colors border-t border-slate-100"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Show {entries.length - 12} more</>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const fetchData = useCallback(async (): Promise<ActivityData> => {
    const res = await fetch('/api/user/activity')
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err.error ?? 'Failed to load activity data.')
    }
    return res.json() as Promise<ActivityData>
  }, [])

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<ActivityData>({
    queryKey: ['admin-team-activity'],
    queryFn:  fetchData,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  if (!authLoading && user && user.role !== 'admin' && user.role !== 'ceo') {
    router.replace('/dashboard')
    return null
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-novax" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to load data.'}</p>
        <button onClick={() => refetch()} className="text-sm text-novax hover:underline">Try again</button>
      </div>
    )
  }

  const { users, totals, agent_breakdown, audit_log } = data

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-novax flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Team Activity</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Live monitoring — who's online, what they're doing, AI usage, and recent actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-novax-muted hover:text-novax hover:bg-novax-light border border-novax-border rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={Circle}
          label="Online Now"
          value={totals.online_now}
          sub="active in last 5 min"
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={Users}
          label="Total Members"
          value={users.length}
          color="bg-novax-light text-novax"
        />
        <StatCard
          icon={Zap}
          label="AI Calls Today"
          value={totals.today_ai_calls}
          color="bg-purple-50 text-purple-700"
        />
        <StatCard
          icon={DollarSign}
          label="AI Cost Today"
          value={`$${totals.today_ai_cost_usd.toFixed(4)}`}
          sub={`$${totals.month_ai_cost_usd.toFixed(3)} this month`}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={TrendingUp}
          label="AI Calls This Month"
          value={totals.month_ai_calls}
          color="bg-blue-50 text-blue-700"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Live Now (1/3) */}
        <div className="space-y-5">
          <LiveNowPanel users={users} />
          {agent_breakdown.length > 0 && (
            <AgentBreakdown items={agent_breakdown} totalCalls={totals.today_ai_calls} />
          )}
        </div>

        {/* Right: Team table + activity feed (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          <TeamSummaryTable users={users} />
          <ActivityFeed entries={audit_log} />
        </div>
      </div>
    </div>
  )
}
