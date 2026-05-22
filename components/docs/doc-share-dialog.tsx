'use client'

import { useState } from 'react'
import { X, Globe, Lock, Link, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocShareDialogProps {
  docId: string
  title: string
  isPublic: boolean
  shareToken: string
  onClose: () => void
  onTogglePublic: (isPublic: boolean) => void
}

export function DocShareDialog({
  title,
  isPublic,
  shareToken,
  onClose,
  onTogglePublic,
}: DocShareDialogProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/docs/public/${shareToken}`
      : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — select the text
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Share document</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500 truncate">{title}</p>

          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5">
              {isPublic ? (
                <Globe className="w-4 h-4 text-novax-muted" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <p className="text-xs font-medium text-slate-800">
                  {isPublic ? 'Public — anyone with the link' : 'Private — only team members'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isPublic
                    ? 'Recipients can view but not edit'
                    : 'Toggle to generate a shareable link'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onTogglePublic(!isPublic)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                isPublic ? 'bg-novax' : 'bg-slate-300',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200',
                  isPublic ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          {/* Share link — shown only when public */}
          {isPublic && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Share link
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                  <Link className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600 truncate">{shareUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    copied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-novax text-white hover:bg-novax-hover',
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    'Copy'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
