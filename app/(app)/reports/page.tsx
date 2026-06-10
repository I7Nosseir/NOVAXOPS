'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
  Legend, ReferenceLine,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn } from '@/lib/utils'
import {
  FileText, TrendingUp, Eye, BarChart2, ArrowUpRight, ArrowDownRight,
  AlertCircle, Activity, Calendar, RefreshCw, Sparkles, Printer, Check,
  Heart, MessageCircle, Share2, Users, Link2,
  Folder, FolderOpen, ChevronDown, ChevronRight, ChevronUp, Trash2,
  Megaphone, CreditCard, MousePointerClick, Percent, ToggleLeft, ToggleRight,
  Plus, X as XIcon, ImagePlus, Upload,
} from 'lucide-react'
import type { PaidAdsData } from '@/lib/report-prompts'

// ─── Brand palette ─────────────────────────────────────────────────────────────
const B = {
  primary: '#1B3D38',
  muted:   '#2A6B62',
  accent:  '#5BB4AE',
  border:  '#9DCCC8',
  light:   '#EBF4F3',
}

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
function formatPostDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

function formatReportDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

// ─── Platform support ───────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', facebook: '#1877F2', linkedin: '#0A66C2',
  tiktok: '#010101', twitter: '#000000', youtube: '#FF0000',
}

const ALL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']

function PlatformLogo({ platform, size = 20 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase()
  if (p === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#E1306C"/>
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="12" cy="12" r="2.8" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="16.3" cy="7.7" r="1.1" fill="white"/>
    </svg>
  )
  if (p === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#1877F2"/>
      <path d="M14.2 7H12.5C11.6 7 11 7.7 11 8.6V10.5H9V13H11V20.5H13.5V13H15.5L16 10.5H13.5V9C13.5 8.7 13.7 8.5 14 8.5H16V7H14.2Z" fill="white"/>
    </svg>
  )
  if (p === 'linkedin') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#0A66C2"/>
      <path d="M7 10h2.5v8H7v-8zm1.25-1.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" fill="white"/>
      <path d="M11.5 10H14v1.2h.1c.4-.7 1.3-1.4 2.6-1.4 2.7 0 3.3 1.8 3.3 4.1V18H17.5v-3.7c0-.9-.1-2-1.4-2-1.4 0-1.6 1.1-1.6 2V18H11.5v-8z" fill="white"/>
    </svg>
  )
  if (p === 'tiktok') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#010101"/>
      <path d="M17 8.5c-.9 0-1.6-.4-2.1-.9-.5-.6-.8-1.4-.8-2.1H12v9.8c0 1-.8 1.8-1.8 1.8S8.4 16.3 8.4 15.3s.8-1.8 1.8-1.8c.2 0 .4 0 .6.1V11c-.2 0-.4-.1-.6-.1C7.8 10.9 6 12.9 6 15.3s1.8 4.2 4.2 4.2 4.2-1.9 4.2-4.2V9.7c.8.5 1.7.8 2.6.8v-2z" fill="white"/>
    </svg>
  )
  if (p === 'twitter' || p === 'x') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#000000"/>
      <path d="M17.8 5.2h2.3l-5 5.7 5.9 7.9h-4.6L12.5 13 8 18.8H5.7l5.4-6.1L5.2 5.2h4.7l3.5 4.7 4.4-4.7z" fill="white"/>
    </svg>
  )
  if (p === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#FF0000"/>
      <path d="M10 15.5V8.5l6.5 3.5-6.5 3.5z" fill="white"/>
    </svg>
  )
  const color = PLATFORM_COLORS[p] ?? '#94a3b8'
  return <svg width={size} height={size} viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill={color}/></svg>
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

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

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <span className="text-[10px] font-bold text-slate-300 tabular-nums shrink-0">{n}</span>
      <div className="flex-1 h-px bg-slate-100"/>
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-300 shrink-0">{label}</span>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
    </div>
  )
}

function CoverPage({ client, period, logoUrl, preparedDate }: { client: string; period: string; logoUrl?: string | null; preparedDate?: string }) {
  const today = preparedDate ?? new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col min-h-[320px]" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
      <div className="px-10 pt-10 flex items-center justify-between">
        <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
          <path d="M8,62 L8,10 L16,10 L48,54 L48,10 L56,10 L56,62 L48,62 L16,18 L16,62 Z" fill="white"/>
          <path fillRule="evenodd" d="M82,10 A26,26 0 0 1 82,62 A26,26 0 0 1 82,10 Z M82,22 A14,14 0 0 1 82,50 A14,14 0 0 1 82,22 Z" fill="white"/>
          <line x1="60" y1="68" x2="104" y2="4" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M114,10 L124,10 L151,58 L178,10 L188,10 L151,64 L141,64 Z" fill="white"/>
          <path fillRule="evenodd" d="M194,62 L218,10 L228,10 L252,62 L243,62 L237,50 L209,50 L203,62 Z M215,42 L223,18 L235,42 Z" fill="white"/>
          <text x="250" y="18" fill="white" fontSize="9" fontFamily="system-ui,Arial,sans-serif">™</text>
        </svg>
        {logoUrl && (
          <img src={logoUrl} alt={`${client} logo`} className="h-10 max-w-[140px] object-contain opacity-90"/>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center px-10 py-12">
        <div className="w-12 h-0.5 rounded-full mb-6" style={{ background: B.accent }}/>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.border }}>Monthly Performance Report</p>
        <h1 className="text-5xl font-bold text-white leading-tight mb-3">{client}</h1>
        <p className="text-lg font-medium" style={{ color: B.accent }}>{period}</p>
        <p className="text-sm mt-1" style={{ color: B.border }}>Full Platform Analytics · All Connected Channels</p>
      </div>
      <div className="px-10 pb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-white mb-0.5">Prepared by NOVAX</p>
          <p className="text-xs" style={{ color: B.border }}>{today}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: B.accent }}/>
          <p className="text-xs font-medium" style={{ color: B.border }}>Confidential — For Client Use Only</p>
        </div>
      </div>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.light}, ${B.border}, ${B.accent})` }}/>
    </div>
  )
}

function ReportPageHeader({ client, period, logoUrl }: { client: string; period: string; logoUrl?: string | null }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-5" style={{ background: B.primary }}>
      <div className="px-7 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-auto">
            <path d="M8,62 L8,10 L16,10 L48,54 L48,10 L56,10 L56,62 L48,62 L16,18 L16,62 Z" fill="white"/>
            <path fillRule="evenodd" d="M82,10 A26,26 0 0 1 82,62 A26,26 0 0 1 82,10 Z M82,22 A14,14 0 0 1 82,50 A14,14 0 0 1 82,22 Z" fill="white"/>
            <line x1="60" y1="68" x2="104" y2="4" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <path d="M114,10 L124,10 L151,58 L178,10 L188,10 L151,64 L141,64 Z" fill="white"/>
            <path fillRule="evenodd" d="M194,62 L218,10 L228,10 L252,62 L243,62 L237,50 L209,50 L203,62 Z M215,42 L223,18 L235,42 Z" fill="white"/>
            <text x="250" y="18" fill="white" fontSize="9" fontFamily="system-ui,Arial,sans-serif">™</text>
          </svg>
          <div className="w-px h-8 bg-white/20"/>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Monthly Performance Report</p>
            <p className="text-[11px] mt-0.5" style={{ color: B.border }}>Full platform analytics — all channels</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${client} logo`}
              className="h-7 max-w-[80px] object-contain opacity-80"
            />
          )}
          <div>
            <p className="text-white font-semibold text-sm">{client}</p>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <Calendar className="w-3 h-3" style={{ color: B.accent }}/>
              <p className="text-xs" style={{ color: B.border }}>{period}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type LivePlatform = {
  platform: string; reach: number; impressions: number; likes: number
  comments: number; shares: number; saves: number; posts: number; engagement_rate: number
}
type LiveTrendPoint = { month: string; reach: number; impressions: number; er: number }
type AIReportNarrative = {
  executive?: string; reach?: string; engagement?: string; platform?: string
  trend?: string; audience?: string; follower?: string; formats?: string; paid_ads?: string
  platform_narratives?: string
}
type AIReport = {
  narrative: AIReportNarrative
  meta: { period: string; clientName: string; reportType: string; isMock: boolean }
}
type TopPost = {
  id?: string; network?: string; publishDate?: string; url?: string
  text?: string; reach: number; impressions: number
  likes: number; comments: number; shares: number; saves: number
}
type TopPostGroup = { platform: string; posts: TopPost[] }

type SavedReport = {
  id: string
  client_id: string
  client_name: string
  period: string
  period_start: string
  period_end: string
  generated_at: string
  preview: { reach: number; likes: number; posts: number }
}

type ReportDataJson = {
  period?: string
  clientName?: string
  logoUrl?: string | null
  stats?: Record<string, number>
  prevStats?: Record<string, number>
  platforms?: LivePlatform[]
  trend?: LiveTrendPoint[]
  topPostGroups?: TopPostGroup[]
  narrative?: AIReportNarrative
  aiMeta?: AIReport['meta']
  adCampaigns?: PaidAdsData[] | null
  paidAdsData?: PaidAdsData | null
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: {name: string; value: number; color?: string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          {p.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }}/>}
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Master Monthly Report ──────────────────────────────────────────────────────

function MasterMonthlyReport({
  client, period, logoUrl, liveStats, prevStats, livePlatforms, liveTrend, topPostGroups, aiReport, language = 'en', adCampaigns,
}: {
  client: string
  period: string
  logoUrl?: string | null
  liveStats?: Record<string, number> | null
  prevStats?: Record<string, number> | null
  livePlatforms?: LivePlatform[] | null
  liveTrend?: LiveTrendPoint[] | null
  topPostGroups?: TopPostGroup[] | null
  aiReport?: AIReport | null
  language?: 'en' | 'ar'
  adCampaigns?: PaidAdsData[] | null
}) {
  const activeCampaigns = (adCampaigns ?? []).filter(c => c.spend)
  const hasPaid = activeCampaigns.length > 0

  const platformData = (livePlatforms ?? [])
    .filter(p => p.reach > 0 || p.impressions > 0 || p.likes > 0 || p.comments > 0)
    .sort((a, b) => (b.reach + b.impressions) - (a.reach + a.impressions))
    .map(p => ({
      ...p,
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      color: PLATFORM_COLORS[p.platform] ?? '#94a3b8',
      engagement: (p.likes ?? 0) + (p.comments ?? 0),
    }))

  const trendData = liveTrend ?? []
  const maxReach = Math.max(...platformData.map(p => p.reach + p.impressions), 1)
  const totalReach = liveStats?.reach ?? 0
  const hasNarrative = !!(aiReport && Object.values(aiReport.narrative).some(Boolean))
  const hasTopPosts = !!(topPostGroups && topPostGroups.some(g => g.posts.length > 0))

  const pieData = platformData
    .filter(p => p.reach > 0 || p.impressions > 0)
    .map(p => ({ name: p.name, value: p.reach || p.impressions, color: p.color }))

  // Section counter
  let sectionN = 1
  const sec = () => String(sectionN++).padStart(2, '0')

  return (
    <div className="space-y-6">

      {/* ── Cover ─────────────────────────────────────────── */}
      <div className="report-cover-page">
        <CoverPage client={client} period={period} logoUrl={logoUrl}/>
      </div>

      {/* ── Section: The Numbers That Matter ─────────────── */}
      <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
        <ReportPageHeader client={client} period={period}/>
        <SectionLabel n={sec()} label="Overview"/>
        <SectionTitle
          title="The Numbers That Matter"
          subtitle={`Here is a clear summary of how your social media performed in ${period}, compared to the previous month.`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {([
            {
              key: 'reach', label: 'People Reached', icon: Users,
              explanation: 'How many different people saw at least one of your posts — each person counted once',
              format: (v: number) => formatNumber(v),
            },
            {
              key: 'impressions', label: 'Times Content Was Seen', icon: Eye,
              explanation: 'Total times your posts appeared on someone\'s screen — one person can count multiple times',
              format: (v: number) => formatNumber(v),
            },
            {
              key: 'likes', label: 'Total Likes', icon: Heart,
              explanation: 'People who liked or positively reacted to your posts',
              format: (v: number) => formatNumber(v),
            },
            {
              key: 'comments', label: 'Total Comments', icon: MessageCircle,
              explanation: 'Conversations started on your posts — a strong sign people care about your content',
              format: (v: number) => formatNumber(v),
            },
            {
              key: 'shares', label: 'Total Shares', icon: Share2,
              explanation: 'Times people shared your content with their own followers',
              format: (v: number) => formatNumber(v),
            },
            {
              key: 'posts', label: 'Posts Published', icon: FileText,
              explanation: 'Number of posts published across all platforms this month',
              format: (v: number) => String(Math.round(v)),
            },
          ] as const).map(({ key, label, icon: Icon, explanation, format }) => {
            const val = liveStats?.[key]
            const prv = prevStats?.[key]
            const delta = deltaStr(val, prv)
            const positive = deltaPos(val, prv)
            return (
              <div key={key} className="rounded-2xl border border-slate-100 p-5" style={{ background: B.light }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(27,61,56,0.1)' }}>
                    <Icon className="w-4 h-4" style={{ color: B.primary }}/>
                  </div>
                  {delta !== '—' && (
                    <DeltaBadge delta={`${delta} vs last month`} positive={positive}/>
                  )}
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1 tabular-nums">
                  {val != null ? format(val) : '—'}
                </p>
                <p className="text-xs font-semibold mb-2" style={{ color: B.muted }}>{label}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{explanation}</p>
              </div>
            )
          })}
        </div>

        {/* Engagement rate callout */}
        {liveStats?.engagement_rate != null && (
          <div className="mt-4 rounded-2xl border border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: B.light }}>
                <TrendingUp className="w-4 h-4" style={{ color: B.primary }}/>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums" style={{ color: B.primary }}>
                  {Math.round(Number(liveStats.engagement_rate))}%
                </p>
                <p className="text-xs font-semibold text-slate-500">Interaction Rate</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed sm:ml-6 max-w-lg">
              Out of every 100 people who saw your content,{' '}
              <strong className="text-slate-700">{Math.round(Number(liveStats.engagement_rate))} of them</strong>{' '}
              liked, commented, or shared it. This measures how much your content is connecting with your audience.
              {prevStats?.engagement_rate != null && deltaStr(liveStats.engagement_rate, prevStats.engagement_rate) !== '—' && (
                <span> That is <strong className="text-slate-700">{deltaStr(liveStats.engagement_rate, prevStats.engagement_rate)}</strong> compared to last month.</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Section: Paid Advertising ─────────────────────── */}
      {hasPaid && (
        <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
          <ReportPageHeader client={client} period={period} logoUrl={logoUrl}/>
          <SectionLabel n={sec()} label="Paid Advertising"/>
          <SectionTitle
            title="Paid Advertising Performance"
            subtitle={`${activeCampaigns.length === 1 ? activeCampaigns[0].platform : `${activeCampaigns.length} campaigns`} — advertising results for ${period}. Figures sourced directly from ads manager.`}
          />

          {activeCampaigns.map((campaign, ci) => (
            <div key={ci} className={cn('mb-6', ci < activeCampaigns.length - 1 && 'pb-6 border-b border-slate-100')}>
              {(campaign.campaignName || activeCampaigns.length > 1) && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: B.light, color: B.primary }}>
                    <Megaphone className="w-3.5 h-3.5"/>
                    {campaign.campaignName || `Campaign ${ci + 1}`}
                  </div>
                  <span className="text-xs text-slate-400">{campaign.platform}</span>
                </div>
              )}

              {/* Ad creative thumbnail */}
              {campaign.imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border border-slate-100 max-w-xs">
                  <img src={campaign.imageUrl} alt="Ad creative" className="w-full h-40 object-cover"/>
                </div>
              )}

              {/* KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {([
                  { label: 'Total Ad Spend', value: `${campaign.currency} ${Number(campaign.spend).toLocaleString()}`, icon: CreditCard, explanation: 'Total amount invested in paid advertising this month' },
                  campaign.reach ? { label: 'Paid Reach', value: formatNumber(Number(campaign.reach)), icon: Users, explanation: 'Unique people who saw your paid ads — each person counted once' } : null,
                  campaign.impressions ? { label: 'Paid Impressions', value: formatNumber(Number(campaign.impressions)), icon: Eye, explanation: 'Total times your ads appeared on screens, including repeat views' } : null,
                  campaign.clicks ? { label: 'Link Clicks', value: formatNumber(Number(campaign.clicks)), icon: MousePointerClick, explanation: 'Number of times people clicked through from your ad' } : null,
                  campaign.ctr ? { label: 'Click-Through Rate', value: `${campaign.ctr}%`, icon: Percent, explanation: 'Out of everyone who saw your ad, this percentage clicked it' } : null,
                  campaign.cpc ? { label: 'Cost Per Click', value: `${campaign.currency} ${campaign.cpc}`, icon: Activity, explanation: 'Average amount paid for each person who clicked your ad' } : null,
                  campaign.cpm ? { label: 'CPM (per 1,000 views)', value: `${campaign.currency} ${campaign.cpm}`, icon: BarChart2, explanation: 'How much it cost to get your ad seen by 1,000 people' } : null,
                  campaign.conversions ? { label: 'Conversions / Results', value: formatNumber(Number(campaign.conversions)), icon: Check, explanation: 'Number of desired actions completed through your ads' } : null,
                  campaign.roas ? { label: 'ROAS', value: `${campaign.roas}x`, icon: TrendingUp, explanation: 'For every unit spent, this is how much in revenue was generated' } : null,
                ].filter(Boolean) as { label: string; value: string; icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>; explanation: string }[])
                  .map(({ label, value, icon: Icon, explanation }) => (
                    <div key={label} className="rounded-2xl border border-slate-100 p-5" style={{ background: B.light }}>
                      <div className="mb-3"><div className="p-2 rounded-lg w-fit" style={{ background: 'rgba(27,61,56,0.1)' }}><Icon className="w-4 h-4" style={{ color: B.primary }}/></div></div>
                      <p className="text-3xl font-bold text-slate-900 mb-1 tabular-nums">{value}</p>
                      <p className="text-xs font-semibold mb-2" style={{ color: B.muted }}>{label}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{explanation}</p>
                    </div>
                  ))}
              </div>

              {/* Paid vs Organic reach comparison (first campaign only) */}
              {ci === 0 && campaign.reach && liveStats?.reach ? (
                <div className="rounded-2xl border border-slate-100 p-5">
                  <p className="text-sm font-bold text-slate-800 mb-1">Paid vs Organic Reach</p>
                  <p className="text-xs text-slate-400 mb-4">How paid advertising reach compared to organic reach this month</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Paid Reach', value: Number(campaign.reach), color: B.primary },
                      { label: 'Organic Reach', value: liveStats.reach, color: B.accent },
                    ].map(row => {
                      const max = Math.max(Number(campaign.reach), liveStats.reach, 1)
                      const pct = Math.max((row.value / max) * 100, 2)
                      return (
                        <div key={row.label}>
                          <div className="flex items-center justify-between mb-1.5 text-xs">
                            <span className="font-semibold text-slate-700">{row.label}</span>
                            <span className="font-bold tabular-nums" style={{ color: row.color }}>{formatNumber(row.value)}</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {/* AI narrative for paid ads */}
          {aiReport?.narrative.paid_ads && (
            <div className="rounded-xl border border-slate-100 p-5 mt-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-1 h-5 rounded-full shrink-0" style={{ background: B.accent }}/>
                <h3 className="text-sm font-bold text-slate-800">What the Paid Data Tells Us</h3>
              </div>
              <p className="text-sm text-slate-600 leading-7">{renderInline(aiReport.narrative.paid_ads)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Are You Reaching More People ─────────── */}
      {trendData.length > 0 && (
        <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
          <ReportPageHeader client={client} period={period} logoUrl={logoUrl}/>
          <SectionLabel n={sec()} label="Growth"/>
          <SectionTitle
            title="Are You Reaching More People?"
            subtitle="These charts show how your audience reach and content interactions have changed over the last 5 months. A rising line is a great sign."
          />

          {/* Reach trend */}
          <div className="rounded-2xl border border-slate-100 p-5 mb-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-slate-800">People Reached Per Month</p>
              {totalReach > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: B.light, color: B.primary }}>
                  {formatNumber(totalReach)} this month
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-5">How many different people saw your content each month</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={B.primary} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={B.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))} width={55}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Area type="monotone" dataKey="reach" name="People Reached" stroke={B.primary} strokeWidth={2.5} fill="url(#reachGrad)" dot={{ fill: B.primary, r: 4, strokeWidth: 0 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Interaction rate trend */}
          <div className="rounded-2xl border border-slate-100 p-5">
            <p className="text-sm font-bold text-slate-800 mb-1">Interaction Rate Per Month</p>
            <p className="text-xs text-slate-400 mb-5">
              What percentage of people who saw your content actually liked, commented, or shared?
              The dotted line shows the average for most brands (2%). Being above it is excellent.
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="erGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={B.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={B.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" width={40}/>
                <Tooltip content={(props) => {
                  if (!props.active || !props.payload?.length) return null
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
                      <p className="font-semibold text-slate-700 mb-1">{props.label}</p>
                      <p className="text-slate-800"><strong>{Math.round(Number(props.payload[0].value))}%</strong> interaction rate</p>
                    </div>
                  )
                }}/>
                <ReferenceLine y={2} stroke="#cbd5e1" strokeDasharray="5 3" label={{ value: 'Average: 2%', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}/>
                <Area type="monotone" dataKey="er" name="Interaction Rate" stroke={B.accent} strokeWidth={2.5} fill="url(#erGrad)" dot={{ fill: B.accent, r: 4, strokeWidth: 0 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Month-by-month table */}
          {trendData.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: B.light }}>
                    {['Month', 'People Reached', 'Times Seen', 'Interaction Rate'].map((h, i) => (
                      <th key={h} className={cn('p-3 text-xs font-bold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((t, i) => (
                    <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                      <td className="p-3 font-semibold text-slate-800">{t.month}</td>
                      <td className="p-3 text-right font-bold text-slate-800">{t.reach > 0 ? formatNumber(t.reach) : '—'}</td>
                      <td className="p-3 text-right text-slate-600">{t.impressions > 0 ? formatNumber(t.impressions) : '—'}</td>
                      <td className="p-3 text-right font-bold" style={{ color: B.primary }}>{t.er > 0 ? `${Math.round(Number(t.er))}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Where Is Your Audience ──────────────── */}
      {platformData.length > 0 && (
        <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
          <ReportPageHeader client={client} period={period} logoUrl={logoUrl}/>
          <SectionLabel n={sec()} label="Platforms"/>
          <SectionTitle
            title="Where Is Your Audience?"
            subtitle="This shows which social media platforms your audience uses most. Every platform that had at least one post this month is shown here."
          />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Pie chart */}
            {pieData.length > 1 && (
              <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                <p className="text-sm font-bold text-slate-800 mb-1">Audience Distribution</p>
                <p className="text-xs text-slate-400 mb-3">Share of total reach by platform</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      dataKey="value"
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v) => [formatNumber(Number(v)), 'People Reached']} contentStyle={{ fontSize: 12, borderRadius: 10 }}/>
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend below */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                  {pieData.map(entry => {
                    const total = pieData.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0'
                    return (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }}/>
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Platform bars */}
            <div className={cn('space-y-4', pieData.length > 1 ? 'lg:col-span-3' : 'lg:col-span-5')}>
              {platformData.map(p => {
                const barWidth = Math.max((p.reach + p.impressions) / maxReach * 100, 1)
                return (
                  <div key={p.platform} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlatformLogo platform={p.platform} size={20}/>
                        <span className="text-sm font-bold text-slate-800">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-bold text-slate-800 text-sm">{formatNumber(p.reach || p.impressions)}</span>
                        <span>people reached</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: p.color }}/>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Heart className="w-3.5 h-3.5 text-slate-400"/>
                        <span className="font-semibold text-slate-700">{formatNumber(p.likes)}</span>
                        <span>likes</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-400"/>
                        <span className="font-semibold text-slate-700">{formatNumber(p.comments)}</span>
                        <span>comments</span>
                      </div>
                      {p.shares > 0 && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Share2 className="w-3.5 h-3.5 text-slate-400"/>
                          <span className="font-semibold text-slate-700">{formatNumber(p.shares)}</span>
                          <span>shares</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-slate-500 ml-auto">
                        <span className="font-semibold" style={{ color: B.primary }}>{Math.round(Number(p.engagement_rate))}%</span>
                        <span>interaction rate</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Engagement comparison bar chart */}
          {platformData.length > 1 && (
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <p className="text-sm font-bold text-slate-800 mb-1">How People Reacted — Platform Comparison</p>
              <p className="text-xs text-slate-400 mb-5">
                Total likes and comments per platform. Taller bars mean more audience interaction on that platform.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={platformData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))} width={50}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="likes" name="Likes" stackId="eng" fill={B.accent} radius={[0, 0, 0, 0]}/>
                  <Bar dataKey="comments" name="Comments" stackId="eng" fill={B.primary} radius={[3, 3, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Top Posts (per platform) ─────────────── */}
      {hasTopPosts && (
        <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
          <ReportPageHeader client={client} period={period} logoUrl={logoUrl}/>
          <SectionLabel n={sec()} label="Top Content"/>
          <SectionTitle
            title="Your Best Content This Month"
            subtitle='The top 3 posts on each platform, ranked by likes, comments and shares. Click "View Post" to open the original.'
          />

          <div className="space-y-8">
            {topPostGroups!.filter(g => g.posts.length > 0).map(group => (
              <div key={group.platform}>
                {/* Platform header */}
                <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-slate-100">
                  <PlatformLogo platform={group.platform} size={18}/>
                  <span className="text-sm font-bold text-slate-800 capitalize">{group.platform}</span>
                  <span className="text-xs text-slate-400">· {group.posts.length} top post{group.posts.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2.5">
                  {group.posts.map((post, i) => {
                    const rankColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#CD7C2F'
                    const views = (post.impressions ?? 0) > 0 ? post.impressions : post.reach
                    return (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                        {/* Rank badge */}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-0.5" style={{ background: rankColor }}>
                          {i + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Date */}
                          {post.publishDate && (
                            <p className="text-[10px] text-slate-400 mb-1.5">{formatPostDate(post.publishDate)}</p>
                          )}

                          {/* Caption */}
                          {post.text ? (
                            <p className="text-sm text-slate-700 leading-relaxed mb-2.5 line-clamp-2">
                              {post.text.length > 150 ? post.text.slice(0, 150) + '…' : post.text}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic mb-2.5">No caption available</p>
                          )}

                          {/* Metrics + link */}
                          <div className="flex flex-wrap items-center gap-3">
                            {views > 0 && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Eye className="w-3 h-3 text-slate-400"/>
                                <span className="font-bold text-slate-700">{formatNumber(views)}</span>
                                <span>views</span>
                              </div>
                            )}
                            {post.likes > 0 && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Heart className="w-3 h-3 text-slate-400"/>
                                <span className="font-bold text-slate-700">{formatNumber(post.likes)}</span>
                                <span>likes</span>
                              </div>
                            )}
                            {post.comments > 0 && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <MessageCircle className="w-3 h-3 text-slate-400"/>
                                <span className="font-bold text-slate-700">{formatNumber(post.comments)}</span>
                                <span>comments</span>
                              </div>
                            )}
                            {post.shares > 0 && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Share2 className="w-3 h-3 text-slate-400"/>
                                <span className="font-bold text-slate-700">{formatNumber(post.shares)}</span>
                                <span>shares</span>
                              </div>
                            )}
                            {post.url && (
                              <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold ml-auto rounded-lg px-2.5 py-1 transition-colors hover:opacity-80"
                                style={{ background: B.light, color: B.primary }}
                              >
                                <Link2 className="w-3 h-3"/>
                                View Post
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section: What This Data Tells Us ──────────────── */}
      {hasNarrative && (
        <div className="print-break-before bg-white rounded-2xl border border-slate-200 p-7">
          <ReportPageHeader client={client} period={period} logoUrl={logoUrl}/>
          <SectionLabel n={sec()} label="Analysis"/>
          <SectionTitle
            title={language === 'ar' ? 'ماذا تخبرنا بيانات هذا الشهر' : "What This Month's Data Tells Us"}
            subtitle={language === 'ar' ? 'إليك ما تعنيه الأرقام لعلامتك التجارية — بلغة واضحة وبدون مصطلحات تسويقية.' : "Here is what the numbers mean for your brand — written in plain language without any marketing jargon."}
          />

          <div className="space-y-6">
            {([
              { key: 'executive',           en: 'Month Overview',                   ar: 'نظرة عامة على الشهر' },
              { key: 'reach',               en: 'How Your Content Spread',           ar: 'كيف انتشر محتواك' },
              { key: 'engagement',          en: 'How People Reacted',                ar: 'كيف تفاعل الجمهور' },
              { key: 'platform',            en: 'Platform Comparison',               ar: 'أفضل المنصات أداءً' },
              { key: 'platform_narratives', en: 'Platform-by-Platform Breakdown',    ar: 'تحليل كل منصة' },
              { key: 'trend',               en: 'Are You Growing?',                  ar: 'هل أنت في تنامٍ؟' },
              { key: 'formats',             en: 'Publishing Frequency',              ar: 'وتيرة النشر' },
              { key: 'audience',            en: 'Depth of Audience Interaction',     ar: 'عمق تفاعل الجمهور' },
              { key: 'follower',            en: 'Follower Growth',                   ar: 'نمو المتابعين' },
            ] as { key: keyof AIReportNarrative; en: string; ar: string }[])
              .filter(({ key }) => !!aiReport!.narrative[key])
              .map(({ key, en, ar }) => (
                <div key={key} className="rounded-xl border border-slate-100 p-5">
                  <div className={cn('flex items-center gap-2.5 mb-3', language === 'ar' && 'flex-row-reverse')}>
                    <div className="w-1 h-5 rounded-full shrink-0" style={{ background: B.accent }}/>
                    <h3 className="text-sm font-bold text-slate-800">{language === 'ar' ? ar : en}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-7" dir={language === 'ar' ? 'rtl' : undefined}>
                    {renderInline(aiReport!.narrative[key]!)}
                  </p>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Footer bar */}
      <div className="rounded-2xl overflow-hidden" style={{ background: B.primary }}>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
        <div className="px-7 py-4 flex items-center justify-between">
          <p className="text-sm font-bold text-white">NOVAX</p>
          <p className="text-xs" style={{ color: B.border }}>{client} · {period}</p>
        </div>
      </div>

    </div>
  )
}

// ─── Period parser ──────────────────────────────────────────────────────────────

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

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { clients }                               = useClients()
  const [selectedClient, setSelectedClient]       = useState('')
  const [period, setPeriod]                       = useState('May 2026')
  const [generating, setGenerating]               = useState(false)
  const [generated, setGenerated]                 = useState(false)
  const [liveStats, setLiveStats]                 = useState<Record<string, number> | null>(null)
  const [prevStats, setPrevStats]                 = useState<Record<string, number> | null>(null)
  const [livePlatforms, setLivePlatforms]         = useState<LivePlatform[] | null>(null)
  const [liveTrend, setLiveTrend]                 = useState<LiveTrendPoint[] | null>(null)
  const [topPostGroups, setTopPostGroups]           = useState<TopPostGroup[] | null>(null)
  const [dataError, setDataError]                 = useState<string | null>(null)
  const [aiError, setAiError]                     = useState<string | null>(null)
  const [aiReport, setAiReport]                   = useState<AIReport | null>(null)
  const [reportLogoUrl, setReportLogoUrl]         = useState<string | null>(null)
  const [exportingPdf, setExportingPdf]           = useState(false) // unused but kept for future
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(ALL_PLATFORMS)
  const [language, setLanguage]                   = useState<'en' | 'ar'>('en')

  // ── Paid ads ──────────────────────────────────────────
  const emptyCampaign = (): PaidAdsData => ({
    platform: 'Meta Ads', spend: '', currency: 'SAR',
    impressions: '', reach: '', clicks: '', ctr: '', cpc: '', cpm: '',
    conversions: '', roas: '', campaignName: '', imageUrl: '',
  })
  const [includePaidAds, setIncludePaidAds]        = useState(false)
  const [adCampaigns, setAdCampaigns]              = useState<PaidAdsData[]>([emptyCampaign()])
  const [scanningIdx, setScanningIdx]              = useState<number | null>(null)

  // ── Library ──────────────────────────────────────────
  const [savedReports, setSavedReports]           = useState<SavedReport[]>([])
  const [libraryLoading, setLibraryLoading]       = useState(false)
  const [libraryOpen, setLibraryOpen]             = useState(true)
  const [expandedClients, setExpandedClients]     = useState<Set<string>>(new Set())
  const [loadingReportId, setLoadingReportId]     = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms]   = useState<string[]>(ALL_PLATFORMS)
  const [probingPlatforms, setProbingPlatforms]     = useState(false)

  const clientName = selectedClient
    ? (clients.find(c => c.id === selectedClient)?.name ?? 'Client')
    : 'Select a client'

  // ── Library helpers ───────────────────────────────────
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/reports/saved')
      if (res.ok) {
        const data = await res.json() as { reports: SavedReport[] }
        setSavedReports(data.reports ?? [])
      }
    } catch { /* non-critical */ }
    setLibraryLoading(false)
  }, [])

  useEffect(() => { fetchLibrary() }, [fetchLibrary])

  const clientFolders = useMemo(() => {
    const map = new Map<string, { client_id: string; client_name: string; reports: SavedReport[] }>()
    for (const r of savedReports) {
      if (!map.has(r.client_id)) map.set(r.client_id, { client_id: r.client_id, client_name: r.client_name, reports: [] })
      map.get(r.client_id)!.reports.push(r)
    }
    return Array.from(map.values())
  }, [savedReports])

  const toggleFolder = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })
  }

  const loadSavedReport = async (report: SavedReport) => {
    setLoadingReportId(report.id)
    try {
      const res = await fetch(`/api/reports/saved/${report.id}`)
      if (!res.ok) return
      const { data } = await res.json() as { data: ReportDataJson }

      setSelectedClient(report.client_id)
      setPeriod(report.period)
      setLiveStats(data.stats ?? null)
      setPrevStats(data.prevStats ?? null)
      setLivePlatforms(data.platforms ?? null)
      setLiveTrend(data.trend ?? null)
      setTopPostGroups(data.topPostGroups ?? null)
      setDataError(null)
      setAiError(null)
      if (data.logoUrl) setReportLogoUrl(data.logoUrl)
      if (data.narrative) {
        setAiReport({
          narrative: data.narrative,
          meta: data.aiMeta ?? { period: report.period, clientName: report.client_name, reportType: 'monthly', isMock: false },
        })
      } else {
        setAiReport(null)
      }
      // Restore campaigns (new format) or legacy single paidAdsData
      if (data.adCampaigns?.length) {
        setAdCampaigns(data.adCampaigns)
        setIncludePaidAds(true)
      } else if (data.paidAdsData?.spend) {
        setAdCampaigns([data.paidAdsData])
        setIncludePaidAds(true)
      }
      setGenerated(true)

      setTimeout(() => document.getElementById('printable-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch { /* non-critical */ }
    setLoadingReportId(null)
  }

  const deleteSavedReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSavedReports(prev => prev.filter(r => r.id !== id))
    try { await fetch(`/api/reports/saved/${id}`, { method: 'DELETE' }) } catch { /* non-critical */ }
  }

  const handleClientChange = (id: string) => {
    setSelectedClient(id)
    setGenerated(false)
    setAiReport(null)
    // Auto-expand this client's folder in the library
    if (id) setExpandedClients(prev => new Set([...prev, id]))
    if (!id) return
    setProbingPlatforms(true)
    setConnectedPlatforms(ALL_PLATFORMS)
    setSelectedPlatforms(ALL_PLATFORMS)
    fetch(`/api/metricool/connected-platforms?client_id=${id}`)
      .then(r => r.json())
      .then((data: { connected?: string[] }) => {
        const connected = data.connected ?? ALL_PLATFORMS
        setConnectedPlatforms(connected)
        setSelectedPlatforms(connected)
      })
      .catch(() => {})
      .finally(() => setProbingPlatforms(false))
  }

  const handleGenerate = async () => {
    if (!selectedClient) return
    setGenerating(true)
    setGenerated(false)
    setLiveStats(null)
    setPrevStats(null)
    setLivePlatforms(null)
    setLiveTrend(null)
    setTopPostGroups(null)
    setReportLogoUrl(null)
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
          clientId:    selectedClient,
          reportType:  'monthly',
          startDate:   range.startDate,
          endDate:     range.endDate,
          platforms:   selectedPlatforms,
          language,
          adCampaigns: includePaidAds && adCampaigns.some(c => c.spend) ? adCampaigns.filter(c => c.spend) : null,
        }),
      })
      const data = await res.json() as {
        narrative?: AIReportNarrative
        stats?: Record<string, number>
        prevStats?: Record<string, number>
        platforms?: LivePlatform[]
        trend?: LiveTrendPoint[]
        topPostGroups?: TopPostGroup[]
        logoUrl?: string | null
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
          const stats = data.stats && Object.values(data.stats).some(v => Number(v) > 0) ? data.stats : null
          const prevSt = data.prevStats && Object.values(data.prevStats).some(v => Number(v) > 0) ? data.prevStats : null
          setLiveStats(stats)
          setPrevStats(prevSt)
          if (data.platforms?.length) setLivePlatforms(data.platforms)
          if (data.trend?.some(t => t.reach > 0 || t.er > 0)) setLiveTrend(data.trend ?? null)
          if (data.topPostGroups?.some((g: TopPostGroup) => g.posts.length > 0)) setTopPostGroups(data.topPostGroups)
          if (data.logoUrl) setReportLogoUrl(data.logoUrl)
        }
        if (data._geminiError) setAiError(data._geminiError)
        if (data.narrative && data.meta && !data._mock) {
          setAiReport({ narrative: data.narrative, meta: data.meta })
        }


        // Auto-save to library (fire and forget — non-blocking)
        if (!data._mock && data.stats && Object.values(data.stats).some(v => Number(v) > 0)) {
          fetch('/api/reports/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id:    selectedClient,
              period,
              period_start: range.startDate,
              period_end:   range.endDate,
              data_json: {
                period,
                clientName,
                logoUrl:        data.logoUrl,
                stats:          data.stats,
                prevStats:      data.prevStats,
                platforms:      data.platforms,
                trend:          data.trend,
                topPostGroups:  data.topPostGroups,
                narrative:      data.narrative,
                aiMeta:         data.meta,
                adCampaigns:    includePaidAds && adCampaigns.some(c => c.spend) ? adCampaigns.filter(c => c.spend) : null,
              },
            }),
          }).then(() => fetchLibrary()).catch(() => {})
        }
      }
    } catch {
      setDataError('Could not connect to the report generation service')
    }

    setGenerating(false)
    setGenerated(true)
  }

  const handleExportPDF = () => {
    window.print()
  }

  return (
    <div className="space-y-5">

      {/* ── Controls ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Title */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: B.light }}>
                  <BarChart2 className="w-4 h-4" style={{ color: B.primary }}/>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Monthly Performance Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Full analytics report across all connected social media channels
                  </p>
                </div>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClient}
                onChange={e => handleClientChange(e.target.value)}
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
                {['May 2026', 'April 2026', 'March 2026', 'February 2026', 'January 2026', 'Q1 2026', 'Q4 2025'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Language toggle */}
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => { setLanguage('en'); setGenerated(false) }}
                  className={cn('px-3 py-2 text-xs font-bold transition-colors', language === 'en' ? 'text-white' : 'text-slate-500 hover:text-slate-700 bg-white')}
                  style={language === 'en' ? { background: B.primary } : undefined}
                >
                  EN
                </button>
                <button
                  onClick={() => { setLanguage('ar'); setGenerated(false) }}
                  className={cn('px-3 py-2 text-xs font-bold transition-colors', language === 'ar' ? 'text-white' : 'text-slate-500 hover:text-slate-700 bg-white')}
                  style={language === 'ar' ? { background: B.primary } : undefined}
                >
                  AR
                </button>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !selectedClient || selectedPlatforms.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
                style={{ background: generating ? B.muted : B.primary }}
              >
                {generating
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Generating…</>
                  : <><FileText className="w-3.5 h-3.5"/> Generate Report</>}
              </button>

              {/* Status badges */}
              {generated && liveStats && !dataError && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                  <Activity className="w-3 h-3"/> Live Data
                </span>
              )}
              {generated && aiReport && !aiError && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: B.light, color: B.primary }}>
                  <Sparkles className="w-3 h-3"/> AI Analysis
                </span>
              )}
              {generated && aiError && (
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg" title={aiError}>
                  <AlertCircle className="w-3 h-3"/> No AI analysis
                </span>
              )}
              {generated && dataError && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg" title={dataError}>
                  <AlertCircle className="w-3 h-3"/> {(dataError.length > 40) ? 'No live data' : dataError}
                </span>
              )}
              {generated && (
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5"/>
                  Print / Save as PDF
                </button>
              )}
            </div>
          </div>

          {/* Paid Ads toggle + multi-campaign form */}
          <div className="border-t border-slate-100 pt-3 mt-4">
            <button
              onClick={() => setIncludePaidAds(v => !v)}
              className="flex items-center gap-2.5 w-full text-left group"
            >
              <div className="flex items-center gap-2">
                {includePaidAds
                  ? <ToggleRight className="w-5 h-5" style={{ color: B.primary }}/>
                  : <ToggleLeft className="w-5 h-5 text-slate-400"/>}
                <Megaphone className="w-3.5 h-3.5 text-slate-400"/>
                <span className={cn('text-xs font-semibold transition-colors', includePaidAds ? 'text-slate-800' : 'text-slate-500')}>
                  Include Paid Ads Data
                </span>
              </div>
              <span className="text-[10px] text-slate-400 ml-1">
                {includePaidAds
                  ? `${adCampaigns.length} campaign${adCampaigns.length !== 1 ? 's' : ''} — enter your ads manager totals below`
                  : 'Add Meta, TikTok, or Google ad results to the report'}
              </span>
            </button>

            {includePaidAds && (
              <div className="mt-3 space-y-3">
                {adCampaigns.map((campaign, ci) => (
                  <div key={ci} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    {/* Campaign header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Campaign {ci + 1}
                      </span>
                      {adCampaigns.length > 1 && (
                        <button
                          onClick={() => setAdCampaigns(prev => prev.filter((_, i) => i !== ci))}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <XIcon className="w-3.5 h-3.5"/>
                        </button>
                      )}
                    </div>

                    {/* Platform / Currency / Name */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Platform</label>
                        <select
                          value={campaign.platform}
                          onChange={e => setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, platform: e.target.value } : c))}
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                        >
                          {['Meta Ads', 'TikTok Ads', 'Google Ads', 'Snapchat Ads', 'LinkedIn Ads', 'Multi-platform'].map(pl => (
                            <option key={pl} value={pl}>{pl}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Currency</label>
                        <select
                          value={campaign.currency}
                          onChange={e => setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, currency: e.target.value } : c))}
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                        >
                          {['SAR', 'AED', 'USD', 'EGP', 'KWD'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Campaign Name (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. May Brand Awareness"
                          value={campaign.campaignName ?? ''}
                          onChange={e => setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, campaignName: e.target.value } : c))}
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                        />
                      </div>
                    </div>

                    {/* Ad image URL + scan */}
                    <div className="flex items-end gap-2 mb-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Ad Creative URL (optional)</label>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-novax-border transition-colors">
                          <ImagePlus className="w-3.5 h-3.5 text-slate-400 ml-2.5 shrink-0"/>
                          <input
                            type="url"
                            placeholder="https://… paste an ad image URL"
                            value={campaign.imageUrl ?? ''}
                            onChange={e => setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, imageUrl: e.target.value } : c))}
                            className="flex-1 px-2 py-1.5 text-sm text-slate-700 outline-none bg-transparent min-w-0"
                          />
                        </div>
                      </div>
                      <button
                        disabled={scanningIdx === ci}
                        onClick={async () => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/*'
                          input.onchange = async () => {
                            const file = input.files?.[0]
                            if (!file) return
                            setScanningIdx(ci)
                            try {
                              const formData = new FormData()
                              formData.append('file', file)
                              const res = await fetch('/api/media-buying/scan-ads', { method: 'POST', body: formData })
                              if (res.ok) {
                                const parsed = await res.json() as Partial<PaidAdsData>
                                setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, ...parsed } : c))
                              }
                            } finally { setScanningIdx(null) }
                          }
                          input.click()
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0"
                        title="Upload a screenshot from your ads manager — AI will fill the fields automatically"
                      >
                        {scanningIdx === ci ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                        {scanningIdx === ci ? 'Scanning…' : 'Scan Screenshot'}
                      </button>
                    </div>

                    {/* Metric fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {([
                        { key: 'spend',       label: 'Total Spend',           placeholder: '5000',    prefix: campaign.currency },
                        { key: 'impressions', label: 'Paid Impressions',      placeholder: '120000',  prefix: null },
                        { key: 'reach',       label: 'Paid Reach',            placeholder: '85000',   prefix: null },
                        { key: 'clicks',      label: 'Link Clicks',           placeholder: '3200',    prefix: null },
                        { key: 'ctr',         label: 'CTR %',                 placeholder: '2.6',     prefix: null, suffix: '%' },
                        { key: 'cpc',         label: 'Cost Per Click',        placeholder: '1.56',    prefix: campaign.currency },
                        { key: 'cpm',         label: 'CPM (per 1K)',          placeholder: '12.50',   prefix: campaign.currency },
                        { key: 'conversions', label: 'Conversions / Results', placeholder: '180',     prefix: null },
                        { key: 'roas',        label: 'ROAS',                  placeholder: '3.2',     prefix: null, suffix: 'x' },
                      ] as { key: keyof PaidAdsData; label: string; placeholder: string; prefix: string | null; suffix?: string }[]).map(({ key, label, placeholder, prefix, suffix }) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-novax-border transition-colors">
                            {prefix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 shrink-0">{prefix}</span>}
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder={placeholder}
                              value={campaign[key] as string}
                              onChange={e => setAdCampaigns(prev => prev.map((c, i) => i === ci ? { ...c, [key]: e.target.value } : c))}
                              className="flex-1 px-2.5 py-1.5 text-sm text-slate-700 outline-none bg-transparent min-w-0"
                            />
                            {suffix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200 shrink-0">{suffix}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Add campaign + hint */}
                <div className="flex items-center justify-between">
                  <button
                    disabled={adCampaigns.length >= 5}
                    onClick={() => setAdCampaigns(prev => [...prev, emptyCampaign()])}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-novax-border hover:text-novax disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5"/>
                    Add Campaign {adCampaigns.length >= 5 ? '(max 5)' : `(${adCampaigns.length}/5)`}
                  </button>
                  <p className="text-[10px] text-slate-400">Only Total Spend is required per campaign — leave other fields blank if unavailable.</p>
                </div>
              </div>
            )}
          </div>

          {/* Platform selector */}
          {selectedClient && (
            <div className="border-t border-slate-100 pt-3 mt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-slate-500">Include platforms</span>
                {probingPlatforms && <span className="text-[10px] text-slate-400 animate-pulse">Checking connections…</span>}
                {!probingPlatforms && <span className="text-[10px] text-slate-400">{selectedPlatforms.length} selected</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map(platform => {
                  const connected = connectedPlatforms.includes(platform)
                  const selected  = selectedPlatforms.includes(platform)
                  return (
                    <button
                      key={platform}
                      disabled={!connected || probingPlatforms}
                      title={!connected ? `${platform} is not connected` : undefined}
                      onClick={() => {
                        setSelectedPlatforms(prev =>
                          prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
                        )
                        setGenerated(false)
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                        probingPlatforms && 'opacity-50 cursor-wait',
                        !connected && !probingPlatforms && 'opacity-30 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400',
                        connected && !selected && 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
                        connected && selected && 'text-white border-transparent shadow-sm',
                      )}
                      style={connected && selected ? { background: PLATFORM_COLORS[platform] ?? B.primary } : undefined}
                    >
                      <PlatformLogo platform={platform} size={14}/>
                      <span className="capitalize">{platform}</span>
                      {connected && selected && <Check className="w-3 h-3 opacity-80"/>}
                      {!connected && !probingPlatforms && <span className="text-[9px] opacity-70 ml-0.5">Not connected</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Reports Library ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setLibraryOpen(!libraryOpen)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
        >
          <div className="p-2 rounded-xl shrink-0" style={{ background: B.light }}>
            <FolderOpen className="w-4 h-4" style={{ color: B.primary }}/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Reports Library</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {savedReports.length > 0
                ? `${savedReports.length} saved report${savedReports.length !== 1 ? 's' : ''} — click to open without regenerating`
                : 'Generated reports are automatically saved here'}
            </p>
          </div>
          {libraryLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0"/>}
          {libraryOpen
            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0"/>
            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0"/>}
        </button>

        {libraryOpen && (
          <div className="border-t border-slate-100">
            {savedReports.length === 0 && !libraryLoading ? (
              <div className="py-10 text-center">
                <FolderOpen className="w-9 h-9 text-slate-200 mx-auto mb-2.5"/>
                <p className="text-sm font-medium text-slate-400">No reports saved yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Generate a report to save it here automatically</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientFolders.map(folder => {
                  const isOpen = expandedClients.has(folder.client_id)
                  return (
                    <div key={folder.client_id}>
                      {/* Folder header */}
                      <button
                        onClick={() => toggleFolder(folder.client_id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                      >
                        <Folder className="w-4 h-4 shrink-0" style={{ color: B.accent }}/>
                        <span className="text-sm font-semibold text-slate-800 flex-1">
                          {folder.client_name} — Reports
                        </span>
                        <span className="text-xs text-slate-400 mr-2 font-medium">
                          {folder.reports.length}
                        </span>
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                      </button>

                      {/* Report rows */}
                      {isOpen && (
                        <div className="px-5 pb-2">
                          <div className="pl-7 space-y-0.5">
                            {folder.reports.map(report => (
                              <div
                                key={report.id}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 group transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 leading-tight">{report.period}</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Saved {formatReportDate(report.generated_at)}
                                    {report.preview.reach > 0 && (
                                      <> · <span className="text-slate-500">{formatNumber(report.preview.reach)} reach</span></>
                                    )}
                                    {report.preview.likes > 0 && (
                                      <> · <span className="text-slate-500">{formatNumber(report.preview.likes)} likes</span></>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => loadSavedReport(report)}
                                    disabled={loadingReportId === report.id}
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                                    style={{ background: B.light, color: B.primary }}
                                  >
                                    {loadingReportId === report.id
                                      ? <><RefreshCw className="w-3 h-3 animate-spin"/> Loading…</>
                                      : 'Open'}
                                  </button>
                                  <button
                                    onClick={(e) => deleteSavedReport(report.id, e)}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                                    title="Delete this report"
                                  >
                                    <Trash2 className="w-3.5 h-3.5"/>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      {generated && dataError ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-amber-200">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-amber-50">
            <AlertCircle className="w-7 h-7 text-amber-500"/>
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">Data not available</h3>
          <p className="text-sm text-slate-500 text-center max-w-md leading-relaxed">{dataError}</p>
        </div>
      ) : generated ? (
        <div id="printable-report">
          <MasterMonthlyReport
            client={clientName}
            period={period}
            logoUrl={reportLogoUrl}
            liveStats={liveStats}
            prevStats={prevStats}
            livePlatforms={livePlatforms}
            liveTrend={liveTrend}
            topPostGroups={topPostGroups}
            aiReport={aiReport}
            language={language}
            adCampaigns={includePaidAds && adCampaigns.some(c => c.spend) ? adCampaigns.filter(c => c.spend) : null}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: B.light }}>
            <BarChart2 className="w-8 h-8" style={{ color: B.primary }}/>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Monthly Performance Report</h3>
          <p className="text-sm text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
            {selectedClient
              ? 'Select a period above and click Generate Report to build your report.'
              : 'Select a client and period above, then click Generate Report.'}
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
