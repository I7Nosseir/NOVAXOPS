'use client'

import { useState } from 'react'
import { ExternalLink, X, Copy, Check, ChevronDown, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspirationBoardItem } from '@/app/api/studio/inspiration/route'
import type { Client } from '@/lib/types'

// ── Platform dot colors ───────────────────────────────────────

const PLATFORM_DOT: Record<string, string> = {
  youtube:   'bg-red-500',
  tiktok:    'bg-slate-900',
  reddit:    'bg-orange-500',
  trendsmcp: 'bg-teal-500',
}

// ── Props ─────────────────────────────────────────────────────

export interface InspirationBoardPanelProps {
  clientId:        string | null   // 'personal' | client UUID | null (none selected)
  savedItems:      InspirationBoardItem[]
  onRemove:        (id: string) => void
  onClientChange:  (clientId: string) => void
  clients:         Client[]
}

// ── Component ─────────────────────────────────────────────────

export function InspirationBoardPanel({
  clientId,
  savedItems,
  onRemove,
  onClientChange,
  clients,
}: InspirationBoardPanelProps) {
  const [copiedId,    setCopiedId]    = useState<string | null>(null)
  const [selectOpen,  setSelectOpen]  = useState(false)

  const isPersonal     = clientId === 'personal'
  const selectedClient = isPersonal ? null : (clients.find(c => c.id === clientId) ?? null)

  const filtered = clientId
    ? isPersonal
      ? savedItems.filter(i => i.client_id == null)
      : savedItems.filter(i => i.client_id === clientId)
    : []

  async function handleCopyBrief(item: InspirationBoardItem) {
    const text = `${item.title}\n${item.url}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard may not be available in all contexts
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Inspiration Board</p>

        {/* Client selector */}
        <div className="relative">
          <button
            onClick={() => setSelectOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors"
          >
            {isPersonal ? (
              <>
                <User className="w-3 h-3 text-novax-muted shrink-0" />
                <span className="text-novax font-medium">My Library</span>
              </>
            ) : selectedClient ? (
              <>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedClient.color }}
                />
                <span className="max-w-[100px] truncate">{selectedClient.name}</span>
              </>
            ) : (
              <span className="text-slate-400">Select board</span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {selectOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
              {/* Personal library option */}
              <button
                onClick={() => { onClientChange('personal'); setSelectOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors border-b border-slate-100',
                  clientId === 'personal' ? 'text-novax font-semibold' : 'text-slate-700',
                )}
              >
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                My Personal Library
              </button>
              {clients.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onClientChange(c.id); setSelectOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors',
                    c.id === clientId ? 'text-novax font-semibold' : 'text-slate-700',
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {!clientId ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-slate-400 italic text-center leading-relaxed">
            Select a board to save inspiration
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-1">
          <p className="text-sm text-slate-500 font-medium">Nothing saved yet</p>
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            Star items in the feed to add them here
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {filtered.map(item => (
            <div key={item.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
              {/* Platform dot */}
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0 mt-1.5',
                  PLATFORM_DOT[item.platform] ?? 'bg-slate-300',
                )}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 line-clamp-1">{item.title}</p>
                {item.notes && (
                  <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{item.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open link"
                  className="p-1 rounded-md text-slate-400 hover:text-novax-muted hover:bg-novax-light transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove"
                  className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add to brief button */}
      {filtered.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => handleCopyBrief(item)}
              className={cn(
                'w-full flex items-center justify-between text-xs rounded-lg px-3 py-2 transition-colors mb-1 last:mb-0',
                copiedId === item.id
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-novax-light hover:border-novax-border hover:text-novax',
              )}
            >
              <span className="truncate max-w-[160px]">{item.title}</span>
              {copiedId === item.id ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0 opacity-50" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
