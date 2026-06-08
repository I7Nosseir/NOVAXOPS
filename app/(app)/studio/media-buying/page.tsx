'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import {
  TrendingUp, Plus, Minus, Download, Loader2, ChevronDown, ChevronUp,
  BarChart2, Target, Users, Layers, CheckCircle, ImageIcon, Sparkles,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MediaBuyingPlanDocument, type MediaBuyingPlan, type PlanImages } from '@/lib/media-buying-pdf'

// ─── Constants ────────────────────────────────────────────────

const PLATFORM_OPTIONS = ['Instagram', 'Snapchat', 'TikTok', 'Google Ads', 'Facebook', 'YouTube', 'X']

const OBJECTIVES = [
  'Generate Patient Leads (Messages + Calls)',
  'Drive Direct Sales',
  'Generate App Installs',
  'Build Brand Awareness',
  'Drive Store Visits',
  'Generate Service Inquiries',
]

const MARKETS = [
  'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'Jordan',
]

const IMAGE_MODELS = [
  {
    id: 'imagen-4.0-generate-001',
    label: 'Imagen 4',
    tag: '$0.04/image · Recommended',
    costPerImage: 0.04,
    badge: 'Best Quality',
  },
  {
    id: 'imagen-4.0-fast-generate-001',
    label: 'Imagen 4 Fast',
    tag: '$0.02/image · Quick',
    costPerImage: 0.02,
    badge: 'Fast',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini Flash Image',
    tag: '$0.039/image',
    costPerImage: 0.039,
    badge: '',
  },
]

// 3 decorative slides: cover, key factors, final overview
const IMAGE_SLIDES = 3

const LOADING_STEPS = [
  { label: 'Researching market demand and consumer behavior' },
  { label: 'Developing customer avatars and psychographic profiles' },
  { label: 'Assigning platform roles across the funnel' },
  { label: 'Allocating budget based on Saudi market benchmarks' },
  { label: 'Forecasting expected leads per platform' },
  { label: 'Generating key performance insights' },
  { label: 'Structuring the final client-ready plan' },
]

const IMAGE_STEPS = [
  { label: 'Cover — industry environment photography' },
  { label: 'Key Factors — contextual lifestyle scene' },
  { label: 'Final Overview — professional space' },
]

// ─── Types ────────────────────────────────────────────────────

interface FormState {
  client_name: string
  client_handle: string
  industry: string
  market: string
  objective: string
  platforms: string[]
  option1_budget: string
  option2_budget: string
  additional_context: string
}

// ─── Image generation helpers ─────────────────────────────────

function buildImagePrompts(plan: MediaBuyingPlan): {
  cover: string
  keyFactors: string
  finalOverview: string
} {
  const industry = plan.client_name  // fallback; caller may pass industry separately
  const market = plan.market

  return {
    cover:
      `Professional ${industry} environment, ${market} market, clean minimalist interior, ` +
      `premium quality, soft natural lighting, architectural photography, no text, no watermark, ` +
      `muted tones, magazine editorial quality`,

    keyFactors:
      `Person holding smartphone viewing content, ${market} demographic, soft natural light, ` +
      `lifestyle photography, authentic candid moment, professional context, no text overlay, ` +
      `no watermark, shallow depth of field`,

    finalOverview:
      `Premium ${industry} interior space, modern minimalist design, clean bright atmosphere, ` +
      `${market} aesthetic, professional photography, white and neutral tones, architectural detail, ` +
      `no text, no watermark`,
  }
}

async function generateOneImage(prompt: string, model: string): Promise<string> {
  const res = await fetch('/api/ai-image/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      style:       'photorealistic',
      aspectRatio: '3:4',
      model,
    }),
  })
  const data = await res.json() as { imageData?: string; mimeType?: string; error?: string }
  if (!res.ok || !data.imageData) throw new Error(data.error ?? 'Image generation failed')
  return `data:${data.mimeType ?? 'image/png'};base64,${data.imageData}`
}

// ─── Sub-components ───────────────────────────────────────────

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none ' +
  'focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all ' +
  'bg-white text-slate-800 placeholder:text-slate-400'

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-novax-light flex items-center justify-center">
            <Icon className="w-4 h-4 text-novax-muted" />
          </div>
          <span className="font-semibold text-slate-900 text-sm">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function PlanPreview({ plan }: { plan: MediaBuyingPlan }) {
  return (
    <div className="space-y-4">
      <SectionCard icon={Target} title="Executive Summary">
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{plan.executive_summary}</p>
      </SectionCard>

      <SectionCard icon={Layers} title="Platform Roles">
        <div className="grid grid-cols-2 gap-3">
          {plan.platforms.map((p, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-slate-900">{p.name}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-medium">{p.funnel_stage}</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug pl-7">{p.role_description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {plan.customer_avatars.length > 0 && (
        <SectionCard icon={Users} title="Customer Segments">
          <div className="space-y-2">
            {plan.customer_avatars.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-novax-muted w-5 shrink-0 pt-0.5">#{i + 1}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-900 mb-0.5">{a.name}</p>
                  <p className="text-xs text-slate-500 leading-snug">{a.motivation}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {[plan.option1, plan.option2].map((opt, oi) => (
        <SectionCard
          key={oi}
          icon={BarChart2}
          title={`Option ${oi + 1} — ${opt.budget_sar.toLocaleString()} SAR/month`}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            {opt.allocation.map((a, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xl font-bold text-slate-900">{a.amount.toLocaleString()}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{a.platform}</p>
                <p className="text-[10px] text-slate-400">SAR</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {opt.expected_results.map((r, i) => (
              <div key={i} className="p-3 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{r.platform}</p>
                <p className="text-xs font-semibold text-slate-900">
                  Expected {r.metric}: {r.min}–{r.max}
                </p>
              </div>
            ))}
          </div>
          <div className={cn(
            'p-3 rounded-lg border',
            oi === 0 ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-200',
          )}>
            <p className="text-lg font-bold text-slate-900 mb-0.5">
              {opt.total_leads_min}–{opt.total_leads_max}{' '}
              <span className="text-xs font-normal text-slate-500">total leads/month</span>
            </p>
            <p className="text-xs text-slate-500">{opt.summary}</p>
          </div>
        </SectionCard>
      ))}

      <SectionCard icon={CheckCircle} title="Key Performance Factors">
        <div className="space-y-4">
          {plan.key_factors.map((f, i) => (
            <div key={i} className={cn('pb-4', i < plan.key_factors.length - 1 && 'border-b border-slate-100')}>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest">{f.number}</span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 mb-1">{f.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function MediaBuyingPage() {
  const [form, setForm] = useState<FormState>({
    client_name:        '',
    client_handle:      '',
    industry:           '',
    market:             'Saudi Arabia',
    objective:          OBJECTIVES[0],
    platforms:          ['Instagram', 'Snapchat', 'TikTok', 'Google Ads'],
    option1_budget:     '5000',
    option2_budget:     '7000',
    additional_context: '',
  })

  const [loading,     setLoading]     = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [plan,        setPlan]        = useState<MediaBuyingPlan | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  // AI imagery toggle
  const [withImages,      setWithImages]      = useState(false)
  const [imageModel,      setImageModel]      = useState(IMAGE_MODELS[0].id)
  const [imageStepStates, setImageStepStates] = useState<('idle' | 'running' | 'done' | 'error')[]>(
    IMAGE_STEPS.map(() => 'idle'),
  )
  const [imageError, setImageError] = useState<string | null>(null)

  const [downloadLoading, setDownloadLoading] = useState(false)

  const selectedImageModel = IMAGE_MODELS.find(m => m.id === imageModel) ?? IMAGE_MODELS[0]
  const estimatedCost = (selectedImageModel.costPerImage * IMAGE_SLIDES).toFixed(2)

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }))

  const togglePlatform = (p: string) =>
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p],
    }))

  const handleGenerate = async () => {
    if (!form.client_name || !form.industry || form.platforms.length === 0) return
    setLoading(true)
    setLoadingStep(0)
    setError(null)
    setPlan(null)

    const stepInterval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1))
    }, 1800)

    try {
      const res = await fetch('/api/studio/media-buying/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:        form.client_name,
          client_handle:      form.client_handle || undefined,
          industry:           form.industry,
          market:             form.market,
          objective:          form.objective,
          platforms:          form.platforms,
          option1_budget:     Number(form.option1_budget),
          option2_budget:     Number(form.option2_budget),
          additional_context: form.additional_context || undefined,
        }),
      })
      const data = await res.json() as { plan?: MediaBuyingPlan; error?: string }
      if (!res.ok || !data.plan) throw new Error(data.error ?? 'Generation failed')
      setLoadingStep(LOADING_STEPS.length - 1)
      setPlan(data.plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      clearInterval(stepInterval)
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!plan) return
    setDownloadLoading(true)
    setImageError(null)

    let images: PlanImages | undefined

    if (withImages) {
      setImageStepStates(['idle', 'idle', 'idle'])
      const prompts = buildImagePrompts(plan)
      const slots: Array<keyof PlanImages> = ['cover', 'keyFactors', 'finalOverview']
      const promptValues = [prompts.cover, prompts.keyFactors, prompts.finalOverview]

      const results: PlanImages = {}
      for (let i = 0; i < slots.length; i++) {
        setImageStepStates(prev => prev.map((s, idx) => idx === i ? 'running' : s))
        try {
          results[slots[i]] = await generateOneImage(promptValues[i], imageModel)
          setImageStepStates(prev => prev.map((s, idx) => idx === i ? 'done' : s))
        } catch (err) {
          setImageStepStates(prev => prev.map((s, idx) => idx === i ? 'error' : s))
          setImageError(`Image ${i + 1} failed: ${err instanceof Error ? err.message : 'Unknown error'}. Continuing without that image.`)
          // non-blocking — continue with partial images
        }
      }
      images = results
    }

    try {
      const blob = await pdf(<MediaBuyingPlanDocument plan={plan} images={images} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${plan.client_name.replace(/\s+/g, '-')}-Media-Buying-Plan.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed')
    } finally {
      setDownloadLoading(false)
      // Reset image step states after a short delay
      setTimeout(() => setImageStepStates(IMAGE_STEPS.map(() => 'idle')), 3000)
    }
  }

  const isGeneratingImages = downloadLoading && withImages &&
    imageStepStates.some(s => s === 'running')

  const canGenerate =
    form.client_name.trim() &&
    form.industry.trim() &&
    form.platforms.length >= 2 &&
    Number(form.option1_budget) > 0 &&
    Number(form.option2_budget) > 0

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-novax-accent" />
          <h1 className="text-xl font-bold text-slate-900">Media Buying Plan</h1>
        </div>
        <p className="text-sm text-slate-500">
          10-step pipeline — market research, customer avatars, platform strategy, budget allocation, lead forecasting. Output: client-ready PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

        {/* ─── Form ──────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign Brief</p>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Client Name">
              <input
                value={form.client_name}
                onChange={e => set('client_name', e.target.value)}
                placeholder="Privea Dent"
                className={inputCls}
              />
            </InputField>
            <InputField label="Handle (optional)">
              <input
                value={form.client_handle}
                onChange={e => set('client_handle', e.target.value)}
                placeholder="@priveadent"
                className={inputCls}
              />
            </InputField>
          </div>

          <InputField label="Industry / Niche">
            <input
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              placeholder="Dental clinic, Aesthetic center, E-commerce..."
              className={inputCls}
            />
          </InputField>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Market">
              <select value={form.market} onChange={e => set('market', e.target.value)} className={inputCls}>
                {MARKETS.map(m => <option key={m}>{m}</option>)}
              </select>
            </InputField>
            <InputField label="Objective">
              <select value={form.objective} onChange={e => set('objective', e.target.value)} className={inputCls}>
                {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
              </select>
            </InputField>
          </div>

          <InputField label="Platforms">
            <div className="flex flex-wrap gap-2 mt-1">
              {PLATFORM_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    form.platforms.includes(p)
                      ? 'bg-novax-light border-novax-border text-novax'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </InputField>

          <InputField label="Budget Options (SAR / month)">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: 'option1_budget' as const, label: 'Option 1' },
                  { key: 'option2_budget' as const, label: 'Option 2' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[10px] text-slate-400 mb-1 font-medium">{label}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => set(key, String(Math.max(1000, Number(form[key]) - 1000)))}
                      className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      className={cn(inputCls, 'text-center')}
                    />
                    <button
                      onClick={() => set(key, String(Number(form[key]) + 1000))}
                      className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </InputField>

          <InputField label="Additional Context (optional)">
            <textarea
              value={form.additional_context}
              onChange={e => set('additional_context', e.target.value)}
              placeholder="Any specific targeting notes, past campaign data, special offers..."
              rows={3}
              className={cn(inputCls, 'resize-none')}
            />
          </InputField>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <TrendingUp className="w-4 h-4" />}
            {loading ? 'Generating Plan…' : 'Generate Media Buying Plan'}
          </button>
        </div>

        {/* ─── Output ────────────────────────────────────────── */}
        <div className="space-y-4 min-h-[300px]">

          {/* Plan generation progress */}
          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <p className="text-sm font-semibold text-slate-900 mb-4">Generating your media buying plan…</p>
              {LOADING_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                    i < loadingStep  ? 'bg-novax' :
                    i === loadingStep ? 'bg-novax-light border-2 border-novax' :
                    'bg-slate-100',
                  )}>
                    {i < loadingStep && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {i === loadingStep && <div className="w-2 h-2 rounded-full bg-novax animate-pulse" />}
                  </div>
                  <span className={cn(
                    'text-xs transition-colors',
                    i < loadingStep  ? 'text-slate-400 line-through' :
                    i === loadingStep ? 'text-slate-900 font-medium' :
                    'text-slate-300',
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Generation failed</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Plan output */}
          {plan && !loading && (
            <>
              {/* Download bar + AI imagery toggle */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

                {/* Download action */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Plan Ready</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {withImages
                        ? `With AI imagery · ~$${estimatedCost} per download`
                        : 'Text only · Free'}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloadLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {downloadLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                    {downloadLoading
                      ? isGeneratingImages ? 'Generating images…' : 'Building PDF…'
                      : 'Download PDF'}
                  </button>
                </div>

                {/* AI imagery section */}
                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">AI-generated imagery</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded-full">
                        Optional
                      </span>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => setWithImages(v => !v)}
                      className={cn(
                        'relative w-10 h-5.5 rounded-full transition-colors',
                        withImages ? 'bg-novax' : 'bg-slate-200',
                      )}
                      style={{ height: 22, width: 42 }}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-all',
                          withImages ? 'left-[22px]' : 'left-0.5',
                        )}
                        style={{ width: 18, height: 18, top: 2 }}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 ml-6 mb-3 leading-relaxed">
                    Adds contextual photos to cover, key factors, and final overview pages.
                    {' '}Each image is generated from your client&apos;s industry and market context — never generic stock.
                  </p>

                  {withImages && (
                    <div className="space-y-3 mt-3">
                      {/* Model picker */}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Image Model</p>
                        <div className="space-y-1.5">
                          {IMAGE_MODELS.map(m => (
                            <button
                              key={m.id}
                              onClick={() => setImageModel(m.id)}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                                imageModel === m.id
                                  ? 'bg-novax text-white border-novax'
                                  : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax',
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {m.badge && (
                                  <span className={cn(
                                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                    imageModel === m.id
                                      ? 'bg-white/20 text-white'
                                      : 'bg-novax-light text-novax-muted',
                                  )}>
                                    {m.badge}
                                  </span>
                                )}
                                {m.label}
                              </span>
                              <span className={cn(
                                'text-[10px] font-normal',
                                imageModel === m.id ? 'text-white/70' : 'text-slate-400',
                              )}>
                                {m.tag}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cost summary */}
                      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-novax-muted shrink-0" />
                        <p className="text-xs text-slate-600">
                          {IMAGE_SLIDES} images × ${selectedImageModel.costPerImage} ={' '}
                          <span className="font-semibold text-slate-900">${estimatedCost} per report</span>
                          {' '}— billed to your Gemini API key
                        </p>
                      </div>

                      {/* Image generation progress (shown while downloading) */}
                      {downloadLoading && (
                        <div className="space-y-2 pt-1">
                          {IMAGE_STEPS.map((step, i) => {
                            const state = imageStepStates[i]
                            return (
                              <div key={i} className="flex items-center gap-2.5">
                                <div className={cn(
                                  'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all',
                                  state === 'done'    ? 'bg-novax' :
                                  state === 'running' ? 'bg-novax-light border-2 border-novax' :
                                  state === 'error'   ? 'bg-red-100 border border-red-300' :
                                  'bg-slate-100',
                                )}>
                                  {state === 'done' && (
                                    <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none">
                                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                  {state === 'running' && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-novax animate-pulse" />
                                  )}
                                  {state === 'error' && (
                                    <span className="text-[8px] text-red-500 font-bold">!</span>
                                  )}
                                </div>
                                <span className={cn(
                                  'text-xs',
                                  state === 'done'    ? 'text-slate-400 line-through' :
                                  state === 'running' ? 'text-slate-900 font-medium' :
                                  state === 'error'   ? 'text-red-500' :
                                  'text-slate-300',
                                )}>
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Image error (non-blocking) */}
                      {imageError && !downloadLoading && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{imageError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <PlanPreview plan={plan} />
            </>
          )}

          {/* Empty state */}
          {!plan && !loading && !error && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
              <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500 mb-1">No plan generated yet</p>
              <p className="text-xs text-slate-400">
                Fill in the campaign brief and click Generate to produce a client-ready media buying plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
