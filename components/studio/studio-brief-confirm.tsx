'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BriefConfirmation, StructuredQuestion } from '@/lib/studio-types'

export interface StudioBriefConfirmProps {
  confirmation: BriefConfirmation
  question: StructuredQuestion | null
  onConfirm: (answers: { confirmed: boolean; emotional_trigger: string }) => void
  onAdjust: () => void
  isLoadingQuestion?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PlatformChip({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center bg-novax-light text-novax text-[10px] font-medium rounded-full px-2 py-0.5">
      {platform}
    </span>
  )
}

function DataRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 w-28 shrink-0 mt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function StudioBriefConfirm({
  confirmation,
  question,
  onConfirm,
  onAdjust,
  isLoadingQuestion = false,
}: StudioBriefConfirmProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const customRef = useRef<HTMLTextAreaElement>(null)

  const isSomethingElse = selectedOption === '__custom__'
  const effectiveTrigger = isSomethingElse
    ? customText.trim()
    : selectedOption ?? ''
  const canRun = effectiveTrigger.length > 0

  // Focus custom textarea when it appears
  useEffect(() => {
    if (isSomethingElse) {
      customRef.current?.focus()
    }
  }, [isSomethingElse])

  function handleContinue() {
    setStep(2)
  }

  function handleRun() {
    if (!canRun) return
    onConfirm({ confirmed: true, emotional_trigger: effectiveTrigger })
  }

  // ── Step 1: Brief confirmation card ─────────────────────────────────────────
  if (step === 1) {
    const isColdStart =
      typeof confirmation.performance_days === 'number' &&
      confirmation.performance_days < 7

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-lg mx-auto">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Here&apos;s what I understood
        </h2>

        <div className="divide-y divide-slate-100">
          <DataRow label="Client">
            <span className="text-sm text-slate-800 font-medium">
              {confirmation.client_name ?? 'No client'}
            </span>
          </DataRow>

          <DataRow label="Platforms">
            <div className="flex flex-wrap gap-1">
              {confirmation.platforms.map(p => (
                <PlatformChip key={p} platform={p} />
              ))}
            </div>
          </DataRow>

          <DataRow label="Goal">
            <span className="text-sm text-slate-700">{confirmation.goal}</span>
          </DataRow>

          <DataRow label="Audience">
            <span className="text-sm text-slate-700">{confirmation.audience}</span>
          </DataRow>

          <DataRow label="Language">
            <span className="text-sm text-slate-700 capitalize">
              {confirmation.language}
            </span>
          </DataRow>

          <DataRow label="Performance data">
            <span className="text-sm text-slate-700">
              {typeof confirmation.performance_days === 'number'
                ? confirmation.performance_days < 7
                  ? '0 days available'
                  : `${confirmation.performance_days} days available`
                : 'Not available'}
            </span>
          </DataRow>

          {confirmation.key_signal && (
            <DataRow label="Key signal">
              <span className="text-sm text-novax-muted italic">
                {confirmation.key_signal}
              </span>
            </DataRow>
          )}
        </div>

        {/* Cold start notice */}
        {isColdStart && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
            <p className="text-sm text-amber-800">
              Based on industry benchmarks — rerun after 30 days for real data.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleContinue}
            className="flex-1 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Looks right — continue
          </button>
          <button
            onClick={onAdjust}
            className="flex-1 py-2.5 text-sm text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Let me adjust
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: The one question ─────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-lg mx-auto">
      <p className="text-sm font-semibold text-slate-900">
        One question before I start
      </p>
      <p className="text-base text-slate-700 mt-2 mb-4 leading-relaxed">
        {question?.question ?? 'How should this content make people feel?'}
      </p>

      {/* Options skeleton while loading */}
      {isLoadingQuestion ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* AI-generated options (string array) */}
          {(question?.options ?? []).map(option => {
            const isSelected = selectedOption === option
            return (
              <button
                key={option}
                onClick={() => setSelectedOption(option)}
                className={cn(
                  'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all',
                  isSelected
                    ? 'bg-novax-light border-2 border-novax-border text-novax font-medium'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-novax-border',
                )}
              >
                {option}
              </button>
            )
          })}

          {/* Something else */}
          <button
            onClick={() => setSelectedOption('__custom__')}
            className={cn(
              'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all',
              isSomethingElse
                ? 'bg-novax-light border-2 border-novax-border text-novax font-medium'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-novax-border',
            )}
          >
            Something else…
          </button>

          {/* Inline custom text input */}
          {isSomethingElse && (
            <textarea
              ref={customRef}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Describe what you have in mind…"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-novax-border rounded-xl outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-novax-light text-slate-800 placeholder:text-slate-400 resize-none transition-all"
            />
          )}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!canRun || isLoadingQuestion}
        className="w-full mt-5 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLoadingQuestion ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing question…
          </>
        ) : (
          'Run →'
        )}
      </button>
    </div>
  )
}
