'use client'

import { useState, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  FileText, TrendingUp, Eye,
  BarChart2, Globe, ArrowUpRight, ArrowDownRight,
  AlertCircle, ChevronRight, X, DollarSign, Activity,
  Calendar, Star, RefreshCw, Sparkles, Printer, Info,
} from 'lucide-react'

// ─── Brand palette ─────────────────────────────────────────────────────────────
const B = {
  primary: '#1B3D38',
  muted:   '#2A6B62',
  accent:  '#5BB4AE',
  border:  '#9DCCC8',
  light:   '#EBF4F3',
}

// ─── Tab definition ────────────────────────────────────────────────────────────
type ReportTab = 'monthly' | 'paid' | 'combined' | 'platform' | 'quarterly' | 'executive' | 'ai'
type IconProps = { className?: string }

const TABS: { id: ReportTab; label: string; icon: (p: IconProps) => React.ReactElement; description: string }[] = [
  { id: 'monthly',    label: 'Monthly Performance',  icon: (p) => <BarChart2  {...p}/>, description: 'Organic reach, impressions, engagement rate trend, and platform breakdown.' },
  { id: 'paid',       label: 'Paid Ads',             icon: (p) => <DollarSign {...p}/>, description: 'Organic performance metrics — reach, engagement, and channel breakdown.' },
  { id: 'combined',   label: 'Paid + Organic',       icon: (p) => <Activity   {...p}/>, description: 'Organic trend and platform mix across all active channels.' },
  { id: 'platform',   label: 'Platform Deep Dive',   icon: (p) => <Globe      {...p}/>, description: 'Per-platform breakdown — reach, ER, and posts across all active channels.' },
  { id: 'quarterly',  label: 'Quarterly Report',     icon: (p) => <Calendar   {...p}/>, description: 'Quarter performance — reach trend and engagement rate trajectory.' },
  { id: 'executive',  label: 'Executive Summary',    icon: (p) => <Star       {...p}/>, description: 'CEO-ready: top KPIs, trend, and platform breakdown.' },
  { id: 'ai',         label: 'AI Report Builder',    icon: (p) => <Sparkles   {...p}/>, description: 'Upload analytics screenshots or paste data — AI extracts and formats a branded report.' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function deltaStr(cur: number | null | undefined, prv: number | null | undefined): string {
  if (cur == null || prv == null || prv === 0) return '—'
  const pct = ((cur - prv) / prv * 100).toFixed(1)
  return `${Number(pct) >= 0 ? '+' : ''}${pct}%`
}
function deltaPos(cur: number | null | undefined, prv: number | null | undefined): boolean | null {
  if (cur == null || prv == null || prv === 0) return null
  return cur >= prv
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', facebook: '#1877F2', linkedin: '#0A66C2',
  tiktok: '#2A2A2A', twitter: '#1DA1F2', youtube: '#FF0000',
}

// ─── Shared UI components ───────────────────────────────────────────────────────

function DeltaBadge({ delta, positive }: { delta: string; positive: boolean | null }) {
  if (delta === '—' || positive === null) {
    return <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{delta}</span>
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50',
    )}>
      {positive ? <ArrowUpRight className="w-2.5 h-2.5"/> : <ArrowDownRight className="w-2.5 h-2.5"/>}
      {delta}
    </span>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-7 rounded-full shrink-0" style={{ background: B.primary }}/>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function ReportHeader({ title, subtitle, client, period }: { title: string; subtitle: string; client: string; period: string }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-1" style={{ background: B.primary }}>
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
              <path d="M8,62 L8,10 L16,10 L48,54 L48,10 L56,10 L56,62 L48,62 L16,18 L16,62 Z" fill="white"/>
              <path fillRule="evenodd" d="M82,10 A26,26 0 0 1 82,62 A26,26 0 0 1 82,10 Z M82,22 A14,14 0 0 1 82,50 A14,14 0 0 1 82,22 Z" fill="white"/>
              <line x1="60" y1="68" x2="104" y2="4" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M114,10 L124,10 L151,58 L178,10 L188,10 L151,64 L141,64 Z" fill="white"/>
              <path fillRule="evenodd" d="M194,62 L218,10 L228,10 L252,62 L243,62 L237,50 L209,50 L203,62 Z M215,42 L223,18 L235,42 Z" fill="white"/>
              <text x="250" y="18" fill="white" fontSize="9" fontFamily="system-ui,Arial,sans-serif">™</text>
            </svg>
          </div>
          <div className="w-px h-10 bg-white/20"/>
          <div>
            <p className="text-white font-bold text-lg leading-tight">{title}</p>
            <p className="text-xs mt-0.5" style={{ color: B.border }}>{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-semibold text-sm">{client}</p>
          <div className="flex items-center gap-1.5 justify-end mt-1">
            <Calendar className="w-3 h-3" style={{ color: B.accent }}/>
            <p className="text-xs" style={{ color: B.border }}>{period}</p>
          </div>
        </div>
      </div>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
    </div>
  )
}

function CoverPage({ title, subtitle, client, period, tag }: { title: string; subtitle: string; client: string; period: string; tag: string }) {
  return (
    <div className="report-cover-page rounded-2xl overflow-hidden flex flex-col" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
      <div className="px-12 pt-12 flex items-center gap-4">
        <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-auto">
          <path d="M8,62 L8,10 L16,10 L48,54 L48,10 L56,10 L56,62 L48,62 L16,18 L16,62 Z" fill="white"/>
          <path fillRule="evenodd" d="M82,10 A26,26 0 0 1 82,62 A26,26 0 0 1 82,10 Z M82,22 A14,14 0 0 1 82,50 A14,14 0 0 1 82,22 Z" fill="white"/>
          <line x1="60" y1="68" x2="104" y2="4" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M114,10 L124,10 L151,58 L178,10 L188,10 L151,64 L141,64 Z" fill="white"/>
          <path fillRule="evenodd" d="M194,62 L218,10 L228,10 L252,62 L243,62 L237,50 L209,50 L203,62 Z M215,42 L223,18 L235,42 Z" fill="white"/>
          <text x="250" y="18" fill="white" fontSize="9" fontFamily="system-ui,Arial,sans-serif">™</text>
        </svg>
      </div>
      <div className="flex-1 flex flex-col justify-center px-12 py-20">
        <div className="w-16 h-0.5 rounded-full mb-8" style={{ background: B.accent }}/>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: B.border }}>{tag}</p>
        <h1 className="text-5xl font-bold text-white leading-tight mb-6">{title}</h1>
        <p className="text-lg leading-relaxed" style={{ color: B.border }}>{subtitle}</p>
      </div>
      <div className="px-12 pb-10 flex items-end justify-between">
        <div>
          <p className="font-bold text-white text-lg">{client}</p>
          <p className="text-sm mt-0.5" style={{ color: B.border }}>{period}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-60" style={{ color: B.border }}>Prepared by NOVAX Ops</p>
        </div>
      </div>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.light}, ${B.border}, ${B.accent})` }}/>
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function Paragraph({ children }: { children: string }) {
  return <p className="text-sm text-slate-600 leading-7">{renderInline(children)}</p>
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
      <p className="text-xs text-amber-800 leading-relaxed">{children}</p>
    </div>
  )
}

function KPICard({ icon: Icon, label, value, delta, positive }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  delta: string
  positive: boolean | null
}) {
  return (
    <div className="rounded-2xl border border-novax-border p-5" style={{ background: B.light }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg" style={{ background: 'rgba(27,61,56,0.12)' }}>
          <Icon className="w-4 h-4" style={{ color: B.primary }}/>
        </div>
        <span className="text-xs font-semibold" style={{ color: B.muted }}>{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      {delta !== '—' && <DeltaBadge delta={`${delta} vs prior period`} positive={positive}/>}
    </div>
  )
}

// ─── Monthly Report ─────────────────────────────────────────────────────────────

function MonthlyReport({ client, period, liveStats, prevStats, livePlatforms, liveTrend, aiReport }: {
  client: string
  period: string
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  livePlatforms?: LivePlatform[] | null
  liveTrend?: LiveTrendPoint[] | null
  aiReport?: AIReport | null
}) {
  const { user } = useAuth()
  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0)
    .map(p => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      reach: p.reach, posts: p.posts, er: p.engagement_rate,
      color: PLATFORM_COLORS[p.platform] ?? '#94a3b8',
    }))
  const trendData = liveTrend ?? []
  const maxReach = Math.max(...platformData.map(p => p.reach), 1)
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title="Monthly Performance Report"
        subtitle="Organic social media performance across all active platforms — reach, engagement, and trend analysis"
        client={client} period={period} tag="Organic Social — Monthly"
      />
      <ReportHeader title="Monthly Performance Report" subtitle="Organic social media performance across all platforms" client={client} period={period}/>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard icon={Eye}       label="Total Reach"          value={liveStats?.reach != null ? formatNumber(liveStats.reach) : '—'}                                        delta={deltaStr(liveStats?.reach, prevStats?.reach)}               positive={deltaPos(liveStats?.reach, prevStats?.reach)}/>
        <KPICard icon={TrendingUp} label="Avg Engagement Rate" value={liveStats?.engagement_rate != null ? `${Number(liveStats.engagement_rate).toFixed(1)}%` : '—'}        delta={deltaStr(liveStats?.engagement_rate, prevStats?.engagement_rate)} positive={deltaPos(liveStats?.engagement_rate, prevStats?.engagement_rate)}/>
        <KPICard icon={BarChart2}  label="Total Impressions"   value={liveStats?.impressions != null ? formatNumber(liveStats.impressions) : '—'}                           delta={deltaStr(liveStats?.impressions, prevStats?.impressions)}    positive={deltaPos(liveStats?.impressions, prevStats?.impressions)}/>
      </div>

      {liveStats && ((liveStats.likes ?? 0) > 0 || (liveStats.comments ?? 0) > 0 || (liveStats.saves ?? 0) > 0 || (liveStats.shares ?? 0) > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: 'Likes',    key: 'likes' },
            { label: 'Comments', key: 'comments' },
            { label: 'Saves',    key: 'saves' },
            { label: 'Shares',   key: 'shares' },
          ] as const).filter(m => (liveStats[m.key] ?? 0) > 0).map(m => (
            <div key={m.key} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.label}</p>
              <p className="text-xl font-bold text-slate-900">{formatNumber(liveStats[m.key] ?? 0)}</p>
              {prevStats && (prevStats[m.key] ?? 0) > 0 && (
                <DeltaBadge delta={deltaStr(liveStats[m.key], prevStats[m.key])} positive={deltaPos(liveStats[m.key], prevStats[m.key])}/>
              )}
            </div>
          ))}
        </div>
      )}

      {trendData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <SectionHeader title="Reach & Impressions Trend" subtitle={`5-month data — ${vendorName(user?.role, 'Metricool')}`}/>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
                <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n === 'reach' ? 'Reach' : 'Impressions']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                <Bar dataKey="impressions" fill={B.light} stroke={B.border} radius={[3, 3, 0, 0]} name="Impressions"/>
                <Line type="monotone" dataKey="reach" stroke={B.primary} strokeWidth={2.5} dot={{ fill: B.primary, r: 3 }} name="Reach"/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <SectionHeader title="Engagement Rate Trend" subtitle="Monthly average"/>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="erGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={B.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={B.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip formatter={v => [`${v}%`, 'Eng. Rate']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                <ReferenceLine y={4} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: 'Benchmark 4%', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}/>
                <Area type="monotone" dataKey="er" stroke={B.accent} strokeWidth={2.5} fill="url(#erGrad)" dot={{ fill: B.accent, r: 3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {platformData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Platform Performance" subtitle={`Reach, posts, and engagement rate — ${vendorName(user?.role, 'Metricool')}`}/>
          <div className="space-y-4">
            {platformData.map(p => (
              <div key={p.name} className="grid items-center gap-4" style={{ gridTemplateColumns: '120px 1fr 280px' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }}/>
                  <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                </div>
                <div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(p.reach / maxReach) * 100}%`, background: p.color }}/>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs">
                  <div className="text-right w-20"><span className="font-bold text-slate-800">{formatNumber(p.reach)}</span><span className="text-slate-400 ml-1">reach</span></div>
                  <div className="text-right w-14"><span className="font-bold text-slate-800">{p.posts}</span><span className="text-slate-400 ml-1">posts</span></div>
                  <div className="text-right w-16"><span className="font-bold text-slate-800">{Number(p.er).toFixed(1)}%</span><span className="text-slate-400 ml-1">ER</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Monthly Summary" subtitle="Data breakdown for the selected month"/>
          <div className="space-y-4">
            {aiReport.narrative.executive    && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.reach        && <><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Reach &amp; Impressions</p><Paragraph>{aiReport.narrative.reach}</Paragraph></>}
            {aiReport.narrative.engagement   && <><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Engagement</p><Paragraph>{aiReport.narrative.engagement}</Paragraph></>}
            {aiReport.narrative.platform     && <><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Platform Performance</p><Paragraph>{aiReport.narrative.platform}</Paragraph></>}
            {aiReport.narrative.trend        && <><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Trend</p><Paragraph>{aiReport.narrative.trend}</Paragraph></>}
            {aiReport.narrative.audience     && <><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-1">Audience Engagement</p><Paragraph>{aiReport.narrative.audience}</Paragraph></>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Paid Ads Report ────────────────────────────────────────────────────────────

function PaidReport({ client, period, liveStats, prevStats, livePlatforms, aiReport }: {
  client: string
  period: string
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  livePlatforms?: LivePlatform[] | null
  aiReport?: AIReport | null
}) {
  const { user } = useAuth()
  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0)
    .map(p => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      reach: p.reach, posts: p.posts, er: p.engagement_rate,
      color: PLATFORM_COLORS[p.platform] ?? '#94a3b8',
    }))
  const maxReach = Math.max(...platformData.map(p => p.reach), 1)
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title="Paid Media Performance Report"
        subtitle="Organic reach, engagement, and channel performance"
        client={client} period={period} tag="Paid Media — Monthly"
      />
      <ReportHeader title="Paid Media Performance Report" subtitle="Organic reach and engagement performance" client={client} period={period}/>

      <InfoBanner>
        Paid campaign data (ROAS, CPC, CPA, spend) is sourced directly from ad platforms — Meta Ads Manager, TikTok Ads Manager, LinkedIn Campaign Manager — and is not available via {vendorName(user?.role, 'Metricool')}. The metrics below reflect organic reach and engagement performance.
      </InfoBanner>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard icon={Eye}       label="Organic Reach"        value={liveStats?.reach != null ? formatNumber(liveStats.reach) : '—'}                                      delta={deltaStr(liveStats?.reach, prevStats?.reach)}               positive={deltaPos(liveStats?.reach, prevStats?.reach)}/>
        <KPICard icon={TrendingUp} label="Avg Engagement Rate" value={liveStats?.engagement_rate != null ? `${Number(liveStats.engagement_rate).toFixed(1)}%` : '—'}      delta={deltaStr(liveStats?.engagement_rate, prevStats?.engagement_rate)} positive={deltaPos(liveStats?.engagement_rate, prevStats?.engagement_rate)}/>
        <KPICard icon={BarChart2}  label="Total Impressions"   value={liveStats?.impressions != null ? formatNumber(liveStats.impressions) : '—'}                         delta={deltaStr(liveStats?.impressions, prevStats?.impressions)}    positive={deltaPos(liveStats?.impressions, prevStats?.impressions)}/>
      </div>

      {platformData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Organic Platform Performance" subtitle="Channel-level performance breakdown"/>
          <div className="space-y-4">
            {platformData.map(p => (
              <div key={p.name} className="grid items-center gap-4" style={{ gridTemplateColumns: '120px 1fr 280px' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }}/>
                  <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                </div>
                <div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(p.reach / maxReach) * 100}%`, background: p.color }}/>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs">
                  <div className="text-right w-20"><span className="font-bold text-slate-800">{formatNumber(p.reach)}</span><span className="text-slate-400 ml-1">reach</span></div>
                  <div className="text-right w-14"><span className="font-bold text-slate-800">{p.posts}</span><span className="text-slate-400 ml-1">posts</span></div>
                  <div className="text-right w-16"><span className="font-bold text-slate-800">{Number(p.er).toFixed(1)}%</span><span className="text-slate-400 ml-1">ER</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Channel Overview" subtitle="Organic performance data for the period"/>
          <div className="space-y-4">
            {aiReport.narrative.executive && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.reach     && <Paragraph>{aiReport.narrative.reach}</Paragraph>}
            {aiReport.narrative.engagement && <Paragraph>{aiReport.narrative.engagement}</Paragraph>}
            {aiReport.narrative.platform  && <Paragraph>{aiReport.narrative.platform}</Paragraph>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Combined Report ────────────────────────────────────────────────────────────

function CombinedReport({ client, period, liveStats, prevStats, livePlatforms, liveTrend, aiReport }: {
  client: string
  period: string
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  livePlatforms?: LivePlatform[] | null
  liveTrend?: LiveTrendPoint[] | null
  aiReport?: AIReport | null
}) {
  const { user } = useAuth()
  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0)
    .map(p => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      reach: p.reach, posts: p.posts, er: p.engagement_rate,
      color: PLATFORM_COLORS[p.platform] ?? '#94a3b8',
    }))
  const trendData = liveTrend ?? []
  const totalReach = liveStats?.reach ?? 0
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title="Paid + Organic Combined Report"
        subtitle="Organic channel performance across all active platforms"
        client={client} period={period} tag="Paid + Organic — Monthly"
      />
      <ReportHeader title="Paid + Organic Combined Report" subtitle="Organic performance across all active platforms" client={client} period={period}/>

      <InfoBanner>
        Paid campaign metrics (spend, ROAS, CPC, CPA) are sourced directly from ad platforms and are not available via {vendorName(user?.role, 'Metricool')}. Organic performance data from {vendorName(user?.role, 'Metricool')} is shown below.
      </InfoBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Organic Reach',   value: totalReach > 0 ? formatNumber(totalReach) : '—',                                                    delta: deltaStr(liveStats?.reach, prevStats?.reach),               positive: deltaPos(liveStats?.reach, prevStats?.reach),               icon: Eye },
          { label: 'Engagement Rate', value: liveStats?.engagement_rate != null ? `${Number(liveStats.engagement_rate).toFixed(1)}%` : '—',      delta: deltaStr(liveStats?.engagement_rate, prevStats?.engagement_rate), positive: deltaPos(liveStats?.engagement_rate, prevStats?.engagement_rate), icon: TrendingUp },
          { label: 'Total Impressions', value: liveStats?.impressions != null ? formatNumber(liveStats.impressions) : '—',                       delta: deltaStr(liveStats?.impressions, prevStats?.impressions),    positive: deltaPos(liveStats?.impressions, prevStats?.impressions),    icon: BarChart2 },
          { label: 'Posts Published', value: liveStats?.posts != null ? String(Math.round(liveStats.posts)) : '—',                              delta: deltaStr(liveStats?.posts, prevStats?.posts),               positive: deltaPos(liveStats?.posts, prevStats?.posts),               icon: Activity },
        ].map(({ label, value, delta, positive, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: B.light }}>
              <Icon className="w-4 h-4" style={{ color: B.primary }}/>
            </div>
            <p className="text-lg font-bold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-1">{label}</p>
            {delta !== '—' && <DeltaBadge delta={`${delta} vs prior period`} positive={positive}/>}
          </div>
        ))}
      </div>

      {trendData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Organic Reach Trend" subtitle={`5-month trajectory — ${vendorName(user?.role, 'Metricool')}`}/>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="orgGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.accent} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={B.accent} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
              <Tooltip formatter={v => [formatNumber(Number(v)), 'Organic Reach']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Area type="monotone" dataKey="reach" stroke={B.accent} strokeWidth={2} fill="url(#orgGrad2)" name="Organic Reach"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {platformData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Organic Channel Mix" subtitle="Platform-level contribution to total organic reach"/>
          <div className="space-y-3">
            {platformData.map(p => {
              const pct = totalReach > 0 ? Math.round((p.reach / totalReach) * 100) : 0
              return (
                <div key={p.name} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }}/>
                    <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }}/>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="font-bold text-slate-800 w-16 text-right">{formatNumber(p.reach)}</span>
                    <span className="text-slate-500 w-10 text-right">{pct}%</span>
                    <span className="font-semibold text-slate-700 w-12 text-right">{Number(p.er).toFixed(1)}% ER</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Cross-Channel Overview" subtitle="Organic performance across all platforms"/>
          <div className="space-y-4">
            {aiReport.narrative.executive && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.reach     && <Paragraph>{aiReport.narrative.reach}</Paragraph>}
            {aiReport.narrative.synergy   && <Paragraph>{aiReport.narrative.synergy}</Paragraph>}
            {aiReport.narrative.channel   && <Paragraph>{aiReport.narrative.channel}</Paragraph>}
            {aiReport.narrative.platform  && <Paragraph>{aiReport.narrative.platform}</Paragraph>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Platform Deep Dive ─────────────────────────────────────────────────────────

function PlatformReport({ client, period, livePlatforms, liveTrend, aiReport }: {
  client: string
  period: string
  livePlatforms?: LivePlatform[] | null
  liveTrend?: LiveTrendPoint[] | null
  aiReport?: AIReport | null
}) {
  const { user } = useAuth()
  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0)
    .sort((a, b) => b.reach - a.reach)
  const trendData = liveTrend ?? []
  const topPlatform = platformData[0]
  const platformLabel = topPlatform
    ? topPlatform.platform.charAt(0).toUpperCase() + topPlatform.platform.slice(1)
    : 'Primary Platform'
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title={`${platformLabel} Deep Dive Report`}
        subtitle="Platform-by-platform reach, engagement rate, posts, saves, and comment data"
        client={client} period={period} tag={`Platform Deep Dive — ${platformLabel}`}
      />
      <ReportHeader title={`${platformLabel} Deep Dive Report`} subtitle="Per-platform reach, engagement, and channel analysis" client={client} period={period}/>

      {platformData.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {platformData.map(p => {
            const color = PLATFORM_COLORS[p.platform] ?? '#94a3b8'
            const name = p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
            return (
              <div key={p.platform} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }}/>
                  <span className="text-sm font-bold text-slate-800">{name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Reach</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{formatNumber(p.reach)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Eng. Rate</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: B.primary }}>{Number(p.engagement_rate).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Impressions</p>
                    <p className="text-base font-semibold text-slate-700 mt-0.5">{formatNumber(p.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Posts</p>
                    <p className="text-base font-semibold text-slate-700 mt-0.5">{p.posts}</p>
                  </div>
                  {p.saves > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Saves</p>
                      <p className="text-base font-semibold text-slate-700 mt-0.5">{formatNumber(p.saves)}</p>
                    </div>
                  )}
                  {p.comments > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Comments</p>
                      <p className="text-base font-semibold text-slate-700 mt-0.5">{formatNumber(p.comments)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">No platform data available — configure {vendorName(user?.role, 'Metricool')} in Settings to enable per-platform analytics.</p>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <SectionHeader title="Reach Trend" subtitle="5-month organic reach trajectory"/>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="platReachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={B.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={B.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
                <Tooltip formatter={v => [formatNumber(Number(v)), 'Reach']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                <Area type="monotone" dataKey="reach" stroke={B.primary} strokeWidth={2.5} fill="url(#platReachGrad)" dot={{ fill: B.primary, r: 3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <SectionHeader title="Engagement Rate Trend" subtitle="Monthly ER trajectory"/>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="platErGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={B.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={B.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip formatter={v => [`${v}%`, 'Eng. Rate']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                <Area type="monotone" dataKey="er" stroke={B.accent} strokeWidth={2.5} fill="url(#platErGrad)" dot={{ fill: B.accent, r: 3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Platform Analysis" subtitle="Performance data by platform"/>
          <div className="space-y-4">
            {aiReport.narrative.executive  && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.follower   && <Paragraph>{aiReport.narrative.follower}</Paragraph>}
            {aiReport.narrative.reach      && <Paragraph>{aiReport.narrative.reach}</Paragraph>}
            {aiReport.narrative.engagement && <Paragraph>{aiReport.narrative.engagement}</Paragraph>}
            {aiReport.narrative.formats    && <Paragraph>{aiReport.narrative.formats}</Paragraph>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quarterly Report ───────────────────────────────────────────────────────────

function QuarterlyReport({ client, period, liveStats, prevStats, liveTrend, aiReport }: {
  client: string
  period: string
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  liveTrend?: LiveTrendPoint[] | null
  aiReport?: AIReport | null
}) {
  const { user } = useAuth()
  const trendData = (liveTrend ?? []).slice(-3).map(t => ({ month: t.month, reach: t.reach, er: t.er }))
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title="Quarterly Performance Report"
        subtitle="Three-month reach and engagement data with a month-by-month performance breakdown"
        client={client} period={period} tag="Quarterly Review"
      />
      <ReportHeader title="Quarterly Performance Report" subtitle="Three-month performance — reach, engagement, and platform data" client={client} period={period}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reach',       key: 'reach',           format: (v: number) => formatNumber(v),                              icon: Eye },
          { label: 'Avg Eng. Rate',     key: 'engagement_rate', format: (v: number) => `${Number(v).toFixed(1)}%`,                   icon: TrendingUp },
          { label: 'Total Impressions', key: 'impressions',     format: (v: number) => formatNumber(v),                              icon: BarChart2 },
          { label: 'Posts Published',   key: 'posts',           format: (v: number) => String(Math.round(v)),                        icon: Activity },
        ].map(({ label, key, format, icon: Icon }) => {
          const val = liveStats?.[key]
          const prv = prevStats?.[key]
          return (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: B.light }}>
                <Icon className="w-4 h-4" style={{ color: B.primary }}/>
              </div>
              <p className="text-xl font-bold text-slate-900">{val != null ? format(val) : '—'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-1">{label}</p>
              {deltaStr(val, prv) !== '—' && <DeltaBadge delta={`${deltaStr(val, prv)} vs prior quarter`} positive={deltaPos(val, prv)}/>}
            </div>
          )
        })}
      </div>

      {trendData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Quarter Trend" subtitle={`Reach and engagement — ${vendorName(user?.role, 'Metricool')}`}/>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trendData as object[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar yAxisId="left" dataKey="reach" fill={B.light} stroke={B.border} radius={[4, 4, 0, 0]} name="Reach"/>
              <Line yAxisId="right" type="monotone" dataKey="er" stroke={B.primary} strokeWidth={2.5} dot={{ fill: B.primary, r: 4 }} name="ER (%)"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Month-by-Month Breakdown" subtitle="Performance data per month in the quarter"/>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: B.light }}>
                  {['Month', 'Reach', 'Impressions', 'Eng. Rate'].map((h, i) => (
                    <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trendData.map((t, i) => (
                  <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                    <td className="p-3 font-semibold text-slate-800">{t.month}</td>
                    <td className="p-3 text-right font-bold text-slate-800">{t.reach > 0 ? formatNumber(t.reach) : '—'}</td>
                    <td className="p-3 text-right text-slate-600">{t.impressions > 0 ? formatNumber(t.impressions) : '—'}</td>
                    <td className="p-3 text-right font-bold" style={{ color: B.primary }}>{t.er > 0 ? `${Number(t.er).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Quarterly Review" subtitle="Three-month performance data"/>
          <div className="space-y-4">
            {aiReport.narrative.executive         && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.quarterly_overview && <Paragraph>{aiReport.narrative.quarterly_overview}</Paragraph>}
            {aiReport.narrative.monthly_breakdown  && <Paragraph>{aiReport.narrative.monthly_breakdown}</Paragraph>}
            {aiReport.narrative.trend              && <Paragraph>{aiReport.narrative.trend}</Paragraph>}
            {aiReport.narrative.platform           && <Paragraph>{aiReport.narrative.platform}</Paragraph>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Executive Summary ──────────────────────────────────────────────────────────

function ExecutiveReport({ client, period, liveStats, prevStats, livePlatforms, liveTrend, aiReport }: {
  client: string
  period: string
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  livePlatforms?: LivePlatform[] | null
  liveTrend?: LiveTrendPoint[] | null
  aiReport?: AIReport | null
}) {
  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0)
    .sort((a, b) => b.reach - a.reach)
  const trendSlice = (liveTrend ?? []).slice(-3)
  const hasNarrative = aiReport && Object.values(aiReport.narrative).some(Boolean)

  return (
    <div className="space-y-5">
      <CoverPage
        title="Executive Summary"
        subtitle="Consolidated key performance indicators — reach, impressions, engagement rate, and platform breakdown"
        client={client} period={period} tag="Executive Summary"
      />
      <ReportHeader title="Executive Summary" subtitle="CEO-ready portfolio overview" client={client} period={period}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reach',       key: 'reach',           format: (v: number) => formatNumber(v) },
          { label: 'Avg Eng. Rate',     key: 'engagement_rate', format: (v: number) => `${Number(v).toFixed(1)}%` },
          { label: 'Total Impressions', key: 'impressions',     format: (v: number) => formatNumber(v) },
          { label: 'Posts Published',   key: 'posts',           format: (v: number) => String(Math.round(v)) },
        ].map(({ label, key, format }) => {
          const val = liveStats?.[key]
          const prv = prevStats?.[key]
          return (
            <div key={label} className="bg-white rounded-2xl border-2 border-slate-100 p-6 text-center hover:border-novax-border transition-colors">
              <p className="text-4xl font-bold mb-2" style={{ color: B.primary }}>{val != null ? format(val) : '—'}</p>
              <p className="text-xs font-semibold text-slate-500 mb-3">{label}</p>
              {deltaStr(val, prv) !== '—' && <DeltaBadge delta={`${deltaStr(val, prv)}`} positive={deltaPos(val, prv)}/>}
            </div>
          )
        })}
      </div>

      {trendSlice.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Reach Trend" subtitle="Recent monthly trajectory"/>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trendSlice}>
              <defs>
                <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.primary} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={B.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
              <Tooltip formatter={v => [formatNumber(Number(v)), 'Total Reach']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Area type="monotone" dataKey="reach" stroke={B.primary} strokeWidth={2.5} fill="url(#execGrad)" dot={{ fill: B.primary, r: 4 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {platformData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Platform Breakdown" subtitle="Organic reach and ER across all active channels"/>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: B.light }}>
                  {['Platform', 'Reach', 'Impressions', 'Eng. Rate', 'Posts', 'Saves', 'Comments'].map((h, i) => (
                    <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platformData.map((p, i) => {
                  const color = PLATFORM_COLORS[p.platform] ?? '#94a3b8'
                  const name = p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
                  return (
                    <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                      <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                        {name}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">{formatNumber(p.reach)}</td>
                      <td className="p-3 text-right text-slate-600">{formatNumber(p.impressions)}</td>
                      <td className="p-3 text-right font-bold" style={{ color: B.primary }}>{Number(p.engagement_rate).toFixed(1)}%</td>
                      <td className="p-3 text-right text-slate-600">{p.posts}</td>
                      <td className="p-3 text-right text-slate-500">{p.saves > 0 ? formatNumber(p.saves) : '—'}</td>
                      <td className="p-3 text-right text-slate-500">{p.comments > 0 ? formatNumber(p.comments) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasNarrative && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionHeader title="Portfolio Overview" subtitle="Consolidated view of the period"/>
          <div className="space-y-4">
            {aiReport.narrative.portfolio   && <Paragraph>{aiReport.narrative.portfolio}</Paragraph>}
            {aiReport.narrative.highlights  && <Paragraph>{aiReport.narrative.highlights}</Paragraph>}
            {aiReport.narrative.executive   && <Paragraph>{aiReport.narrative.executive}</Paragraph>}
            {aiReport.narrative.platform    && <Paragraph>{aiReport.narrative.platform}</Paragraph>}
            {aiReport.narrative.audience    && <Paragraph>{aiReport.narrative.audience}</Paragraph>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Builder ─────────────────────────────────────────────────────────────────

type ReportStructuredData = {
  kpis: { label: string; value: string; change: string }[]
  platforms: { name: string; reach: number; er: number }[]
  trend: { period: string; value: number }[]
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3"/>
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    )
    if (line.match(/^[-*] /)) {
      return (
        <div key={i} className="flex items-start gap-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: B.accent }}/>
          <p className="text-sm text-slate-700 leading-relaxed">{rendered}</p>
        </div>
      )
    }
    if (line.startsWith('### ') || line.startsWith('## ')) {
      const txt = line.replace(/^#{2,3}\s*/, '').replace(/\*/g, '')
      return <h4 key={i} className="text-sm font-bold text-slate-900 mt-5 mb-2" style={{ color: B.primary }}>{txt}</h4>
    }
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      return (
        <div key={i} className="flex items-start gap-3 py-1">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: B.primary }}>{num}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{rendered}</p>
        </div>
      )
    }
    return <p key={i} className="text-sm text-slate-700 leading-relaxed py-0.5">{rendered}</p>
  }).filter(Boolean) as React.ReactNode[]
}

function AIBuilder() {
  const { clients } = useClients()
  const { user } = useAuth()
  const [files, setFiles]           = useState<File[]>([])
  const [prompt, setPrompt]         = useState('')
  const [reportType, setReportType] = useState<Exclude<ReportTab, 'ai'>>('monthly')
  const [selectedClient, setSelectedClient] = useState('all')
  const [loading, setLoading]       = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [result, setResult]         = useState<string | null>(null)
  const [structuredData, setStructuredData] = useState<ReportStructuredData | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const clientName = selectedClient === 'all'
    ? 'Client'
    : (clients.find(c => c.id === selectedClient)?.name ?? 'Client')

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    setFiles(prev => [...prev, ...dropped].slice(0, 5))
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 5))
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const pullLiveData = async () => {
    if (selectedClient === 'all') return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    try {
      const res = await fetch(`/api/metricool/analytics?client_id=${selectedClient}&startDate=${start}&endDate=${end}`)
      const data = await res.json() as { stats?: Record<string, unknown>; error?: string }
      if (res.ok && data.stats) {
        const s = data.stats
        setPrompt(prev => `${prev}\n\nLive ${vendorName(user?.role, 'Metricool')} data (${start} to ${end}):\nReach: ${s.reach}\nImpressions: ${s.impressions}\nEngagement rate: ${s.engagement_rate}%\nLikes: ${s.likes}  Comments: ${s.comments}  Shares: ${s.shares}  Saves: ${s.saves}`.trim())
      }
    } catch { /* ignore */ }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && files.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    setStructuredData(null)
    try {
      const form = new FormData()
      form.append('prompt', prompt)
      form.append('reportType', reportType)
      files.forEach((f, i) => form.append(`file_${i}`, f))
      const res  = await fetch('/api/reports/analyze', { method: 'POST', body: form })
      const data = await res.json() as { text?: string; data?: ReportStructuredData; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult(data.text ?? '')
      setStructuredData(data.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintPDF = () => {
    const el = document.getElementById('ai-report-preview')
    if (el) {
      el.style.minWidth = '740px'
      window.dispatchEvent(new Event('resize'))
      setTimeout(() => { window.print(); setTimeout(() => { el.style.minWidth = '' }, 800) }, 350)
    } else {
      window.print()
    }
  }

  const handleExportPptx = async () => {
    if (!result) return
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result, data: structuredData ?? {}, client_name: clientName, report_type: TABS.find(t => t.id === reportType)?.label ?? reportType }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `NOVA_${clientName}_${reportType}_report.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: B.light }}>
            <Sparkles className="w-4 h-4" style={{ color: B.primary }}/>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Report Builder</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload analytics screenshots or paste raw data — AI extracts and formats a branded report</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Client</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
              >
                <option value="all">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={pullLiveData}
                disabled={selectedClient === 'all'}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                Pull live data
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as Exclude<ReportTab, 'ai'>)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
            >
              {TABS.filter(t => t.id !== 'ai').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600 mb-2 block">Paste raw data or context</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={5}
            placeholder="Paste analytics data, numbers, campaign context, or anything you'd like the AI to include in the report..."
            className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-novax-border resize-none bg-slate-50 focus:bg-white transition-colors"
          />
        </div>

        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-novax-border transition-colors mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onFileChange}/>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: B.light }}>
            <FileText className="w-5 h-5" style={{ color: B.primary }}/>
          </div>
          <p className="text-sm text-slate-500">Drop screenshots or PDFs here, or click to upload</p>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF · Max 5 files</p>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                <FileText className="w-3 h-3 text-slate-400"/>
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0"/>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || (!prompt.trim() && files.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ background: B.primary }}
          >
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin"/> Analysing…</> : <><Sparkles className="w-4 h-4"/> Generate Report</>}
          </button>
          {result && (
            <>
              <button onClick={handlePrintPDF} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <Printer className="w-3.5 h-3.5"/> Print PDF
              </button>
              <button
                onClick={handleExportPptx}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <FileText className="w-3.5 h-3.5"/>}
                {exporting ? 'Exporting…' : 'Export PPTX'}
              </button>
            </>
          )}
        </div>
      </div>

      {result && (
        <div id="ai-report-preview" className="bg-white rounded-2xl border border-slate-200 p-8">
          <ReportHeader
            title={TABS.find(t => t.id === reportType)?.label ?? 'Report'}
            subtitle="AI-generated from provided data and screenshots"
            client={clientName}
            period={TABS.find(t => t.id === reportType)?.label ?? reportType}
          />
          <div className="mt-6 space-y-1">
            {renderMarkdown(result)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parsePeriodToRange(period: string): { startDate: string; endDate: string } | null {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const mMatch = period.match(/^(\w+)\s+(\d{4})$/)
  if (mMatch) {
    const mi = MONTHS.findIndex(m => m === mMatch[1])
    if (mi >= 0) {
      const y = mMatch[2]
      const last = new Date(Number(y), mi + 1, 0).getDate()
      return { startDate: `${y}-${String(mi + 1).padStart(2, '0')}-01`, endDate: `${y}-${String(mi + 1).padStart(2, '0')}-${last}` }
    }
  }
  const qMatch = period.match(/^Q(\d)\s+(\d{4})$/)
  if (qMatch) {
    const q = Number(qMatch[1]); const y = qMatch[2]
    const sm = (q - 1) * 3 + 1; const em = q * 3
    return { startDate: `${y}-${String(sm).padStart(2, '0')}-01`, endDate: `${y}-${String(em).padStart(2, '0')}-${new Date(Number(y), em, 0).getDate()}` }
  }
  return null
}

// ─── Main page types ─────────────────────────────────────────────────────────────

type LivePlatform = { platform: string; reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; posts: number; engagement_rate: number }
type LiveTrendPoint = { month: string; reach: number; impressions: number; er: number }

type AIReportNarrative = {
  executive?: string
  reach?: string
  engagement?: string
  platform?: string
  trend?: string
  audience?: string
  follower?: string
  formats?: string
  hashtags?: string
  synergy?: string
  channel?: string
  efficiency?: string
  creative?: string
  quarterly_overview?: string
  monthly_breakdown?: string
  highlights?: string
  portfolio?: string
  clients?: string
}
type AIReport = {
  narrative: AIReportNarrative
  meta: { period: string; clientName: string; reportType: string; isMock: boolean }
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { clients }                   = useClients()
  const [activeTab, setActiveTab]     = useState<ReportTab>('monthly')
  const [selectedClient, setSelectedClient] = useState('')
  const [period, setPeriod]           = useState('May 2026')
  const [generating, setGenerating]   = useState(false)
  const [generated, setGenerated]     = useState(false)
  const [liveStats, setLiveStats]     = useState<Record<string, number> | null>(null)
  const [prevStats, setPrevStats]     = useState<Record<string, number> | null>(null)
  const [livePlatforms, setLivePlatforms] = useState<LivePlatform[] | null>(null)
  const [liveTrend, setLiveTrend]     = useState<LiveTrendPoint[] | null>(null)
  const [dataError, setDataError]     = useState<string | null>(null)
  const [aiError, setAiError]         = useState<string | null>(null)
  const [aiReport, setAiReport]       = useState<AIReport | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const clientName = selectedClient
    ? (clients.find(c => c.id === selectedClient)?.name ?? 'Client')
    : 'Select a client'

  const handleGenerate = async () => {
    if (!selectedClient) return
    setGenerating(true)
    setGenerated(false)
    setLiveStats(null)
    setPrevStats(null)
    setLivePlatforms(null)
    setLiveTrend(null)
    setDataError(null)
    setAiError(null)
    setAiReport(null)

    const range = parsePeriodToRange(period)
    if (!range) {
      setDataError('Unrecognised period — select a valid month or quarter.')
      setGenerating(false)
      setGenerated(true)
      return
    }

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:   selectedClient,
          reportType: activeTab,
          startDate:  range.startDate,
          endDate:    range.endDate,
        }),
      })
      const data = await res.json() as {
        narrative?: AIReportNarrative
        stats?: Record<string, number>
        prevStats?: Record<string, number>
        platforms?: LivePlatform[]
        trend?: LiveTrendPoint[]
        meta?: AIReport['meta']
        _mock?: boolean
        _geminiError?: string
        error?: string
      }

      if (!res.ok) {
        setDataError(data.error ?? 'Report generation failed')
      } else {
        if (data._mock || data.error) {
          setDataError(data.error ?? 'Metricool not configured — add the blog ID in Settings to enable live data')
        } else {
          // Only store data that actually has values — no empty arrays / zero-only stats
          const stats = data.stats && Object.values(data.stats).some(v => Number(v) > 0) ? data.stats : null
          const prevSt = data.prevStats && Object.values(data.prevStats).some(v => Number(v) > 0) ? data.prevStats : null
          setLiveStats(stats)
          setPrevStats(prevSt)
          if (data.platforms?.length) setLivePlatforms(data.platforms)
          if (data.trend?.some(t => t.reach > 0 || t.er > 0)) setLiveTrend(data.trend ?? null)
        }
        if (data._geminiError) {
          setAiError(data._geminiError)
        }
        if (data.narrative && data.meta && !data._mock) {
          setAiReport({ narrative: data.narrative, meta: data.meta })
        }
      }
    } catch {
      setDataError('Could not connect to the report generation API')
    }

    setGenerating(false)
    setGenerated(true)
  }

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab)
    setGenerated(false)
    setAiReport(null)
  }

  const handleExportPDF = async () => {
    setExportingPdf(true)
    try {
      const res = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab:       activeTab,
          clientName,
          period,
          stats:     liveStats     ?? undefined,
          prevStats: prevStats     ?? undefined,
          platforms: livePlatforms ?? undefined,
          trend:     liveTrend     ?? undefined,
          narrative: aiReport?.narrative ?? undefined,
        }),
      })
      if (!res.ok) { console.error('PDF export failed', res.status); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `NOVAX_${clientName.replace(/\s+/g, '_')}_${activeTab}_${period.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingPdf(false)
    }
  }

  const sharedProps = { client: clientName, period, liveStats, prevStats, livePlatforms, liveTrend, aiReport }

  return (
    <div className="space-y-5">
      {/* Tab bar + controls */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max border-b border-slate-100">
            {TABS.map(tab => {
              const Icon   = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors',
                    active
                      ? 'border-b-2 text-novax bg-novax-light'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                  )}
                  style={active ? { borderBottomColor: B.primary } : {}}
                >
                  <Icon className="w-4 h-4 shrink-0"/>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab !== 'ai' && (
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 max-w-lg">{TABS.find(t => t.id === activeTab)?.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClient}
                onChange={e => { setSelectedClient(e.target.value); setGenerated(false); setAiReport(null) }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white transition-all"
              >
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={period}
                onChange={e => { setPeriod(e.target.value); setGenerated(false); setAiReport(null) }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white transition-all"
              >
                {['May 2026', 'April 2026', 'March 2026', 'Q1 2026', 'Q4 2025'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedClient}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
                style={{ background: generating ? B.muted : B.primary }}
              >
                {generating
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Generating…</>
                  : <><FileText className="w-3.5 h-3.5"/> Generate Report</>}
              </button>
              {generated && liveStats && !dataError && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                  <Activity className="w-3 h-3"/> Live Data
                </span>
              )}
              {generated && aiReport && !aiError && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: B.light, color: B.primary }}>
                  <Sparkles className="w-3 h-3"/> AI Narrative
                </span>
              )}
              {generated && aiError && (
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg" title={aiError}>
                  <AlertCircle className="w-3 h-3"/> No AI narrative
                </span>
              )}
              {generated && dataError && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg" title={dataError}>
                  <AlertCircle className="w-3 h-3"/> {(dataError?.length ?? 0) > 40 ? 'No live data' : dataError}
                </span>
              )}
              {generated && (
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5"/>
                  {exportingPdf ? 'Preparing…' : 'Export PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      {activeTab === 'ai' ? (
        <AIBuilder/>
      ) : generated && dataError ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-amber-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-amber-50">
            <AlertCircle className="w-7 h-7 text-amber-500"/>
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">Data not available</h3>
          <p className="text-sm text-slate-500 text-center max-w-md leading-relaxed">{dataError}</p>
        </div>
      ) : generated ? (
        <div id="printable-report" className="space-y-5">
          {activeTab === 'monthly'   && <MonthlyReport   {...sharedProps}/>}
          {activeTab === 'paid'      && <PaidReport       {...sharedProps}/>}
          {activeTab === 'combined'  && <CombinedReport   {...sharedProps}/>}
          {activeTab === 'platform'  && <PlatformReport   client={clientName} period={period} livePlatforms={livePlatforms} liveTrend={liveTrend} aiReport={aiReport}/>}
          {activeTab === 'quarterly' && <QuarterlyReport  client={clientName} period={period} liveStats={liveStats} prevStats={prevStats} liveTrend={liveTrend} aiReport={aiReport}/>}
          {activeTab === 'executive' && <ExecutiveReport  {...sharedProps}/>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: B.light }}>
            <BarChart2 className="w-8 h-8" style={{ color: B.primary }}/>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {TABS.find(t => t.id === activeTab)?.label}
          </h3>
          <p className="text-sm text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
            {selectedClient
              ? TABS.find(t => t.id === activeTab)?.description
              : 'Select a client from the dropdown above, then click Generate Report.'}
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedClient}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ background: B.primary }}
          >
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin"/> Generating…</>
              : <><FileText className="w-4 h-4"/> Generate Report</>}
          </button>
        </div>
      )}
    </div>
  )
}
