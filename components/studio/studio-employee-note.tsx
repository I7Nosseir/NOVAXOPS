'use client'

import { useState } from 'react'
import { Lightbulb, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  what: string
  why: string
  defaultOpen?: boolean
}

export function StudioEmployeeNote({ what, why, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-novax-border bg-novax-light rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-novax-muted shrink-0" />
          <span className="text-xs font-semibold text-novax-muted">What I did &amp; why</span>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-novax-muted transition-transform duration-150', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-novax-border">
          <div className="pt-3">
            <p className="text-[10px] font-bold text-novax uppercase tracking-wider mb-1">What I did</p>
            <p className="text-xs text-slate-700 leading-relaxed">{what}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-novax-muted uppercase tracking-wider mb-1">Why</p>
            <p className="text-xs text-slate-600 leading-relaxed">{why}</p>
          </div>
        </div>
      )}
    </div>
  )
}
