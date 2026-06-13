'use client'

import { useState, useRef } from 'react'
import {
  Loader2, Brain, Target, AlertTriangle, CheckCircle, TrendingUp, Zap,
  BarChart2, SplitSquareVertical, Flame, Monitor, ChevronDown, FileText,
  ShieldAlert, Lightbulb, Database, Award, ArrowRight, Clock, X as XIcon,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

// ── File preparation — PDF goes straight to AI as base64, no text extraction ──

type FileResult =
  | { mode: 'file'; base64: string; mimeType: string; detectedType: 'copy' | 'data' }
  | { mode: 'text'; text: string; detectedType: 'copy' | 'data' }

async function prepareFile(file: File): Promise<FileResult> {
  const name = file.name.toLowerCase()

  // PDF → base64, sent directly to AI (Claude document block / Gemini inline_data)
  if (name.endsWith('.pdf')) {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return { mode: 'file', base64: btoa(binary), mimeType: 'application/pdf', detectedType: 'copy' }
  }

  // CSV / Excel → extract to text (AI reads tabular data as CSV text)
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      if (csv.trim()) lines.push(`[Sheet: ${sheetName}]\n${csv}`)
    }
    return { mode: 'text', text: lines.join('\n\n'), detectedType: 'data' }
  }

  // TXT → read as text
  if (name.endsWith('.txt')) {
    return { mode: 'text', text: await file.text(), detectedType: 'copy' }
  }

  // DOCX and others → basic text strip
  const raw = await file.text()
  const cleaned = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
  return { mode: 'text', text: cleaned || '', detectedType: 'copy' }
}

// ── Types ────────────────────────────────────────────────────────────────────

type EvalMode = 'strategy' | 'content'
type ContentType = 'copy' | 'data'

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
  strategic_stress_test: { core_assumption: string; failure_mode: string; mitigation: string }
  critical_gaps: string[]
  quick_wins: string[]
  competitor_blind_spots: string[]
  verdict: 'world_class' | 'strong' | 'solid' | 'needs_work' | 'start_over'
  verdict_rationale: string
}

interface CopyResult {
  overall: number
  hook_strength: number
  narrative_arc: number
  brand_voice_match: number
  cta_effectiveness: number
  platform_fit: number
  emotional_arousal: number
  message_clarity: number
  persuasion_architecture: number
  virality_score: number
  engagement_prediction: 'low' | 'medium' | 'high' | 'viral'
  emotional_trigger: string
  hook_analysis: string
  cialdini_principles_used: string[]
  strengths: string[]
  improvements: string[]
  missing_elements: string[]
  platform_recommendations: string[]
  ab_test_suggestion: string
  hubspot_benchmark_note: string
}

interface DataResult {
  overall: number
  data_quality: number
  insight_depth: number
  benchmark_alignment: number
  strategic_clarity: number
  actionability: number
  completeness: number
  content_type_detected: string
  key_findings: string[]
  benchmark_gaps: string[]
  top_performers: string[]
  underperformers: string[]
  strategic_recommendations: string[]
  missing_data_points: string[]
  priority_actions: { action: string; expected_impact: string; timeline: string }[]
  verdict: 'exceptional' | 'strong' | 'adequate' | 'insufficient' | 'unusable'
  verdict_rationale: string
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

const DATA_VERDICT_CONFIG = {
  exceptional:  { label: 'Exceptional Data', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  strong:       { label: 'Strong Dataset',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  adequate:     { label: 'Adequate',         color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  insufficient: { label: 'Insufficient',     color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  unusable:     { label: 'Unusable',         color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

const STRATEGY_DIMENSIONS = [
  { key: 'clarity_of_pov'               as const, label: 'Clarity of POV',             description: 'Single, defensible POV that reframes the competitive space' },
  { key: 'audience_insight_depth'       as const, label: 'Audience Insight',            description: 'Real human tension — specific aspiration, fear, or contradiction' },
  { key: 'competitive_differentiation'  as const, label: 'Competitive Differentiation', description: 'Blue Ocean — specific moves competitors are not making' },
  { key: 'platform_calibration'         as const, label: 'Platform Calibration',        description: 'Differentiated strategy per platform — not one message posted everywhere' },
  { key: 'executional_feasibility'      as const, label: 'Executional Feasibility',     description: 'Volume and scope realistic for implied team size and budget' },
  { key: 'measurability'                as const, label: 'Measurability',               description: 'KPIs with baselines and target dates — beyond vanity metrics' },
  { key: 'cultural_intelligence'        as const, label: 'Cultural Intelligence',        description: 'MENA fit — calendar, dialect, platform penetration, consumer behaviour' },
  { key: 'strategic_logic'              as const, label: 'Strategic Logic',             description: 'Coherent argument: insight → choice → tactic → measurable outcome' },
]

const COPY_DIMENSIONS = [
  { key: 'hook_strength'          as const, label: 'Hook / Opening Strength', description: 'Scroll-halt probability — pattern interrupt quality in first 3 seconds (Meta research)' },
  { key: 'emotional_arousal'      as const, label: 'Emotional Arousal',       description: 'High-arousal emotions drive 2× shares (Berger & Milkman 2012)' },
  { key: 'narrative_arc'          as const, label: 'Narrative Arc',           description: 'Hook → tension → resolution — structural investment before payoff' },
  { key: 'message_clarity'        as const, label: 'Message Clarity',         description: '3-second extraction test — Cognitive Load Theory (Sweller)' },
  { key: 'brand_voice_match'      as const, label: 'Brand Voice Match',       description: 'Tonal alignment — feels native to the brand, not generic' },
  { key: 'cta_effectiveness'      as const, label: 'CTA Effectiveness',       description: 'Specific, frictionless action placed after value delivery (HubSpot)' },
  { key: 'platform_fit'           as const, label: 'Platform Fit',            description: 'Native-format optimisation — length, culture, algorithm alignment' },
  { key: 'persuasion_architecture' as const, label: 'Persuasion Architecture', description: 'Cialdini principles present — social proof, scarcity, authority, liking, reciprocity' },
]

const DATA_DIMENSIONS = [
  { key: 'data_quality'       as const, label: 'Data Quality',         description: 'Completeness, consistency, and structural reliability of the dataset' },
  { key: 'insight_depth'      as const, label: 'Insight Depth',        description: 'Quality and richness of extractable patterns — what stories the data tells' },
  { key: 'benchmark_alignment' as const, label: 'Benchmark Alignment', description: 'Performance vs. Sprout Social / HubSpot 2024 industry standards' },
  { key: 'strategic_clarity'  as const, label: 'Strategic Clarity',    description: 'How clearly the data narrates a strategic direction for the next 90 days' },
  { key: 'actionability'      as const, label: 'Actionability',        description: 'Ease of deriving concrete, measurable next steps from the dataset' },
  { key: 'completeness'       as const, label: 'Completeness',         description: 'Key metrics present vs. missing for a full performance intelligence picture' },
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
        <div className={cn('h-full rounded-full transition-all duration-700', scoreBg(score))} style={{ width: `${score}%` }} />
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
          <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}/>
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
  const [contentType, setContentType] = useState<ContentType>('copy')
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [text, setText] = useState('')
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string; filename: string; size: number } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [dataResult, setDataResult] = useState<DataResult | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = async (f: File) => {
    setPreparing(true)
    setEvalError(null)
    setFileData(null)
    setText('')
    try {
      const result = await prepareFile(f)
      if (mode === 'content') setContentType(result.detectedType)
      if (result.mode === 'file') {
        setFileData({ base64: result.base64, mimeType: result.mimeType, filename: f.name, size: f.size })
      } else {
        setText(result.text)
      }
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'File preparation failed')
    } finally {
      setPreparing(false)
    }
  }

  const selectedClient = clients.find(c => c.id === clientId)

  const clearFile = () => {
    setFileData(null)
    setText('')
    setEvalError(null)
  }

  const handleModeSwitch = (m: EvalMode) => {
    setMode(m)
    setStrategyResult(null)
    setCopyResult(null)
    setDataResult(null)
    setEvalError(null)
    clearFile()
  }

  const evaluate = async () => {
    if (!fileData && !text.trim()) return
    setEvaluating(true)
    setStrategyResult(null)
    setCopyResult(null)
    setDataResult(null)
    setEvalError(null)
    try {
      const params = {
        agent: mode === 'strategy' ? 'strategy_eval' : 'content_eval',
        client: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity }
          : undefined,
        ...(!fileData ? { brief: text, textContent: text } : {}),
        platform: mode === 'content' ? platform : undefined,
        evalMode: mode,
        contentType: mode === 'content' ? contentType : undefined,
      }

      let fetchInit: RequestInit
      if (fileData) {
        // Send file as binary FormData to bypass JSON body size limits
        const bytes = atob(fileData.base64)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        const blob = new Blob([arr], { type: fileData.mimeType })
        const fd = new FormData()
        fd.append('file', blob, fileData.filename)
        fd.append('params', JSON.stringify(params))
        fetchInit = { method: 'POST', body: fd }
      } else {
        fetchInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }
      }

      const res = await fetch('/api/ai', fetchInit)
      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok || data.error) { setEvalError(data.error ?? 'Evaluation failed.'); return }
      const raw = (data.text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(raw)
      if (mode === 'strategy') setStrategyResult(parsed as StrategyResult)
      else if (contentType === 'data') setDataResult(parsed as DataResult)
      else setCopyResult(parsed as CopyResult)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed. Please try again.')
    } finally {
      setEvaluating(false)
    }
  }

  const hasResult = mode === 'strategy' ? !!strategyResult : contentType === 'data' ? !!dataResult : !!copyResult
  const dimensions = mode === 'strategy' ? STRATEGY_DIMENSIONS : contentType === 'data' ? DATA_DIMENSIONS : COPY_DIMENSIONS
  const result = (mode === 'strategy' ? strategyResult : contentType === 'data' ? dataResult : copyResult) as Record<string, unknown> | null
  const isLoading = evaluating || preparing
  const canEvaluate = !!fileData || !!text.trim()

  const verdictKey = strategyResult?.verdict && strategyResult.verdict in STRATEGY_VERDICT_CONFIG
    ? strategyResult.verdict : 'solid'
  const verdictCfg = STRATEGY_VERDICT_CONFIG[verdictKey as keyof typeof STRATEGY_VERDICT_CONFIG]

  const dataVerdictKey = dataResult?.verdict && dataResult.verdict in DATA_VERDICT_CONFIG
    ? dataResult.verdict : 'adequate'
  const dataVerdictCfg = DATA_VERDICT_CONFIG[dataVerdictKey as keyof typeof DATA_VERDICT_CONFIG]

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
                {preparing
                  ? 'Preparing document…'
                  : mode === 'strategy'
                    ? 'Running Strategy Evaluation…'
                    : contentType === 'data'
                      ? 'Running Analytics Intelligence Analysis…'
                      : 'Running Content Evaluation…'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {preparing
                  ? 'Encoding for AI analysis…'
                  : mode === 'strategy'
                    ? 'Deep reading · Blue Ocean · Cultural Intelligence · Stress-testing…'
                    : contentType === 'data'
                      ? 'Pattern recognition · Benchmark comparison · Strategic gaps…'
                      : 'Deep reading · Hook science · Berger arousal · Cialdini principles…'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-5xl">
        <p className="text-sm text-slate-500">
          Paste a strategy, social copy, or upload a performance data file. The AI applies research-backed frameworks — Blue Ocean Strategy, Berger-Milkman virality science, Cialdini persuasion principles, HubSpot CTA research, and Sprout Social benchmarks — to produce a scored, actionable evaluation.
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
              {m === 'strategy' ? 'Strategy Eval' : 'Content Eval'}
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted bg-white"
              >
                <option value="">No client — evaluate generically</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Content mode selectors — content eval only */}
            {mode === 'content' && (
              <div className="grid grid-cols-2 gap-3">
                {/* Content type toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Type</label>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
                    <button
                      onClick={() => setContentType('copy')}
                      className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors',
                        contentType === 'copy' ? 'bg-novax text-white' : 'text-slate-500 hover:bg-slate-50')}
                    >
                      <FileText className="w-3 h-3"/> Copy
                    </button>
                    <button
                      onClick={() => setContentType('data')}
                      className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-l border-slate-200',
                        contentType === 'data' ? 'bg-novax text-white' : 'text-slate-500 hover:bg-slate-50')}
                    >
                      <Database className="w-3 h-3"/> Analytics Data
                    </button>
                  </div>
                </div>
                {/* Platform selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platform</label>
                  <div className="relative">
                    <select
                      value={platform}
                      onChange={e => setPlatform(e.target.value)}
                      className="w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted bg-white appearance-none"
                    >
                      {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Input area — file card OR textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {mode === 'strategy' ? 'Strategy Document or Brief' : contentType === 'data' ? 'Analytics Data / CSV Export' : 'Copy, Caption, or Script'}
                </label>
                {!fileData && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-novax font-medium border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {preparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                      {preparing ? 'Preparing…' : 'Upload file'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv,.xlsx,.xls,.docx,.pdf"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) void handleImportFile(e.target.files[0]); e.target.value = '' }}
                    />
                  </div>
                )}
              </div>

              {/* File card — shown when a binary file (PDF) is ready */}
              {fileData ? (
                <div className="rounded-xl border-2 border-novax-border bg-novax-light p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1B3D38' }}>
                        <FileText className="w-5 h-5 text-white"/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{fileData.filename}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(fileData.size / 1024).toFixed(0)} KB · Ready for AI analysis
                        </p>
                      </div>
                    </div>
                    <button onClick={clearFile} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5">
                      <XIcon className="w-4 h-4"/>
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle className="w-3 h-3"/> Document ready — no text extraction needed
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    The AI will read the document directly and begin analysis immediately.
                  </p>
                </div>
              ) : (
                <>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={10}
                    placeholder={
                      mode === 'strategy'
                        ? 'Paste your strategy document, quarterly plan, or content strategy brief…\n\nor upload a PDF above'
                        : contentType === 'data'
                          ? 'Paste your CSV export or performance data…\n\nor upload a .csv / .xlsx file above'
                          : 'Paste your caption, reel script, ad copy, or any social content…\n\nor upload a PDF above'}
                    className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-novax-muted bg-white resize-none leading-relaxed placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {text.length > 0
                      ? `${text.length} characters · ${text.split(/\s+/).filter(Boolean).length} words`
                      : '.pdf .txt .csv .xlsx .docx supported — PDFs sent directly to AI, no extraction'}
                  </p>
                </>
              )}
            </div>

            <button
              onClick={evaluate}
              disabled={isLoading || !canEvaluate}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {evaluating
                ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
                : mode === 'strategy'
                  ? <><Brain className="w-4 h-4" />Run Strategy Evaluation</>
                  : contentType === 'data'
                    ? <><Database className="w-4 h-4" />Run Analytics Intelligence</>
                    : <><Zap className="w-4 h-4" />Run Content Evaluation</>}
            </button>
          </div>

          {/* Right: score panel */}
          <div>
            {!hasResult && !evaluating && !evalError && (
              <div className="h-full flex items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  {mode === 'strategy' ? <Brain className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    : contentType === 'data' ? <Database className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    : <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />}
                  <p className="text-sm text-slate-500">
                    {mode === 'strategy' ? 'Paste a strategy to run the evaluation.'
                      : contentType === 'data' ? 'Upload or paste analytics data to analyse.'
                      : 'Paste content copy to evaluate.'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {mode === 'strategy' ? '8 dimensions · verdict · stress test'
                      : contentType === 'data' ? '6 dimensions · benchmark comparison · priority actions'
                      : '8 dimensions · virality score · Cialdini analysis'}
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
                {/* Header: overall + ring + verdict badge */}
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
                      : contentType === 'data'
                        ? ((result.insight_depth as number) ?? 0)
                        : ((result.virality_score as number) ?? 0)}
                    label={mode === 'strategy' ? 'logic' : contentType === 'data' ? 'insight' : 'viral'}
                  />
                  {mode === 'strategy' && strategyResult && (
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', verdictCfg.color, verdictCfg.bg, verdictCfg.border)}>
                      <TrendingUp className="w-3 h-3" />{verdictCfg.label}
                    </div>
                  )}
                  {mode === 'content' && contentType !== 'data' && copyResult && (() => {
                    const cfg = ENGAGEMENT_CONFIG[copyResult.engagement_prediction] ?? ENGAGEMENT_CONFIG.medium
                    return (
                      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', cfg.color, cfg.bg, cfg.border)}>
                        <TrendingUp className="w-3 h-3" />{cfg.label}
                      </div>
                    )
                  })()}
                  {mode === 'content' && contentType === 'data' && dataResult && (
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start', dataVerdictCfg.color, dataVerdictCfg.bg, dataVerdictCfg.border)}>
                      <Database className="w-3 h-3" />{dataVerdictCfg.label}
                    </div>
                  )}
                </div>

                {/* Score bars */}
                <div className="space-y-3">
                  {dimensions.map(({ key, label, description }) => (
                    <ScoreBar key={key} label={label} description={description} score={(result[key] as number) ?? 0} />
                  ))}
                </div>

                {/* Data: content type detected */}
                {contentType === 'data' && dataResult?.content_type_detected && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <Database className="w-3 h-3 text-slate-400"/>
                    <p className="text-[10px] text-slate-500">Detected: <span className="font-semibold">{dataResult.content_type_detected}</span></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Intelligence report ── */}
        {hasResult && result && !evaluating && (
          <div className="space-y-4">

            {/* STRATEGY report */}
            {mode === 'strategy' && strategyResult && (
              <>
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

            {/* COPY report */}
            {mode === 'content' && contentType === 'copy' && copyResult && (
              <>
                {/* Hook analysis banner */}
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Flame className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
                        Opening / Hook Analysis
                        {copyResult.emotional_trigger && (
                          <span className="ml-2 text-[10px] normal-case font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            {copyResult.emotional_trigger}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed">{copyResult.hook_analysis}</p>
                    </div>
                  </div>
                </div>

                {/* Cialdini principles + HubSpot benchmark */}
                {(copyResult.cialdini_principles_used?.length > 0 || copyResult.hubspot_benchmark_note) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {copyResult.cialdini_principles_used?.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Award className="w-3.5 h-3.5 text-purple-500" />
                          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Cialdini Principles Detected</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {copyResult.cialdini_principles_used.map((p, i) => (
                            <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {copyResult.hubspot_benchmark_note && (
                      <div className="bg-sky-50 rounded-xl border border-sky-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart2 className="w-3.5 h-3.5 text-sky-600" />
                          <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">HubSpot Benchmark Note</p>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{copyResult.hubspot_benchmark_note}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-3.5 h-3.5 text-red-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Missing for Impact</p>
                    </div>
                    <InsightList items={copyResult.missing_elements} dotColor="bg-red-400" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strengths</p>
                    </div>
                    <InsightList items={copyResult.strengths} dotColor="bg-emerald-400" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Improvements</p>
                    </div>
                    <InsightList items={copyResult.improvements} dotColor="bg-amber-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Monitor className="w-3.5 h-3.5 text-sky-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Platform Fit Analysis</p>
                    </div>
                    <InsightList items={copyResult.platform_recommendations} dotColor="bg-sky-400" />
                  </div>
                  <div className="bg-novax-light rounded-xl border border-novax-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <SplitSquareVertical className="w-3.5 h-3.5 text-novax-muted" />
                      <p className="text-xs font-semibold text-novax uppercase tracking-wider">A/B Test Recommendation</p>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{copyResult.ab_test_suggestion}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Scored against: Berger & Milkman virality research · Meta 1.7s dwell study · Sweller Cognitive Load Theory · Cialdini 6 Principles · HubSpot CTA standards · Platform algorithm research
                </p>
              </>
            )}

            {/* DATA ANALYTICS report */}
            {mode === 'content' && contentType === 'data' && dataResult && (
              <>
                {/* Verdict rationale */}
                <div className="p-4 bg-novax-light border border-novax-border rounded-xl">
                  <div className="flex items-start gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-novax-muted mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-novax uppercase tracking-wider mb-1.5">Intelligence Summary</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{dataResult.verdict_rationale}</p>
                    </div>
                  </div>
                </div>

                {/* Key findings + Benchmark gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-3.5 h-3.5 text-sky-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Key Findings</p>
                    </div>
                    <InsightList items={dataResult.key_findings} dotColor="bg-sky-400" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Benchmark Gaps (Sprout / HubSpot)</p>
                    </div>
                    <InsightList items={dataResult.benchmark_gaps} dotColor="bg-amber-400" />
                  </div>
                </div>

                {/* Top performers + Underperformers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Top Performers</p>
                    </div>
                    <InsightList items={dataResult.top_performers} dotColor="bg-emerald-400" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-3.5 h-3.5 text-red-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Underperformers</p>
                    </div>
                    <InsightList items={dataResult.underperformers} dotColor="bg-red-400" />
                  </div>
                </div>

                {/* Priority actions */}
                {dataResult.priority_actions?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ArrowRight className="w-3.5 h-3.5 text-novax-muted" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Priority Actions</p>
                    </div>
                    <div className="space-y-3">
                      {dataResult.priority_actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-novax-light rounded-xl border border-novax-border">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: '#1B3D38' }}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 mb-1">{a.action}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-[10px] text-emerald-700 font-medium">{a.expected_impact}</span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3"/>{a.timeline}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strategic recommendations + Missing data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-novax-muted" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strategic Recommendations</p>
                    </div>
                    <InsightList items={dataResult.strategic_recommendations} dotColor="bg-novax-border" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Missing Data Points</p>
                    </div>
                    <InsightList items={dataResult.missing_data_points} dotColor="bg-slate-300" />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Benchmarks: Sprout Social 2024 Benchmarks · HubSpot Social Media Report 2024 · Later Media · Hootsuite Global Digital 2024
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
