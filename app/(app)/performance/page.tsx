'use client'

import { useState, useEffect, useMemo, type ComponentType } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { PlatformIcon } from '@/components/ui/platform-icon'
import type { Client, SocialPlatform } from '@/lib/types'
import {
  TrendingUp, TrendingDown, RefreshCw, Zap,
  Clock, ChevronRight, AlertTriangle, Activity,
  BarChart2, Target, Award, Info, Sparkles,
} from 'lucide-react'
import { AILoadingOverlay } from '@/components/shared/ai-loading-overlay'

const B = {
  primary: '#1B3D38',
  accent:  '#5BB4AE',
  muted:   '#2A6B62',
  light:   '#EBF4F3',
  border:  '#9DCCC8',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PerformancePost = {
  id: string
  caption: string
  media_url: string | null
  platforms: string[]
  published_at: string
  platform: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  link_clicks: number
  engagement_rate: number
}

type PerformanceIntel = {
  viral_patterns?: string[]
  failure_patterns?: string[]
  optimal_times?: Record<string, string>
  content_mix_recommendation?: {
    current: Record<string, number>
    recommended: Record<string, number>
    rationale: string
  }
  next_recommendations?: {
    title: string
    platform: string
    format: string
    caption_angle: string
    timing: string
    expected_er: string
  }[]
  one_line_summary?: string
}

type BestTimeEntry = { day: string; hour: number; avg_er: number; count: number }

type MetricoolAggregate = {
  reach: number; impressions: number; engagement_rate: number
  likes: number; comments: number; shares: number; saves: number
  _mock?: boolean
}

// ─── Industry benchmarks ─────────────────────────────────────────────────────

const BENCHMARKS: Record<string, { label: string; er: number }> = {
  instagram: { label: 'Instagram', er: 1.5 },
  tiktok:    { label: 'TikTok',    er: 5.0 },
  facebook:  { label: 'Facebook',  er: 0.6 },
  linkedin:  { label: 'LinkedIn',  er: 2.0 },
  twitter:   { label: 'X / Twitter', er: 0.5 },
  youtube:   { label: 'YouTube',   er: 4.0 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientPlatforms(client: Client): string[] {
  const profile = client.normalized_profile
  if (!profile) return []
  const platforms: string[] = []
  if (profile.primary_platform) platforms.push(profile.primary_platform)
  if (profile.secondary_platforms) platforms.push(...profile.secondary_platforms)
  return [...new Set(platforms)]
}

function erTierClass(er: number, posts: PerformancePost[]) {
  if (posts.length < 5) return 'border-slate-200'
  const sorted = [...posts].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top20 = sorted[Math.floor(sorted.length * 0.2)]?.engagement_rate ?? 0
  const bot20 = sorted[Math.floor(sorted.length * 0.8)]?.engagement_rate ?? 0
  if (er >= top20) return 'border-emerald-400 bg-emerald-50/40'
  if (er <= bot20) return 'border-red-300 bg-red-50/20'
  return 'border-slate-200'
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, badge, trend, icon: Icon }: {
  label: string
  value: string
  sub?: string | null
  badge?: string
  trend?: 'up' | 'down' | null
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        {Icon ? <Icon className="w-4 h-4 text-slate-300"/> : <span/>}
        <div className="flex items-center gap-1.5">
          {trend === 'up'   && <TrendingUp   className="w-3 h-3 text-emerald-500"/>}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400"/>}
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{badge}</span>
          )}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Platform breakdown card ──────────────────────────────────────────────────

function PlatformCard({ platform, posts, benchmark }: {
  platform: string
  posts: PerformancePost[]
  benchmark?: { er: number; label: string }
}) {
  const stats = useMemo(() => {
    const withData = posts.filter(p => p.engagement_rate > 0)
    const avgER = withData.length
      ? withData.reduce((s, p) => s + p.engagement_rate, 0) / withData.length
      : 0
    const totalReach = posts.reduce((s, p) => s + p.reach, 0)
    return { avgER, totalReach, count: posts.length }
  }, [posts])

  const vs = benchmark && stats.avgER > 0 ? stats.avgER / benchmark.er : null
  const status = vs == null ? null : vs >= 1.15 ? 'above' : vs >= 0.85 ? 'at' : 'below'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform as SocialPlatform} size="sm"/>
          <span className="text-sm font-semibold text-slate-800">{benchmark?.label ?? platform}</span>
        </div>
        {status && (
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
            status === 'above' ? 'bg-emerald-50 text-emerald-700' :
            status === 'at'    ? 'bg-amber-50 text-amber-700' :
                                 'bg-red-50 text-red-700')}>
            {status === 'above' ? 'Above avg' : status === 'at' ? 'On track' : 'Below avg'}
          </span>
        )}
        {stats.count === 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">No data</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-slate-50 rounded-lg">
          <p className="text-sm font-bold text-slate-900">{stats.avgER > 0 ? `${stats.avgER.toFixed(1)}%` : '—'}</p>
          <p className="text-[9px] text-slate-400">Avg ER</p>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <p className="text-sm font-bold text-slate-900">{formatNumber(stats.totalReach)}</p>
          <p className="text-[9px] text-slate-400">Total Reach</p>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <p className="text-sm font-bold text-slate-900">{stats.count}</p>
          <p className="text-[9px] text-slate-400">Posts</p>
        </div>
      </div>

      {benchmark && stats.avgER > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>vs {benchmark.er}% industry avg</span>
            <span>{stats.avgER.toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                status === 'above' ? 'bg-emerald-500' :
                status === 'below' ? 'bg-red-400' : 'bg-amber-400')}
              style={{ width: `${Math.min(100, (stats.avgER / Math.max(stats.avgER, benchmark.er * 1.5)) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, isSelected, onClick, allPosts }: {
  post: PerformancePost
  isSelected: boolean
  onClick: () => void
  allPosts: PerformancePost[]
}) {
  const sorted = [...allPosts].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top20Threshold = allPosts.length >= 5
    ? sorted[Math.floor(allPosts.length * 0.2)]?.engagement_rate ?? Infinity
    : Infinity
  const isTop = post.engagement_rate > 0 && post.engagement_rate >= top20Threshold

  return (
    <div
      onClick={onClick}
      className={cn('bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md', erTierClass(post.engagement_rate, allPosts))}
    >
      <div className="flex items-start gap-2 mb-3">
        <PlatformIcon platform={post.platform as SocialPlatform} size="xs"/>
        <p className="text-xs text-slate-700 line-clamp-2 flex-1">{post.caption || '(No caption)'}</p>
        {isTop && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: B.accent }}>Top</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'ER',    value: post.engagement_rate > 0 ? `${post.engagement_rate}%` : '—' },
          { label: 'Reach', value: formatNumber(post.reach) },
          { label: 'Likes', value: formatNumber(post.likes) },
          { label: 'Saves', value: formatNumber(post.saves) },
        ].map(({ label, value }) => (
          <div key={label} className="p-1.5 bg-slate-50 rounded-lg">
            <p className="text-xs font-bold text-slate-900">{value}</p>
            <p className="text-[9px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Impressions', value: formatNumber(post.impressions) },
            { label: 'Comments',    value: formatNumber(post.comments) },
            { label: 'Shares',      value: formatNumber(post.shares) },
            { label: 'Link Clicks', value: formatNumber(post.link_clicks) },
            { label: 'Published',   value: new Date(post.published_at).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-bold text-slate-700">{value}</p>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ clientId, client }: { clientId: string; client: Client }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PerformancePost[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [selected, setSelected] = useState<PerformancePost | null>(null)
  const [liveStats, setLiveStats] = useState<MetricoolAggregate | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; error?: string } | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30
  const hasBlogId = !!client.metricool_blog_id

  const fetchAll = async (d: number) => {
    if (!clientId) return
    setLoading(true)
    const end = new Date().toISOString()
    const start = new Date(Date.now() - d * 86400000).toISOString()
    const endDate = end.split('T')[0]
    const startDate = start.split('T')[0]
    try {
      const [postsRes, statsRes] = await Promise.all([
        fetch(`/api/performance/posts?client_id=${clientId}&start=${start}&end=${end}`),
        fetch(`/api/metricool/analytics?client_id=${clientId}&startDate=${startDate}&endDate=${endDate}`),
      ])
      const postsData = await postsRes.json() as { posts?: PerformancePost[] }
      const statsData = await statsRes.json() as { stats?: MetricoolAggregate; _mock?: boolean }
      setPosts(postsData.posts ?? [])
      if (statsData.stats) setLiveStats({ ...statsData.stats, _mock: statsData._mock })
    } finally {
      setLoading(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/performance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json() as { synced?: number; error?: string }
      setSyncResult({ synced: data.synced ?? 0, error: data.error })
    } catch { /* ignore */ }
    await fetchAll(days)
    setSyncing(false)
  }

  useEffect(() => { void fetchAll(days) }, [clientId, days])

  // Derived
  const isLive = liveStats && !liveStats._mock
  const totalReach       = liveStats?.reach       ?? posts.reduce((s, p) => s + p.reach, 0)
  const totalImpressions = liveStats?.impressions  ?? posts.reduce((s, p) => s + p.impressions, 0)
  const avgERNum = liveStats?.engagement_rate
    ?? (posts.length ? posts.reduce((s, p) => s + p.engagement_rate, 0) / posts.length : 0)
  const totalLikes = liveStats?.likes ?? posts.reduce((s, p) => s + p.likes, 0)
  const postsWithStats = posts.filter(p => p.engagement_rate > 0 || p.reach > 0)

  // Platform grouping
  const platformsInData = [...new Set(posts.map(p => p.platform))].filter(Boolean)
  const postsByPlatform: Record<string, PerformancePost[]> = Object.fromEntries(
    platformsInData.map(p => [p, posts.filter(post => post.platform === p)])
  )
  const clientPlatforms = getClientPlatforms(client)
  const allPlatforms = [...new Set([...platformsInData, ...clientPlatforms])].filter(p => p in BENCHMARKS)

  // Engagement trend chart
  const trendData = useMemo(() => {
    const sorted = [...posts].sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
    const buckets: Record<string, { reach: number; er_sum: number; count: number }> = {}
    for (const p of sorted) {
      const d = new Date(p.published_at)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      if (!buckets[key]) buckets[key] = { reach: 0, er_sum: 0, count: 0 }
      buckets[key].reach += p.reach
      buckets[key].er_sum += p.engagement_rate
      buckets[key].count += 1
    }
    return Object.entries(buckets).map(([date, d]) => ({
      date,
      reach: d.reach,
      avg_er: d.count > 0 ? parseFloat((d.er_sum / d.count).toFixed(2)) : 0,
    }))
  }, [posts])

  const topPosts = useMemo(
    () => [...posts].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 6),
    [posts]
  )
  const filteredPosts = platformFilter === 'all' ? topPosts : posts.filter(p => p.platform === platformFilter).slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                dateRange === r ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50')}
              style={dateRange === r ? { background: B.primary } : {}}
            >
              {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {syncResult?.error && <span className="text-[11px] text-red-600 font-medium max-w-xs truncate">{syncResult.error}</span>}
          {syncResult && !syncResult.error && <span className="text-[11px] text-emerald-600 font-medium">{syncResult.synced} posts synced</span>}
          <button
            onClick={syncNow}
            disabled={syncing || !hasBlogId}
            title={!hasBlogId ? 'No blog ID configured for this client' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 bg-white transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
            {syncing ? 'Syncing…' : `Sync ${vendorName(user?.role, 'Metricool')}`}
          </button>
        </div>
      </div>

      {!hasBlogId && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0"/>
          <p className="text-xs text-amber-700">No Scheduling Platform blog ID configured for this client. Add it in Clients → Edit Client to enable sync.</p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Reach"
          value={formatNumber(totalReach)}
          sub={isLive ? `${formatNumber(totalImpressions)} impressions` : null}
          badge={isLive ? 'LIVE' : undefined}
          icon={Activity}
        />
        <KpiCard label="Avg Engagement Rate" value={avgERNum ? `${avgERNum.toFixed(2)}%` : '—'} icon={TrendingUp}/>
        <KpiCard label="Total Likes" value={formatNumber(totalLikes)} icon={Award}/>
        <KpiCard
          label="Posts Tracked"
          value={postsWithStats.length.toString()}
          sub={posts.length > postsWithStats.length ? `${posts.length} total published` : null}
          icon={BarChart2}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300"/>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: B.light }}>
            <BarChart2 className="w-6 h-6" style={{ color: B.muted }}/>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No performance data yet</p>
          <p className="text-xs text-slate-500 max-w-xs mb-5">
            {hasBlogId
              ? `Sync with ${vendorName(user?.role, 'Metricool')} to pull post-level stats. Posts must be published via this platform.`
              : 'Add a Scheduling Platform blog ID for this client to enable performance sync.'}
          </p>
          {hasBlogId && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: B.primary }}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
              Sync Now
            </button>
          )}
        </div>
      )}

      {!loading && posts.length > 0 && (
        <>
          {/* Engagement rate trend */}
          {trendData.length > 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Engagement Rate Trend</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="erGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={B.accent} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={B.accent} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Avg ER']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
                  <Area type="monotone" dataKey="avg_er" stroke={B.accent} fill="url(#erGrad)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Platform breakdown */}
          {allPlatforms.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Platform Breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPlatforms.map(p => (
                  <PlatformCard
                    key={p}
                    platform={p}
                    posts={postsByPlatform[p] ?? []}
                    benchmark={BENCHMARKS[p]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top posts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Posts by Engagement</p>
              {platformsInData.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPlatformFilter('all')}
                    className={cn('px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors',
                      platformFilter === 'all' ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 bg-white')}
                    style={platformFilter === 'all' ? { background: B.primary } : {}}
                  >
                    All
                  </button>
                  {platformsInData.map(p => (
                    <button
                      key={p}
                      onClick={() => setPlatformFilter(p)}
                      className={cn('flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors',
                        platformFilter === p ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 bg-white')}
                      style={platformFilter === p ? { background: B.primary } : {}}
                    >
                      <PlatformIcon platform={p as SocialPlatform} size="xs"/>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredPosts.map(post => (
                  <PostCard
                    key={`${post.id}-${post.platform}`}
                    post={post}
                    isSelected={selected?.id === post.id && selected?.platform === post.platform}
                    onClick={() => setSelected(prev =>
                      prev?.id === post.id && prev?.platform === post.platform ? null : post
                    )}
                    allPosts={posts}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No posts for this platform in the selected range.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab 2: AI Patterns ───────────────────────────────────────────────────────

function PatternsTab({ clientId }: { clientId: string }) {
  const [intel, setIntel] = useState<PerformanceIntel | null>(null)
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bestTimes, setBestTimes] = useState<BestTimeEntry[]>([])
  const [postCount, setPostCount] = useState<number | null>(null)

  const fetchIntel = async () => {
    const res = await fetch(`/api/performance/intelligence?client_id=${clientId}`)
    const data = await res.json() as { intel?: PerformanceIntel; analyzed_at?: string }
    setIntel(data.intel ?? null)
    setAnalyzedAt(data.analyzed_at ?? null)
  }

  const fetchBestTimes = async () => {
    const res = await fetch(`/api/performance/best-times?client_id=${clientId}`)
    const data = await res.json() as { heatmap?: BestTimeEntry[] }
    setBestTimes((data.heatmap ?? []).slice(0, 6))
  }

  const fetchPostCount = async () => {
    const start = new Date(Date.now() - 90 * 86400000).toISOString()
    const end = new Date().toISOString()
    const res = await fetch(`/api/performance/posts?client_id=${clientId}&start=${start}&end=${end}`)
    const data = await res.json() as { posts?: { engagement_rate: number }[] }
    setPostCount((data.posts ?? []).filter(p => p.engagement_rate > 0).length)
  }

  useEffect(() => {
    if (clientId) {
      void fetchIntel()
      void fetchBestTimes()
      void fetchPostCount()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const runAnalysis = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/performance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json() as { intel?: PerformanceIntel; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setIntel(data.intel ?? null)
      setAnalyzedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const mixData = intel?.content_mix_recommendation
    ? Object.entries(intel.content_mix_recommendation.recommended).map(([name, value]) => ({ name, value }))
    : []

  const needsSync = postCount !== null && postCount < 5

  return (
    <div className="space-y-5">
      {analyzing && <AILoadingOverlay message="Generating pattern intelligence…" sub="Analyzing your top and bottom posts…"/>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {analyzedAt ? `Last analyzed: ${new Date(analyzedAt).toLocaleDateString()}` : 'No analysis yet'}
        </p>
        <button
          onClick={runAnalysis}
          disabled={analyzing || needsSync}
          title={needsSync ? 'Sync more posts first (need 5 with stats)' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
          style={{ background: B.primary }}
        >
          {analyzing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
          {analyzing ? 'Analyzing…' : intel ? 'Re-analyze' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0"/>
          <p className="text-xs text-amber-700">
            {error.includes('Not enough')
              ? 'Need at least 5 posts with synced stats. Go to Overview and sync first.'
              : error}
          </p>
        </div>
      )}

      {needsSync && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: B.light }}>
            <Activity className="w-5 h-5" style={{ color: B.muted }}/>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">More data needed</p>
          <p className="text-xs text-slate-500">
            {postCount === 0
              ? 'No posts with stats yet. Sync from the Overview tab first.'
              : `Only ${postCount} post${postCount !== 1 ? 's' : ''} with stats — need at least 5.`}
          </p>
        </div>
      )}

      {!intel && !analyzing && !error && !needsSync && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: B.light }}>
            <Sparkles className="w-6 h-6" style={{ color: B.muted }}/>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Run your first analysis</p>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            AI will surface viral patterns, failure signals, and content mix recommendations from your post history.
          </p>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: B.primary }}
          >
            <Zap className="w-3.5 h-3.5"/> Run Analysis
          </button>
        </div>
      )}

      {intel && (
        <div className="space-y-5">
          {intel.one_line_summary && (
            <div className="p-4 rounded-xl border" style={{ background: B.light, borderColor: B.border }}>
              <p className="text-sm font-semibold text-slate-800">{intel.one_line_summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {intel.viral_patterns && intel.viral_patterns.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-3.5 h-3.5 text-emerald-500"/>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">What&apos;s Working</p>
                </div>
                <div className="space-y-2">
                  {intel.viral_patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-emerald-50 rounded-lg">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0"/>
                      <p className="text-xs text-slate-700">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {intel.failure_patterns && intel.failure_patterns.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400"/>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider">What&apos;s Not Working</p>
                </div>
                <div className="space-y-2">
                  {intel.failure_patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg">
                      <ChevronRight className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0"/>
                      <p className="text-xs text-slate-700">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mixData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recommended Content Mix</p>
                {intel.content_mix_recommendation?.rationale && (
                  <p className="text-xs text-slate-400 mb-4">{intel.content_mix_recommendation.rationale}</p>
                )}
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={mixData} cx="50%" cy="50%" outerRadius={58} dataKey="value" labelLine={false}>
                      {mixData.map((_, i) => (
                        <Cell key={i} fill={[B.primary, B.accent, B.muted, '#94a3b8'][i % 4]}/>
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }}/>
                    <Tooltip formatter={(v: number) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {bestTimes.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-3.5 h-3.5" style={{ color: B.muted }}/>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Best Times to Post</p>
                </div>
                <div className="space-y-2.5">
                  {bestTimes.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700 w-24 shrink-0">{t.day} {t.hour}:00</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (t.avg_er / (bestTimes[0]?.avg_er || 1)) * 100)}%`,
                            background: B.accent,
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 w-14 text-right">{t.avg_er.toFixed(1)}% ER</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {intel.optimal_times && Object.keys(intel.optimal_times).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Optimal Times by Platform</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(intel.optimal_times).map(([platform, time]) => (
                  <div key={platform} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformIcon platform={platform as SocialPlatform} size="xs"/>
                      <span className="text-xs font-semibold text-slate-700 capitalize">{platform}</span>
                    </div>
                    <p className="text-xs text-slate-500">{time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Benchmarks ────────────────────────────────────────────────────────

function BenchmarksTab({ clientId, client }: { clientId: string; client: Client }) {
  const [posts, setPosts] = useState<PerformancePost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    fetch(`/api/performance/posts?client_id=${clientId}`)
      .then(r => r.json() as Promise<{ posts?: PerformancePost[] }>)
      .then(data => setPosts(data.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  const platformER: Record<string, number> = {}
  for (const plat of [...new Set(posts.map(p => p.platform))]) {
    const items = posts.filter(p => p.platform === plat && p.engagement_rate > 0)
    if (items.length) platformER[plat] = items.reduce((s, p) => s + p.engagement_rate, 0) / items.length
  }

  const clientPlatforms = getClientPlatforms(client)
  const platformsWithData = Object.keys(platformER)
  const platformsToShow = [...new Set([...platformsWithData, ...clientPlatforms])].filter(p => p in BENCHMARKS)
  const hasAnyData = platformsWithData.length > 0

  const chartData = platformsToShow.map(p => ({
    platform: BENCHMARKS[p]?.label ?? p,
    client: parseFloat((platformER[p] ?? 0).toFixed(2)),
    benchmark: BENCHMARKS[p]?.er ?? 0,
  })).filter(d => d.client > 0 || d.benchmark > 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"/>)}
      </div>
    )
  }

  if (platformsToShow.length === 0 && !hasAnyData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: B.light }}>
          <BarChart2 className="w-6 h-6" style={{ color: B.muted }}/>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">No benchmark data yet</p>
        <p className="text-xs text-slate-500 max-w-xs">
          Sync performance data from the Overview tab. Benchmarks appear once posts have analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"/>
        <p className="text-xs text-slate-500">
          Industry averages from 2025–2026 (Social Insider, Hootsuite). Only platforms active for this client are shown.
          {!hasAnyData && ' Sync performance data to see client ER vs industry.'}
        </p>
      </div>

      {hasAnyData && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Client ER vs Industry Average</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={6} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip
                formatter={(v: number, n: string) => [`${v}%`, n === 'client' ? 'Client' : 'Industry Avg']}
                contentStyle={{ fontSize: 12, borderRadius: 10 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="client"    name="Client ER"    fill={B.primary} radius={[3, 3, 0, 0]}/>
              <Bar dataKey="benchmark" name="Industry Avg" fill={B.accent}  radius={[3, 3, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {platformsToShow.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {platformsToShow.map(p => {
            const bench = BENCHMARKS[p]
            if (!bench) return null
            const clientER = platformER[p] ?? null
            const status = clientER == null ? 'no-data'
              : clientER >= bench.er * 1.15 ? 'above'
              : clientER >= bench.er * 0.85 ? 'at'
              : 'below'
            return (
              <div key={p} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={p as SocialPlatform} size="sm"/>
                    <span className="text-sm font-semibold text-slate-700">{bench.label}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                    status === 'above'   ? 'bg-emerald-50 text-emerald-700' :
                    status === 'at'      ? 'bg-amber-50 text-amber-700' :
                    status === 'below'   ? 'bg-red-50 text-red-700' :
                                          'bg-slate-100 text-slate-500')}>
                    {status === 'above' ? 'Above avg' : status === 'at' ? 'On track' : status === 'below' ? 'Below avg' : 'No data yet'}
                  </span>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className={cn('text-xl font-bold', clientER != null ? 'text-slate-900' : 'text-slate-300')}>
                      {clientER != null ? `${clientER.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400">Your ER</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-semibold text-slate-400">{bench.er}%</p>
                    <p className="text-[10px] text-slate-400">Industry avg</p>
                  </div>
                </div>
                {clientER != null && (
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', status === 'above' ? 'bg-emerald-500' : status === 'below' ? 'bg-red-400' : 'bg-amber-400')}
                      style={{ width: `${Math.min(100, (clientER / Math.max(clientER, bench.er * 1.5)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        Benchmarks are global 2025–2026 averages and vary by niche. Use as directional reference only.
      </p>
    </div>
  )
}

// ─── Tab 4: Recommendations ───────────────────────────────────────────────────

function RecommendationsTab({ clientId }: { clientId: string }) {
  const [intel, setIntel] = useState<PerformanceIntel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    fetch(`/api/performance/intelligence?client_id=${clientId}`)
      .then(r => r.json() as Promise<{ intel?: PerformanceIntel }>)
      .then(data => setIntel(data.intel ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-300"/>
      </div>
    )
  }

  if (!intel?.next_recommendations?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: B.light }}>
          <Target className="w-6 h-6" style={{ color: B.muted }}/>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">No recommendations yet</p>
        <p className="text-xs text-slate-500 max-w-xs mb-1">
          Run an AI pattern analysis from the AI Patterns tab to generate data-backed content briefs here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Based on your top-performing posts. Click Create to open in Studio.</p>
      {intel.next_recommendations.map((rec, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: B.primary }}
              >
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-slate-900">{rec.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PlatformIcon platform={rec.platform as SocialPlatform} size="xs"/>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{rec.format}</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">{rec.caption_angle}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3"/>{rec.timing}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3"/>{rec.expected_er}
              </span>
            </div>
            <Link
              href={`/studio/content?platform=${encodeURIComponent(rec.platform)}&brief=${encodeURIComponent(rec.caption_angle)}&client=${clientId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors hover:opacity-90"
              style={{ background: B.primary }}
            >
              <Zap className="w-3 h-3"/>
              Create in Studio
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { clients } = useClients()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'benchmarks' | 'recommendations'>('overview')

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) setSelectedClientId(clients[0].id)
  }, [clients, selectedClientId])

  const client = clients.find(c => c.id === selectedClientId)

  const TABS = [
    { id: 'overview'        as const, label: 'Overview',        icon: BarChart2 },
    { id: 'patterns'        as const, label: 'AI Patterns',     icon: Sparkles  },
    { id: 'benchmarks'      as const, label: 'Benchmarks',      icon: Activity  },
    { id: 'recommendations' as const, label: 'Recommendations', icon: Target    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Content analytics, AI pattern analysis, and actionable recommendations</p>
        </div>
        <select
          value={selectedClientId}
          onChange={e => { setSelectedClientId(e.target.value); setActiveTab('overview') }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
        >
          <option value="" disabled>Select client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedClientId && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-slate-100">
            <TrendingUp className="w-7 h-7 text-slate-300"/>
          </div>
          <p className="text-sm font-medium text-slate-500">Select a client to view performance data</p>
        </div>
      )}

      {selectedClientId && client && (
        <>
          {/* Client context strip */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
            <div
              className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: client.brand_identity?.logo_url ? '#f8fafc' : client.color }}
            >
              {client.brand_identity?.logo_url
                ? <img src={client.brand_identity.logo_url} alt={client.name} className="w-full h-full object-contain p-0.5"/>
                : client.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{client.name}</p>
              <p className="text-xs text-slate-400">{client.brand_identity.industry}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {getClientPlatforms(client).length > 0
                ? getClientPlatforms(client).map(p => (
                    <div key={p} className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <PlatformIcon platform={p as SocialPlatform} size="xs"/>
                      <span className="text-[10px] text-slate-500 capitalize">{p}</span>
                    </div>
                  ))
                : <span className="text-[10px] text-slate-400">No platforms configured</span>}
              {!client.metricool_blog_id && (
                <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">No sync</span>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  )}
                  style={activeTab === tab.id ? { background: B.primary } : {}}
                >
                  <Icon className="w-3.5 h-3.5"/>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {activeTab === 'overview'        && <OverviewTab       clientId={selectedClientId} client={client}/>}
          {activeTab === 'patterns'        && <PatternsTab       clientId={selectedClientId}/>}
          {activeTab === 'benchmarks'      && <BenchmarksTab     clientId={selectedClientId} client={client}/>}
          {activeTab === 'recommendations' && <RecommendationsTab clientId={selectedClientId}/>}
        </>
      )}
    </div>
  )
}
