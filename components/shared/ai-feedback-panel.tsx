'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AIFeedbackPanelProps {
  score?: number
  verdict?: string
  items?: string[]
  suggestions?: string[]
  itemsLabel?: string
  suggestionsLabel?: string
  onUseSuggestion?: (text: string) => void
  loading?: boolean
  className?: string
  autoExpand?: boolean
}

function scoreColors(score: number) {
  if (score >= 8) return { text: 'text-emerald-700', bg: 'bg-emerald-50',   border: 'border-emerald-200' }
  if (score >= 6) return { text: 'text-novax',        bg: 'bg-novax-light', border: 'border-novax-border' }
  if (score >= 4) return { text: 'text-amber-700',    bg: 'bg-amber-50',    border: 'border-amber-200' }
  return               { text: 'text-red-700',        bg: 'bg-red-50',      border: 'border-red-200' }
}

export function AIFeedbackPanel({
  score,
  verdict,
  items = [],
  suggestions = [],
  itemsLabel = 'Issues',
  suggestionsLabel = 'Rewrites',
  onUseSuggestion,
  loading,
  className,
  autoExpand,
}: AIFeedbackPanelProps) {
  const [expanded, setExpanded] = useState(autoExpand ?? (score !== undefined && score < 6))

  if (loading) {
    return (
      <div className={cn('mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 flex items-center gap-2', className)}>
        <Loader2 className="w-3.5 h-3.5 text-novax-muted animate-spin shrink-0" />
        <span className="text-xs text-slate-500">Reviewing…</span>
      </div>
    )
  }

  if (!score && !verdict && !items.length && !suggestions.length) return null

  const colors = score !== undefined ? scoreColors(score) : { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' }
  const hasDetails = items.length > 0 || suggestions.length > 0

  return (
    <div className={cn('mt-2 rounded-xl border bg-white overflow-hidden', colors.border, className)}>
      {/* Header row: score badge + verdict + toggle */}
      <div
        className={cn('flex items-center gap-2.5 px-3 py-2.5', hasDetails && 'cursor-pointer select-none')}
        onClick={() => hasDetails && setExpanded(v => !v)}
      >
        {score !== undefined && (
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 tabular-nums', colors.text, colors.bg)}>
            {score}/10
          </span>
        )}
        {verdict && (
          <p className="flex-1 text-xs text-slate-600 leading-snug">{verdict}</p>
        )}
        {hasDetails && (
          <span className="shrink-0 text-slate-400">
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3">
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{itemsLabel}</p>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 leading-snug">
                    <span className="text-red-400 shrink-0 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{suggestionsLabel}</p>
              <div className="space-y-2">
                {suggestions.map((sug, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{sug}</p>
                    {onUseSuggestion && (
                      <button
                        onClick={e => { e.stopPropagation(); onUseSuggestion(sug) }}
                        className="mt-1.5 text-[10px] font-semibold text-novax hover:text-novax-hover transition-colors"
                      >
                        Use this
                      </button>
                    )}
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
