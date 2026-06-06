'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'

const QUICK_TAGS = [
  'Too formal',
  'Too casual',
  'Off-brand',
  'Too long',
  'Too short',
  'Wrong tone',
  'Wrong language',
  'Off-topic',
] as const

interface Props {
  clientId?: string
  agentType: string
  contentSnapshot: string
  className?: string
  onFeedbackSaved?: (rating: 'positive' | 'negative') => void
}

export function AIFeedbackButtons({
  clientId,
  agentType,
  contentSnapshot,
  className,
  onFeedbackSaved,
}: Props) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null)
  const [showNegativeForm, setShowNegativeForm] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [correctionText, setCorrectionText] = useState('')
  const [editedVersion, setEditedVersion] = useState('')

  if (!clientId) return null

  const save = async (rating: 'positive' | 'negative', tags?: string[], correction?: string, edited?: string) => {
    setSubmitting(true)
    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          agent_type: agentType,
          content_snapshot: contentSnapshot.slice(0, 500),
          rating,
          tags: tags ?? [],
          correction_text: correction ?? '',
          edited_version: edited ?? '',
          created_by: user?.id,
        }),
      })
      setSubmitted(rating)
      onFeedbackSaved?.(rating)
    } catch { /* non-critical */ }
    finally { setSubmitting(false) }
  }

  const handlePositive = () => {
    if (submitted) return
    void save('positive')
  }

  const handleNegativeSubmit = () => {
    void save('negative', selectedTags, correctionText, editedVersion)
    setShowNegativeForm(false)
  }

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

  return (
    <div className={cn('relative', className)}>
      {/* Thumbs row */}
      {!submitted && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 mr-1">Rate output</span>
          <button
            onClick={handlePositive}
            disabled={submitting}
            title="Good output"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
          >
            <ThumbsUp className="w-3.5 h-3.5"/>
          </button>
          <button
            onClick={() => setShowNegativeForm(v => !v)}
            disabled={submitting}
            title="Needs improvement"
            className={cn(
              'p-1.5 rounded-lg transition-colors disabled:opacity-40',
              showNegativeForm
                ? 'text-red-500 bg-red-50'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50',
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}

      {/* Submitted confirmation */}
      {submitted === 'positive' && (
        <p className="text-[11px] text-emerald-600 font-medium">Noted — will improve future outputs</p>
      )}
      {submitted === 'negative' && (
        <p className="text-[11px] text-red-500 font-medium">Correction saved — AI will learn from this</p>
      )}

      {/* Negative feedback overlay */}
      {showNegativeForm && !submitted && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-red-700">What was wrong?</p>
            <button
              onClick={() => setShowNegativeForm(false)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5"/>
            </button>
          </div>

          {/* Quick tags */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-full border font-medium transition-all',
                  selectedTags.includes(tag)
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-100',
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* What should it have done */}
          <input
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            placeholder="What should it have done? (optional)"
            className="w-full px-2.5 py-1.5 text-xs border border-red-200 rounded-lg outline-none focus:border-red-400 bg-white text-slate-700 placeholder:text-slate-400"
          />

          {/* Corrected version */}
          <textarea
            value={editedVersion}
            onChange={e => setEditedVersion(e.target.value)}
            placeholder="Write the corrected version (optional)"
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs border border-red-200 rounded-lg outline-none focus:border-red-400 bg-white text-slate-700 placeholder:text-slate-400 resize-none"
          />

          <button
            onClick={handleNegativeSubmit}
            disabled={submitting || (selectedTags.length === 0 && !correctionText.trim())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Send className="w-3 h-3"/>
            Save Correction
          </button>
        </div>
      )}
    </div>
  )
}
