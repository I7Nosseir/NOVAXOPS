'use client'

import { Zap, Wand2, Brain, Target, AlertCircle, Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudioSession } from '@/lib/studio-types'

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface StudioSessionListProps {
  sessions: StudioSession[]
  onSessionClick: (session: StudioSession) => void
  onNewSession: () => void
  isLoading?: boolean
}

// ─── Tool config ──────────────────────────────────────────────────────────────

const TOOL_CONFIG: Record<
  StudioSession['tool'],
  { icon: React.ElementType; label: string }
> = {
  content:   { icon: Zap,        label: 'Content Studio'    },
  hooks:     { icon: Wand2,      label: 'Hook Lab'          },
  strategy:  { icon: Brain,      label: 'Strategy'          },
  campaign:  { icon: Target,     label: 'Campaign Igniter'  },
  postmortem:{ icon: AlertCircle,label: 'Post-Mortem'       },
  intel:     { icon: AlertCircle,label: 'Intelligence'      },
  trends:    { icon: Zap,        label: 'Trends'            },
  ads:       { icon: Target,     label: 'Ads'               },
  repurpose: { icon: RefreshCw,  label: 'Repurpose'         },
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  StudioSession['status'],
  { bg: string; text: string; label: string }
> = {
  running: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Running' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
  complete: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Complete' },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
}

// ─── Performance badge ────────────────────────────────────────────────────────

const PERFORMANCE_STYLES: Record<
  NonNullable<StudioSession['performance_verdict']>,
  { bg: string; text: string; label: string }
> = {
  exceeded: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    label: '↑ Exceeded avg',
  },
  met: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'Met average',
  },
  below: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: '↓ Below avg',
  },
  significantly_below: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: '↓ Below avg',
  },
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-slate-100 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 bg-slate-100 rounded-full w-1/2" />
        <div className="h-2.5 bg-slate-100 rounded-full w-1/3" />
      </div>
      <div className="h-5 w-16 bg-slate-100 rounded-full shrink-0" />
    </div>
  )
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onClick,
}: {
  session: StudioSession
  onClick: () => void
}) {
  const toolCfg = TOOL_CONFIG[session.tool] ?? TOOL_CONFIG.content
  const Icon = toolCfg.icon
  const statusCfg = STATUS_STYLES[session.status] ?? STATUS_STYLES.complete
  const perfCfg = session.performance_verdict
    ? PERFORMANCE_STYLES[session.performance_verdict]
    : null

  // Format created_at to relative or readable date
  const dateLabel = session.created_at
    ? formatRelativeDate(session.created_at)
    : null

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-slate-50 cursor-pointer text-left transition-colors group"
    >
      {/* Tool icon */}
      <div className="bg-novax-light rounded-lg p-2 shrink-0 group-hover:bg-novax-light-hover transition-colors">
        <Icon className="w-4 h-4 text-novax" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {session.name}
          </span>
          {session.client_id && (
            <span className="text-[10px] bg-novax-light text-novax-muted rounded-full px-2 py-0.5 shrink-0">
              Client
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400">{toolCfg.label}</span>
          {dateLabel && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-xs text-slate-400">{dateLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            'text-[10px] font-semibold rounded-full px-2 py-0.5',
            statusCfg.bg,
            statusCfg.text,
          )}
        >
          {statusCfg.label}
        </span>
        {perfCfg && (
          <span
            className={cn(
              'text-[10px] font-semibold rounded-full px-2 py-0.5',
              perfCfg.bg,
              perfCfg.text,
            )}
          >
            {perfCfg.label}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
}: {
  session: StudioSession
  onClick: () => void
}) {
  const toolCfg = TOOL_CONFIG[session.tool] ?? TOOL_CONFIG.content
  const Icon = toolCfg.icon
  const statusCfg = STATUS_STYLES[session.status] ?? STATUS_STYLES.complete
  const perfCfg = session.performance_verdict
    ? PERFORMANCE_STYLES[session.performance_verdict]
    : null
  const dateLabel = session.created_at
    ? formatRelativeDate(session.created_at)
    : null

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-novax-border hover:shadow-md text-left transition-all"
    >
      <div className="bg-novax-light rounded-lg p-2 shrink-0">
        <Icon className="w-4 h-4 text-novax" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {session.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{toolCfg.label}</p>
        {dateLabel && (
          <p className="text-xs text-slate-400">{dateLabel}</p>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span
            className={cn(
              'text-[10px] font-semibold rounded-full px-2 py-0.5',
              statusCfg.bg,
              statusCfg.text,
            )}
          >
            {statusCfg.label}
          </span>
          {perfCfg && (
            <span
              className={cn(
                'text-[10px] font-semibold rounded-full px-2 py-0.5',
                perfCfg.bg,
                perfCfg.text,
              )}
            >
              {perfCfg.label}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StudioSessionList({
  sessions,
  onSessionClick,
  onNewSession,
  isLoading = false,
}: StudioSessionListProps) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Recent Sessions
        </span>
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 text-xs text-novax font-medium hover:text-novax-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Session
        </button>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="divide-y divide-slate-100">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-slate-500 mb-4">No sessions yet</p>
          <button
            onClick={onNewSession}
            className="flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" />
            Start first session
          </button>
        </div>
      )}

      {/* Desktop row list (hidden on mobile) */}
      {!isLoading && sessions.length > 0 && (
        <>
          {/* Desktop */}
          <div className="hidden sm:block divide-y divide-slate-100">
            {sessions.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session)}
              />
            ))}
          </div>

          {/* Mobile card stack */}
          <div className="sm:hidden space-y-3">
            {sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}
