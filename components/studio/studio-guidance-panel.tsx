'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuidanceItem {
  term: string
  definition: string
}

interface GuidanceTip {
  label: string
  tip: string
}

interface StudioGuidancePanelProps {
  title?: string
  description?: string
  items?: GuidanceItem[]
  tips?: GuidanceTip[]
  defaultOpen?: boolean
}

export function StudioGuidancePanel({
  title = 'How this works',
  description,
  items = [],
  tips = [],
  defaultOpen = false,
}: StudioGuidancePanelProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (items.length === 0 && tips.length === 0 && !description) return null

  return (
    <div className="border border-novax-border/60 rounded-xl overflow-hidden bg-novax-light/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-novax-light/50 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5 text-novax-muted shrink-0" />
        <span className="flex-1 text-[11px] font-semibold text-novax-muted uppercase tracking-wider">{title}</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-novax-muted shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-novax-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-novax-border/40">
          {description && (
            <p className="text-xs text-slate-600 leading-relaxed pt-3">{description}</p>
          )}

          {items.length > 0 && (
            <div className={cn('grid gap-3', items.length > 3 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
              {items.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 w-1 h-1 rounded-full bg-novax-accent shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-slate-700">{item.term}</span>
                    <span className="text-[11px] text-slate-400 mx-1">—</span>
                    <span className="text-[11px] text-slate-500 leading-relaxed">{item.definition}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tips.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-novax-border/30">
              {tips.map((tip, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="text-[10px] font-bold text-novax-accent uppercase tracking-wide shrink-0 mt-0.5 min-w-[60px]">{tip.label}</span>
                  <span className="text-[11px] text-slate-500 leading-relaxed">{tip.tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
