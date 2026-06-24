'use client'

import { useState, useRef } from 'react'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import {
  TrendingUp, Plus, X, Sparkles, RefreshCw, Download,
  ChevronDown, ChevronUp, BarChart2, Target, ImagePlus,
  CheckCircle, AlertCircle, BookOpen, Megaphone,
} from 'lucide-react'

// ─── Brand palette ─────────────────────────────────────────────────────────────
const B = {
  primary: '#1B3D38',
  muted:   '#2A6B62',
  accent:  '#5BB4AE',
  border:  '#9DCCC8',
  light:   '#EBF4F3',
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const PLATFORMS  = ['Meta Ads', 'TikTok Ads', 'Google Ads', 'Snapchat Ads', 'LinkedIn Ads', 'YouTube Ads']
const OBJECTIVES = ['Brand Awareness', 'Reach', 'Traffic', 'Engagement', 'Lead Generation', 'Conversions', 'Video Views', 'App Installs']
const CURRENCIES = ['SAR', 'AED', 'USD', 'EGP', 'KWD']

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CampaignOption {
  id: string
  platform: string
  objective: string
  budget: string
  startDate: string
  endDate: string
  targetAudience: string
  notes: string
}

interface KpiEstimate {
  metric: string
  value: string
  basis: string
}

interface CampaignResult {
  optionIndex: number
  platform: string
  objective: string
  budget: string
  currency: string
  headline: string
  rationale: string
  kpis: KpiEstimate[]
  strengths: string[]
  considerations: string[]
  recommended: boolean
}

interface MediaBuyerGuideSection {
  title: string
  steps: string[]
}

interface GenerateResult {
  clientName: string
  period: string
  currency: string
  campaigns: CampaignResult[]
  mediaBuyerGuide: MediaBuyerGuideSection[]
  executiveSummary: string
}

function emptyCampaign(): CampaignOption {
  return {
    id: Math.random().toString(36).slice(2),
    platform: 'Meta Ads',
    objective: 'Brand Awareness',
    budget: '',
    startDate: '',
    endDate: '',
    targetAudience: '',
    notes: '',
  }
}

// ─── Cover page ─────────────────────────────────────────────────────────────────

function CoverPage({ clientName, period, currency }: { clientName: string; period: string; currency: string }) {
  const today = new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col min-h-[320px]" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
      <div className="px-10 pt-10">
        <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
          <path d="M8,62 L8,10 L16,10 L48,54 L48,10 L56,10 L56,62 L48,62 L16,18 L16,62 Z" fill="white"/>
          <path fillRule="evenodd" d="M82,10 A26,26 0 0 1 82,62 A26,26 0 0 1 82,10 Z M82,22 A14,14 0 0 1 82,50 A14,14 0 0 1 82,22 Z" fill="white"/>
          <line x1="60" y1="68" x2="104" y2="4" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M114,10 L124,10 L151,58 L178,10 L188,10 L151,64 L141,64 Z" fill="white"/>
          <path fillRule="evenodd" d="M194,62 L218,10 L228,10 L252,62 L243,62 L237,50 L209,50 L203,62 Z M215,42 L223,18 L235,42 Z" fill="white"/>
          <text x="250" y="18" fill="white" fontSize="9" fontFamily="system-ui,Arial,sans-serif">™</text>
        </svg>
      </div>
      <div className="flex-1 flex flex-col justify-center px-10 py-12">
        <div className="w-12 h-0.5 rounded-full mb-6" style={{ background: B.accent }}/>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.border }}>Media Buying Proposal</p>
        <h1 className="text-5xl font-bold text-white leading-tight mb-3">{clientName}</h1>
        <p className="text-lg font-medium" style={{ color: B.accent }}>{period || 'Campaign Period'}</p>
        <p className="text-sm mt-1" style={{ color: B.border }}>Paid Media Budget Allocation · {currency}</p>
      </div>
      <div className="px-10 pb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-white mb-0.5">Prepared by NOVAX</p>
          <p className="text-xs" style={{ color: B.border }}>{today}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: B.accent }}/>
          <p className="text-xs font-medium" style={{ color: B.border }}>Confidential — For Client Use Only</p>
        </div>
      </div>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.light}, ${B.border}, ${B.accent})` }}/>
    </div>
  )
}

// ─── Campaign result card ───────────────────────────────────────────────────────

function CampaignResultCard({ result }: { result: CampaignResult }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className={cn(
      'rounded-2xl border p-6 transition-all',
      result.recommended ? 'shadow-sm' : 'border-slate-200',
    )} style={result.recommended ? { background: B.light, borderColor: B.border } : undefined}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-xl shrink-0" style={{ background: result.recommended ? B.primary : '#f8fafc' }}>
            <Megaphone className="w-4 h-4" style={{ color: result.recommended ? 'white' : B.muted }}/>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-slate-800">Option {result.optionIndex + 1} — {result.platform}</h3>
              {result.recommended && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: B.primary }}>
                  <CheckCircle className="w-2.5 h-2.5"/> Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{result.objective} · {result.currency} {Number(result.budget).toLocaleString()}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-800 leading-snug">{result.headline}</p>
          <p className="text-sm text-slate-600 leading-relaxed">{result.rationale}</p>

          {result.kpis.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Expected Performance</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {result.kpis.map((kpi, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{kpi.value}</p>
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: B.muted }}>{kpi.metric}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{kpi.basis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(result.strengths.length > 0 || result.considerations.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.strengths.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-xs font-bold text-emerald-700 mb-2">Strengths</p>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5"/>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.considerations.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-xs font-bold text-amber-700 mb-2">Watch Out For</p>
                  <ul className="space-y-1">
                    {result.considerations.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5"/>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function MediaBuyingPage() {
  const { clients } = useClients()
  const [selectedClient, setSelectedClient]   = useState('')
  const [currency, setCurrency]               = useState('SAR')
  const [period, setPeriod]                   = useState('')
  const [campaigns, setCampaigns]             = useState<CampaignOption[]>([emptyCampaign(), emptyCampaign()])
  const [images, setImages]                   = useState<string[]>([])
  const [generating, setGenerating]           = useState(false)
  const [result, setResult]                   = useState<GenerateResult | null>(null)
  const [error, setError]                     = useState<string | null>(null)
  const [guideOpen, setGuideOpen]             = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clientName = selectedClient
    ? (clients.find(c => c.id === selectedClient)?.name ?? 'Client')
    : 'Select a client'

  const updateCampaign = (id: string, updates: Partial<CampaignOption>) =>
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))

  const handleGenerate = async () => {
    if (!selectedClient || campaigns.length < 2) return
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const client = clients.find(c => c.id === selectedClient)
      const res = await fetch('/api/media-buying/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          clientName: client?.name ?? '',
          currency,
          period,
          campaigns: campaigns.map(c => ({
            platform: c.platform,
            objective: c.objective,
            budget: c.budget,
            startDate: c.startDate,
            endDate: c.endDate,
            targetAudience: c.targetAudience,
            notes: c.notes,
          })),
          images,
        }),
      })
      const data = await res.json() as { result?: GenerateResult; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Generation failed')
      } else if (data.result) {
        setResult(data.result)
        setTimeout(() => document.getElementById('mb-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch {
      setError('Could not connect to the generation service')
    }
    setGenerating(false)
  }

  const canGenerate = !!(selectedClient && campaigns.length >= 2 && campaigns.every(c => c.budget && Number(c.budget) > 0))

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: B.light }}>
            <TrendingUp className="w-5 h-5" style={{ color: B.primary }}/>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Media Buying Plan</h1>
            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
              Enter 2–5 campaign options with budgets. AI estimates expected KPIs for each, identifies the best-value option, and generates a Media Buyer Guide.
            </p>
          </div>
        </div>
      </div>

      {/* ── Setup ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Setup</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
            >
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Campaign Period</label>
            <input
              type="text"
              placeholder="e.g. June 2026 or Q3 2026"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Campaign Options ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Campaign Options</p>
            <p className="text-xs text-slate-400 mt-0.5">2–5 options to compare. Minimum 2 required.</p>
          </div>
          <button
            disabled={campaigns.length >= 5}
            onClick={() => setCampaigns(prev => [...prev, emptyCampaign()])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-novax-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5"/>
            Add Option ({campaigns.length}/5)
          </button>
        </div>

        <div className="space-y-4">
          {campaigns.map((campaign, ci) => (
            <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-slate-50/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: B.muted }}>
                    {ci + 1}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {campaign.platform} — {campaign.objective}
                  </span>
                </div>
                {campaigns.length > 2 && (
                  <button
                    onClick={() => setCampaigns(prev => prev.filter(c => c.id !== campaign.id))}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Platform</label>
                  <select
                    value={campaign.platform}
                    onChange={e => updateCampaign(campaign.id, { platform: e.target.value })}
                    className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Objective</label>
                  <select
                    value={campaign.objective}
                    onChange={e => updateCampaign(campaign.id, { objective: e.target.value })}
                    className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                  >
                    {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Budget ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10000"
                    value={campaign.budget}
                    onChange={e => updateCampaign(campaign.id, { budget: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Flight</label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={campaign.startDate}
                      onChange={e => updateCampaign(campaign.id, { startDate: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                    />
                    <input
                      type="date"
                      value={campaign.endDate}
                      onChange={e => updateCampaign(campaign.id, { endDate: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Target Audience</label>
                  <input
                    type="text"
                    placeholder="e.g. Women 25–45, UAE, interested in skincare"
                    value={campaign.targetAudience}
                    onChange={e => updateCampaign(campaign.id, { targetAudience: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Retargeting, exclude existing customers"
                    value={campaign.notes}
                    onChange={e => updateCampaign(campaign.id, { notes: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Creative References ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Creative References</p>
            <p className="text-xs text-slate-400 mt-0.5">3–6 reference images (optional — helps AI tailor the guide)</p>
          </div>
          <button
            disabled={images.length >= 6}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-novax-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5"/>
            Add Image ({images.length}/6)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file || images.length >= 6) return
              const formData = new FormData()
              formData.append('file', file)
              try {
                const res = await fetch('/api/assets/upload', { method: 'POST', body: formData })
                if (res.ok) {
                  const { url } = await res.json() as { url?: string }
                  if (url) setImages(prev => [...prev, url])
                }
              } catch { /* non-critical */ }
              e.target.value = ''
            }}
          />
        </div>

        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt={`Reference ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border border-slate-200"/>
                <button
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5"/>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs">
            No reference images added
          </div>
        )}
      </div>

      {/* ── Generate ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: generating ? B.muted : B.primary }}
        >
          {generating
            ? <><RefreshCw className="w-4 h-4 animate-spin"/> Generating Plan…</>
            : <><Sparkles className="w-4 h-4"/> Generate Media Buying Plan</>}
        </button>
        {!selectedClient && <p className="text-xs text-slate-400">Select a client</p>}
        {selectedClient && campaigns.length < 2 && <p className="text-xs text-slate-400">Add at least 2 options</p>}
        {selectedClient && campaigns.length >= 2 && !campaigns.every(c => c.budget && Number(c.budget) > 0) && (
          <p className="text-xs text-amber-500">Enter a budget for every option</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0"/>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Output ────────────────────────────────────────── */}
      {result && (
        <div id="mb-result" className="space-y-5">

          {/* Cover */}
          <div className="report-cover-page">
            <CoverPage clientName={result.clientName || clientName} period={result.period || period} currency={result.currency || currency}/>
          </div>

          {/* Executive summary */}
          {result.executiveSummary && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 print-break-before">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: B.light }}>
                  <BarChart2 className="w-4 h-4" style={{ color: B.primary }}/>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Summary</p>
                  <h2 className="text-base font-bold text-slate-900">Budget Allocation Overview</h2>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-7">{result.executiveSummary}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {result.campaigns.map((c, i) => (
                  <div
                    key={i}
                    className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm', c.recommended ? 'text-white' : 'border border-slate-200 text-slate-700 bg-slate-50')}
                    style={c.recommended ? { background: B.primary } : undefined}
                  >
                    <span className="font-semibold">Option {i + 1}</span>
                    <span className="text-xs opacity-70">{c.platform}</span>
                    <span className="font-bold">{c.currency} {Number(c.budget).toLocaleString()}</span>
                    {c.recommended && <Target className="w-3 h-3 opacity-80"/>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign cards */}
          <div className="space-y-4 print-break-before">
            {result.campaigns.map(campaign => (
              <CampaignResultCard key={campaign.optionIndex} result={campaign}/>
            ))}
          </div>

          {/* Media Buyer Guide */}
          {result.mediaBuyerGuide.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden print-break-before">
              <button
                onClick={() => setGuideOpen(v => !v)}
                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: B.light }}>
                  <BookOpen className="w-4 h-4" style={{ color: B.primary }}/>
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-slate-900">Media Buyer Guide</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Step-by-step execution instructions</p>
                </div>
                {guideOpen ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
              </button>

              {guideOpen && (
                <div className="border-t border-slate-100 p-6 space-y-5">
                  {result.mediaBuyerGuide.map((section, si) => (
                    <div key={si}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: B.accent }}>
                          {si + 1}
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">{section.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {section.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                            <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: B.accent }}/>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Export */}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={() => {
                const el = document.getElementById('mb-result')
                if (!el) return
                const win = window.open('', '_blank', 'width=960,height=760')
                if (!win) return
                const styles = Array.from(
                  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
                ).map(s => s.outerHTML).join('\n')
                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:0;padding:24px 32px;background:#fff;font-family:system-ui,sans-serif;font-size:13px;color:#0f172a}
  button,[data-no-print]{display:none!important}
  *{overflow:visible!important;max-height:none!important;overflow-wrap:break-word!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box}
  img{max-width:100%}
  @page{size:A4 portrait;margin:14mm 16mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    .rounded-2xl,.rounded-xl,.rounded-lg{page-break-inside:avoid}}
</style>
${styles}
</head><body>${el.outerHTML}</body></html>`)
                win.document.close()
                win.focus()
                setTimeout(() => { win.print(); win.close() }, 800)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4"/>
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
