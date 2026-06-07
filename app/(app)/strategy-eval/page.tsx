'use client'

import { useState } from 'react'
import {
  Loader2, Brain, Target, AlertTriangle, CheckCircle, TrendingUp, Zap,
  BarChart2, Users, Compass, Layers, Activity, SplitSquareVertical,
  Flame, Monitor, ChevronDown,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'

type EvalMode = 'strategy' | 'content'

// ── Strategy result ──────────────────────────────────────────────────────────

interface StrategyResult {
  overall: number
  objective_clarity: number
  audience_precision: number
  competitive_differentiation: number
  channel_fit: number
  pillar_coherence: number
  measurement_framework: number
  execution_feasibility: number
  strategic_impact_score: number
  strategy_grade: 'weak' | 'developing' | 'strong' | 'exceptional'
  strategic_gaps: string[]
  untapped_angles: string[]
  framework_violations: string[]
  strengths: string[]
  improvements: string[]
}

// ── Content result ───────────────────────────────────────────────────────────

interface ContentResult {
  overall: number
  hook_strength: number
  narrative_arc: number
  brand_voice_match: number
  cta_effectiveness: number
  platform_fit: number
  emotional_arousal: number
  message_clarity: number
  virality_score: number
  engagement_prediction: 'low' | 'medium' | 'high' | 'viral'
  emotional_trigger: string
  hook_analysis: string
  strengths: string[]
  improvements: string[]
  missing_elements: string[]
  platform_recommendations: string[]
  ab_test_suggestion: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const STRATEGY_GRADE_CONFIG = {
  weak:        { label: 'Weak Strategy',        color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  developing:  { label: 'Developing',           color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  strong:      { label: 'Strong Strategy',      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  exceptional: { label: 'Exceptional Strategy', color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
}

const ENGAGEMENT_CONFIG = {
  low:    { label: 'Low Engagement',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  medium: { label: 'Medium Engagement', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  high:   { label: 'High Engagement',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  viral:  { label: 'Viral Potential',   color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
}

const STRATEGY_DIMENSIONS = [
  { key: 'objective_clarity'          as const, label: 'Objective Clarity',          description: 'SMART criteria: Specific, Measurable, Achievable, Relevant, Time-bound' },
  { key: 'audience_precision'         as const, label: 'Audience Precision',          description: 'ICP quality: psychographics, behavioral triggers, jobs-to-be-done' },
  { key: 'competitive_differentiation'as const, label: 'Competitive Differentiation', description: 'Blue Ocean positioning — uncontested strategic space identified' },
  { key: 'channel_fit'                as const, label: 'Channel-Strategy Fit',        description: 'Platform selection driven by audience behavior data, not convention' },
  { key: 'pillar_coherence'           as const, label: 'Content Pillar Coherence',    description: 'Pillars form a coherent narrative arc across the customer journey' },
  { key: 'measurement_framework'      as const, label: 'Measurement Framework',       description: 'KPIs beyond vanity metrics — leading + lagging indicators defined' },
  { key: 'execution_feasibility'      as const, label: 'Execution Feasibility',       description: 'Volume and scope realistic for implied team size and budget' },
]

const CONTENT_DIMENSIONS = [
  { key: 'hook_strength'     as const, label: 'Hook Strength',      description: 'Scroll-halt probability in 1.7s (Meta research)' },
  { key: 'emotional_arousal' as const, label: 'Emotional Arousal',  description: 'Arousal intensity — high arousal drives 2× sharing (Berger & Milkman 2012)' },
  { key: 'narrative_arc'     as const, label: 'Narrative Arc',       description: 'Hook → tension → resolution — structural investment before payoff' },
  { key: 'message_clarity'   as const, label: 'Message Clarity',     description: '3-second extraction test (Cognitive Load Theory — Sweller)' },
  { key: 'brand_voice_match' as const, label: 'Brand Voice Match',   description: 'Tonal alignment — feels native to the brand, not generic' },
  { key: 'cta_effectiveness' as const, label: 'CTA Effectiveness',   description: 'Specific, frictionless action placed after value delivery' },
  { key: 'platform_fit'      as const, label: 'Platform Fit',        description: 'Native-format optimisation — line breaks, length, culture-match' },
]

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'twitter',   label: 'X / Twitter' },
  { value: 'youtube',   label: 'YouTube' },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function scoreColor(score: number) {
  return score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
}
function scoreBg(score: number) {
  return score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
}

function ScoreBar({ label, description, score }: { label: string; description: string; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className={cn('text-xs font-bold tabular-nums', scoreColor(score))}>{score}</span>
      </div>
      <p className="text-[10px] text-slate-400 mb-1.5">{description}</p>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function ImpactRing({ score, label }: { score: number; label: string }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#a855f7' : score >= 55 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="5"/>
          <circle
            cx="32" cy="32" r={radius} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[8px] text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
      </div>
    </div>
  )
}

function InsightList({ items, dotColor }: { items: string[]; dotColor: string }) {
  if (!items.length) return <p className="text-xs text-slate-400">None detected.</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <div className={cn('w-1 h-1 rounded-full mt-1.5 shrink-0', dotColor)} />
          <p className="text-xs text-slate-600 leading-relaxed">{item}</p>
        </li>
      ))}
    </ul>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function StrategyEvalPage() {
  const { clients } = useClients()
  const [mode, setMode] = useState<EvalMode>('strategy')
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [text, setText] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null)
  const [contentResult, setContentResult] = useState<ContentResult | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  const handleModeSwitch = (m: EvalMode) => {
    setMode(m)
    setStrategyResult(null)
    setContentResult(null)
    setEvalError(null)
  }

  const evaluate = async () => {
    if (!text.trim()) return
    setEvaluating(true)
    setStrategyResult(null)
    setContentResult(null)
    setEvalError(null)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: mode === 'strategy' ? 'strategy_eval' : 'content_eval',
          client: selectedClient
            ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity }
            : undefined,
          brief: text,
          platform: mode === 'content' ? platform : undefined,
          evalMode: mode,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setEvalError(data.error ?? 'Evaluation failed.'); return }
      const raw = (data.text as string).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(raw)
      if (mode === 'strategy') setStrategyResult(parsed as StrategyResult)
      else setContentResult(parsed as ContentResult)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed. Please try again.')
    } finally {
      setEvaluating(false)
    }
  }

  const hasResult = mode === 'strategy' ? !!strategyResult : !!contentResult
  const dimensions = mode === 'strategy' ? STRATEGY_DIMENSIONS : CONTENT_DIMENSIONS
  const result = (mode === 'strategy' ? strategyResult : contentResult) as Record<string, unknown> | null

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-slate-500">
        Paste a strategy document or a piece of content. The AI applies research-backed frameworks — SMART criteria, Blue Ocean Strategy, Berger-Milkman virality science, and platform algorithm research — to produce a scored, actionable evaluation.
      </p>

      {/* ── Mode tabs ── */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(['strategy', 'content'] as EvalMode[]).map(m => (
          <button
            key={m}
            onClick={() => handleModeSwitch(m)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
              mode === m
                ? 'bg-white text-novax shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {m === 'strategy' ? <Brain className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {m === 'strategy' ? 'Strategy' : 'Content'}
          </button>
        ))}
      </div>

      {/* ── Input + score row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: input controls */}
        <div className="space-y-4">
          {/* Client selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Evaluate for Client <span className="text-slate-400 font-normal">(optional — adds brand context)</span>
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white"
            >
              <option value="">No client — evaluate generically</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Platform selector — content mode only */}
          {mode === 'content' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platform</label>
              <div className="relative">
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white appearance-none"
                >
                  {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {mode === 'strategy' ? 'Strategy Document or Brief' : 'Copy, Caption, or Script'}
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={mode === 'strategy'
                ? 'Paste your strategy document, quarterly plan, content strategy brief, or any strategic text…'
                : 'Paste your caption, post copy, reel script, or any content text…'}
              className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white resize-none leading-relaxed placeholder:text-slate-300"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {text.length > 0 ? `${text.length} characters` : 'No minimum length — longer input produces more accurate scoring'}
            </p>
          </div>

          <button
            onClick={evaluate}
            disabled={evaluating || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {evaluating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
              : mode === 'strategy'
                ? <><Brain className="w-4 h-4" />Run Strategy Evaluation</>
                : <><Zap className="w-4 h-4" />Run Content Evaluation</>}
          </button>
        </div>

        {/* Right: score panel */}
        <div>
          {!hasResult && !evaluating && !evalError && (
            <div className="h-full flex items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                {mode === 'strategy'
                  ? <Brain className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  : <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />}
                <p className="text-sm text-slate-500">
                  {mode === 'strategy'
                    ? 'Paste a strategy to run the evaluation.'
                    : 'Paste content copy to run the evaluation.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {mode === 'strategy'
                    ? '7 dimensions · impact score · strategic gaps'
                    : '7 dimensions · virality score · hook analysis'}
                </p>
              </div>
            </div>
          )}

          {evalError && !evaluating && (
            <div className="h-full flex items-center justify-center p-8 bg-red-50 rounded-2xl border border-red-100">
              <div className="text-center">
                <p className="text-sm font-medium text-red-700 mb-1">Evaluation failed</p>
                <p className="text-xs text-red-600">{evalError}</p>
              </div>
            </div>
          )}

          {evaluating && (
            <div className="h-full flex items-center justify-center p-8 bg-novax-light rounded-2xl border border-novax-border">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-novax animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-novax-muted">Running analysis…</p>
                <p className="text-xs text-slate-500 mt-1">
                  {mode === 'strategy'
                    ? 'SMART criteria · Blue Ocean · KPI framework…'
                    : 'Hook strength · Berger arousal · Cognitive load…'}
                </p>
              </div>
            </div>
          )}

          {hasResult && result && !evaluating && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              {/* Header: overall + ring + grade */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Overall Score</p>
                  <div className="flex items-end gap-1">
                    <span className={cn('text-5xl font-black leading-none', scoreColor(result.overall as number))}>
                      {result.overall as number}
                    </span>
                    <span className="text-sm text-slate-400 mb-1">/100</span>
                  </div>
                </div>
                <ImpactRing
                  score={mode === 'strategy'
                    ? (result.strategic_impact_score as number)
                    : (result.virality_score as number)}
                  label={mode === 'strategy' ? 'impact' : 'viral'}
                />
                {mode === 'strategy' && strategyResult && (() => {
                  const cfg = STRATEGY_GRADE_CONFIG[strategyResult.strategy_grade]
                  return (
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', cfg.color, cfg.bg, cfg.border)}>
                      <TrendingUp className="w-3 h-3" />
                      {cfg.label}
                    </div>
                  )
                })()}
                {mode === 'content' && contentResult && (() => {
                  const cfg = ENGAGEMENT_CONFIG[contentResult.engagement_prediction]
                  return (
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', cfg.color, cfg.bg, cfg.border)}>
                      <TrendingUp className="w-3 h-3" />
                      {cfg.label}
                    </div>
                  )
                })()}
              </div>

              {/* 7 score bars */}
              <div className="space-y-3">
                {dimensions.map(({ key, label, description }) => (
                  <ScoreBar key={key} label={label} description={description} score={result[key] as number} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Intelligence report ── */}
      {hasResult && result && !evaluating && (
        <div className="space-y-4">

          {/* ── STRATEGY report ── */}
          {mode === 'strategy' && strategyResult && (
            <>
              {/* Row 1: Gaps + Violations + Untapped */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strategic Gaps</p>
                  </div>
                  <InsightList items={strategyResult.strategic_gaps} dotColor="bg-red-400" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Framework Violations</p>
                  </div>
                  <InsightList items={strategyResult.framework_violations} dotColor="bg-amber-400" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Compass className="w-3.5 h-3.5 text-sky-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Untapped Angles</p>
                  </div>
                  <InsightList items={strategyResult.untapped_angles} dotColor="bg-sky-400" />
                </div>
              </div>

              {/* Row 2: Strengths + Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strengths</p>
                  </div>
                  <InsightList items={strategyResult.strengths} dotColor="bg-emerald-400" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="w-3.5 h-3.5 text-novax-muted" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Improvements</p>
                  </div>
                  <InsightList items={strategyResult.improvements} dotColor="bg-slate-400" />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Scored against: SMART criteria framework · Kim & Mauborgne Blue Ocean Strategy · 5-3-2 content pillar ratio · Platform algorithm research · OKR measurement framework
              </p>
            </>
          )}

          {/* ── CONTENT report ── */}
          {mode === 'content' && contentResult && (
            <>
              {/* Hook analysis banner */}
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-start gap-2">
                  <Flame className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
                      Hook Analysis — 0-3 Second Window
                      {contentResult.emotional_trigger && (
                        <span className="ml-2 text-[10px] normal-case font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          {contentResult.emotional_trigger}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">{contentResult.hook_analysis}</p>
                  </div>
                </div>
              </div>

              {/* Row 1: Missing + Strengths + Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Missing for Impact</p>
                  </div>
                  <InsightList items={contentResult.missing_elements} dotColor="bg-red-400" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strengths</p>
                  </div>
                  <InsightList items={contentResult.strengths} dotColor="bg-emerald-400" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Improvements</p>
                  </div>
                  <InsightList items={contentResult.improvements} dotColor="bg-amber-400" />
                </div>
              </div>

              {/* Row 2: Platform recs + A/B test */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="w-3.5 h-3.5 text-sky-500" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Platform Fit Analysis</p>
                  </div>
                  <InsightList items={contentResult.platform_recommendations} dotColor="bg-sky-400" />
                </div>

                <div className="bg-novax-light rounded-xl border border-novax-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <SplitSquareVertical className="w-3.5 h-3.5 text-novax-muted" />
                    <p className="text-xs font-semibold text-novax uppercase tracking-wider">A/B Test Recommendation</p>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{contentResult.ab_test_suggestion}</p>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Scored against: Berger & Milkman virality research · Meta 1.7s dwell study · Sweller Cognitive Load Theory · Cialdini persuasion principles · Platform algorithm research
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
