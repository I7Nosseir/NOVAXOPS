'use client'

import { useState, useRef } from 'react'
import {
  Loader2, Brain, Target, AlertTriangle, CheckCircle, TrendingUp, Zap,
  BarChart2, SplitSquareVertical, Flame, Monitor, ChevronDown, FileText,
  ShieldAlert, Lightbulb,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

async function extractFileText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'PDF extraction failed')
    }
    const data = await res.json() as { text?: string }
    return data.text ?? '(Could not extract PDF text — paste content manually)'
  }
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const lines: string[] = []
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      if (csv.trim()) lines.push(`[Sheet: ${name}]\n${csv}`)
    }
    return lines.join('\n\n')
  }
  if (file.name.endsWith('.txt')) return file.text()
  // docx: basic text extraction
  const raw = await file.text()
  const cleaned = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
  return cleaned || '(Could not auto-extract — paste content manually)'
}

type EvalMode = 'strategy' | 'content'

// ── Strategy result — matches strategy_eval API response ─────────────────────

interface StrategyResult {
  overall: number
  clarity_of_pov: number
  audience_insight_depth: number
  competitive_differentiation: number
  platform_calibration: number
  executional_feasibility: number
  measurability: number
  cultural_intelligence: number
  strategic_logic: number
  strategic_stress_test: {
    core_assumption: string
    failure_mode: string
    mitigation: string
  }
  critical_gaps: string[]
  quick_wins: string[]
  competitor_blind_spots: string[]
  verdict: 'world_class' | 'strong' | 'solid' | 'needs_work' | 'start_over'
  verdict_rationale: string
}

// ── Content result — matches content_eval API response ───────────────────────

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

const STRATEGY_VERDICT_CONFIG = {
  world_class: { label: 'World Class',  color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  strong:      { label: 'Strong',       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  solid:       { label: 'Solid',        color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  needs_work:  { label: 'Needs Work',   color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  start_over:  { label: 'Start Over',   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
}

const ENGAGEMENT_CONFIG = {
  low:    { label: 'Low Engagement',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  medium: { label: 'Medium Engagement', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  high:   { label: 'High Engagement',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  viral:  { label: 'Viral Potential',   color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
}

const STRATEGY_DIMENSIONS = [
  { key: 'clarity_of_pov'            as const, label: 'Clarity of POV',             description: 'Single, defensible POV that reframes the competitive space' },
  { key: 'audience_insight_depth'    as const, label: 'Audience Insight',            description: 'Real human tension — specific aspiration, fear, or contradiction' },
  { key: 'competitive_differentiation' as const, label: 'Competitive Differentiation', description: 'Blue Ocean — specific moves competitors are not making' },
  { key: 'platform_calibration'      as const, label: 'Platform Calibration',        description: 'Differentiated strategy per platform — not one message posted everywhere' },
  { key: 'executional_feasibility'   as const, label: 'Executional Feasibility',     description: 'Volume and scope realistic for implied team size and budget' },
  { key: 'measurability'             as const, label: 'Measurability',               description: 'KPIs with baselines and target dates — beyond vanity metrics' },
  { key: 'cultural_intelligence'     as const, label: 'Cultural Intelligence',        description: 'MENA fit — calendar, dialect, platform penetration, consumer behaviour' },
  { key: 'strategic_logic'           as const, label: 'Strategic Logic',             description: 'Coherent argument: insight → choice → tactic → measurable outcome' },
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
  if (!items?.length) return <p className="text-xs text-slate-400">None detected.</p>
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
  const [docFileName, setDocFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null)
  const [contentResult, setContentResult] = useState<ContentResult | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = async (f: File) => {
    setDocFileName(f.name)
    setExtracting(true)
    setText('')
    try {
      const extracted = await extractFileText(f)
      setText(extracted)
    } catch (err) {
      setText('(Could not extract file content — paste manually)')
      setEvalError(err instanceof Error ? err.message : 'File extraction failed')
    } finally {
      setExtracting(false)
    }
  }

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
          textContent: text,
          platform: mode === 'content' ? platform : undefined,
          evalMode: mode,
        }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok || data.error) { setEvalError(data.error ?? 'Evaluation failed.'); return }
      const raw = (data.text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(raw) as StrategyResult | ContentResult
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
  const isLoading = evaluating || extracting

  // Resolve verdict safely — guard against unexpected API values
  const verdictKey = strategyResult?.verdict && strategyResult.verdict in STRATEGY_VERDICT_CONFIG
    ? strategyResult.verdict
    : 'solid'
  const verdictCfg = STRATEGY_VERDICT_CONFIG[verdictKey as keyof typeof STRATEGY_VERDICT_CONFIG]

  return (
    <>
      {/* ── Fullscreen loading overlay ── */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-5">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-novax-light" />
              <div className="absolute inset-0 rounded-full border-4 border-t-novax border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <div>
              <p className="text-base font-semibold text-novax">
                {extracting
                  ? 'Extracting document…'
                  : mode === 'strategy'
                    ? 'Running Strategy Evaluation…'
                    : 'Running Content Evaluation…'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {extracting
                  ? `Reading ${docFileName}`
                  : mode === 'strategy'
                    ? 'Blue Ocean · Cultural Intelligence · Stress-testing assumptions…'
                    : 'Hook strength · Berger arousal · Cognitive load…'}
              </p>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {mode === 'strategy' ? 'Strategy Document or Brief' : 'Copy, Caption, or Script'}
                </label>
                <div className="flex items-center gap-2">
                  {docFileName && (
                    <span className="text-[10px] text-novax-muted font-medium truncate max-w-[100px]">{docFileName}</span>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-novax font-medium border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                    {extracting ? 'Reading…' : 'Import'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls,.docx,.pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && void handleImportFile(e.target.files[0])}
                  />
                </div>
              </div>
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
                {text.length > 0
                  ? `${text.length} characters`
                  : 'No minimum — longer input produces more accurate scoring · .txt .xlsx .csv .docx .pdf supported'}
              </p>
            </div>

            <button
              onClick={evaluate}
              disabled={isLoading || !text.trim()}
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
                      ? '8 dimensions · verdict · stress test'
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

            {hasResult && result && !evaluating && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                {/* Header: overall + ring + verdict/engagement badge */}
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
                      ? ((result.strategic_logic as number) ?? 0)
                      : ((result.virality_score as number) ?? 0)}
                    label={mode === 'strategy' ? 'logic' : 'viral'}
                  />
                  {mode === 'strategy' && strategyResult && (
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', verdictCfg.color, verdictCfg.bg, verdictCfg.border)}>
                      <TrendingUp className="w-3 h-3" />
                      {verdictCfg.label}
                    </div>
                  )}
                  {mode === 'content' && contentResult && (() => {
                    const cfg = ENGAGEMENT_CONFIG[contentResult.engagement_prediction] ?? ENGAGEMENT_CONFIG.medium
                    return (
                      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', cfg.color, cfg.bg, cfg.border)}>
                        <TrendingUp className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    )
                  })()}
                </div>

                {/* 7–8 score bars */}
                <div className="space-y-3">
                  {dimensions.map(({ key, label, description }) => (
                    <ScoreBar key={key} label={label} description={description} score={(result[key] as number) ?? 0} />
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
                {/* Row 1: Gaps + Blind spots + Quick wins */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-3.5 h-3.5 text-red-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Critical Gaps</p>
                    </div>
                    <InsightList items={strategyResult.critical_gaps} dotColor="bg-red-400" />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Competitor Blind Spots</p>
                    </div>
                    <InsightList items={strategyResult.competitor_blind_spots} dotColor="bg-amber-400" />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-3.5 h-3.5 text-sky-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Quick Wins</p>
                    </div>
                    <InsightList items={strategyResult.quick_wins} dotColor="bg-sky-400" />
                  </div>
                </div>

                {/* Row 2: Stress test + Verdict rationale */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strategic Stress Test</p>
                    </div>
                    {strategyResult.strategic_stress_test && (
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Core Assumption</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{strategyResult.strategic_stress_test.core_assumption}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Failure Mode</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{strategyResult.strategic_stress_test.failure_mode}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Mitigation</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{strategyResult.strategic_stress_test.mitigation}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-novax-light rounded-xl border border-novax-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart2 className="w-3.5 h-3.5 text-novax-muted" />
                      <p className="text-xs font-semibold text-novax uppercase tracking-wider">Verdict Rationale</p>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{strategyResult.verdict_rationale}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Scored against: Blue Ocean Strategy · SMART criteria · OKR measurement framework · Platform algorithm research · MENA cultural intelligence
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
    </>
  )
}
