'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, X, FileText, Loader2, Send, Brain,
  Globe, BookOpen, TrendingUp, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp, MessageSquare, RotateCcw,
  Star, Target, ShieldAlert, Zap,
  FileSearch, Sparkles, Award, TriangleAlert, Info,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import type { Client } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssessmentSection {
  title: string
  score: number
  findings: string[]
  backed_by: string
}

interface Mistake {
  type: 'grammar' | 'cultural' | 'strategic' | 'factual' | 'brand'
  severity: 'critical' | 'warning' | 'minor'
  found: string
  fix: string
}

interface DirectorAssessment {
  work_type: string
  work_description: string
  overall_score: number
  verdict: 'Exceptional' | 'Strong' | 'Needs Work' | 'Rework Required'
  verdict_summary: string
  sections: AssessmentSection[]
  mistakes: Mistake[]
  director_verdict: {
    top_strength: string
    critical_fix: string
    world_class_benchmark: string
    priority_action: string
  }
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const WORK_TYPES = [
  'Auto-detect',
  'Social Caption',
  'Design / Visual',
  'Strategy Document',
  'Campaign Brief',
  'Email / Newsletter',
  'Ad Copy',
  'Video Script',
  'Report / Presentation',
]

const LOADING_STEPS = [
  { icon: FileSearch, label: 'Identifying work type and content…' },
  { icon: Globe,      label: 'Loading cultural market intelligence…' },
  { icon: BookOpen,   label: 'Applying global marketing frameworks…' },
  { icon: TrendingUp, label: 'Cross-referencing industry benchmarks…' },
  { icon: Brain,      label: 'Compiling director assessment…' },
]

const MARKETING_QUOTES = [
  '"Emotionally connected customers are 52% more valuable than merely satisfied ones." — HBR',
  '"The best marketing doesn\'t feel like marketing." — Tom Fishburne',
  '"Half the money I spend on advertising is wasted; the trouble is I don\'t know which half." — John Wanamaker',
  '"Brands that build mental availability grow 2x faster." — Byron Sharp, How Brands Grow',
  '"95% of purchase decisions happen in System 1 — the emotional, fast brain." — Kahneman',
  '"Cultural missteps cost brands 10–30% market share in the first year." — McKinsey',
  '"The first 1.5 seconds of a TikTok video determines 90% of watch rate." — TikTok Research',
  '"Ramadan campaigns in MENA see 30–50% higher conversion than baseline." — WARC',
  '"Social proof is 12x more trustworthy than brand-generated content." — Nielsen',
  '"Long-term brand campaigns are 2x more profitable than short-term activation." — Les Binet & Peter Field',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 8)  return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 6)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function scoreBg(score: number) {
  if (score >= 8)  return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
  if (score >= 6)  return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
}

function verdictConfig(verdict: DirectorAssessment['verdict']) {
  switch (verdict) {
    case 'Exceptional':     return { bg: 'bg-emerald-600', text: 'text-white', icon: Award }
    case 'Strong':          return { bg: 'bg-novax',       text: 'text-white', icon: CheckCircle }
    case 'Needs Work':      return { bg: 'bg-amber-500',   text: 'text-white', icon: AlertTriangle }
    case 'Rework Required': return { bg: 'bg-red-600',     text: 'text-white', icon: TriangleAlert }
  }
}

function mistakeSeverityStyle(s: Mistake['severity']) {
  switch (s) {
    case 'critical': return 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
    case 'warning':  return 'border-l-amber-400 bg-amber-50 dark:bg-amber-900/20'
    case 'minor':    return 'border-l-slate-300 bg-slate-50 dark:bg-slate-800/40'
  }
}

function mistakeTypeLabel(t: Mistake['type']) {
  switch (t) {
    case 'grammar':   return 'Grammar'
    case 'cultural':  return 'Cultural'
    case 'strategic': return 'Strategic'
    case 'factual':   return 'Factual'
    case 'brand':     return 'Brand'
  }
}

// ── Loading screen ────────────────────────────────────────────────────────────

function DirectorLoadingScreen({ country }: { country: string }) {
  const [step, setStep]   = useState(0)
  const [quote, setQuote] = useState(0)

  useEffect(() => {
    const stepTimer = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 1400)
    const quoteTimer = setInterval(() => setQuote(q => (q + 1) % MARKETING_QUOTES.length), 3500)
    return () => { clearInterval(stepTimer); clearInterval(quoteTimer) }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] py-12 px-6 relative overflow-hidden rounded-2xl"
      style={{ background: 'linear-gradient(160deg, #040d0c 0%, #071210 50%, #0a1a18 100%)' }}>

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(91,180,174,0.18) 0%, transparent 70%)' }} />

      {/* Brain pulse */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(91,180,174,0.12)', border: '1px solid rgba(91,180,174,0.25)' }}>
          <Brain className="w-9 h-9 text-novax-accent animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'rgba(91,180,174,0.06)', animationDuration: '2s' }} />
      </div>

      <p className="text-white font-semibold text-lg mb-1 tracking-wide">Marketing Director</p>
      <p className="text-slate-400 text-sm mb-10">
        {country ? `Reviewing for ${country} market` : 'Reviewing your work'}
      </p>

      {/* Steps */}
      <div className="w-full max-w-sm space-y-3 mb-10">
        {LOADING_STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500',
              active && 'bg-white/[0.06] border border-white/[0.08]',
              done && 'opacity-40',
            )}>
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                done   ? 'bg-novax-accent/20' : active ? 'bg-novax/30' : 'bg-white/5',
              )}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-novax-accent" />
                  : active
                    ? <Loader2 className="w-3.5 h-3.5 text-novax-accent animate-spin" />
                    : <Icon className="w-3.5 h-3.5 text-slate-600" />}
              </div>
              <span className={cn(
                'text-sm transition-colors',
                active ? 'text-white font-medium' : done ? 'text-novax-accent/60' : 'text-slate-600',
              )}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm h-0.5 bg-white/5 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-novax-accent rounded-full transition-all duration-1000"
          style={{ width: `${((step + 1) / LOADING_STEPS.length) * 100}%` }} />
      </div>

      {/* Rotating quote */}
      <div className="w-full max-w-sm text-center px-4 min-h-[48px]">
        <p className="text-slate-500 text-[11px] leading-relaxed italic transition-opacity duration-700">
          {MARKETING_QUOTES[quote]}
        </p>
      </div>
    </div>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="88" height="88" className="shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-700" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="18" fontWeight="700">{score.toFixed(1)}</text>
      <text x="44" y="58" textAnchor="middle" dominantBaseline="central"
        fill="#94a3b8" fontSize="9">/10</text>
    </svg>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: AssessmentSection }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={cn('rounded-xl border overflow-hidden', scoreBg(section.score))}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className={cn('text-lg font-bold tabular-nums', scoreColor(section.score))}>
            {section.score.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{section.title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <ul className="space-y-1.5">
            {section.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {section.backed_by && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-black/5 dark:border-white/5 pt-2 mt-2">
              <span className="font-semibold">Source: </span>{section.backed_by}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketingDirectorPage() {
  const { clients } = useClients()

  // Upload state
  const [file, setFile]               = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [textContent, setTextContent] = useState('')
  const [isDragging, setIsDragging]   = useState(false)
  const fileInputRef                   = useRef<HTMLInputElement>(null)

  // Config state
  const [selectedClientId, setSelectedClientId] = useState('')
  const [workType, setWorkType]                 = useState('Auto-detect')
  const [workBrief, setWorkBrief]               = useState('')

  // Assessment state
  const [loading, setLoading]         = useState(false)
  const [assessment, setAssessment]   = useState<DirectorAssessment | null>(null)
  const [evalError, setEvalError]     = useState<string | null>(null)

  // Chat state
  const [chatOpen, setChatOpen]       = useState(false)
  const [chatInput, setChatInput]     = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef                     = useRef<HTMLDivElement>(null)

  const selectedClient: Client | undefined = clients.find(c => c.id === selectedClientId)

  // ── File handling ───────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setEvalError(null)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setFilePreview(url)
    } else {
      setFilePreview(null)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Evaluate ────────────────────────────────────────────────────────────────

  const evaluate = async () => {
    if (!file && !textContent.trim()) {
      setEvalError('Upload a file or paste text content before evaluating.')
      return
    }
    setLoading(true)
    setAssessment(null)
    setEvalError(null)
    setChatHistory([])
    setChatOpen(false)

    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      if (textContent) fd.append('text_content', textContent)
      if (selectedClientId) fd.append('client_id', selectedClientId)
      if (workType !== 'Auto-detect') fd.append('work_type', workType)
      if (workBrief) fd.append('work_brief', workBrief)

      const res  = await fetch('/api/marketing-director/evaluate', { method: 'POST', body: fd })
      const data = await res.json() as { assessment?: DirectorAssessment; error?: string }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Evaluation failed')
      setAssessment(data.assessment!)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Chat ────────────────────────────────────────────────────────────────────

  const sendChatMessage = async (msg: string) => {
    if (!msg.trim() || !assessment || chatLoading) return

    const prevHistory = chatHistory
    setChatHistory(h => [...h, { role: 'user', content: msg }])
    setChatLoading(true)

    const assessmentCtx = `Work: ${assessment.work_type}. Score: ${assessment.overall_score}/10. Verdict: ${assessment.verdict}. ${assessment.verdict_summary}`
    const clientCtx = selectedClient
      ? `Client: ${selectedClient.name}${selectedClient.country ? `, ${selectedClient.country}` : ''}`
      : ''

    try {
      const res = await fetch('/api/marketing-director/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: prevHistory,
          assessment_context: assessmentCtx,
          client_context: clientCtx,
        }),
      })
      const data = await res.json() as { reply?: string; error?: string }
      setChatHistory(h => [...h, {
        role: 'assistant',
        content: data.reply ?? 'No response received.',
      }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Request failed. Check your connection and try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    sendChatMessage(msg)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasLocale = selectedClient && (selectedClient.country || selectedClient.city)
  const canEvaluate = (!!file || !!textContent.trim()) && !loading

  return (
    <div className="max-w-6xl space-y-6">

      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #1B3D38, #2A6B62)' }}>
          <Brain className="w-5 h-5 text-novax-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Marketing Director</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload your work for a senior-level evaluation backed by global marketing science and cultural intelligence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Upload + Config ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Upload zone */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Submit Your Work</p>
              <p className="text-xs text-slate-400 mt-0.5">Upload an image, design, document — or paste text below</p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => !file && fileInputRef.current?.click()}
              className={cn(
                'relative m-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer',
                isDragging
                  ? 'border-novax-border-active bg-novax-light dark:bg-novax/10'
                  : file
                    ? 'border-slate-200 dark:border-slate-700 cursor-default'
                    : 'border-slate-200 dark:border-slate-700 hover:border-novax-border hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              {file ? (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg shrink-0 border border-slate-200" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB · {file.type || 'Unknown type'}</p>
                      {filePreview && (
                        <p className="text-[11px] text-novax-muted mt-1 dark:text-novax-accent">
                          Visual analysis will be included in the evaluation
                        </p>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); clearFile() }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">Images, PDFs, text files supported</p>
                  <div className="flex items-center gap-2 mt-3">
                    {['JPG', 'PNG', 'WebP', 'PDF', 'TXT'].map(ext => (
                      <span key={ext} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">{ext}</span>
                    ))}
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {/* OR text paste */}
            <div className="mx-4 mb-4">
              <div className="relative">
                <textarea
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Or paste your caption, copy, script, brief… directly here"
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-novax-border-active focus:ring-2 focus:ring-novax-light dark:focus:ring-novax/20 resize-none"
                />
                {textContent && (
                  <button onClick={() => setTextContent('')}
                    className="absolute top-2 right-2 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Evaluation Context</p>

            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Client</label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-novax-border-active"
              >
                <option value="">No client (general evaluation)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.country ? ` · ${c.country}` : ''}
                  </option>
                ))}
              </select>

              {/* Cultural context indicator */}
              {selectedClient && (
                <div className={cn(
                  'mt-2 px-3 py-2 rounded-lg border text-xs flex items-start gap-2',
                  hasLocale
                    ? 'bg-novax-light border-novax-border dark:bg-novax/10 dark:border-novax/30'
                    : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
                )}>
                  {hasLocale ? (
                    <>
                      <Globe className="w-3.5 h-3.5 text-novax shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-novax dark:text-novax-accent">
                          {[selectedClient.city, selectedClient.country].filter(Boolean).join(', ')} market
                        </span>
                        {selectedClient.culture_notes && (
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{selectedClient.culture_notes}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-amber-700 dark:text-amber-400">
                        No market location set for this client. Add country, city and culture notes in client settings for cultural intelligence.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Work type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Work Type</label>
              <div className="flex flex-wrap gap-1.5">
                {WORK_TYPES.map(wt => (
                  <button key={wt} onClick={() => setWorkType(wt)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      workType === wt
                        ? 'bg-novax text-white border-novax'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300',
                    )}>
                    {wt}
                  </button>
                ))}
              </div>
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Brief / Context <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={workBrief}
                onChange={e => setWorkBrief(e.target.value)}
                placeholder="What is this for? What goal should it achieve? Any constraints?"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-novax-border-active resize-none"
              />
            </div>

            {/* Evaluate button */}
            {evalError && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{evalError}
              </p>
            )}
            <button
              onClick={evaluate}
              disabled={!canEvaluate}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                canEvaluate
                  ? 'bg-novax hover:bg-novax-hover text-white shadow-lg shadow-novax/20 active:scale-[0.98]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed',
              )}
            >
              <Brain className="w-4 h-4" />
              Evaluate with Marketing Director
            </button>

            {assessment && (
              <button onClick={() => { setAssessment(null); setChatHistory([]); setChatOpen(false) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                Start a new evaluation
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Loading / Assessment ───────────────────────────────────── */}
        <div className="space-y-4">
          {loading && (
            <DirectorLoadingScreen country={selectedClient?.country ?? ''} />
          )}

          {!loading && !assessment && (
            <div className="flex flex-col items-center justify-center min-h-[520px] bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your assessment will appear here</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                Upload your work on the left, set the context, and the Marketing Director will evaluate it against global benchmarks and your client's market.
              </p>
            </div>
          )}

          {!loading && assessment && (
            <div className="space-y-4">

              {/* Overall verdict */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                  <ScoreRing score={assessment.overall_score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const vc = verdictConfig(assessment.verdict)
                        const VIcon = vc.icon
                        return (
                          <span className={cn('flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold', vc.bg, vc.text)}>
                            <VIcon className="w-3 h-3" />
                            {assessment.verdict}
                          </span>
                        )
                      })()}
                      <span className="text-xs text-slate-400 font-medium">{assessment.work_type}</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-100 font-medium leading-snug">
                      {assessment.verdict_summary}
                    </p>
                    {assessment.work_description && (
                      <p className="text-xs text-slate-400 mt-1">{assessment.work_description}</p>
                    )}
                  </div>
                </div>

                {/* Director verdict strip */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Top Strength</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{assessment.director_verdict.top_strength}</p>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Critical Fix</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{assessment.director_verdict.critical_fix}</p>
                  </div>
                </div>

                {assessment.director_verdict.world_class_benchmark && (
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Award className="w-3 h-3 text-novax-accent" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">World-Class Benchmark</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug italic">{assessment.director_verdict.world_class_benchmark}</p>
                  </div>
                )}

                {assessment.director_verdict.priority_action && (
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3 h-3 text-novax" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Priority Action</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{assessment.director_verdict.priority_action}</p>
                  </div>
                )}
              </div>

              {/* Sections */}
              <div className="space-y-2">
                {assessment.sections.map((s, i) => <SectionCard key={i} section={s} />)}
              </div>

              {/* Mistakes */}
              {assessment.mistakes.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Mistakes & Corrections
                    </span>
                    <span className="ml-auto text-xs text-slate-400">{assessment.mistakes.length} found</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {assessment.mistakes.map((m, i) => (
                      <div key={i} className={cn('border-l-4 px-4 py-3', mistakeSeverityStyle(m.severity))}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wide',
                            m.severity === 'critical' ? 'text-red-600' : m.severity === 'warning' ? 'text-amber-600' : 'text-slate-500')}>
                            {m.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{mistakeTypeLabel(m.type)}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mb-1"><span className="font-medium">Found: </span>{m.found}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400"><span className="font-medium text-emerald-600 dark:text-emerald-400">Fix: </span>{m.fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat trigger */}
              <button
                onClick={() => setChatOpen(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-novax-border/50 text-novax dark:text-novax-accent text-sm font-medium hover:bg-novax-light dark:hover:bg-novax/10 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                {chatOpen ? 'Close Director Chat' : 'Ask the Director a Question'}
              </button>

            </div>
          )}
        </div>
      </div>

      {/* ── Chat panel (full width, below results) ────────────────────────── */}
      {chatOpen && assessment && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #040d0c, #071210)' }}>
            <Brain className="w-4 h-4 text-novax-accent" />
            <span className="text-sm font-semibold text-white">Director Chat</span>
            <span className="text-[11px] text-slate-500 ml-1">— ask anything about the assessment</span>
          </div>

          <div className="p-4 h-72 overflow-y-auto space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400">Ask about any part of the evaluation, request a rewrite suggestion, or get strategic advice.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {[
                    'What\'s the highest-impact change I can make?',
                    'How would you rewrite the headline?',
                    'What would this look like at world-class level?',
                    'What cultural mistake should I prioritise fixing?',
                  ].map(q => (
                    <button key={q} onClick={() => sendChatMessage(q)} disabled={chatLoading}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-novax-border hover:text-novax dark:hover:text-novax-accent transition-colors text-left disabled:opacity-40">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatHistory.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #1B3D38, #2A6B62)' }}>
                    <Brain className="w-3 h-3 text-novax-accent" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed',
                  m.role === 'user'
                    ? 'bg-novax text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm',
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 pl-8">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
              placeholder="Ask the Director…"
              disabled={chatLoading}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-novax-border-active disabled:opacity-50"
            />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
              className="px-3 py-2 rounded-lg bg-novax text-white disabled:opacity-40 hover:bg-novax-hover transition-colors">
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
