'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Zap } from 'lucide-react'
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
  content:   'Content Studio',
  hooks:     'Hook Lab',
  strategy:  'Strategy Command Center',
  campaign:  'Campaign Igniter',
  postmortem:'Post-Mortem',
}

// ── Typewriter for insights ─────────────────────────────────────────────────
function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 14)
    return () => clearInterval(id)
  }, [text])
  return <>{displayed}</>
}

// ── Main component ──────────────────────────────────────────────────────────
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
  const completedCount = steps.filter(s => s.status === 'complete').length

  const progressPercent =
    tool === 'campaign' && totalSteps && totalSteps > 0
      ? Math.round(((completedSteps ?? 0) / totalSteps) * 100)
      : steps.length > 0
        ? Math.round((completedCount / steps.length) * 100)
        : 0

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-start pt-10 pb-16 px-6 overflow-hidden">

      {/* ── Keyframes ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes sx-orbit      { from { transform: rotate(0deg) }   to { transform: rotate(360deg) } }
        @keyframes sx-orbit-ccw  { from { transform: rotate(0deg) }   to { transform: rotate(-360deg) } }
        @keyframes sx-pulse-ring { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:.18; transform:scale(1.14) } }
        @keyframes sx-glow-ring  { 0%,100% { box-shadow:0 0 12px 3px rgba(91,180,174,.22) } 50% { box-shadow:0 0 32px 10px rgba(91,180,174,.52) } }
        @keyframes sx-shimmer    { from { background-position:-250% 0 } to { background-position:250% 0 } }
        @keyframes sx-scan       { 0%   { transform:translateY(-20px); opacity:0 }
                                   4%   { opacity:1 }
                                   96%  { opacity:1 }
                                   100% { transform:translateY(70vh); opacity:0 } }
        @keyframes sx-dot-blink  { 0%,100% { opacity:1 } 50% { opacity:.15 } }
        @keyframes sx-fade-up    { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sx-slide-in   { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
        @keyframes sx-insight-in { from { opacity:0; max-height:0; transform:scaleY(.9) } to { opacity:1; max-height:200px; transform:scaleY(1) } }
        @keyframes sx-step-glow  { 0%,100% { box-shadow:0 0 0 0 rgba(91,180,174,0), inset 0 0 0 1px rgba(157,204,200,.5) }
                                   50%      { box-shadow:0 2px 18px 0 rgba(91,180,174,.25), inset 0 0 0 1px rgba(91,180,174,.7) } }

        .sx-orbit        { animation: sx-orbit      4s linear infinite; will-change:transform }
        .sx-orbit-ccw    { animation: sx-orbit-ccw  6.5s linear infinite; will-change:transform }
        .sx-orbit-slow   { animation: sx-orbit      9s linear infinite; will-change:transform }
        .sx-pulse-ring   { animation: sx-pulse-ring 2.8s ease-in-out infinite }
        .sx-glow-ring    { animation: sx-glow-ring  2.6s ease-in-out infinite }
        .sx-shimmer-bar  { background: linear-gradient(90deg,
                             #1B3D38 0%,
                             #1B3D38 28%,
                             #5BB4AE 47%,
                             #9DCCC8 50%,
                             #5BB4AE 53%,
                             #1B3D38 72%,
                             #1B3D38 100%);
                           background-size:280% 100%;
                           animation: sx-shimmer 2s ease-in-out infinite }
        .sx-scan-line    { animation: sx-scan 7s ease-in-out infinite }
        .sx-dot-blink    { animation: sx-dot-blink 1.5s ease-in-out infinite }
        .sx-fade-up      { animation: sx-fade-up  .6s ease both }
        .sx-slide-in     { animation: sx-slide-in .45s ease both }
        .sx-insight-in   { animation: sx-insight-in .5s ease both; transform-origin: top }
        .sx-step-active  { animation: sx-step-glow 2.4s ease-in-out infinite }
      `}</style>

      {/* ── Top shimmer progress bar (fixed) ──────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-novax-light overflow-hidden">
        <div
          className="h-full sx-shimmer-bar transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(4, progressPercent)}%` }}
        />
      </div>

      {/* ── Horizontal scan line ─────────────────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 h-px pointer-events-none z-10 sx-scan-line"
        style={{
          top: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(91,180,174,.25) 20%, rgba(91,180,174,.6) 50%, rgba(91,180,174,.25) 80%, transparent 100%)',
        }}
      />

      {/* ── Orbital center piece ──────────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center mb-8 sx-fade-up"
        style={{ width: 172, height: 172, animationDelay: '0ms' }}
      >
        {/* Outermost soft pulse ring */}
        <div
          className="absolute inset-0 rounded-full border border-novax-border sx-pulse-ring"
        />

        {/* Slow outer dashed orbit */}
        <div
          className="absolute rounded-full sx-orbit-slow"
          style={{
            inset: 10,
            border: '1px dashed rgba(91,180,174,.28)',
            borderRadius: '50%',
          }}
        />

        {/* CCW orbit ring */}
        <div
          className="absolute rounded-full sx-orbit-ccw"
          style={{
            inset: 26,
            border: '1px solid rgba(91,180,174,.18)',
            borderRadius: '50%',
          }}
        />

        {/* Orbiting dot — outer ring, CW */}
        <div
          className="absolute sx-orbit"
          style={{ inset: 10, borderRadius: '50%' }}
        >
          <div
            className="absolute rounded-full bg-novax-accent"
            style={{ width: 7, height: 7, top: -3.5, left: '50%', marginLeft: -3.5, boxShadow: '0 0 6px 2px rgba(91,180,174,.7)' }}
          />
        </div>

        {/* Orbiting dot — inner ring, CCW, offset 180° */}
        <div
          className="absolute sx-orbit-ccw"
          style={{ inset: 26, borderRadius: '50%' }}
        >
          <div
            className="absolute rounded-full bg-novax-border"
            style={{ width: 5, height: 5, bottom: -2.5, left: '50%', marginLeft: -2.5 }}
          />
        </div>

        {/* Orbiting dot 3 — outer ring, slow, offset 90° */}
        <div
          className="absolute sx-orbit-slow"
          style={{ inset: 10, borderRadius: '50%', transform: 'rotate(90deg)' }}
        >
          <div
            className="absolute rounded-full bg-novax-muted/60"
            style={{ width: 4, height: 4, top: -2, left: '50%', marginLeft: -2 }}
          />
        </div>

        {/* Center disk */}
        <div
          className="relative z-10 rounded-full bg-novax flex flex-col items-center justify-center sx-glow-ring select-none"
          style={{ width: 84, height: 84 }}
        >
          <span className="text-[12px] font-black text-white tracking-[.2em] leading-none">NOVAX</span>
          <span className="text-[7px] font-semibold text-novax-accent tracking-[.15em] uppercase mt-1">AI</span>
        </div>
      </div>

      {/* ── Tool + session label ─────────────────────────────────────────────── */}
      <p
        className="text-[10px] font-bold uppercase tracking-[.22em] text-novax-muted mb-1.5 sx-fade-up"
        style={{ animationDelay: '80ms' }}
      >
        {TOOL_LABELS[tool]}
      </p>

      {sessionName && (
        <p
          className="text-sm font-semibold text-slate-700 mb-8 text-center max-w-xs leading-snug sx-fade-up"
          style={{ animationDelay: '150ms' }}
        >
          {sessionName}
        </p>
      )}

      {/* ── Step list ────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm space-y-1.5">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              'sx-slide-in rounded-xl px-4 py-3 flex items-start gap-3 transition-all duration-500',
              step.status === 'active'  && 'bg-novax-light sx-step-active',
              step.status === 'complete'&& 'bg-slate-50/80',
              step.status === 'pending' && 'opacity-25',
            )}
            style={{ animationDelay: `${180 + i * 55}ms` }}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center">
              {step.status === 'pending' && (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
              )}
              {step.status === 'active' && (
                <div className="relative w-4 h-4">
                  <div className="absolute inset-0 rounded-full border-2 border-novax-accent border-t-transparent animate-spin" />
                  <div className="absolute inset-1 rounded-full bg-novax-accent/20" />
                </div>
              )}
              {step.status === 'complete' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'text-sm leading-snug block transition-colors duration-300',
                  step.status === 'active'   && 'text-novax font-semibold',
                  step.status === 'complete' && 'text-slate-500',
                  step.status === 'pending'  && 'text-slate-400',
                )}
              >
                {step.label}
              </span>

              {/* Insight — typewriter reveal */}
              {step.status === 'complete' && step.insight && (
                <div
                  className="mt-2 px-3 py-2 rounded-lg bg-novax-light border border-novax-border overflow-hidden sx-insight-in"
                  key={step.insight}
                >
                  <p className="text-[11px] text-novax-muted italic leading-relaxed">
                    <TypewriterText text={step.insight} />
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Campaign granular progress bar ──────────────────────────────────── */}
      {tool === 'campaign' && totalSteps && totalSteps > 0 && (
        <div className="mt-5 w-full max-w-sm sx-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="h-[3px] rounded-full bg-novax-light overflow-hidden">
            <div
              className="h-full rounded-full sx-shimmer-bar transition-[width] duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-slate-400 mt-1 tabular-nums">
            {completedSteps ?? 0} / {totalSteps}
          </p>
        </div>
      )}

      {/* ── Paused question card ─────────────────────────────────────────────── */}
      {pausedQuestion && (
        <div className="mt-8 w-full max-w-sm rounded-2xl bg-novax border border-novax-border/30 p-5 space-y-4 sx-fade-up">
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-novax-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-novax-accent mb-1.5">
                One quick question
              </p>
              <p className="text-sm font-semibold text-white leading-snug">
                {pausedQuestion.question}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pausedQuestion.options.map(opt => (
              <button
                key={opt}
                onClick={() => onQuestionAnswer?.(opt)}
                className="px-3 py-2 text-xs font-medium bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white hover:text-novax transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Elapsed time ─────────────────────────────────────────────────────── */}
      {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && !pausedQuestion && (
        <div className="mt-8 flex items-center gap-2 sx-fade-up" style={{ animationDelay: '500ms' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-novax-accent sx-dot-blink" />
          <span className="text-xs text-slate-400 tabular-nums">{elapsedSeconds}s</span>
        </div>
      )}
    </div>
  )
}
