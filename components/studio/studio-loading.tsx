'use client'

import { Circle, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StudioLoadingStep {
  label: string
  status: 'pending' | 'active' | 'complete'
  insight?: string
}

export interface StudioLoadingProps {
  steps: StudioLoadingStep[]
  sessionName?: string
  tool: 'content' | 'hooks' | 'strategy' | 'campaign' | 'postmortem'
  elapsedSeconds?: number
  totalSteps?: number
  completedSteps?: number
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

        {/* Elapsed time */}
        {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
          <p className="text-xs text-slate-400 mt-4 text-right">
            {elapsedSeconds}s elapsed
          </p>
        )}
      </div>
    </div>
  )
}
