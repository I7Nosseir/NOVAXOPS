'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { PlatformIcon } from '@/components/ui/platform-icon'
import type { SocialPlatform } from '@/lib/types'
import {
  TrendingUp, RefreshCw, Zap, Plus, Trash2, BarChart2,
  Users, Clock, ChevronRight, AlertTriangle, Activity,
} from 'lucide-react'

const B = {
  primary: '#1B3D38',
  accent:  '#5BB4AE',
  muted:   '#2A6B62',
  light:   '#EBF4F3',
  border:  '#9DCCC8',
}

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

// ─── Performance tier coloring ──────────────────────────────────────────────
function erTierClass(er: number, posts: PerformancePost[]) {
  if (posts.length < 5) return 'border-slate-200'
  const sorted = [...posts].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top20 = sorted[Math.floor(sorted.length * 0.2)]?.engagement_rate ?? 0
  const bot20 = sorted[Math.floor(sorted.length * 0.8)]?.engagement_rate ?? 0
  if (er >= top20) return 'border-emerald-400 bg-emerald-50/30'
  if (er <= bot20) return 'border-red-300 bg-red-50/20'
  return 'border-slate-200'
}

type MetricoolAggregate = {
  reach: number; impressions: number; engagement_rate: number
  likes: number; comments: number; shares: number; saves: number
  _mock?: boolean
}

// ─── Tab 1: Content Performance ──────────────────────────────────────────────
function ContentPerformanceTab({ clientId }: { clientId: string }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PerformancePost[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dateRange, setDateRange] = useState('30d')
  const [selected, setSelected] = useState<PerformancePost | null>(null)
  const [liveStats, setLiveStats] = useState<MetricoolAggregate | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; _mock?: boolean } | null>(null)

  const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30

  const fetchLiveStats = async () => {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    try {
      const res = await fetch(`/api/metricool/analytics?client_id=${clientId}&startDate=${start}&endDate=${end}`)
      if (!res.ok) return
      const data = await res.json() as { stats?: MetricoolAggregate; _mock?: boolean }
      if (data.stats) setLiveStats({ ...data.stats, _mock: data._mock })
    } catch { /* silent — posts fallback is shown instead */ }
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
      const data = await res.json() as { synced?: number; _mock?: boolean }
      setSyncResult({ synced: data.synced ?? 0, _mock: data._mock })
    } catch { /* ignore */ }
    await Promise.all([fetchPosts(), fetchLiveStats()])
    setSyncing(false)
  }

  useEffect(() => {
    void fetchPosts()
    void fetchLiveStats()
  }, [clientId, dateRange])

  // Prefer live Metricool aggregate; fall back to computing from posts array
  const totalReach      = liveStats?.reach      ?? posts.reduce((s, p) => s + p.reach, 0)
  const totalImpressions = liveStats?.impressions ?? posts.reduce((s, p) => s + p.impressions, 0)
  const avgERNum = liveStats?.engagement_rate
    ?? (posts.length ? posts.reduce((s, p) => s + p.engagement_rate, 0) / posts.length : 0)
  const avgER = avgERNum ? avgERNum.toFixed(2) : '—'
  const topPost = posts[0]
  const isLive = liveStats && !liveStats._mock

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)} className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              dateRange === r ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
            )} style={dateRange === r ? { background: B.primary } : {}}>Last {r}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {syncResult && !syncResult._mock && (
            <span className="text-[11px] text-emerald-600 font-medium">{syncResult.synced} posts synced</span>
          )}
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors bg-white">
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
            {syncing ? 'Syncing…' : `Sync ${vendorName(user?.role, 'Metricool')}`}
          </button>
        </div>
      </div>

      {/* Summary KPIs — sourced from Metricool analytics endpoint */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Reach',      value: formatNumber(totalReach),      sub: liveStats ? formatNumber(totalImpressions) + ' impr.' : null },
          { label: 'Avg ER',           value: `${avgER}%`,                   sub: null },
          { label: 'Posts Analyzed',   value: posts.length.toString(),       sub: null },
          { label: 'Top ER',           value: topPost ? `${topPost.engagement_rate}%` : '—', sub: null },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <p className="text-xl font-bold text-slate-900">{value}</p>
              {label === 'Total Reach' && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  isLive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
                  {isLive ? 'LIVE' : 'EST'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300"/>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <BarChart2 className="w-8 h-8 mb-2"/>
          <p className="text-sm font-medium text-slate-600">No performance data yet</p>
          <p className="text-xs mt-1">Sync with {vendorName(user?.role, 'Metricool')} to pull post stats, or wait for the daily cron.</p>
          <button onClick={syncNow} disabled={syncing} className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm text-white font-medium rounded-lg transition-colors" style={{ background: B.primary }}>
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/> Sync Now
          </button>
        </div>
      )}

      {/* Post grid */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map(post => (
            <div
              key={`${post.id}-${post.platform}`}
              onClick={() => setSelected(selected?.id === post.id ? null : post)}
              className={cn('bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md', erTierClass(post.engagement_rate, posts))}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-xs text-slate-700 line-clamp-2 flex-1">{post.caption || '—'}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <PlatformIcon platform={post.platform as SocialPlatform} size="xs"/>
                  {post.engagement_rate >= (posts[Math.floor(posts.length * 0.2)]?.engagement_rate ?? 0) && posts.length >= 5 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: B.accent }}>Viral</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'ER', value: `${post.engagement_rate}%` },
                  { label: 'Reach', value: formatNumber(post.reach) },
                  { label: 'Likes', value: formatNumber(post.likes) },
                  { label: 'Saves', value: formatNumber(post.saves) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-bold text-slate-900">{value}</p>
                    <p className="text-[10px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {selected?.id === post.id && (
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

// ─── Tab 2: Competitor Insights ──────────────────────────────────────────────
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
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 90 * 86400000).toISOString()
    const res = await fetch(`/api/performance/posts?client_id=${clientId}&start=${start}&end=${end}`)
    const data = await res.json() as { posts?: PerformancePost[] }
    const posts = data.posts ?? []
    if (posts.length > 0) {
      setClientAvgER(posts.reduce((s, p) => s + p.engagement_rate, 0) / posts.length)
    }
  }

  useEffect(() => {
    if (clientId) {
      void fetchCompetitors()
      void fetchClientAvgER()
    }
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
    { name: 'This Client', er: clientAvgER, fill: B.primary },
    ...competitors.map(c => ({ name: c.competitor_handle, er: c.avg_er, fill: '#94a3b8' })),
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-medium rounded-lg transition-colors"
          style={{ background: B.primary }}
        >
          <Plus className="w-3.5 h-3.5"/> Add Competitor
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Add Competitor</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Handle</label>
              <input value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="@competitor" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Platform</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-novax-border">
                {['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Followers</label>
              <input value={form.followers} onChange={e => setForm(f => ({ ...f, followers: e.target.value }))} placeholder="e.g. 42000" type="number" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Avg ER %</label>
              <input value={form.avg_er} onChange={e => setForm(f => ({ ...f, avg_er: e.target.value }))} placeholder="e.g. 3.8" type="number" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Posts/week</label>
              <input value={form.posting_frequency} onChange={e => setForm(f => ({ ...f, posting_frequency: e.target.value }))} placeholder="e.g. 5" type="number" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-border"/>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.handle.trim()} className="px-4 py-2 text-xs text-white font-medium rounded-lg disabled:opacity-50 transition-colors" style={{ background: B.primary }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {competitors.length > 0 && clientAvgER > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Engagement Rate Comparison</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip formatter={(v) => [`${v}%`, 'Avg ER']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
              <Bar dataKey="er" radius={[4,4,0,0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
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
                <span className="text-xs text-slate-400 capitalize">{c.platform}</span>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
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
              <div className={cn('mt-3 p-2 rounded-lg text-xs font-medium text-center',
                clientAvgER >= c.avg_er ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                {clientAvgER >= c.avg_er
                  ? `Outperforming by ${(clientAvgER - c.avg_er).toFixed(1)}pp ER`
                  : `Gap: ${(c.avg_er - clientAvgER).toFixed(1)}pp behind on ER`}
              </div>
            )}
            {c.notes && <p className="mt-2 text-xs text-slate-400 italic">{c.notes}</p>}
          </div>
        ))}
        {competitors.length === 0 && !adding && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Users className="w-7 h-7 mb-2"/>
            <p className="text-sm text-slate-600 font-medium">No competitors tracked yet</p>
            <p className="text-xs mt-1">Add competitors to compare ER and identify performance gaps.</p>
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

  const fetchIntel = async () => {
    const res = await fetch(`/api/performance/intelligence?client_id=${clientId}`)
    const data = await res.json() as { intel?: PerformanceIntel; analyzed_at?: string }
    setIntel(data.intel ?? null)
    setAnalyzedAt(data.analyzed_at ?? null)
  }

  const fetchBestTimes = async () => {
    const res = await fetch(`/api/performance/best-times?client_id=${clientId}`)
    const data = await res.json() as { heatmap?: BestTimeEntry[] }
    setBestTimes((data.heatmap ?? []).slice(0, 5))
  }

  useEffect(() => {
    if (clientId) {
      void fetchIntel()
      void fetchBestTimes()
    }
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
    ? [
        ...Object.entries(intel.content_mix_recommendation.recommended).map(([name, value]) => ({ name, value, fill: B.primary })),
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {analyzedAt ? `Last analyzed: ${new Date(analyzedAt).toLocaleDateString()}` : 'Not yet analyzed'}
        </p>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
          style={{ background: B.primary }}
        >
          {analyzing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
          {analyzing ? 'Analyzing…' : intel ? 'Re-analyze' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0"/>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {!intel && !analyzing && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <TrendingUp className="w-8 h-8 mb-2"/>
          <p className="text-sm font-medium text-slate-600">No analysis yet</p>
          <p className="text-xs mt-1">Run an analysis to surface viral patterns, content mix recommendations, and next content briefs.</p>
        </div>
      )}

      {intel && <>
        {/* One-line summary */}
        {intel.one_line_summary && (
          <div className="p-4 rounded-xl border border-novax-border" style={{ background: B.light }}>
            <p className="text-sm font-medium text-slate-700">{intel.one_line_summary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* What's working */}
          {intel.viral_patterns && intel.viral_patterns.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">What&apos;s Working</p>
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

          {/* What's not working */}
          {intel.failure_patterns && intel.failure_patterns.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3">What&apos;s Not Working</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Content mix recommendation */}
          {mixData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recommended Content Mix</p>
              {intel.content_mix_recommendation?.rationale && (
                <p className="text-xs text-slate-500 mb-4">{intel.content_mix_recommendation.rationale}</p>
              )}
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={mixData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {mixData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? B.primary : i === 1 ? B.accent : i === 2 ? B.muted : '#94a3b8'}/>
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Best times to post */}
          {bestTimes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Best Times to Post (by ER)</p>
              <div className="space-y-2">
                {bestTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                    <span className="text-xs font-semibold text-slate-700 w-20">{t.day} {t.hour}:00</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.avg_er / (bestTimes[0]?.avg_er || 1)) * 100)}%`, background: B.accent }}/>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{t.avg_er}% ER</span>
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
                <div key={platform} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
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

        {/* Next 5 recommendations */}
        {intel.next_recommendations && intel.next_recommendations.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Next 5 Content Briefs</p>
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
                  <p className="text-xs text-slate-600 mb-2">{rec.caption_angle}</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-[10px] text-slate-400">
                      <span><Clock className="w-3 h-3 inline mr-1"/>{rec.timing}</span>
                      <span><TrendingUp className="w-3 h-3 inline mr-1"/>Expected ER: {rec.expected_er}</span>
                    </div>
                    <Link
                      href={`/studio/content?platform=${encodeURIComponent(rec.platform)}&brief=${encodeURIComponent(rec.caption_angle)}&client=${clientId}`}
                      className="flex items-center gap-1 px-2.5 py-1 bg-novax hover:bg-novax-hover text-white text-[10px] font-semibold rounded-lg transition-colors shrink-0"
                    >
                      <Zap className="w-3 h-3"/>
                      Create This
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  )
}

// ─── Tab 4: Benchmarks ──────────────────────────────────────────────────────
const INDUSTRY_BENCHMARKS = [
  { platform: 'instagram',  avg_er: 3.5, label: 'Instagram',  benchmark_er: 1.5 },
  { platform: 'tiktok',     avg_er: 0,   label: 'TikTok',     benchmark_er: 5.0 },
  { platform: 'facebook',   avg_er: 0,   label: 'Facebook',   benchmark_er: 0.6 },
  { platform: 'linkedin',   avg_er: 0,   label: 'LinkedIn',   benchmark_er: 2.0 },
  { platform: 'twitter',    avg_er: 0,   label: 'X (Twitter)',benchmark_er: 0.5 },
  { platform: 'youtube',    avg_er: 0,   label: 'YouTube',    benchmark_er: 4.0 },
]

function BenchmarksTab({ clientId }: { clientId: string }) {
  const [posts, setPosts] = useState<PerformancePost[]>([])

  useEffect(() => {
    if (!clientId) return
    fetch(`/api/performance/posts?client_id=${clientId}`)
      .then(r => r.json() as Promise<{ posts?: PerformancePost[] }>)
      .then(data => setPosts(data.posts ?? []))
      .catch(() => {})
  }, [clientId])

  const platformER: Record<string, number> = {}
  for (const plat of [...new Set(posts.map(p => p.platform))]) {
    const items = posts.filter(p => p.platform === plat)
    if (items.length) platformER[plat] = items.reduce((s, p) => s + p.engagement_rate, 0) / items.length
  }

  const chartData = INDUSTRY_BENCHMARKS.map(b => ({
    platform: b.label,
    client: parseFloat((platformER[b.platform] ?? 0).toFixed(2)),
    benchmark: b.benchmark_er,
  }))

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Client ER vs Industry Benchmark</p>
        <p className="text-xs text-slate-400 mb-4">Benchmarks from 2025–2026 industry averages (Social Insider, Hootsuite)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
            <Tooltip formatter={(v, n) => [`${v}%`, n === 'client' ? 'Client' : 'Industry Avg']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
            <Legend wrapperStyle={{ fontSize: 11 }}/>
            <Bar dataKey="client" name="Client ER" fill={B.primary} radius={[3,3,0,0]}/>
            <Bar dataKey="benchmark" name="Industry Avg" fill={B.accent} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INDUSTRY_BENCHMARKS.map(b => {
          const clientER = platformER[b.platform] ?? null
          const status = clientER == null ? 'no-data' : clientER >= b.benchmark_er * 1.15 ? 'above' : clientER >= b.benchmark_er * 0.85 ? 'at' : 'below'
          return (
            <div key={b.platform} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={b.platform as SocialPlatform} size="sm"/>
                  <span className="text-sm font-semibold text-slate-700">{b.label}</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                  status === 'above' ? 'bg-emerald-50 text-emerald-700' :
                  status === 'at'    ? 'bg-amber-50 text-amber-700' :
                  status === 'below' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {status === 'above' ? 'Above' : status === 'at' ? 'On Track' : status === 'below' ? 'Below' : 'No Data'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div><p className="font-bold text-slate-900">{clientER != null ? `${clientER.toFixed(1)}%` : '—'}</p><p className="text-slate-400">Client ER</p></div>
                <div><p className="font-bold text-slate-500">{b.benchmark_er}%</p><p className="text-slate-400">Industry avg</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { clients } = useClients()
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'content' | 'competitors' | 'intelligence' | 'benchmarks'>('content')

  // Auto-select first client
  useEffect(() => {
    if (!selectedClient && clients.length > 0) setSelectedClient(clients[0].id)
  }, [clients])

  const client = clients.find(c => c.id === selectedClient)

  const TABS = [
    { id: 'content'       as const, label: 'Content Performance' },
    { id: 'competitors'   as const, label: 'Competitor Insights' },
    { id: 'intelligence'  as const, label: 'Pattern Intelligence' },
    { id: 'benchmarks'    as const, label: 'Benchmarks' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Content analytics, competitor tracking, and AI-powered pattern analysis</p>
        </div>
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
        >
          <option value="" disabled>Select client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedClient && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <TrendingUp className="w-8 h-8 mb-2"/>
          <p className="text-sm">Select a client to view performance data</p>
        </div>
      )}

      {selectedClient && <>
        {/* Tab navigation */}
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              )}
              style={activeTab === tab.id ? { background: B.primary } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'content' && <ContentPerformanceTab clientId={selectedClient}/>}
        {activeTab === 'competitors' && <CompetitorTab clientId={selectedClient}/>}
        {activeTab === 'intelligence' && <PatternIntelTab clientId={selectedClient}/>}
        {activeTab === 'benchmarks' && <BenchmarksTab clientId={selectedClient}/>}
      </>}
    </div>
  )
}
