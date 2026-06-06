'use client'

import { Circle, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StudioLoadingStep {
  label: string
  status: 'pending' | 'active' | 'complete'
  insight?: string
}

export interface StudioLoadingQuestion {
  question: string
  options: string[]
}

export interface StudioLoadingProps {
  steps: StudioLoadingStep[]
  sessionName?: string
  tool: 'content' | 'hooks' | 'strategy' | 'campaign' | 'postmortem'
  elapsedSeconds?: number
  totalSteps?: number
  completedSteps?: number
  /** When set, loading pauses and displays this question inline */
  pausedQuestion?: StudioLoadingQuestion | null
  onQuestionAnswer?: (answer: string) => void
}

const TOOL_LABELS: Record<StudioLoadingProps['tool'], string> = {
  content: 'Content Studio',
  hooks: 'Hook Lab',
  strategy: 'Strategy Command Center',
  campaign: 'Campaign Igniter',
  postmortem: 'Post-Mortem',
}

export function StudioLoading({
  steps,
  sessionName,
  tool,
  elapsedSeconds,
  totalSteps,
  completedSteps,
  pausedQuestion,
  onQuestionAnswer,
}: StudioLoadingProps) {
  const allPending = steps.every(s => s.status === 'pending')
  const progressPercent =
    tool === 'campaign' && totalSteps && totalSteps > 0
      ? Math.round(((completedSteps ?? 0) / totalSteps) * 100)
      : null

  // ── All-pending state: wordmark only ────────────────────────────────────────
  if (allPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-2xl font-black text-novax tracking-tight select-none">NOVAX</p>
        <p className="text-sm text-slate-500 mt-2">Preparing {TOOL_LABELS[tool]}…</p>
      </div>
    )
  }

  // ── Working state ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Session name */}
        {sessionName && (
          <p className="text-lg font-semibold text-slate-800 mb-6 text-center sm:text-left">
            {sessionName}
          </p>
        )}

        {/* Step list */}
        <div className="space-y-1">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col">
              <div
                className={cn(
                  'flex items-start gap-3 py-2',
                  step.status === 'pending' && 'opacity-50',
                )}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {step.status === 'pending' && (
                    <Circle className="w-4 h-4 text-slate-300" />
                  )}
                  {step.status === 'active' && (
                    <Loader2 className="w-4 h-4 text-novax-accent animate-spin" />
                  )}
                  {step.status === 'complete' && (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-sm',
                    step.status === 'active' && 'text-slate-700 font-medium',
                    step.status === 'complete' && 'text-slate-600',
                    step.status === 'pending' && 'text-slate-400',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Completed insight */}
              {step.status === 'complete' && step.insight && (
                <div className="ml-7 mb-1">
                  <div className="bg-novax-light border border-novax-border rounded-lg px-3 py-1.5 mt-1">
                    <p className="text-xs text-novax-muted italic">{step.insight}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Campaign progress bar */}
        {tool === 'campaign' && progressPercent !== null && (
          <div className="mt-6">
            <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-novax h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Inline question pause card */}
        {pausedQuestion && (
          <div className="mt-8 bg-novax-light border border-novax-border rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-2">
              <Loader2 className="w-4 h-4 text-novax-accent mt-0.5 shrink-0 animate-spin" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-novax-muted mb-1">One quick question</p>
                <p className="text-sm font-semibold text-novax leading-snug">{pausedQuestion.question}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {pausedQuestion.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => onQuestionAnswer?.(opt)}
                  className="px-3 py-2 text-xs font-medium bg-white border border-novax-border text-novax rounded-xl hover:bg-novax hover:text-white transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Elapsed time */}
        {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && !pausedQuestion && (
          <p className="text-xs text-slate-400 mt-4 text-right">
            {elapsedSeconds}s elapsed
          </p>
        )}
      </div>
    </div>
  )
}
