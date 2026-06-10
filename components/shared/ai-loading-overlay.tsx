'use client'

import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'

/**
 * Full-screen fixed overlay shown during any AI generation call.
 * Renders via a portal so it sits above the sidebar and header.
 *
 * Usage:
 *   {isGenerating && <AILoadingOverlay message="Generating pattern intelligence…" />}
 */
export function AILoadingOverlay({ message = 'Thinking…', sub }: { message?: string; sub?: string }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'rgba(7,16,15,0.82)', backdropFilter: 'blur(6px)' }}>
      {/* Logo mark */}
      <div className="mb-6 select-none">
        <p className="text-2xl font-black tracking-[0.18em]" style={{ color: '#5BB4AE' }}>NOVAX</p>
      </div>

      {/* Spinner */}
      <div className="relative mb-5">
        <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-[#5BB4AE] animate-spin" />
        <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-[#5BB4AE] opacity-0" aria-hidden />
      </div>

      {/* Message */}
      <p className="text-sm font-medium text-white/80 text-center max-w-xs leading-relaxed">{message}</p>
      {sub && <p className="text-xs text-white/40 mt-1 text-center">{sub}</p>}
    </div>,
    document.body,
  )
}
