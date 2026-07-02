'use client'

import { useState } from 'react'
import {
  X, FileDown, Layout, Square, AlignJustify, Moon, Sun, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: 'pdf' | 'pptx'
  size:   'A4' | 'LETTER'
  theme:  'brand' | 'light'
}

export interface ExportFormatModalConfig {
  title?:          string
  subtitle?:       string
  supportsPptx?:   boolean
  defaultFormat?:  'pdf' | 'pptx'
  hideTheme?:      boolean
}

export interface ExportFormatModalProps {
  open:      boolean
  onClose:   () => void
  onExport:  (options: ExportOptions) => void | Promise<void>
  config?:   ExportFormatModalConfig
  exporting?: boolean
}

// ── Internal tile component ───────────────────────────────────────────────────

function Tile({
  selected, onClick, icon: Icon, label, desc,
}: {
  selected: boolean
  onClick:  () => void
  icon:     React.ElementType
  label:    string
  desc?:    string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all w-full',
        selected
          ? 'border-novax bg-novax-light'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <div className={cn(
        'mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
        selected ? 'bg-novax text-white' : 'bg-slate-100 text-slate-400',
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-sm font-semibold transition-colors',
          selected ? 'text-novax' : 'text-slate-800',
        )}>{label}</p>
        {desc && (
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
        )}
      </div>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ExportFormatModal({
  open,
  onClose,
  onExport,
  config = {},
  exporting = false,
}: ExportFormatModalProps) {
  const {
    title         = 'Export Document',
    subtitle,
    supportsPptx  = false,
    defaultFormat = 'pdf',
    hideTheme     = false,
  } = config

  const [format, setFormat] = useState<'pdf' | 'pptx'>(defaultFormat)
  const [size,   setSize]   = useState<'A4' | 'LETTER'>('A4')
  const [theme,  setTheme]  = useState<'brand' | 'light'>('brand')

  if (!open) return null

  const isPdf = format === 'pdf' || !supportsPptx

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Format — only when PPTX is supported */}
          {supportsPptx && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Format
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Tile
                  selected={format === 'pdf'}
                  onClick={() => setFormat('pdf')}
                  icon={FileDown}
                  label="PDF"
                  desc="Best for sharing & client delivery"
                />
                <Tile
                  selected={format === 'pptx'}
                  onClick={() => setFormat('pptx')}
                  icon={Layout}
                  label="PowerPoint"
                  desc="Editable slides (PPTX)"
                />
              </div>
            </div>
          )}

          {/* Paper size — PDF only */}
          {isPdf && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Paper Size
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Tile
                  selected={size === 'A4'}
                  onClick={() => setSize('A4')}
                  icon={Square}
                  label="A4"
                  desc="International standard (210 × 297 mm)"
                />
                <Tile
                  selected={size === 'LETTER'}
                  onClick={() => setSize('LETTER')}
                  icon={AlignJustify}
                  label="US Letter"
                  desc="North America (216 × 279 mm)"
                />
              </div>
            </div>
          )}

          {/* Style — PDF only, unless hideTheme */}
          {isPdf && !hideTheme && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Style
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Tile
                  selected={theme === 'brand'}
                  onClick={() => setTheme('brand')}
                  icon={Moon}
                  label="Brand"
                  desc="Dark cover with NOVAX teal accents"
                />
                <Tile
                  selected={theme === 'light'}
                  onClick={() => setTheme('light')}
                  icon={Sun}
                  label="Clean Light"
                  desc="All-white, minimal, print-friendly"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onExport({ format, size, theme })}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              `Download ${format === 'pptx' ? 'PPTX' : 'PDF'}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
