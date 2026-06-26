import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer, Font,
} from '@react-pdf/renderer'

// Register Cairo (Arabic + Latin) so Arabic narrative text renders correctly.
// Cairo is served directly from jsDelivr — no build-time download needed.
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5/files/cairo-arabic-400-normal.woff2', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5/files/cairo-arabic-700-normal.woff2', fontWeight: 700 },
  ],
})

function hasArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformRow {
  platform: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  posts: number
  engagement_rate: number
}

interface TrendPoint {
  month: string
  reach: number
  impressions: number
  er: number
}

interface AIReportNarrative {
  executive?: string
  reach?: string
  engagement?: string
  platform?: string
  trend?: string
  audience?: string
  follower?: string
  formats?: string
  synergy?: string
  channel?: string
  quarterly_overview?: string
  monthly_breakdown?: string
  highlights?: string
  portfolio?: string
}

interface ExportBody {
  tab?: string
  clientName?: string
  period?: string
  stats?: Record<string, number>
  prevStats?: Record<string, number>
  platforms?: PlatformRow[]
  trend?: TrendPoint[]
  narrative?: AIReportNarrative
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const P = {
  primary:  '#1B3D38',
  muted:    '#2A6B62',
  accent:   '#5BB4AE',
  border:   '#9DCCC8',
  light:    '#EBF4F3',
  white:    '#FFFFFF',
  slate900: '#0F172A',
  slate700: '#334155',
  slate500: '#64748B',
  slate300: '#CBD5E1',
  slate100: '#F1F5F9',
  emerald:  '#059669',
  red:      '#DC2626',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  linkedin:  '#0A66C2',
  tiktok:    '#2A2A2A',
  twitter:   '#1DA1F2',
  youtube:   '#FF0000',
}

const TAB_LABELS: Record<string, string> = {
  monthly:   'Monthly Performance Report',
  paid:      'Paid Media Report',
  combined:  'Paid + Organic Report',
  platform:  'Platform Deep Dive',
  quarterly: 'Quarterly Report',
  executive: 'Executive Summary',
  ai:        'AI Report',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

function deltaStr(cur?: number, prv?: number): string {
  if (cur == null || prv == null || prv === 0) return ''
  const pct = ((cur - prv) / prv * 100).toFixed(1)
  return `${Number(pct) >= 0 ? '+' : ''}${pct}%`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: P.white,
    paddingBottom: 40,
  },

  // Cover
  cover: {
    backgroundColor: P.primary,
    padding: 40,
    minHeight: 200,
  },
  coverAccentBar: {
    height: 3,
    backgroundColor: P.accent,
  },
  coverLogo: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: P.white,
    letterSpacing: 1,
  },
  coverSub: {
    fontSize: 7,
    color: P.accent,
    letterSpacing: 2,
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  coverDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 14,
  },
  coverTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: P.white,
    lineHeight: 1.3,
  },
  coverSubtitle: {
    fontSize: 9,
    color: P.border,
    marginTop: 3,
  },
  coverClient: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: P.white,
  },
  coverPeriod: {
    fontSize: 9,
    color: P.border,
    marginTop: 3,
  },
  coverConfidential: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 6,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  sectionBar: {
    width: 3,
    height: 16,
    backgroundColor: P.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: P.slate900,
  },
  sectionSubtitle: {
    fontSize: 8,
    color: P.slate500,
    marginTop: 1,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  kpiCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: P.light,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: P.border,
    padding: 12,
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: P.slate900,
    lineHeight: 1.1,
  },
  kpiLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: P.muted,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiDelta: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  // Platform table
  table: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.slate300,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: P.light,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: P.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: P.slate100,
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    fontSize: 9,
    color: P.slate700,
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: P.slate900,
  },

  // Platform colour dot
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
    marginTop: 1,
  },

  // Progress bar
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: P.slate100,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },

  // Trend table
  trendTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: P.slate300,
    overflow: 'hidden',
  },

  // AI narrative
  narrativeSection: {
    marginBottom: 12,
  },
  narrativeHeading: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: P.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  narrativeText: {
    fontSize: 9,
    color: P.slate700,
    lineHeight: 1.65,
  },

  // Content padding wrapper
  body: {
    paddingHorizontal: 32,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: P.slate300,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: P.slate500,
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: P.primary,
  },

  // Info banner
  infoBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  infoBannerText: {
    fontSize: 8,
    color: '#92400E',
    lineHeight: 1.5,
  },
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    React.createElement(View, { style: s.sectionHeader },
      React.createElement(View, { style: s.sectionBar }),
      React.createElement(View, null,
        React.createElement(Text, { style: s.sectionTitle }, title),
        subtitle ? React.createElement(Text, { style: s.sectionSubtitle }, subtitle) : null,
      ),
    )
  )
}

function KPIGrid({ stats, prevStats }: { stats?: Record<string, number>; prevStats?: Record<string, number> }) {
  const kpis = [
    { label: 'Total Reach',       key: 'reach',           format: (v: number) => fmt(v) },
    { label: 'Avg Engagement',    key: 'engagement_rate', format: (v: number) => `${Number(v).toFixed(1)}%` },
    { label: 'Total Impressions', key: 'impressions',     format: (v: number) => fmt(v) },
    { label: 'Posts Published',   key: 'posts',           format: (v: number) => String(Math.round(v)) },
  ]
  return React.createElement(View, { style: s.kpiGrid },
    ...kpis.map(({ label, key, format }) => {
      const val = stats?.[key]
      const prv = prevStats?.[key]
      const delta = deltaStr(val, prv)
      const isPos = val != null && prv != null && prv > 0 ? val >= prv : null
      return React.createElement(View, { key: label, style: s.kpiCard },
        React.createElement(Text, { style: s.kpiValue }, val != null ? format(val) : '—'),
        React.createElement(Text, { style: s.kpiLabel }, label),
        delta ? React.createElement(Text, {
          style: [s.kpiDelta, { backgroundColor: isPos ? '#D1FAE5' : '#FEE2E2', color: isPos ? P.emerald : P.red }],
        }, delta) : null,
      )
    })
  )
}

function PlatformTable({ platforms }: { platforms: PlatformRow[] }) {
  const maxReach = platforms.length > 0 ? Math.max(...platforms.map(p => p.reach), 1) : 1
  const cols = [
    { label: 'Platform',    w: '22%' },
    { label: 'Reach',       w: '14%' },
    { label: 'Impressions', w: '17%' },
    { label: 'Eng. Rate',   w: '14%' },
    { label: 'Posts',       w: '10%' },
    { label: 'Saves',       w: '10%' },
    { label: 'Comments',    w: '13%' },
  ]
  return React.createElement(View, { style: s.table },
    // Header
    React.createElement(View, { style: s.tableHeader },
      ...cols.map(c =>
        React.createElement(Text, { key: c.label, style: [s.tableHeaderCell, { width: c.w }] }, c.label)
      )
    ),
    // Rows
    ...platforms.map((p, i) => {
      const color = PLATFORM_COLORS[p.platform] ?? '#94a3b8'
      const pct = Math.round((p.reach / maxReach) * 100)
      return React.createElement(View, { key: p.platform, style: [s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}] },
        // Platform name with dot
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', width: '22%' } },
          React.createElement(View, { style: [s.dot, { backgroundColor: color }] }),
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: s.tableCellBold }, cap(p.platform)),
            // mini bar
            React.createElement(View, { style: [s.barTrack, { marginHorizontal: 0, marginTop: 3 }] },
              React.createElement(View, { style: [s.barFill, { width: `${pct}%`, backgroundColor: color }] })
            ),
          )
        ),
        React.createElement(Text, { style: [s.tableCellBold, { width: '14%' }] }, fmt(p.reach)),
        React.createElement(Text, { style: [s.tableCell,     { width: '17%' }] }, fmt(p.impressions)),
        React.createElement(Text, { style: [s.tableCellBold, { width: '14%', color: P.primary }] }, `${Number(p.engagement_rate).toFixed(1)}%`),
        React.createElement(Text, { style: [s.tableCell,     { width: '10%' }] }, String(p.posts)),
        React.createElement(Text, { style: [s.tableCell,     { width: '10%' }] }, p.saves > 0 ? fmt(p.saves) : '—'),
        React.createElement(Text, { style: [s.tableCell,     { width: '13%' }] }, p.comments > 0 ? fmt(p.comments) : '—'),
      )
    })
  )
}

function TrendTable({ trend }: { trend: TrendPoint[] }) {
  return React.createElement(View, { style: s.trendTable },
    React.createElement(View, { style: s.tableHeader },
      React.createElement(Text, { style: [s.tableHeaderCell, { width: '25%' }] }, 'Month'),
      React.createElement(Text, { style: [s.tableHeaderCell, { width: '35%' }] }, 'Reach'),
      React.createElement(Text, { style: [s.tableHeaderCell, { width: '25%' }] }, 'Impressions'),
      React.createElement(Text, { style: [s.tableHeaderCell, { width: '15%' }] }, 'ER %'),
    ),
    ...trend.map((t, i) =>
      React.createElement(View, { key: t.month, style: [s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}] },
        React.createElement(Text, { style: [s.tableCellBold, { width: '25%' }] }, t.month),
        React.createElement(Text, { style: [s.tableCell,     { width: '35%' }] }, fmt(t.reach)),
        React.createElement(Text, { style: [s.tableCell,     { width: '25%' }] }, fmt(t.impressions)),
        React.createElement(Text, { style: [s.tableCell,     { width: '15%', color: P.primary, fontFamily: 'Helvetica-Bold' }] }, `${Number(t.er).toFixed(1)}%`),
      )
    )
  )
}

const NARRATIVE_LABELS: Record<string, string> = {
  executive:          'Executive Summary',
  reach:              'Reach & Impressions',
  engagement:         'Engagement Analysis',
  platform:           'Platform Performance',
  trend:              'Trend Analysis',
  audience:           'Audience Insights',
  follower:           'Follower Growth',
  formats:            'Content Formats',
  synergy:            'Paid vs Organic Synergy',
  channel:            'Channel Mix',
  quarterly_overview: 'Quarterly Overview',
  monthly_breakdown:  'Month-by-Month Breakdown',
  highlights:         'Performance Highlights',
  portfolio:          'Portfolio Overview',
}

function AISection({ narrative }: { narrative: AIReportNarrative }) {
  const entries = Object.entries(narrative).filter(([, v]) => v?.trim())
  if (entries.length === 0) return null
  return React.createElement(View, null,
    ...entries.map(([key, text]) => {
      const isAr = hasArabic(text!)
      const textStyle = isAr
        ? [s.narrativeText, { fontFamily: 'Cairo', textAlign: 'right' as const, direction: 'rtl' as const }]
        : s.narrativeText
      return React.createElement(View, { key, style: s.narrativeSection },
        React.createElement(Text, { style: s.narrativeHeading }, NARRATIVE_LABELS[key] ?? key),
        React.createElement(Text, { style: textStyle }, text!.replace(/\*\*/g, '')),
      )
    })
  )
}

// ─── Main PDF document ────────────────────────────────────────────────────────

function ReportDocument({
  tab,
  clientName,
  period,
  stats,
  prevStats,
  platforms,
  trend,
  narrative,
}: ExportBody) {
  const title = TAB_LABELS[tab ?? 'monthly'] ?? 'Report'
  const hasStats     = stats && Object.values(stats).some(v => Number(v) > 0)
  const hasPlatforms = (platforms ?? []).filter(p => p.reach > 0 || p.impressions > 0).length > 0
  const hasTrend     = (trend ?? []).some(t => t.reach > 0 || t.er > 0)
  const hasNarrative = narrative && Object.values(narrative).some(v => v?.trim())
  const activePlatforms = (platforms ?? []).filter(p => p.reach > 0 || p.impressions > 0)
  const activeTrend     = (trend ?? []).filter(t => t.reach > 0 || t.er > 0)

  const isPaid     = tab === 'paid' || tab === 'combined'
  const isQuarterly = tab === 'quarterly'

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },

      // ── Cover / header ──────────────────────────────────────────────────────
      React.createElement(View, { style: s.cover },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
            React.createElement(View, null,
              React.createElement(Text, { style: s.coverLogo }, 'NOVAX'),
              React.createElement(Text, { style: s.coverSub }, 'OPS PLATFORM'),
            ),
            React.createElement(View, { style: s.coverDivider }),
            React.createElement(View, null,
              React.createElement(Text, { style: s.coverTitle }, title),
              React.createElement(Text, { style: s.coverSubtitle }, 'Prepared by NOVAX · Confidential'),
            ),
          ),
          React.createElement(View, { style: { alignItems: 'flex-end' } },
            React.createElement(Text, { style: s.coverClient }, clientName ?? 'Client'),
            React.createElement(Text, { style: s.coverPeriod }, period ?? ''),
            React.createElement(Text, { style: s.coverConfidential }, 'Not for external distribution'),
          ),
        ),
      ),
      React.createElement(View, { style: s.coverAccentBar }),

      // ── Body ────────────────────────────────────────────────────────────────
      React.createElement(View, { style: s.body },

        // Paid info banner
        isPaid ? React.createElement(View, { style: [s.infoBanner, { marginTop: 18 }] },
          React.createElement(Text, { style: s.infoBannerText },
            'Paid campaign metrics (spend, ROAS, CPC) are sourced from ad platforms and are not available via the scheduling platform. ' +
            'The metrics below reflect organic performance as a baseline for paid amplification decisions.'
          )
        ) : null,

        // KPIs
        hasStats ? React.createElement(View, null,
          React.createElement(SectionHeader, { title: 'Key Performance Indicators', subtitle: `${period ?? ''} vs prior ${isQuarterly ? 'quarter' : 'month'}` }),
          React.createElement(KPIGrid, { stats: stats!, prevStats }),
        ) : null,

        // Platform breakdown
        hasPlatforms ? React.createElement(View, null,
          React.createElement(SectionHeader, { title: 'Platform Performance', subtitle: 'Reach, impressions, engagement rate, and posts per channel' }),
          React.createElement(PlatformTable, { platforms: activePlatforms }),
        ) : null,

        // Trend
        hasTrend ? React.createElement(View, null,
          React.createElement(SectionHeader, { title: isQuarterly ? 'Quarter Trend' : '5-Month Trend', subtitle: 'Monthly reach, impressions, and engagement rate' }),
          React.createElement(TrendTable, { trend: activeTrend }),
        ) : null,

        // AI narrative
        hasNarrative ? React.createElement(View, null,
          React.createElement(SectionHeader, { title: 'AI Performance Analysis', subtitle: 'AI-generated interpretation of the data above' }),
          React.createElement(AISection, { narrative: narrative! }),
        ) : null,
      ),

      // ── Footer ──────────────────────────────────────────────────────────────
      React.createElement(View, { style: s.footer, fixed: true },
        React.createElement(Text, { style: s.footerBrand }, 'NOVAX'),
        React.createElement(Text, { style: s.footerText }, `${title} · ${clientName ?? 'Client'} · ${period ?? ''}`),
      ),
    )
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ExportBody
  try {
    body = await req.json() as ExportBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(ReportDocument, body) as any

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const slug = (body.clientName ?? 'Report').replace(/\s+/g, '_')
  const filename = `NOVAX_${slug}_${body.tab ?? 'report'}_${(body.period ?? '').replace(/\s+/g, '_')}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
