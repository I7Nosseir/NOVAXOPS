'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { PlatformIcon } from '@/components/ui/platform-icon'
import type { Client, SocialPlatform } from '@/lib/types'
import {
  TrendingUp, TrendingDown, RefreshCw, Zap, Plus, Trash2,
  Users, Clock, ChevronRight, AlertTriangle, Activity,
  BarChart2, Target, Award, Info,
} from 'lucide-react'
import { AILoadingOverlay } from '@/components/shared/ai-loading-overlay'

const B = {
  primary: '#1B3D38',
  accent:  '#5BB4AE',
  muted:   '#2A6B62',
  light:   '#EBF4F3',
  border:  '#9DCCC8',
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

type CompetitorSnapshot = {
  id: string
  competitor_handle: string
  platform: string
  followers: number
  avg_er: number
  posting_frequency: number
  top_content_types: Record<string, number>
  notes?: string
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function erTierClass(er: number, posts: PerformancePost[]) {
  if (posts.length < 5) return 'border-slate-200'
  const sorted = [...posts].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top20 = sorted[Math.floor(sorted.length * 0.2)]?.engagement_rate ?? 0
  const bot20 = sorted[Math.floor(sorted.length * 0.8)]?.engagement_rate ?? 0
  if (er >= top20) return 'border-emerald-400 bg-emerald-50/40'
  if (er <= bot20) return 'border-red-300 bg-red-50/20'
  return 'border-slate-200'
}

function getClientPlatforms(client: Client): string[] {
  const profile = client.normalized_profile
  if (!profile) return []
  const platforms: string[] = []
  if (profile.primary_platform) platforms.push(profile.primary_platform)
  if (profile.secondary_platforms) platforms.push(...profile.secondary_platforms)
  return [...new Set(platforms)]
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, badge, trend }: {
  label: string; value: string; sub?: string | null; badge?: string; trend?: 'up' | 'down' | null
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-500"/>}
          {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400"/>}
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{badge}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Tab 1: Content Performance ───────────────────────────────────────────────

function ContentPerformanceTab({ clientId, client }: { clientId: string; client: Client }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PerformancePost[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dateRange, setDateRange] = useState('30d')
  const [selected, setSelected] = useState<PerformancePost | null>(null)
  const [liveStats, setLiveStats] = useState<MetricoolAggregate | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; error?: string } | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30
  const hasBlogId = !!client.metricool_blog_id

  const fetchLiveStats = async () => {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    try {
      const res = await fetch(`/api/metricool/analytics?client_id=${clientId}&startDate=${start}&endDate=${end}`)
      if (!res.ok) return
      const data = await res.json() as { stats?: MetricoolAggregate; _mock?: boolean }
      if (data.stats) setLiveStats({ ...data.stats, _mock: data._mock })
    } catch { /* silent */ }
  }

  const fetchPosts = async () => {
    if (!clientId) return
    setLoading(true)
    const end = new Date().toISOString()
    const start = new Date(Date.now() - days * 86400000).toISOString()
    try {
      const res = await fetch(`/api/performance/posts?client_id=${clientId}&start=${start}&end=${end}`)
      const data = await res.json() as { posts?: PerformancePost[] }
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }

  const syncNow = async () => {
    if (!clientId) return
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
    await Promise.all([fetchPosts(), fetchLiveStats()])
    setSyncing(false)
  }

  useEffect(() => {
    void fetchPosts()
    void fetchLiveStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange])

  const isLive = liveStats && !liveStats._mock
  const totalReach       = liveStats?.reach       ?? posts.reduce((s, p) => s + p.reach, 0)
  const totalImpressions = liveStats?.impressions  ?? posts.reduce((s, p) => s + p.impressions, 0)
  const avgERNum = liveStats?.engagement_rate
    ?? (posts.length ? posts.reduce((s, p) => s + p.engagement_rate, 0) / posts.length : 0)
  const topPost = posts[0]

  const postsWithStats = posts.filter(p => p.engagement_rate > 0 || p.reach > 0)
  const filteredPosts = platformFilter === 'all' ? posts : posts.filter(p => p.platform === platformFilter)
  const platformsInData = [...new Set(posts.map(p => p.platform))]

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', dateRange === r ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50')}
              style={dateRange === r ? { background: B.primary } : {}}
            >
              Last {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {syncResult?.error && (
            <span className="text-[11px] text-red-600 font-medium max-w-xs truncate">{syncResult.error}</span>
          )}
          {syncResult && !syncResult.error && (
            <span className="text-[11px] text-emerald-600 font-medium">{syncResult.synced} post{syncResult.synced !== 1 ? 's' : ''} synced</span>
          )}
          <button
            onClick={syncNow}
            disabled={syncing || !hasBlogId}
            title={!hasBlogId ? 'No Metricool blog ID configured for this client' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors bg-white"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
            {syncing ? 'Syncing…' : `Sync ${vendorName(user?.role, 'Metricool')}`}
          </button>
        </div>
      </div>

      {/* No Metricool ID warning */}
      {!hasBlogId && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0"/>
          <p className="text-xs text-amber-700">This client has no Metricool blog ID configured. Add it in Settings → Client to enable performance sync.</p>
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Reach"
          value={formatNumber(totalReach)}
          sub={liveStats ? `${formatNumber(totalImpressions)} impressions` : null}
          badge={isLive ? 'LIVE' : undefined}
        />
        <StatCard
          label="Avg Engagement Rate"
          value={avgERNum ? `${avgERNum.toFixed(2)}%` : '—'}
        />
        <StatCard
          label="Posts Analyzed"
          value={postsWithStats.length.toString()}
          sub={posts.length > postsWithStats.length ? `${posts.length} total published` : null}
        />
        <StatCard
          label="Top ER Post"
          value={topPost?.engagement_rate ? `${topPost.engagement_rate}%` : '—'}
          sub={topPost ? topPost.platform : null}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300"/>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <BarChart2 className="w-5 h-5 text-slate-400"/>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No performance data yet</p>
            <p className="text-xs text-slate-500 mb-4">
              {hasBlogId
                ? `Sync with ${vendorName(user?.role, 'Metricool')} to pull post-level stats. Posts must be published via this platform first.`
                : 'Add a Metricool blog ID for this client, then sync to see post analytics.'}
            </p>
            {hasBlogId && (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: B.primary }}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Platform filter */}
      {!loading && posts.length > 0 && platformsInData.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Platform:</span>
          <button
            onClick={() => setPlatformFilter('all')}
            className={cn('px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors',
              platformFilter === 'all' ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50')}
            style={platformFilter === 'all' ? { background: B.primary } : {}}
          >
            All
          </button>
          {platformsInData.map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors',
                platformFilter === p ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50')}
              style={platformFilter === p ? { background: B.primary } : {}}
            >
              <PlatformIcon platform={p as SocialPlatform} size="xs"/>
              <span className="capitalize">{p}</span>
            </button>
          ))}
        </div>
      )}

      {/* Post grid */}
      {!loading && filteredPosts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredPosts.map(post => (
            <div
              key={`${post.id}-${post.platform}`}
              onClick={() => setSelected(selected?.id === post.id && selected.platform === post.platform ? null : post)}
              className={cn('bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md', erTierClass(post.engagement_rate, posts))}
            >
              <div className="flex items-start gap-2 mb-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <PlatformIcon platform={post.platform as SocialPlatform} size="xs"/>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2 flex-1">{post.caption || '(No caption)'}</p>
                {post.engagement_rate > 0 && posts.length >= 5 &&
                  post.engagement_rate >= (posts[Math.floor(posts.length * 0.2)]?.engagement_rate ?? 0) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: B.accent }}>Top</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label: 'ER', value: post.engagement_rate > 0 ? `${post.engagement_rate}%` : '—' },
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
              {selected?.id === post.id && selected.platform === post.platform && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Impressions', value: formatNumber(post.impressions) },
                    { label: 'Comments', value: formatNumber(post.comments) },
                    { label: 'Shares', value: formatNumber(post.shares) },
                    { label: 'Link Clicks', value: formatNumber(post.link_clicks) },
                    { label: 'Published', value: new Date(post.published_at).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-slate-700">{value}</p>
                      <p className="text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Competitor Insights ───────────────────────────────────────────────

function CompetitorTab({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<CompetitorSnapshot[]>([])
  const [clientAvgER, setClientAvgER] = useState(0)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ handle: '', platform: 'instagram', followers: '', avg_er: '', posting_frequency: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const fetchCompetitors = async () => {
    const res = await fetch(`/api/performance/competitors?client_id=${clientId}`)
    const data = await res.json() as { competitors?: CompetitorSnapshot[] }
    setCompetitors(data.competitors ?? [])
  }

  const fetchClientAvgER = async () => {
    const start = new Date(Date.now() - 90 * 86400000).toISOString()
    const end = new Date().toISOString()
    const res = await fetch(`/api/performance/posts?client_id=${clientId}&start=${start}&end=${end}`)
    const data = await res.json() as { posts?: PerformancePost[] }
    const posts = (data.posts ?? []).filter(p => p.engagement_rate > 0)
    if (posts.length > 0) setClientAvgER(posts.reduce((s, p) => s + p.engagement_rate, 0) / posts.length)
  }

  useEffect(() => {
    if (clientId) { void fetchCompetitors(); void fetchClientAvgER() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const handleSave = async () => {
    if (!form.handle.trim()) return
    setSaving(true)
    await fetch('/api/performance/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        competitor_handle: form.handle,
        platform: form.platform,
        followers: Number(form.followers) || 0,
        avg_er: Number(form.avg_er) || 0,
        posting_frequency: Number(form.posting_frequency) || 0,
        notes: form.notes || undefined,
      }),
    })
    setAdding(false)
    setForm({ handle: '', platform: 'instagram', followers: '', avg_er: '', posting_frequency: '', notes: '' })
    await fetchCompetitors()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/performance/competitors?id=${id}`, { method: 'DELETE' })
    setCompetitors(prev => prev.filter(c => c.id !== id))
  }

  const chartData = [
    { name: 'This Client', er: parseFloat(clientAvgER.toFixed(2)) },
    ...competitors.map(c => ({ name: c.competitor_handle, er: c.avg_er })),
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-medium rounded-lg"
          style={{ background: B.primary }}
        >
          <Plus className="w-3.5 h-3.5"/> Add Competitor
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Add Competitor</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'handle', label: 'Handle', placeholder: '@competitor', type: 'text' },
              { key: 'followers', label: 'Followers', placeholder: '42000', type: 'number' },
              { key: 'avg_er', label: 'Avg ER %', placeholder: '3.8', type: 'number' },
              { key: 'posting_frequency', label: 'Posts/week', placeholder: '5', type: 'number' },
              { key: 'notes', label: 'Notes', placeholder: 'Optional', type: 'text' },
            ].map(f => (
              <div key={f.key} className={f.key === 'notes' ? 'col-span-2' : ''}>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  type={f.type}
                  step={f.key === 'avg_er' ? '0.1' : undefined}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Platform</label>
              <select value={form.platform} onChange={e => setForm(v => ({ ...v, platform: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-novax-border">
                {['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.handle.trim()} className="px-4 py-2 text-xs text-white font-medium rounded-lg disabled:opacity-50" style={{ background: B.primary }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {competitors.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Engagement Rate Comparison</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip formatter={(v) => [`${v}%`, 'Avg ER']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
              <Bar dataKey="er" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? B.primary : '#94a3b8'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-3">
        {competitors.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={c.platform as SocialPlatform} size="xs"/>
                <span className="text-sm font-semibold text-slate-900">{c.competitor_handle}</span>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              {[
                { label: 'Followers', value: formatNumber(c.followers) },
                { label: 'Avg ER', value: `${c.avg_er}%` },
                { label: 'Posts/week', value: c.posting_frequency.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-slate-900">{value}</p>
                  <p className="text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
            {clientAvgER > 0 && c.avg_er > 0 && (
              <div className={cn('p-2 rounded-lg text-xs font-medium text-center',
                clientAvgER >= c.avg_er ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                {clientAvgER >= c.avg_er
                  ? `Outperforming by ${(clientAvgER - c.avg_er).toFixed(1)}pp ER`
                  : `${(c.avg_er - clientAvgER).toFixed(1)}pp behind on ER`}
              </div>
            )}
            {c.notes && <p className="mt-2 text-xs text-slate-400 italic">{c.notes}</p>}
          </div>
        ))}

        {competitors.length === 0 && !adding && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-slate-400"/>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No competitors tracked</p>
            <p className="text-xs text-slate-400">Add competitors to compare engagement rates and identify performance gaps.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 3: Pattern Intelligence ──────────────────────────────────────────────

function PatternIntelTab({ clientId }: { clientId: string }) {
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
    const posts = data.posts ?? []
    setPostCount(posts.filter(p => p.engagement_rate > 0).length)
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

  const hasEnoughData = postCount === null || postCount >= 5
  const needsSync = postCount !== null && postCount < 5

  return (
    <div className="space-y-5">
      {analyzing && <AILoadingOverlay message="Generating pattern intelligence…" sub="Analyzing your top and bottom posts…"/>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {analyzedAt ? `Last analyzed: ${new Date(analyzedAt).toLocaleDateString()}` : 'Not yet analyzed'}
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
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1">{error.includes('Not enough') ? 'More data needed' : 'Analysis failed'}</p>
            {error.includes('Not enough') ? (
              <p className="text-xs text-amber-700">
                You need at least 5 posts with synced performance stats. Go to Content Performance and use Sync to pull post analytics first.
              </p>
            ) : (
              <p className="text-xs text-amber-700">{error}</p>
            )}
          </div>
        </div>
      )}

      {needsSync && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Activity className="w-5 h-5 text-slate-400"/>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Need more data to analyze</p>
          <p className="text-xs text-slate-500 mb-3">
            {postCount === 0
              ? 'No posts with performance stats yet. Sync Metricool data from the Content Performance tab first.'
              : `Only ${postCount} post${postCount !== 1 ? 's' : ''} with stats. Need at least 5 to generate reliable patterns.`}
          </p>
        </div>
      )}

      {!intel && !analyzing && !error && hasEnoughData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-slate-400"/>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No analysis yet</p>
          <p className="text-xs text-slate-500 mb-4">Run an analysis to surface viral patterns, content mix recommendations, and next content briefs.</p>
          <button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: B.primary }}>
            <Zap className="w-3.5 h-3.5"/> Run Analysis
          </button>
        </div>
      )}

      {intel && (
        <div className="space-y-5">
          {/* Summary callout */}
          {intel.one_line_summary && (
            <div className="p-4 rounded-xl border border-novax-border" style={{ background: B.light }}>
              <p className="text-sm font-semibold text-slate-800">{intel.one_line_summary}</p>
            </div>
          )}

          {/* Patterns row */}
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

          {/* Mix + Best times */}
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
                    <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {bestTimes.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-3.5 h-3.5 text-novax-muted"/>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Best Times to Post</p>
                </div>
                <div className="space-y-2">
                  {bestTimes.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700 w-24 shrink-0">{t.day} {t.hour}:00</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, (t.avg_er / (bestTimes[0]?.avg_er || 1)) * 100)}%`, background: B.accent }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 w-14 text-right">{t.avg_er.toFixed(1)}% ER</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optimal times by platform */}
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

          {/* Next content briefs */}
          {intel.next_recommendations && intel.next_recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-3.5 h-3.5 text-novax-muted"/>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Next Content Briefs</p>
              </div>
              <div className="space-y-3">
                {intel.next_recommendations.map((rec, i) => (
                  <div key={i} className="p-4 rounded-xl border border-novax-border" style={{ background: B.light }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: B.primary }}>{i + 1}</span>
                        <p className="text-sm font-semibold text-slate-900">{rec.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PlatformIcon platform={rec.platform as SocialPlatform} size="xs"/>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-novax-border text-slate-600 capitalize">{rec.format}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">{rec.caption_angle}</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-[10px] text-slate-400">
                        <span><Clock className="w-3 h-3 inline mr-1"/>{rec.timing}</span>
                        <span><TrendingUp className="w-3 h-3 inline mr-1"/>{rec.expected_er}</span>
                      </div>
                      <Link
                        href={`/studio/content?platform=${encodeURIComponent(rec.platform)}&brief=${encodeURIComponent(rec.caption_angle)}&client=${clientId}`}
                        className="flex items-center gap-1 px-2.5 py-1 text-white text-[10px] font-semibold rounded-lg transition-colors shrink-0"
                        style={{ background: B.primary }}
                      >
                        <Zap className="w-3 h-3"/> Create
                      </Link>
                    </div>
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

// ─── Tab 4: Benchmarks ────────────────────────────────────────────────────────

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

  // Compute per-platform ER from real post data
  const platformER: Record<string, number> = {}
  for (const plat of [...new Set(posts.map(p => p.platform))]) {
    const items = posts.filter(p => p.platform === plat && p.engagement_rate > 0)
    if (items.length) platformER[plat] = items.reduce((s, p) => s + p.engagement_rate, 0) / items.length
  }

  // Determine which platforms to show:
  // 1. Platforms with actual ER data
  // 2. Platforms the client is known to use (from normalized_profile)
  const clientPlatforms = getClientPlatforms(client)
  const platformsWithData = Object.keys(platformER)
  const platformsToShow = [...new Set([...platformsWithData, ...clientPlatforms])]
    .filter(p => p in BENCHMARKS)

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
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <BarChart2 className="w-5 h-5 text-slate-400"/>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">No benchmark data yet</p>
        <p className="text-xs text-slate-500 max-w-xs">
          Sync performance data from the Content Performance tab. Benchmarks will appear once posts have analytics.
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
          {!hasAnyData && ' Sync performance data to see your client ER vs industry.'}
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
              <Tooltip formatter={(v, n) => [`${v}%`, n === 'client' ? 'Client' : 'Industry Avg']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="client" name="Client ER" fill={B.primary} radius={[3, 3, 0, 0]}/>
              <Bar dataKey="benchmark" name="Industry Avg" fill={B.accent} radius={[3, 3, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform cards — only for active platforms */}
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
                    status === 'above' ? 'bg-emerald-50 text-emerald-700' :
                    status === 'at'    ? 'bg-amber-50 text-amber-700' :
                    status === 'below' ? 'bg-red-50 text-red-700' :
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { clients } = useClients()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'content' | 'competitors' | 'intelligence' | 'benchmarks'>('content')

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) setSelectedClientId(clients[0].id)
  }, [clients, selectedClientId])

  const client = clients.find(c => c.id === selectedClientId)

  const TABS = [
    { id: 'content'      as const, label: 'Content',     icon: BarChart2 },
    { id: 'competitors'  as const, label: 'Competitors', icon: Users },
    { id: 'intelligence' as const, label: 'AI Patterns', icon: Zap },
    { id: 'benchmarks'   as const, label: 'Benchmarks',  icon: Activity },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Content analytics, competitor tracking, and AI-powered pattern analysis</p>
        </div>
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
        >
          <option value="" disabled>Select client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedClientId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <TrendingUp className="w-8 h-8 mb-2"/>
          <p className="text-sm">Select a client to view performance data</p>
        </div>
      )}

      {selectedClientId && client && (
        <>
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

          {activeTab === 'content'      && <ContentPerformanceTab clientId={selectedClientId} client={client}/>}
          {activeTab === 'competitors'  && <CompetitorTab clientId={selectedClientId}/>}
          {activeTab === 'intelligence' && <PatternIntelTab clientId={selectedClientId}/>}
          {activeTab === 'benchmarks'   && <BenchmarksTab clientId={selectedClientId} client={client}/>}
        </>
      )}
    </div>
  )
}
