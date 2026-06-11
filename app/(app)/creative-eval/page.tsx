'use client'

import { useState, useRef } from 'react'
import {
  Upload, X, Loader2, TrendingUp, Eye, AlertTriangle, CheckCircle,
  Brain, Flame, Target, Share2, Monitor, Sparkles, FlaskConical,
  SplitSquareVertical, FileText, ImageIcon, AlignLeft, FileSearch,
  ShieldAlert, Lightbulb, Crosshair, Users, Award, TriangleAlert,
  ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

type FileType = 'image' | 'video'
type InputMode = 'media' | 'text' | 'strategy'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'youtube',   label: 'YouTube' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'twitter',   label: 'X (Twitter)' },
]

// ── Content eval result ────────────────────────────────────────────────────────

interface AttentionArchitecture {
  hook_window:      number
  retention_driver: number
  payoff_quality:   number
  verdict:          string
}

interface StressTest {
  skeptic_objection:  string
  is_objection_fatal: boolean
  rebuttal:           string
}

interface RewriteSuggestion {
  element:       string
  current:       string
  suggested:     string
  expected_lift: string
  reasoning:     string
}

interface ScoreEvidence {
  dimension: string
  score:     number
  evidence:  string
  benchmark: string
}

interface EvalResult {
  overall:               number
  thumb_stop_rate:       number
  emotional_resonance:   number
  brand_coherence:       number
  message_clarity:       number
  visual_quality:        number
  share_save_potential:  number
  platform_fit:          number
  strategic_contribution:number
  audience_truth:        number
  credibility_gap:       number
  virality_score:        number
  engagement_prediction: 'low' | 'medium' | 'high' | 'viral'
  attention_architecture:AttentionArchitecture
  stress_test:           StressTest
  rewrite_suggestions:   RewriteSuggestion[]
  red_flags:             string[]
  score_evidence:        ScoreEvidence[]
  psychological_triggers:string[]
  viral_elements:        string[]
  missing_elements:      string[]
  platform_recommendations:string[]
  ab_test_suggestion:    string
  strengths:             string[]
  improvements:          string[]
  hook_analysis?:        string
}

// ── Strategy eval result ───────────────────────────────────────────────────────

interface StrategyStressTest {
  core_assumption: string
  failure_mode:    string
  mitigation:      string
}

interface StrategyEvalResult {
  overall:                   number
  clarity_of_pov:            number
  audience_insight_depth:    number
  competitive_differentiation:number
  platform_calibration:      number
  executional_feasibility:   number
  measurability:             number
  cultural_intelligence:     number
  strategic_logic:           number
  strategic_stress_test:     StrategyStressTest
  critical_gaps:             string[]
  quick_wins:                string[]
  competitor_blind_spots:    string[]
  verdict:                   'world_class' | 'strong' | 'solid' | 'needs_work' | 'start_over'
  verdict_rationale:         string
}

// ── Config ─────────────────────────────────────────────────────────────────────

const PREDICTION_CONFIG = {
  low:    { label: 'Low Engagement',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  medium: { label: 'Medium Engagement', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  high:   { label: 'High Engagement',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  viral:  { label: 'Viral Potential',   color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
}

const VERDICT_CONFIG = {
  world_class: { label: 'World Class',  color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  strong:      { label: 'Strong',       color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  solid:       { label: 'Solid',        color: 'text-sky-700',    bg: 'bg-sky-50',    border: 'border-sky-200' },
  needs_work:  { label: 'Needs Work',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  start_over:  { label: 'Start Over',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
}

const CORE_DIMENSIONS = [
  { key: 'thumb_stop_rate'     as const, label: 'Thumb-Stop Rate',       description: 'Scroll-halt in 1.7s window (Meta research)' },
  { key: 'emotional_resonance' as const, label: 'Emotional Resonance',   description: 'Arousal intensity — high arousal drives 2× sharing (Berger 2012)' },
  { key: 'brand_coherence'     as const, label: 'Brand Coherence',       description: 'Visual + tonal alignment to brand identity' },
  { key: 'message_clarity'     as const, label: 'Message Clarity',       description: '3-second message extraction test (Cognitive Load Theory)' },
  { key: 'visual_quality'      as const, label: 'Visual Quality',        description: 'Technical & compositional excellence' },
  { key: 'share_save_potential'as const, label: 'Share & Save Potential',description: 'STEPPS framework trigger density (Berger)' },
  { key: 'platform_fit'        as const, label: 'Platform Fit',          description: 'Native optimisation per stated platform(s)' },
]

const STRATEGIC_DIMENSIONS = [
  { key: 'strategic_contribution' as const, label: 'Strategic Contribution', description: 'Contributes to brand memory structure vs. pure activation (Byron Sharp)' },
  { key: 'audience_truth'         as const, label: 'Audience Truth',         description: 'Real human tension, not surface demographics' },
  { key: 'credibility_gap'        as const, label: 'Credibility Gap',        description: 'Higher = brand can credibly make this claim (inverted: high is good)' },
]

const STRATEGY_DIMENSIONS = [
  { key: 'clarity_of_pov'              as const, label: 'Clarity of POV',             description: 'Single, defensible strategic point-of-view' },
  { key: 'audience_insight_depth'      as const, label: 'Audience Insight Depth',      description: 'Real tension vs. demographic description' },
  { key: 'competitive_differentiation' as const, label: 'Competitive Differentiation', description: "Genuinely different from competitors' playbook" },
  { key: 'platform_calibration'        as const, label: 'Platform Calibration',        description: 'Per-platform strategy vs. one-size-fits-all' },
  { key: 'executional_feasibility'     as const, label: 'Executional Feasibility',     description: 'Deliverable by real team with real resources' },
  { key: 'measurability'               as const, label: 'Measurability',               description: 'KPIs tied to tactics, not vanity metrics' },
  { key: 'cultural_intelligence'       as const, label: 'Cultural Intelligence',        description: 'MENA market fit — calendar, dialect, platform mix' },
  { key: 'strategic_logic'             as const, label: 'Strategic Logic',             description: 'Coherent chain: insight → choice → tactic → outcome' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function verdictCfg(verdict: string) {
  return VERDICT_CONFIG[verdict as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG.needs_work
}

function scoreColor(s: number) {
  return s >= 80 ? 'text-emerald-600' : s >= 65 ? 'text-amber-600' : s >= 50 ? 'text-orange-600' : 'text-red-600'
}
function scoreBg(s: number) {
  return s >= 80 ? 'bg-emerald-500' : s >= 65 ? 'bg-amber-500' : s >= 50 ? 'bg-orange-500' : 'bg-red-500'
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
        <div className={cn('h-full rounded-full transition-all duration-700', scoreBg(score))} style={{ width: `${score}%` }}/>
      </div>
    </div>
  )
}

function ViralityRing({ score }: { score: number }) {
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
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[8px] text-slate-400 uppercase tracking-wide">viral</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-1 text-center leading-tight">Virality<br/>Score</p>
    </div>
  )
}

async function extractXlsxText(file: File): Promise<string> {
  const ab  = await file.arrayBuffer()
  const wb  = XLSX.read(ab, { type: 'array' })
  const out: string[] = []
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false })
    if (csv.trim()) out.push(`[Sheet: ${name}]\n${csv}`)
  }
  return out.join('\n\n')
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function CreativeEvalPage() {
  const { clients } = useClients()
  const [clientId, setClientId]         = useState('')
  const [inputMode, setInputMode]       = useState<InputMode>('media')
  const [platforms, setPlatforms]       = useState<string[]>(['instagram', 'tiktok'])
  const [file, setFile]                 = useState<{ name: string; url: string; type: FileType } | null>(null)
  const [textContent, setTextContent]   = useState('')
  const [docFileName, setDocFileName]   = useState('')
  const [evaluating, setEvaluating]     = useState(false)
  const [result, setResult]             = useState<EvalResult | null>(null)
  const [stratResult, setStratResult]   = useState<StrategyEvalResult | null>(null)
  const [evalError, setEvalError]       = useState<string | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const docInputRef   = useRef<HTMLInputElement>(null)

  const togglePlatform = (id: string) =>
    setPlatforms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleMediaFile = (f: File) => {
    setFile({ name: f.name, url: URL.createObjectURL(f), type: f.type.startsWith('video/') ? 'video' : 'image' })
    setResult(null); setStratResult(null); setEvalError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleMediaFile(f)
  }

  const handleDocFile = async (f: File) => {
    setDocFileName(f.name); setResult(null); setStratResult(null); setEvalError(null)
    try {
      if (f.name.match(/\.xlsx?$|\.csv$/i)) {
        setTextContent(await extractXlsxText(f))
      } else if (f.name.endsWith('.txt')) {
        setTextContent(await f.text())
      } else if (f.name.match(/\.pdf$/i)) {
        const ab    = await f.arrayBuffer()
        const bytes = new Uint8Array(ab)
        let bin = ''
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
        const base64 = btoa(bin)
        setTextContent('Extracting PDF text…')
        const res  = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 }),
        })
        const data = await res.json() as { text?: string; error?: string }
        setTextContent(data.text?.trim() || '(Could not extract — paste text manually)')
      } else {
        const raw = await f.text()
        setTextContent(raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
          || '(Could not extract — paste text manually)')
      }
    } catch {
      setTextContent('(Could not extract — paste text manually)')
    }
  }

  const toBase64 = async (url: string, type: FileType): Promise<{ base64: string; mimeType: string }> => {
    if (type === 'video') {
      return new Promise((resolve, reject) => {
        const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.src = url
        v.onloadeddata = () => { v.currentTime = 0.1 }
        v.onseeked = () => {
          const c = document.createElement('canvas')
          c.width = Math.min(v.videoWidth, 1280)
          c.height = Math.round(c.width * (v.videoHeight / v.videoWidth))
          c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
          resolve({ base64: c.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' })
        }
        v.onerror = reject
      })
    }
    const res  = await fetch(url)
    const blob = await res.blob()
    const ab   = await blob.arrayBuffer()
    const bytes = new Uint8Array(ab)
    let bin = ''
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
    return { base64: btoa(bin), mimeType: blob.type || 'image/jpeg' }
  }

  const canEvaluate = inputMode === 'media'
    ? !!file
    : textContent.trim().length > 20

  const evaluate = async () => {
    if (!canEvaluate) return
    setEvaluating(true); setResult(null); setStratResult(null); setEvalError(null)
    try {
      const selectedClient = clients.find(c => c.id === clientId)
      const isStrategy = inputMode === 'strategy'
      const agent = isStrategy ? 'strategy_eval' : 'creative_eval'

      let payload: Record<string, unknown> = {
        agent,
        client: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity }
          : undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
      }

      if (inputMode === 'media' && file) {
        const { base64, mimeType } = await toBase64(file.url, file.type)
        payload = { ...payload, imageBase64: base64, mimeType, fileType: file.type }
      } else {
        payload = { ...payload, textContent: textContent.trim(), fileType: 'text' }
      }

      const res  = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok || data.error) { setEvalError(data.error ?? 'Evaluation failed.'); return }

      const raw = (data.text as string).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(raw)
      if (isStrategy) setStratResult(parsed as StrategyEvalResult)
      else setResult(parsed as EvalResult)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed.')
    } finally {
      setEvaluating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
    {/* Full-screen loading overlay — covers sidebar, header, everything */}
    {evaluating && (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-novax-light"/>
            <div className="absolute inset-0 rounded-full border-4 border-t-novax animate-spin"/>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {inputMode === 'strategy' ? 'Evaluating strategy…' : 'Evaluating creative…'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {inputMode === 'strategy'
                ? 'POV clarity · audience insight · differentiation · stress test'
                : 'Attention architecture · credibility gap · virality · stress test'}
            </p>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-slate-500">
        Upload a creative, paste a script, or evaluate a strategy document. Scored against world-class benchmarks — calibrated to be honest, not encouraging.
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { id: 'media',    label: 'Media',          icon: ImageIcon  },
          { id: 'text',     label: 'Text / Script',  icon: AlignLeft  },
          { id: 'strategy', label: 'Strategy',       icon: FileSearch },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setInputMode(id); setResult(null); setStratResult(null); setEvalError(null) }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              inputMode === id ? 'bg-white text-novax shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}>
            <Icon className="w-3.5 h-3.5"/>
            {label}
          </button>
        ))}
      </div>

      {/* Input + score panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Evaluate for Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white">
              <option value="">No client (generic)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Platforms (not shown for strategy) */}
          {inputMode !== 'strategy' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Target Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                      platforms.includes(p.id) ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Media input */}
          {inputMode === 'media' && (
            <>
              {!file ? (
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                  onClick={() => mediaInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-novax-border-active hover:bg-slate-50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                  <p className="text-sm font-medium text-slate-700">Drop creative here or browse</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, MP4, MOV · Max 50MB</p>
                  <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleMediaFile(e.target.files[0])}/>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                  {file.type === 'image'
                    ? <img src={file.url} alt="" className="w-full max-h-64 object-contain"/>
                    : <video src={file.url} controls className="w-full max-h-64"/>}
                  <button onClick={() => { setFile(null); setResult(null) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                  <div className="px-3 py-2 bg-white border-t border-slate-100">
                    <p className="text-xs text-slate-600 font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{file.type}</p>
                  </div>
                </div>
              )}
              {!file && (
                <button
                  onClick={() => setFile({ name: 'sample.jpg', url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800', type: 'image' })}
                  className="w-full py-2 text-xs text-novax-muted hover:text-novax font-medium transition-colors border border-dashed border-novax-border rounded-xl">
                  Use sample image for demo
                </button>
              )}
            </>
          )}

          {/* Text / Script / Strategy input */}
          {(inputMode === 'text' || inputMode === 'strategy') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <FileText className="w-3.5 h-3.5"/>
                  Import file
                </button>
                <span className="text-[10px] text-slate-400">.txt · .csv · .xlsx · .pdf · .docx</span>
                <input ref={docInputRef} type="file" accept=".txt,.csv,.xlsx,.xls,.docx,.pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && void handleDocFile(e.target.files[0])}/>
                {docFileName && <span className="text-[10px] text-novax-muted font-medium truncate max-w-[120px]">{docFileName}</span>}
              </div>
              <textarea value={textContent} onChange={e => setTextContent(e.target.value)} rows={inputMode === 'strategy' ? 14 : 10}
                placeholder={inputMode === 'strategy'
                  ? 'Paste the strategy document, quarterly plan, content pillars, or campaign brief…'
                  : 'Paste your caption, reel script, carousel copy, or ad text…'}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white resize-none"/>
              <p className="text-[10px] text-slate-400">{textContent.length} characters</p>
            </div>
          )}

          {canEvaluate && (
            <button onClick={() => void evaluate()} disabled={evaluating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {evaluating
                ? <><Loader2 className="w-4 h-4 animate-spin"/>Analysing…</>
                : <><FlaskConical className="w-4 h-4"/>
                    {inputMode === 'strategy' ? 'Run Strategy Evaluation' : 'Run Creative Evaluation'}
                  </>}
            </button>
          )}
        </div>

        {/* Score panel */}
        <div>
          {!result && !stratResult && !evaluating && !evalError && (
            <div className="h-full flex items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <Eye className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                <p className="text-sm text-slate-500">
                  {inputMode === 'strategy' ? 'Paste a strategy to run the evaluation.' : inputMode === 'media' ? 'Upload a creative to run the evaluation.' : 'Paste content to evaluate.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {inputMode === 'strategy' ? '8 strategic dimensions · stress test · quick wins' : '10 dimensions · attention architecture · rewrite suggestions'}
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
                <Loader2 className="w-8 h-8 text-novax animate-spin mx-auto mb-3"/>
                <p className="text-sm font-medium text-novax-muted">Running analysis…</p>
                <p className="text-xs text-slate-500 mt-1">
                  {inputMode === 'strategy'
                    ? 'POV clarity · audience insight · differentiation…'
                    : 'Attention architecture · credibility gap · stress test…'}
                </p>
              </div>
            </div>
          )}

          {/* Content eval scores */}
          {result && !evaluating && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              {/* Red flags banner */}
              {result.red_flags?.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <TriangleAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">Score caps applied</p>
                    {result.red_flags.map((f, i) => (
                      <p key={i} className="text-[10px] text-red-600 leading-relaxed">{f}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall + virality + prediction */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Overall Score</p>
                  <div className="flex items-end gap-1">
                    <span className={cn('text-5xl font-black leading-none', scoreColor(result.overall))}>{result.overall}</span>
                    <span className="text-sm text-slate-400 mb-1">/100</span>
                  </div>
                </div>
                <ViralityRing score={result.virality_score}/>
                <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start',
                  PREDICTION_CONFIG[result.engagement_prediction].color,
                  PREDICTION_CONFIG[result.engagement_prediction].bg,
                  PREDICTION_CONFIG[result.engagement_prediction].border)}>
                  <TrendingUp className="w-3 h-3"/>
                  {PREDICTION_CONFIG[result.engagement_prediction].label}
                </div>
              </div>

              {/* Core dimensions */}
              <div className="space-y-3">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Performance Dimensions</p>
                {CORE_DIMENSIONS.map(({ key, label, description }) => (
                  <ScoreBar key={key} label={label} description={description} score={result[key]}/>
                ))}
              </div>

              {/* Strategic dimensions */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Strategic Dimensions</p>
                {STRATEGIC_DIMENSIONS.map(({ key, label, description }) => (
                  <ScoreBar key={key} label={label} description={description} score={result[key]}/>
                ))}
              </div>
            </div>
          )}

          {/* Strategy eval scores */}
          {stratResult && !evaluating && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              {/* Overall + verdict */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Overall Score</p>
                  <div className="flex items-end gap-1">
                    <span className={cn('text-5xl font-black leading-none', scoreColor(stratResult.overall))}>{stratResult.overall}</span>
                    <span className="text-sm text-slate-400 mb-1">/100</span>
                  </div>
                </div>
                <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold self-start',
                  verdictCfg(stratResult.verdict).color,
                  verdictCfg(stratResult.verdict).bg,
                  verdictCfg(stratResult.verdict).border)}>
                  <Award className="w-3 h-3"/>
                  {verdictCfg(stratResult.verdict).label}
                </div>
              </div>

              <div className="space-y-3">
                {STRATEGY_DIMENSIONS.map(({ key, label, description }) => (
                  <ScoreBar key={key} label={label} description={description} score={stratResult[key]}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content eval intelligence panels ── */}
      {result && !evaluating && (
        <div className="space-y-4">

          {/* Attention architecture */}
          {result.attention_architecture && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-novax-muted"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Attention Architecture</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                {[
                  { label: '0–1.7s Hook', score: result.attention_architecture.hook_window, note: 'Pre-attentive trigger' },
                  { label: '1.7–7s Retention', score: result.attention_architecture.retention_driver, note: 'Reason to keep watching' },
                  { label: '7s+ Payoff', score: result.attention_architecture.payoff_quality, note: 'Worth the viewer\'s time' },
                ].map(({ label, score, note }) => (
                  <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                    <p className={cn('text-2xl font-black', scoreColor(score))}>{score}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed italic">{result.attention_architecture.verdict}</p>
            </div>
          )}

          {/* Hook analysis */}
          {result.hook_analysis && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-3.5 h-3.5 text-amber-600"/>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Hook Analysis — 0–3 Second Window</p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">{result.hook_analysis}</p>
            </div>
          )}

          {/* Stress test */}
          {result.stress_test && (
            <div className={cn('p-5 rounded-2xl border',
              result.stress_test.is_objection_fatal ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200')}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className={cn('w-4 h-4', result.stress_test.is_objection_fatal ? 'text-red-600' : 'text-slate-500')}/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Stress Test — Adversarial Review</p>
                <span className={cn('ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  result.stress_test.is_objection_fatal ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                  {result.stress_test.is_objection_fatal ? 'Objection is fatal' : 'Objection is manageable'}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium mb-1">Skeptic's objection</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.stress_test.skeptic_objection}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium mb-1">Rebuttal</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.stress_test.rebuttal}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rewrite suggestions */}
          {result.rewrite_suggestions?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-amber-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Concrete Rewrite Suggestions</p>
              </div>
              <div className="space-y-4">
                {result.rewrite_suggestions.map((s, i) => (
                  <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-700">{s.element}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{s.expected_lift}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium mb-1">Current</p>
                        <p className="text-xs text-slate-500 leading-relaxed line-through">{s.current}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-novax uppercase font-medium mb-1">Suggested</p>
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">{s.suggested}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed italic">{s.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intel grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-3.5 h-3.5 text-purple-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Psychological Triggers</p>
              </div>
              {result.psychological_triggers?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.psychological_triggers.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-100">{t}</span>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No strong triggers detected.</p>}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Viral Elements Present</p>
              </div>
              <ul className="space-y-1.5">
                {result.viral_elements?.map((el, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{el}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-red-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Missing for Virality</p>
              </div>
              <ul className="space-y-1.5">
                {result.missing_elements?.map((el, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{el}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strengths</p>
              </div>
              <ul className="space-y-2">
                {result.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Improvements</p>
              </div>
              <ul className="space-y-2">
                {result.improvements?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-3.5 h-3.5 text-sky-500"/>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Best Platforms</p>
                </div>
                <ul className="space-y-1.5">
                  {result.platform_recommendations?.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 shrink-0"/>
                      <p className="text-xs text-slate-600 leading-relaxed">{p}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-novax-light rounded-xl border border-novax-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SplitSquareVertical className="w-3.5 h-3.5 text-novax-muted"/>
                  <p className="text-xs font-semibold text-novax uppercase tracking-wider">A/B Test</p>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{result.ab_test_suggestion}</p>
              </div>
            </div>
          </div>

          {/* Score evidence (collapsible) */}
          {result.score_evidence?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button onClick={() => setEvidenceOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-slate-400"/>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Score Evidence — What Earned Each Rating</p>
                </div>
                {evidenceOpen ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
              </button>
              {evidenceOpen && (
                <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                  {result.score_evidence.map((e, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr] gap-4 py-3 border-b border-slate-50 last:border-0">
                      <div className="text-center min-w-[48px]">
                        <p className={cn('text-xl font-black', scoreColor(e.score))}>{e.score}</p>
                        <p className="text-[9px] text-slate-400 truncate max-w-[48px]">{e.dimension.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-700 leading-relaxed mb-1">{e.evidence}</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">Benchmark: {e.benchmark}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-center">
            Scored against: Berger &amp; Milkman virality research · Meta 1.7s dwell study · STEPPS · Cognitive Load Theory · Byron Sharp brand distinctiveness · Cialdini persuasion principles · Les Binet brand-response balance
          </p>
        </div>
      )}

      {/* ── Strategy eval intelligence panels ── */}
      {stratResult && !evaluating && (
        <div className="space-y-4">

          {/* Verdict rationale */}
          <div className={cn('p-5 rounded-2xl border',
            stratResult.verdict === 'world_class' || stratResult.verdict === 'strong' ? 'bg-emerald-50 border-emerald-100'
            : stratResult.verdict === 'start_over' ? 'bg-red-50 border-red-100'
            : 'bg-slate-50 border-slate-200')}>
            <div className="flex items-center gap-2 mb-2">
              <Award className={cn('w-4 h-4', verdictCfg(stratResult.verdict).color)}/>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Verdict</p>
              <span className={cn('ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full border',
                verdictCfg(stratResult.verdict).color,
                verdictCfg(stratResult.verdict).bg,
                verdictCfg(stratResult.verdict).border)}>
                {verdictCfg(stratResult.verdict).label}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{stratResult.verdict_rationale}</p>
          </div>

          {/* Stress test */}
          {stratResult.strategic_stress_test && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-slate-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strategic Stress Test — Core Assumption</p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium mb-1">The assumption this strategy rests on</p>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{stratResult.strategic_stress_test.core_assumption}</p>
                </div>
                <div>
                  <p className="text-[10px] text-red-500 uppercase font-medium mb-1">Failure mode if assumption is wrong</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{stratResult.strategic_stress_test.failure_mode}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600 uppercase font-medium mb-1">How to make it more resilient</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{stratResult.strategic_stress_test.mitigation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gaps / Quick wins / Competitor blind spots */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TriangleAlert className="w-3.5 h-3.5 text-red-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Critical Gaps</p>
              </div>
              <ul className="space-y-2">
                {stratResult.critical_gaps?.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{g}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Quick Wins</p>
              </div>
              <ul className="space-y-2">
                {stratResult.quick_wins?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{w}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-sky-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Competitor Blind Spots</p>
              </div>
              <ul className="space-y-2">
                {stratResult.competitor_blind_spots?.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{b}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Scored against: Byron Sharp brand distinctiveness · Berger STEPPS · Les Binet brand-response balance · Mark Ritson brand strategy rigour · Don Miller StoryBrand · MENA market benchmarks
          </p>
        </div>
      )}
    </div>
    </>
  )
}
