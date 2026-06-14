'use client'

import { useState } from 'react'
import { X, Shield, CheckCircle, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAGE_DEFS, ALL_PAGE_KEYS, PAGE_GROUPS, type PageKey } from '@/lib/page-permissions'
import type { User } from '@/lib/types'

// The 13-page standard access template matching the screenshot
const STANDARD_TEMPLATE: PageKey[] = [
  'clients', 'projects', 'publishing', 'approval',
  'assets', 'ai-image', 'creative-eval', 'docs', 'strategy-eval',
  'assistant', 'workload', 'library', 'reports',
]

interface Props {
  selectedUsers: User[]
  onClose: () => void
  onApplied: () => void
}

export function BulkPermissionsPanel({ selectedUsers, onClose, onApplied }: Props) {
  const [pages, setPages] = useState<PageKey[]>([...STANDARD_TEMPLATE])
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  const allSelected = pages.length === ALL_PAGE_KEYS.length

  const togglePage = (key: PageKey) => {
    setPages(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const apply = async () => {
    setApplying(true)
    try {
      const res = await fetch('/api/users/bulk-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedUsers.map(u => u.id),
          page_permissions: allSelected ? null : pages,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) {
        setDone(true)
        setTimeout(() => { onApplied(); onClose() }, 1200)
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">Set Page Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Applying to <strong className="text-slate-700">{selectedUsers.length}</strong> team member{selectedUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10">
            <div className="w-12 h-12 rounded-full bg-novax-light flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-novax" />
            </div>
            <p className="font-semibold text-slate-900">Access updated</p>
            <p className="text-sm text-slate-500 text-center">
              {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} now have {pages.length} of {ALL_PAGE_KEYS.length} optional pages enabled.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

              {/* Affected users */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Applying to</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: u.color }}>
                        {u.initials}
                      </div>
                      <span className="text-xs text-slate-700 font-medium">{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template quick-select */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPages([...STANDARD_TEMPLATE])}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg border transition-all',
                    pages.length === STANDARD_TEMPLATE.length && STANDARD_TEMPLATE.every(k => pages.includes(k)) && !allSelected
                      ? 'border-novax bg-novax-light text-novax'
                      : 'border-slate-200 text-slate-600 hover:border-novax-border',
                  )}
                >
                  Standard (13 pages)
                </button>
                <button
                  onClick={() => setPages([...ALL_PAGE_KEYS])}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg border transition-all',
                    allSelected ? 'border-novax bg-novax-light text-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border',
                  )}
                >
                  Full access
                </button>
                <button
                  onClick={() => setPages([])}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg border transition-all',
                    pages.length === 0 ? 'border-novax bg-novax-light text-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border',
                  )}
                >
                  Required only
                </button>
              </div>

              {/* Page toggles */}
              <div className="space-y-3">
                {PAGE_GROUPS.map(group => {
                  const groupPages = PAGE_DEFS.filter(p => p.group === group)
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{group}</p>
                      <div className="flex flex-wrap gap-2">
                        {groupPages.map(({ key, label }) => {
                          const checked = pages.includes(key)
                          return (
                            <button
                              key={key}
                              onClick={() => togglePage(key)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                                checked
                                  ? 'bg-novax-light border-novax-border text-novax'
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                              )}
                            >
                              <span className={cn(
                                'w-3 h-3 rounded flex items-center justify-center border transition-all shrink-0',
                                checked ? 'bg-novax border-novax' : 'border-slate-300',
                              )}>
                                {checked && (
                                  <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none">
                                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-slate-400">
                {allSelected
                  ? 'Full access — all optional pages enabled'
                  : pages.length === 0
                    ? 'Restricted — required pages only (Dashboard, Pipeline, Tasks, Settings)'
                    : `${pages.length} of ${ALL_PAGE_KEYS.length} optional pages will be enabled`}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={applying}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {applying
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying…</>
                  : <><Shield className="w-3.5 h-3.5" /> Apply to {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''}</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
