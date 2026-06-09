'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'
import { usePosts } from '@/lib/hooks/use-posts'
import { useModerationItems } from '@/lib/hooks/use-moderation'
import { useWeeklyActivity, useAiCostMonth } from '@/lib/hooks/use-dashboard'
import { useAuth } from '@/lib/auth-context'
import { useRealtimeMulti } from '@/lib/hooks/use-realtime'
import { hasRole, vendorName, STAGE_CONFIG, PRIORITY_CONFIG, formatDate, formatNumber, formatCurrency, cn } from '@/lib/utils'
import {
  CheckSquare, Clock, AlertCircle, MessageSquare,
  DollarSign, Calendar, Globe, TrendingUp, ArrowUpRight, ArrowDownRight,
  Eye, Activity, RefreshCw, ChevronRight, X, Heart, MessageCircle, Share2,
} from 'lucide-react'
import { PlatformIcon } from '@/components/ui/platform-icon'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────

type OverviewClient = {
  client_id: string; name: string; reach: number; impressions: number
  er: number; posts: number; likes: number; comments: number; shares: number
}
type MetricoolOverview = {
  total_reach: number; total_impressions: number; avg_er: number
  total_likes: number; total_comments: number; total_shares: number
  clients: OverviewClient[]
}
type RecentPost = {
  id: string; client_id: string; client_name: string; client_color: string
  platform: string; post_type: 'reel' | 'post' | 'story' | 'video' | 'carousel' | 'unknown'
  thumbnail: string | null; caption: string
  published_at: string | null; reach: number; likes: number; comments: number; shares: number; er: number
}
type PlatformSection = { platform: string; post_count: number; posts: RecentPost[] }
type ClientGroup = {
  client_id: string; client_name: string; client_color: string
  total_posts: number; platforms: PlatformSection[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  linkedin: 'LinkedIn', youtube: 'YouTube', twitter: 'X (Twitter)',
}
function platformLabel(p: string) { return PLATFORM_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1) }

// ── Social Performance ─────────────────────────────────────────────────────────

function SocialPerformanceSection() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<MetricoolOverview | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const now       = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate   = now.toISOString().split('T')[0]

  const fetchOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res  = await fetch(`/api/metricool/overview?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) return
      const data = await res.json() as MetricoolOverview
      setOverview(data)
    } catch { /* silent */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void fetchOverview() }, [fetchOverview])

  if (loading) return (
    <div className="dash-card flex items-center justify-center h-28">
      <RefreshCw className="w-5 h-5 animate-spin text-slate-300"/>
    </div>
  )
  if (!overview) return null

  const kpis = [
    { label: 'Total Reach',  value: formatNumber(overview.total_reach),      icon: Eye,           color: 'bg-blue-50 text-blue-600' },
    { label: 'Avg ER',       value: `${overview.avg_er}%`,                   icon: Activity,      color: overview.avg_er >= 4 ? 'bg-emerald-50 text-emerald-600' : overview.avg_er >= 2 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600' },
    { label: 'Likes',        value: formatNumber(overview.total_likes),       icon: Heart,         color: 'bg-pink-50 text-pink-600' },
    { label: 'Comments',     value: formatNumber(overview.total_comments),    icon: MessageCircle, color: 'bg-purple-50 text-purple-600' },
    { label: 'Shares',       value: formatNumber(overview.total_shares),      icon: Share2,        color: 'bg-cyan-50 text-cyan-600' },
    { label: 'Impressions',  value: formatNumber(overview.total_impressions), icon: Globe,         color: 'bg-slate-50 text-slate-600' },
  ]

  return (
    <div className="dash-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">Social Performance</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">LIVE</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Month-to-date across all clients · via {vendorName(user?.role, 'Metricool')}</p>
        </div>
        <button onClick={() => fetchOverview(true)} disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}/>
        </button>
      </div>

      {/* 6-KPI grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-center">
            <div className={`inline-flex p-1.5 rounded-lg mb-1.5 ${color}`}>
              <Icon className="w-3 h-3"/>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-client breakdown with ER color coding */}
      {overview.clients.length > 0 && (
        <div className="space-y-2.5">
          {overview.clients.map(client => {
            const erColor = client.er >= 4 ? '#10b981' : client.er >= 2 ? '#f59e0b' : '#f43f5e'
            const pct = overview.total_reach > 0 ? (client.reach / overview.total_reach) * 100 : 0
            return (
              <div key={client.client_id} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-28 truncate shrink-0">{client.name}</span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: '#1B3D38' }}/>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 w-20 text-right">{formatNumber(client.reach)} reach</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: erColor + '18', color: erColor }}>
                    {client.er}% ER
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: RecentPost }) {
  const erColor   = post.er >= 4 ? '#10b981' : post.er >= 2 ? '#f59e0b' : '#f43f5e'
  const typeLabel = post.post_type === 'reel' ? 'Reel' : post.post_type === 'story' ? 'Story' : post.post_type === 'carousel' ? 'Album' : post.post_type === 'video' ? 'Video' : null
  const dateStr   = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    : null

  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-100 dark:border-white/6 hover:border-slate-200 dark:hover:border-white/10 transition-all hover:shadow-md shrink-0 w-32 sm:w-36 bg-white dark:bg-slate-900">
      {/* Thumbnail */}
      <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-white/5 relative overflow-hidden">
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail} alt={post.caption.slice(0, 40)} className="w-full h-full object-cover" loading="lazy"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ background: post.client_color + '22', color: post.client_color }}>
            {post.client_name.charAt(0)}
          </div>
        )}
        {/* Post type badge (top-left) */}
        {typeLabel && (
          <div className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
            {typeLabel}
          </div>
        )}
        {/* ER badge (top-right) */}
        {post.er > 0 && (
          <div className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm" style={{ background: erColor + 'cc', color: '#fff' }}>
            {post.er}%
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/72 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
          <p className="text-[9px] text-white/85 leading-tight line-clamp-3 mb-1.5">{post.caption.slice(0, 100)}</p>
          <div className="grid grid-cols-3 gap-1 text-center">
            {[
              { icon: Heart,         v: post.likes    },
              { icon: MessageCircle, v: post.comments },
              { icon: Share2,        v: post.shares   },
            ].map(({ icon: Icon, v }, i) => (
              <div key={i}>
                <Icon className="w-3 h-3 text-white/70 mx-auto mb-0.5"/>
                <p className="text-[9px] font-semibold text-white">{formatNumber(v)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Footer — date prominent */}
      <div className="px-2 py-2 space-y-0.5">
        {dateStr && (
          <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{dateStr}</p>
        )}
        {post.reach > 0 && (
          <p className="text-[9px] text-slate-400">{formatNumber(post.reach)} reach</p>
        )}
      </div>
    </div>
  )
}

// ── Latest Posts Feed ──────────────────────────────────────────────────────────

function LatestPostsFeed() {
  const [grouped,    setGrouped]    = useState<ClientGroup[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res  = await fetch('/api/metricool/recent-posts?perPlatform=8&days=30')
      if (!res.ok) return
      const data = await res.json() as { grouped?: ClientGroup[]; posts?: RecentPost[] }
      if (data.grouped?.length) {
        setGrouped(data.grouped)
      } else if (data.posts?.length) {
        // Fallback: build client→platform groups from flat list
        const clientMap = new Map<string, ClientGroup>()
        for (const p of data.posts) {
          if (!clientMap.has(p.client_id)) {
            clientMap.set(p.client_id, { client_id: p.client_id, client_name: p.client_name, client_color: p.client_color, total_posts: 0, platforms: [] })
          }
          const group = clientMap.get(p.client_id)!
          let section = group.platforms.find(s => s.platform === p.platform)
          if (!section) { section = { platform: p.platform, post_count: 0, posts: [] }; group.platforms.push(section) }
          section.posts.push(p); section.post_count++; group.total_posts++
        }
        setGrouped([...clientMap.values()])
      }
    } catch { /* silent */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchPosts() }, [fetchPosts])

  if (loading) return (
    <div className="dash-card flex items-center justify-center h-36">
      <RefreshCw className="w-5 h-5 animate-spin text-slate-300"/>
    </div>
  )
  if (grouped.length === 0) return null

  const totalPlatforms = grouped.reduce((s, g) => s + g.platforms.length, 0)

  return (
    <div className="dash-card">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Latest Content</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {grouped.length} client{grouped.length !== 1 ? 's' : ''} · {totalPlatforms} platform{totalPlatforms !== 1 ? 's' : ''} · last 30 days
          </p>
        </div>
        <button onClick={() => fetchPosts(true)} disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}/>
        </button>
      </div>

      {/* Per-client blocks */}
      <div className="space-y-8">
        {grouped.map((group, gi) => (
          <div key={group.client_id}>
            {/* Client name bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: group.client_color }}/>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{group.client_name}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-slate-400">
                {group.total_posts} posts
              </span>
            </div>

            {/* Per-platform sub-sections */}
            <div className="space-y-4 pl-5">
              {group.platforms.map(section => (
                <div key={section.platform}>
                  {/* Platform sub-header */}
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <PlatformIcon platform={section.platform as import('@/lib/types').SocialPlatform} size="xs"/>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {platformLabel(section.platform)}
                    </span>
                    <span className="text-[9px] text-slate-400">· {section.post_count}</span>
                  </div>
                  {/* Horizontal scroll row */}
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
                    {section.posts.map(post => (
                      <PostCard key={post.id} post={post}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider between clients */}
            {gi < grouped.length - 1 && (
              <div className="mt-6 border-t border-slate-100 dark:border-white/5"/>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Client Health ──────────────────────────────────────────────────────────────

type ClientHealthProps = {
  clients: ReturnType<typeof useClients>['clients']
  tasks:   ReturnType<typeof useTasks>['tasks']
  posts:   ReturnType<typeof usePosts>['posts']
}

function computeHealth(client: ClientHealthProps['clients'][0], tasks: ClientHealthProps['tasks'], posts: ClientHealthProps['posts']) {
  const now         = new Date()
  const clientTasks = tasks.filter(t => t.client_id === client.id)
  const activeTasks = clientTasks.filter(t => t.status === 'active')
  const scheduled   = posts.filter(p => p.client_id === client.id && p.status === 'scheduled').length

  const crisisScore   = client.is_in_crisis ? 0 : 15
  const overdueCount  = activeTasks.filter(t => t.due_date && new Date(t.due_date) < now).length
  const overdueScore  = Math.max(0, 20 - overdueCount * 7)

  const stageWeight: Record<string, number> = {
    strategy: 1, ideas: 2, calendar: 3, copy: 4, design: 5,
    review: 6, approval: 7, scheduled: 8, published: 9, reporting: 10,
  }
  const avgStage      = clientTasks.length > 0
    ? clientTasks.reduce((s, t) => s + (stageWeight[t.pipeline_stage] ?? 1), 0) / clientTasks.length
    : 0
  const momentumScore = Math.round((avgStage / 10) * 30)
  const cadenceScore  = scheduled >= 3 ? 25 : scheduled === 2 ? 18 : scheduled === 1 ? 10 : 0
  const publishScore  = clientTasks.some(
    t => t.pipeline_stage === 'published' || t.pipeline_stage === 'reporting' || t.status === 'completed'
  ) ? 10 : 0

  const health = crisisScore + overdueScore + momentumScore + cadenceScore + publishScore

  const factors = [
    { label: 'Crisis status',          score: crisisScore,   max: 15, tip: crisisScore < 15 ? 'Deactivate Crisis Mode to restore 15 pts.' : null },
    { label: 'Overdue tasks',          score: overdueScore,  max: 20, tip: overdueScore < 20 ? `${overdueCount} overdue — clear them to recover up to ${20 - overdueScore} pts.` : null },
    { label: 'Pipeline momentum',      score: momentumScore, max: 30, tip: momentumScore < 30 ? clientTasks.length === 0 ? 'Create tasks and move them through the pipeline.' : 'Push work toward Design → Approval → Published.' : null },
    { label: 'Content cadence',        score: cadenceScore,  max: 25, tip: cadenceScore < 25 ? `${scheduled} posts scheduled — queue at least 3 to reach full 25 pts.` : null },
    { label: 'Publishing track record', score: publishScore, max: 10, tip: publishScore < 10 ? 'Publish or complete at least one task to earn 10 pts.' : null },
  ]

  const healthLabel = client.is_in_crisis ? 'In Crisis' : health >= 60 ? 'Healthy' : health >= 35 ? 'At Risk' : 'Needs Attention'
  const healthColor = health >= 60 ? '#10b981' : health >= 35 ? '#f59e0b' : '#f43f5e'

  return { health, healthLabel, healthColor, factors, activeTasks, scheduled }
}

function ClientHealthSection({ clients, tasks, posts }: ClientHealthProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedClient = clients.find(c => c.id === selected)
  const selectedHealth = selectedClient ? computeHealth(selectedClient, tasks, posts) : null

  return (
    <div className="dash-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Client Health</h3>
        <a href="/clients" className="text-xs text-novax hover:text-novax-hover font-medium">All clients →</a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {clients.map(client => {
          const { health, healthLabel, healthColor, activeTasks, scheduled } = computeHealth(client, tasks, posts)
          const isSelected = selected === client.id
          return (
            <div
              key={client.id}
              onClick={() => setSelected(isSelected ? null : client.id)}
              className={cn(
                'p-4 rounded-xl border transition-all cursor-pointer',
                isSelected
                  ? 'border-novax-border-active ring-2 ring-novax-light bg-novax-light/30 dark:bg-novax/8 shadow-sm'
                  : 'border-slate-100 dark:border-white/6 hover:border-slate-200 dark:hover:border-novax-border/40 hover:shadow-sm dark:bg-white/[0.02]',
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: client.color }}>
                  {client.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{client.name}</p>
                  <p className="text-[10px] text-slate-400">{client.brand_identity.industry}</p>
                </div>
                <ChevronRight className={cn('w-3.5 h-3.5 shrink-0 transition-transform text-slate-400', isSelected && 'rotate-90 text-novax-muted')}/>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">{healthLabel}</span>
                  <span className="font-semibold" style={{ color: healthColor }}>{health}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${health}%`, background: healthColor }}/>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                  <span>{activeTasks.length} active</span>
                  <span>{scheduled} scheduled</span>
                </div>
              </div>
            </div>
          )
        })}
        {clients.length === 0 && (
          <p className="col-span-4 text-sm text-slate-400 text-center py-6">No clients yet.</p>
        )}
      </div>

      {selectedClient && selectedHealth && (
        <div className="mt-4 p-4 rounded-xl border border-novax-border bg-novax-light/20 dark:bg-novax/6 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedClient.name} — How to reach 100%
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Current score: <span className="font-semibold" style={{ color: selectedHealth.healthColor }}>{selectedHealth.health}%</span>
                {selectedHealth.health < 100 && <> — {100 - selectedHealth.health} pts available</>}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-3.5 h-3.5"/>
            </button>
          </div>
          <div className="space-y-2">
            {selectedHealth.factors.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="flex items-center gap-1.5 w-36 shrink-0 pt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.score >= f.max ? '#10b981' : f.score > 0 ? '#f59e0b' : '#f43f5e' }}/>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{f.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(f.score / f.max) * 100}%`, background: f.score >= f.max ? '#10b981' : f.score > 0 ? '#f59e0b' : '#f43f5e' }}/>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 w-12 text-right">{f.score}/{f.max} pts</span>
                  </div>
                  {f.tip && <p className="text-[10px] text-slate-500 leading-snug">{f.tip}</p>}
                </div>
              </div>
            ))}
          </div>
          {selectedHealth.health >= 100 && (
            <p className="text-xs text-emerald-600 font-medium text-center pt-1">This client is at full health. Maintain the momentum.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }   = useAuth()
  const { tasks }  = useTasks()
  const { clients } = useClients()
  const { users }  = useUsers()
  const { posts }  = usePosts()
  const { items: moderationItems } = useModerationItems()
  const { data: activityData = [] } = useWeeklyActivity()
  const { data: aiCostRaw = 0 }    = useAiCostMonth()
  useRealtimeMulti([
    { table: 'tasks',            queryKey: ['tasks'] },
    { table: 'moderation_items', queryKey: ['moderation'] },
    { table: 'scheduled_posts',  queryKey: ['posts'] },
  ])

  const canSeeAiCost          = hasRole(user, ['admin', 'ceo', 'creative_director'])
  const canSeePipelineDetails = hasRole(user, ['admin', 'ceo', 'creative_director'])

  const today = new Date().toISOString().split('T')[0]
  const activeTasks       = tasks.filter(t => t.status === 'active').length
  const dueToday          = tasks.filter(t => t.due_date === today && t.status !== 'completed').length
  const pendingApprovals  = tasks.filter(t => t.pipeline_stage === 'approval').length
  const pendingModeration = moderationItems.filter(m => m.status === 'pending').length
  const postsScheduled    = posts.filter(p => p.status === 'scheduled').length
  const postsPublished    = posts.filter(p => p.status === 'published').length

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)

  const topPosts = [...posts]
    .filter(p => p.performance?.engagement_rate)
    .sort((a, b) => b.performance!.engagement_rate - a.performance!.engagement_rate)
    .slice(0, 5)

  const statCards = [
    { label: 'Active Tasks',       value: activeTasks,      icon: CheckSquare,   color: 'bg-blue-50 text-blue-600',     delta: `${tasks.filter(t => t.status === 'blocked').length} blocked` },
    { label: 'Due Today',          value: dueToday,         icon: Clock,         color: 'bg-amber-50 text-amber-600',   delta: `${tasks.filter(t => t.due_date < today && t.status !== 'completed').length} overdue` },
    { label: 'Pending Approvals',  value: pendingApprovals, icon: AlertCircle,   color: 'bg-rose-50 text-rose-600',     delta: 'Needs attention' },
    { label: 'Pending Moderation', value: pendingModeration,icon: MessageSquare, color: 'bg-purple-50 text-purple-600', delta: `${moderationItems.filter(m => m.status === 'escalated').length} escalated` },
    ...(canSeeAiCost ? [{ label: 'AI Cost (Month)', value: formatCurrency(aiCostRaw), icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', delta: 'via API usage log' }] : []),
    { label: 'Posts Scheduled',    value: postsScheduled,   icon: Calendar,      color: 'bg-novax-light text-novax',    delta: 'Upcoming' },
    { label: 'Posts Published',    value: postsPublished,   icon: Globe,         color: 'bg-cyan-50 text-cyan-600',     delta: 'This month' },
    { label: 'Pipeline Velocity',  value: tasks.length > 0 ? '3d' : '—', icon: TrendingUp, color: 'bg-orange-50 text-orange-600', delta: 'Avg days/stage' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 anim-stagger">
        {statCards.map(({ label, value, icon: Icon, color, delta }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-4 h-4"/>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{delta}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Social Performance — Metricool month-to-date */}
      <SocialPerformanceSection/>

      {/* Latest Posts Feed — live thumbnails from Metricool */}
      <LatestPostsFeed/>

      {/* Weekly Activity */}
      <div className="dash-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Activity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tasks completed &amp; posts published</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={activityData.length > 0 ? activityData : [{ day: '—', tasks: 0, posts: 0 }]}>
            <defs>
              <linearGradient id="tasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1B3D38" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#1B3D38" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="posts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
            <Area type="monotone" dataKey="tasks" stroke="#1B3D38" strokeWidth={2} fill="url(#tasks)" name="Tasks completed"/>
            <Area type="monotone" dataKey="posts"  stroke="#10b981" strokeWidth={2} fill="url(#posts)"  name="Posts published"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent tasks */}
        <div className="lg:col-span-2 dash-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Tasks</h3>
            <a href="/pipeline" className="text-xs text-novax hover:text-novax-hover font-medium">View pipeline →</a>
          </div>
          <div className="space-y-2">
            {recentTasks.map(task => {
              const stage    = STAGE_CONFIG[task.pipeline_stage]
              const priority = PRIORITY_CONFIG[task.priority]
              const client   = clients.find(c => c.id === task.client_id)
              const assignee = users.find(u => u.id === task.assigned_to)
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.035] transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-novax transition-colors">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400">{client?.name}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-[11px] text-slate-400">{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canSeePipelineDetails && (
                      <span className={`hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
                    )}
                    <span className={`hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>{priority.label}</span>
                    {assignee && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: assignee.color }}>
                        {assignee.initials}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {recentTasks.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No tasks yet.</p>
            )}
          </div>
        </div>

        {/* Top content by ER */}
        <div className="dash-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Top Content</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Best performing by engagement rate</p>
            </div>
            <a href="/performance" className="text-xs text-novax hover:text-novax-hover font-medium">Performance →</a>
          </div>
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-0.5">
            {topPosts.map((post, i) => {
              const client   = clients.find(c => c.id === post.client_id)
              const perf     = post.performance!
              const isUp     = perf.engagement_rate >= 3
              const platform = post.platforms?.[0]
              const erColor  = perf.engagement_rate >= 4 ? '#10b981' : perf.engagement_rate >= 2 ? '#f59e0b' : '#f43f5e'
              return (
                <div key={post.id} className="p-3 rounded-xl border border-slate-100 dark:border-white/6 hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-4 h-4 rounded bg-slate-100 dark:bg-white/8 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">{i + 1}</span>
                    {platform && <span className="shrink-0"><PlatformIcon platform={platform} size="xs"/></span>}
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex-1 truncate">{client?.name}</span>
                    <span className="text-[11px] font-bold flex items-center gap-0.5 shrink-0" style={{ color: erColor }}>
                      {isUp ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                      {perf.engagement_rate}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2.5">{post.caption}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: 'Reach',    value: formatNumber(perf.reach) },
                      { label: 'Likes',    value: formatNumber(perf.likes) },
                      { label: 'Comments', value: String(perf.comments) },
                    ].map(({ label, value }) => (
                      <div key={label} className="py-1 rounded-lg bg-slate-50 dark:bg-white/4">
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{value}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">{formatDate(post.published_at ?? post.scheduled_at)}</p>
                </div>
              )
            })}
            {topPosts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No published posts with data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Client health */}
      <ClientHealthSection clients={clients} tasks={tasks} posts={posts}/>
    </div>
  )
}
