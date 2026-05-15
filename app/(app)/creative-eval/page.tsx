'use client'

import { useState, useRef } from 'react'
import {
  Upload, X, Loader2, TrendingUp, Eye, Zap, AlertTriangle, CheckCircle,
  Brain, Flame, Target, Share2, Monitor, Sparkles, FlaskConical, SplitSquareVertical,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'

type FileType = 'image' | 'video'

interface EvalResult {
  overall: number
  thumb_stop_rate: number
  emotional_resonance: number
  brand_coherence: number
  message_clarity: number
  visual_quality: number
  share_save_potential: number
  platform_fit: number
  virality_score: number
  engagement_prediction: 'low' | 'medium' | 'high' | 'viral'
  psychological_triggers: string[]
  viral_elements: string[]
  missing_elements: string[]
  platform_recommendations: string[]
  ab_test_suggestion: string
  strengths: string[]
  improvements: string[]
  hook_analysis?: string
}

const PREDICTION_CONFIG = {
  low:    { label: 'Low Engagement',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  medium: { label: 'Medium Engagement', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  high:   { label: 'High Engagement',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  viral:  { label: 'Viral Potential',   color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
}

const SCORE_DIMENSIONS = [
  {
    key: 'thumb_stop_rate' as const,
    label: 'Thumb-Stop Rate',
    description: 'Scroll-halt probability in 1.7s (Meta research)',
  },
  {
    key: 'emotional_resonance' as const,
    label: 'Emotional Resonance',
    description: 'Arousal intensity — high arousal drives 2× sharing (Berger 2012)',
  },
  {
    key: 'brand_coherence' as const,
    label: 'Brand Coherence',
    description: 'Visual + tonal alignment to brand identity',
  },
  {
    key: 'message_clarity' as const,
    label: 'Message Clarity',
    description: '3-second message extraction test (Cognitive Load Theory)',
  },
  {
    key: 'visual_quality' as const,
    label: 'Visual Quality',
    description: 'Technical & compositional excellence',
  },
  {
    key: 'share_save_potential' as const,
    label: 'Share & Save Potential',
    description: 'STEPPS framework trigger density (Berger)',
  },
  {
    key: 'platform_fit' as const,
    label: 'Platform Fit',
    description: 'Native optimisation — aspect ratio, text density, sound-off clarity',
  },
]

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
          <span className="text-[8px] text-slate-400 uppercase tracking-wide">viral</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-1 text-center leading-tight">Virality<br/>Score</p>
    </div>
  )
}

export default function CreativeEvalPage() {
  const { clients } = useClients()
  const [client, setClient] = useState('')
  const [file, setFile] = useState<{ name: string; url: string; type: FileType } | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<EvalResult | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile({ name: f.name, url: URL.createObjectURL(f), type: f.type.startsWith('video/') ? 'video' : 'image' })
    setResult(null)
    setEvalError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const toBase64 = async (url: string, type: FileType): Promise<{ base64: string; mimeType: string }> => {
    if (type === 'video') {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.src = url
        video.onloadeddata = () => { video.currentTime = 0.1 }
        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          canvas.width = Math.min(video.videoWidth, 1280)
          canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth))
          canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve({ base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' })
        }
        video.onerror = reject
      })
    }
    if (url.startsWith('blob:')) {
      const res = await fetch(url)
      const blob = await res.blob()
      const ab = await blob.arrayBuffer()
      const bytes = new Uint8Array(ab)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      return { base64: btoa(binary), mimeType: blob.type || 'image/jpeg' }
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.min(img.naturalWidth, 1280)
        canvas.height = Math.round(canvas.width * (img.naturalHeight / img.naturalWidth))
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = url
    })
  }

  const evaluate = async () => {
    if (!file) return
    setEvaluating(true)
    setResult(null)
    setEvalError(null)
    try {
      const { base64, mimeType } = await toBase64(file.url, file.type)
      const selectedClient = clients.find(c => c.id === client)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'creative_eval',
          client: selectedClient ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity } : undefined,
          imageBase64: base64,
          mimeType,
          fileType: file.type,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setEvalError(data.error ?? 'Evaluation failed.'); return }

      // Strip any markdown fences the model might wrap around the JSON
      const raw = (data.text as string).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      setResult(JSON.parse(raw))
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed. Please try again.')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-slate-500">
        Upload an image or video. The AI applies 7 neuroscience-backed dimensions — scroll psychology, virality science, and platform algorithm research — to produce an actionable creative brief.
      </p>

      {/* ── Upload row ── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Evaluate for Client</label>
            <select value={client} onChange={e => setClient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white">
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {!file ? (
            <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-novax-border-active hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
              <p className="text-sm font-medium text-slate-700">Drop creative here or browse</p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, MP4, MOV · Max 50MB</p>
              <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
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

          {file && (
            <button onClick={evaluate} disabled={evaluating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {evaluating
                ? <><Loader2 className="w-4 h-4 animate-spin"/>Analysing with 7 scientific dimensions…</>
                : <><FlaskConical className="w-4 h-4"/>Run Scientific Evaluation</>}
            </button>
          )}

          {!file && (
            <button
              onClick={() => setFile({ name: 'sample-creative.jpg', url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800', type: 'image' })}
              className="w-full py-2 text-xs text-novax-muted hover:text-novax font-medium transition-colors border border-dashed border-novax-border rounded-xl">
              Use sample image for demo
            </button>
          )}
        </div>

        {/* ── Score panel ── */}
        <div>
          {!result && !evaluating && !evalError && (
            <div className="h-full flex items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <Eye className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                <p className="text-sm text-slate-500">Upload a creative to run the scientific evaluation.</p>
                <p className="text-xs text-slate-400 mt-1">7 dimensions · virality scoring · A/B test recommendation</p>
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
                <p className="text-xs text-slate-500 mt-1">Thumb-stop · Emotional arousal · STEPPS virality…</p>
              </div>
            </div>
          )}

          {result && !evaluating && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              {/* Header row: overall + virality + prediction */}
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

              {/* 7 score bars */}
              <div className="space-y-3">
                {SCORE_DIMENSIONS.map(({ key, label, description }) => (
                  <ScoreBar key={key} label={label} description={description} score={result[key]}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Full intelligence report ── */}
      {result && !evaluating && (
        <div className="space-y-4">
          {/* Hook analysis — video only */}
          {result.hook_analysis && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-3.5 h-3.5 text-amber-600"/>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Hook Analysis — 0–3 Second Window</p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">{result.hook_analysis}</p>
            </div>
          )}

          {/* Row 1: Triggers + Viral elements + Missing elements */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-3.5 h-3.5 text-purple-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Psychological Triggers</p>
              </div>
              {result.psychological_triggers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.psychological_triggers.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-100">{t}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No strong triggers detected.</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Viral Elements Present</p>
              </div>
              <ul className="space-y-1.5">
                {result.viral_elements.map((el, i) => (
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
                {result.missing_elements.map((el, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0"/>
                    <p className="text-xs text-slate-600 leading-relaxed">{el}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Row 2: Strengths + Improvements + Platform recs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500"/>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strengths</p>
              </div>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
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
                {result.improvements.map((s, i) => (
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
                  {result.platform_recommendations.map((p, i) => (
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

          {/* Science footnote */}
          <p className="text-[10px] text-slate-400 text-center">
            Scored against: Berger & Milkman virality research · Meta 1.7s dwell study · STEPPS framework · Cognitive Load Theory · Itti-Koch visual saliency · Cialdini persuasion principles
          </p>
        </div>
      )}
    </div>
  )
}
