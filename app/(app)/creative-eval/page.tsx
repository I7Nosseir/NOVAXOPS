'use client'

import { useState, useRef } from 'react'
import {
  Upload, X, Loader2, TrendingUp, Eye, AlertTriangle, CheckCircle,
  Brain, Flame, Target, Share2, Monitor, Sparkles, FlaskConical,
  SplitSquareVertical, FileText, ImageIcon, FileSearch,
  ShieldAlert, Lightbulb, Crosshair, Users, Award, TriangleAlert,
  ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'

type FileType = 'image' | 'video' | 'pdf'
type InputMode = 'media' | 'strategy'

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
  { key: 'thumb_stop_rate'     as const, label: 'Scroll Stop',            description: 'Would someone pause mid-scroll for this?' },
  { key: 'emotional_resonance' as const, label: 'Emotional Pull',         description: 'Does it make people feel something strongly?' },
  { key: 'brand_coherence'     as const, label: 'Brand Fit',              description: 'Looks and sounds like this brand' },
  { key: 'message_clarity'     as const, label: 'Message Clarity',        description: 'Can you understand the point in 3 seconds?' },
  { key: 'visual_quality'      as const, label: 'Visual Quality',         description: 'Technical and compositional quality' },
  { key: 'share_save_potential'as const, label: 'Share & Save Potential', description: 'Would people share this or save it for later?' },
  { key: 'platform_fit'        as const, label: 'Platform Fit',           description: 'Optimised for the target platform' },
]

const STRATEGIC_DIMENSIONS = [
  { key: 'strategic_contribution' as const, label: 'Brand Building',    description: 'Does it build the brand long-term, not just drive clicks?' },
  { key: 'audience_truth'         as const, label: 'Audience Insight',  description: 'Built on what this audience actually thinks and feels' },
  { key: 'credibility_gap'        as const, label: 'Brand Credibility', description: 'Can this brand back up what it\'s claiming? (higher = more credible)' },
]

const STRATEGY_DIMENSIONS = [
  { key: 'clarity_of_pov'              as const, label: 'Clear Direction',        description: 'Has a single, clear strategic direction' },
  { key: 'audience_insight_depth'      as const, label: 'Audience Understanding', description: 'Built on real audience tensions, not just demographics' },
  { key: 'competitive_differentiation' as const, label: 'Stands Out',             description: 'Does something competitors are not already doing' },
  { key: 'platform_calibration'        as const, label: 'Platform Strategy',      description: 'Genuinely adapted per platform, not just reformatted' },
  { key: 'executional_feasibility'     as const, label: 'Realistic to Execute',   description: 'Deliverable by the actual team with real resources' },
  { key: 'measurability'               as const, label: 'Measurable Goals',       description: 'Clear metrics tied to specific tactics' },
  { key: 'cultural_intelligence'       as const, label: 'Local Market Fit',       description: 'Reflects the regional market — not a generic template' },
  { key: 'strategic_logic'             as const, label: 'Logical Flow',           description: 'Every tactic connects to a clear audience insight and outcome' },
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

// ── Main ───────────────────────────────────────────────────────────────────────

export default function CreativeEvalPage() {
  const { clients } = useClients()
  const [clientId, setClientId]         = useState('')
  const [inputMode, setInputMode]       = useState<InputMode>('media')
  const [platforms, setPlatforms]       = useState<string[]>(['instagram', 'tiktok'])
  const [file, setFile]                 = useState<{ name: string; url: string; type: FileType; rawFile?: File; size?: number } | null>(null)
  const [stratFile, setStratFile]       = useState<{ name: string; file: File; size: number } | null>(null)
  const [evaluating, setEvaluating]     = useState(false)
  const [result, setResult]             = useState<EvalResult | null>(null)
  const [stratResult, setStratResult]   = useState<StrategyEvalResult | null>(null)
  const [evalError, setEvalError]       = useState<string | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const stratInputRef = useRef<HTMLInputElement>(null)

  const togglePlatform = (id: string) =>
    setPlatforms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleMediaFile = (f: File) => {
    if (f.type === 'application/pdf' || f.name.match(/\.pdf$/i)) {
      if (f.size > 5 * 1024 * 1024) {
        setEvalError('PDF is too large — maximum size is 5MB.')
        return
      }
      setFile({ name: f.name, url: '', type: 'pdf', rawFile: f, size: f.size })
    } else {
      setFile({ name: f.name, url: URL.createObjectURL(f), type: f.type.startsWith('video/') ? 'video' : 'image' })
    }
    setResult(null); setStratResult(null); setEvalError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleMediaFile(f)
  }

  const handleStratFile = (f: File) => {
    if (!f.name.match(/\.pdf$/i)) {
      setEvalError('Only PDF files are supported for strategy evaluation.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setEvalError('PDF is too large — maximum size is 5MB. Try exporting a smaller version.')
      return
    }
    setStratFile({ name: f.name, file: f, size: f.size })
    setResult(null); setStratResult(null); setEvalError(null)
  }

  const handleStratDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleStratFile(f)
  }

  const toBase64 = async (url: string, type: FileType): Promise<{ base64: string; mimeType: string }> => {
    if (type === 'video') {
      return new Promise((resolve, reject) => {
        const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.src = url
        v.onloadeddata = () => { v.currentTime = 0.1 }
        v.onseeked = () => {
          const c = document.createElement('canvas')
          c.width = Math.min(v.videoWidth, 512)
          c.height = Math.round(c.width * (v.videoHeight / v.videoWidth))
          c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
          const result = { base64: c.toDataURL('image/jpeg', 0.65).split(',')[1], mimeType: 'image/jpeg' }
          console.log('[eval] Video thumbnail base64 size:', Math.round(result.base64.length / 1024) + 'KB')
          resolve(result)
        }
        v.onerror = reject
      })
    }
    const res  = await fetch(url)
    const blob = await res.blob()
    // Resize to max 960px to stay within API body limits
    const bitmap = await createImageBitmap(blob)
    const MAX = 720
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    const result = { base64: c.toDataURL('image/jpeg', 0.65).split(',')[1], mimeType: 'image/jpeg' }
    console.log('[eval] Image base64 size:', Math.round(result.base64.length / 1024) + 'KB')
    return result
  }

  const canEvaluate = inputMode === 'media' ? !!file : !!stratFile

  const evaluate = async () => {
    if (!canEvaluate) return
    setEvaluating(true); setResult(null); setStratResult(null); setEvalError(null)
    try {
      const selectedClient = clients.find(c => c.id === clientId)
      const isStrategy = inputMode === 'strategy'
      const agent = isStrategy ? 'strategy_eval' : 'creative_eval'

      const basePayload: Record<string, unknown> = {
        agent,
        client: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity }
          : undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
      }

      let res: Response

      if (inputMode === 'media' && file && file.type === 'pdf' && file.rawFile) {
        // PDF creative eval — send as binary multipart (no base64 JSON overhead)
        const fd = new FormData()
        fd.set('params', JSON.stringify({ ...basePayload, fileType: 'pdf' }))
        fd.set('file', file.rawFile)
        console.log('[eval] Sending creative PDF via multipart, size:', Math.round((file.size ?? 0) / 1024) + 'KB')
        res = await fetch('/api/ai', { method: 'POST', body: fd })
      } else if (inputMode === 'media' && file) {
        const { base64, mimeType } = await toBase64(file.url, file.type as 'image' | 'video')
        const payload = { ...basePayload, imageBase64: base64, mimeType, fileType: file.type }
        res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else if (inputMode === 'strategy' && stratFile) {
        // Send PDF as binary multipart — avoids base64 JSON body overhead
        const fd = new FormData()
        fd.set('params', JSON.stringify(basePayload))
        fd.set('file', stratFile.file)
        console.log('[eval] Sending PDF via multipart, size:', Math.round(stratFile.size / 1024) + 'KB')
        res = await fetch('/api/ai', { method: 'POST', body: fd })
      } else {
        return
      }

      let data: { error?: string; text?: string; message?: string } = {}
      try {
        data = await res.json()
      } catch {
        console.error('[eval] Failed to parse response JSON, status:', res.status)
        setEvalError(
          res.status === 413
            ? 'File is too large. For images try a smaller file; for PDFs compress to under 5MB.'
            : `Server error (${res.status}) — please try again.`
        )
        return
      }

      if (!res.ok) {
        console.error('[eval] Non-OK response:', res.status, data)
        setEvalError(
          res.status === 413
            ? 'File is too large. For images try a smaller file; for PDFs compress to under 5MB.'
            : (data.error ?? data.message ?? `Server error (${res.status}).`)
        )
        return
      }
      if (data.error) { setEvalError(data.error); return }

      const rawText = data.text ?? ''
      const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      let parsed: EvalResult | StrategyEvalResult
      try {
        parsed = JSON.parse(raw)
      } catch (parseErr) {
        console.error('[eval] JSON parse failed. Raw response start:', rawText.slice(0, 200))
        setEvalError('The AI returned an unexpected response format. Please try again.')
        return
      }
      if (isStrategy) setStratResult(parsed as StrategyEvalResult)
      else setResult(parsed as EvalResult)
    } catch (err) {
      console.error('[eval] Unexpected error:', err)
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
                ? 'Direction · audience understanding · differentiation · stress test'
                : 'Scroll stop · emotional pull · brand fit · rewrite suggestions'}
            </p>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-slate-500">
        Upload a creative or a strategy PDF. Scored against world-class benchmarks — calibrated to be honest, not encouraging.
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { id: 'media',    label: 'Creative',  icon: ImageIcon  },
          { id: 'strategy', label: 'Strategy',  icon: FileSearch },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => {
            setInputMode(id)
            setResult(null); setStratResult(null); setEvalError(null)
            if (id === 'media') setStratFile(null)
            if (id === 'strategy') setFile(null)
          }}
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

          {/* Creative input — image, video, or PDF */}
          {inputMode === 'media' && (
            <>
              {!file ? (
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                  onClick={() => mediaInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-novax-border-active hover:bg-slate-50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                  <p className="text-sm font-medium text-slate-700">Drop creative here or browse</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, MP4, MOV, PDF · PDF max 5MB</p>
                  <input ref={mediaInputRef} type="file" accept="image/*,video/*,.pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleMediaFile(e.target.files[0])}/>
                </div>
              ) : file.type === 'pdf' ? (
                <div className="flex items-center gap-3 p-4 bg-novax-light rounded-xl border border-novax-border">
                  <FileText className="w-5 h-5 text-novax-muted shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{file.size ? (file.size / 1024).toFixed(0) + ' KB' : 'PDF document'}</p>
                  </div>
                  <button onClick={() => { setFile(null); setResult(null) }}
                    className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5"/>
                  </button>
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

          {/* Strategy PDF input */}
          {inputMode === 'strategy' && (
            <>
              {!stratFile ? (
                <div onDrop={handleStratDrop} onDragOver={e => e.preventDefault()}
                  onClick={() => stratInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-novax-border-active hover:bg-slate-50 transition-colors cursor-pointer">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                  <p className="text-sm font-medium text-slate-700">Drop strategy PDF here or browse</p>
                  <p className="text-xs text-slate-400 mt-1">PDF only · Max 5MB</p>
                  <input ref={stratInputRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleStratFile(e.target.files[0])}/>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-novax-light rounded-xl border border-novax-border">
                  <FileText className="w-5 h-5 text-novax-muted shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{stratFile.name}</p>
                    <p className="text-xs text-slate-400">{(stratFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => { setStratFile(null); setStratResult(null); setEvalError(null) }}
                    className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              )}
            </>
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
                  {inputMode === 'strategy' ? 'Upload a strategy PDF to run the evaluation.' : 'Upload a creative to run the evaluation.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {inputMode === 'strategy' ? '8 dimensions · stress test · quick wins · what to fix' : '10 dimensions · attention flow · rewrite suggestions'}
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
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Attention Flow</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                {[
                  { label: 'Opening (0–3s)', score: result.attention_architecture.hook_window, note: 'Does it grab attention immediately?' },
                  { label: 'Middle', score: result.attention_architecture.retention_driver, note: 'Is there a reason to keep watching?' },
                  { label: 'Finish', score: result.attention_architecture.payoff_quality, note: 'Is the payoff worth the viewer\'s time?' },
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
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Stress Test — Biggest Weakness</p>
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
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Stress Test — Key Assumption</p>
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

        </div>
      )}
    </div>
    </>
  )
}
