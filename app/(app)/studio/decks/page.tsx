'use client'

import { useState } from 'react'
import {
  ChevronLeft, Flame, Brain, BarChart2, Target,
  Loader2, AlertCircle, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { DECK_DESIGN_TEMPLATES, type DesignTemplate } from '@/lib/deck-templates'
import type { DeckTemplate, DeckInputMode, DeckDocument } from '@/lib/deck-types'

type Step = 'template' | 'design' | 'input' | 'generating' | 'preview'

const STRUCTURE_TEMPLATES: {
  id: DeckTemplate
  icon: React.ElementType
  title: string
  description: string
  slides: string
}[] = [
  {
    id: 'campaign',
    icon: Flame,
    title: 'Campaign Presentation',
    description: '4–6 campaign concepts with taglines, tone of voice, and rationale.',
    slides: '11–15 slides',
  },
  {
    id: 'strategy',
    icon: Brain,
    title: 'Strategy Deck',
    description: 'Content pillars, platform roles, KPIs, and quarterly roadmap.',
    slides: '8 slides',
  },
  {
    id: 'report',
    icon: BarChart2,
    title: 'Client Report',
    description: 'Performance summary, top content, learnings, and next-month focus.',
    slides: '7 slides',
  },
  {
    id: 'pitch',
    icon: Target,
    title: 'Pitch Deck',
    description: 'Problem, solution, proof, investment options, and clear CTA.',
    slides: '6 slides',
  },
]

const STRUCTURE_LABELS: Record<DeckTemplate, string> = {
  campaign: 'Campaign Presentation',
  strategy: 'Strategy Deck',
  report:   'Client Report',
  pitch:    'Pitch Deck',
}

export default function DeckBuilderPage() {
  const { user }    = useAuth()
  const { clients } = useClients()

  const [step,           setStep]          = useState<Step>('template')
  const [template,       setTemplate]      = useState<DeckTemplate | null>(null)
  const [designTemplate, setDesignTemplate] = useState<DesignTemplate | null>(null)
  const [mode,           setMode]          = useState<DeckInputMode>('ai_generate')
  const [clientId,       setClientId]      = useState('')
  const [prompt,         setPrompt]        = useState('')
  const [deck,           setDeck]          = useState<DeckDocument | null>(null)
  const [error,          setError]         = useState<string | null>(null)
  const [exportingPptx,  setExportingPptx] = useState(false)
  const [exportingPdf,   setExportingPdf]  = useState(false)

  function selectTemplate(t: DeckTemplate) {
    setTemplate(t)
    setError(null)
    setStep('design')
  }

  function selectDesign(d: DesignTemplate) {
    setDesignTemplate(d)
    setStep('input')
  }

  async function handleGenerate() {
    if (!template || !designTemplate || prompt.trim().length < 20) {
      setError('Please write at least 20 characters of content.')
      return
    }
    setStep('generating')
    setError(null)
    try {
      const res = await fetch('/api/studio/decks/structure', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          mode,
          prompt,
          client_id:       clientId || undefined,
          design_template: designTemplate.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error((err as { error?: string }).error ?? 'Generation failed')
      }
      const { deck: deckData } = await res.json() as { deck: DeckDocument }
      setDeck(deckData)
      if (user?.id) {
        fetch('/api/studio/session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool:      'decks',
            client_id: clientId || undefined,
            input:     { template, designTemplate: designTemplate.id, mode, prompt },
            output:    { deck: deckData },
          }),
        }).catch(err => console.error('[decks] session save failed:', err))
      }
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate deck')
      setStep('input')
    }
  }

  async function handleExport(format: 'pptx' | 'pdf') {
    if (!deck) return
    const setter = format === 'pptx' ? setExportingPptx : setExportingPdf
    setter(true)
    try {
      const res = await fetch('/api/studio/decks/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck, format }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error((err as { error?: string }).error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${deck.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Deck'}.${format}`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setter(false)
    }
  }

  function handleStartOver() {
    setStep('template')
    setTemplate(null)
    setDesignTemplate(null)
    setPrompt('')
    setClientId('')
    setDeck(null)
    setError(null)
  }

  const selectedClient = clients.find(c => c.id === clientId)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Deck Builder</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Pick a structure and design, write your brief, export as PPTX and PDF.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="shrink-0 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 1: Structure ─────────────────────────────────── */}
      {step === 'template' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 1 of 3 — Choose structure</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STRUCTURE_TEMPLATES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className="group text-left p-6 bg-white border border-slate-200 rounded-2xl hover:border-novax-border hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-novax-light flex items-center justify-center">
                      <Icon className="w-5 h-5 text-novax-muted" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{t.slides}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-novax transition-colors">{t.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">{t.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Design ────────────────────────────────────── */}
      {step === 'design' && template && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('template')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-novax transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 2 of 3 — Choose design</p>
            <span className="text-[10px] bg-novax text-white px-2 py-0.5 rounded-full font-semibold">{STRUCTURE_LABELS[template]}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DECK_DESIGN_TEMPLATES.map(dt => (
              <button
                key={dt.id}
                onClick={() => selectDesign(dt)}
                className="group text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-novax-border hover:shadow-md transition-all"
              >
                {/* Mini slide preview */}
                <div className="h-24 w-full relative overflow-hidden" style={{ backgroundColor: dt.branding.background }}>
                  <div className="absolute inset-0 flex flex-col justify-center items-start p-5 gap-2">
                    <div className="h-2.5 rounded-sm w-3/4" style={{ backgroundColor: dt.branding.surface, opacity: 0.9 }} />
                    <div className="h-1.5 rounded-sm w-1/2" style={{ backgroundColor: dt.branding.accent, opacity: 0.85 }} />
                    <div className="h-1 rounded-sm w-2/3" style={{ backgroundColor: dt.branding.surface, opacity: 0.35 }} />
                    <div className="h-1 rounded-sm w-1/2" style={{ backgroundColor: dt.branding.surface, opacity: 0.2 }} />
                  </div>
                  <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: dt.branding.accent }} />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-slate-900 group-hover:text-novax transition-colors">{dt.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{dt.description}</p>
                  {dt.use_case && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      <span className="font-semibold">Best for:</span> {dt.use_case}
                    </p>
                  )}
                  <div className="flex gap-1.5 mt-3">
                    {[dt.branding.background, dt.branding.accent, dt.branding.primary].map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Input ─────────────────────────────────────── */}
      {step === 'input' && template && designTemplate && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('design')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-novax transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 3 of 3 — Brief</p>
            <span className="text-[10px] bg-novax text-white px-2 py-0.5 rounded-full font-semibold">{STRUCTURE_LABELS[template]}</span>
            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full">
              <div className="w-2.5 h-2.5 rounded-full border border-white/50" style={{ backgroundColor: designTemplate.branding.background }} />
              <span className="text-[10px] font-semibold text-slate-600">{designTemplate.name}</span>
            </div>
          </div>

          {/* Client selector */}
          {clients.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Client — optional, adds brand context to AI
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted bg-white"
              >
                <option value="">No client — generate without context</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedClient && (
                <p className="text-xs text-novax-muted flex items-center gap-1.5">
                  <Check className="w-3 h-3" />
                  Brand voice, tone, and past context for {selectedClient.name} will be injected
                </p>
              )}
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex p-1 gap-1 bg-slate-100 rounded-xl w-fit">
            {(['ai_generate', 'exact_text'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === m ? 'bg-novax text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {m === 'ai_generate' ? 'Generate from prompt' : 'Use exact content'}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={mode === 'ai_generate' ? 7 : 10}
              placeholder={
                mode === 'ai_generate'
                  ? 'Describe the deck you need. Include client name, industry, goals, and campaign ideas.\n\nExample: Create a 4-campaign deck for Lusin, a premium Armenian restaurant in Dubai. Campaigns: Heritage Nights, Seasonal Menu, Private Dining, Weekend Brunch.'
                  : 'Paste your full deck content exactly as you want it. The AI will structure it into slides without changing a single word.\n\nClearly label each section or campaign for best results.'
              }
              className="w-full resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-mono leading-relaxed"
            />
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {mode === 'ai_generate'
                  ? `Design: ${designTemplate.name} applied automatically — no branding instructions needed.`
                  : 'Your exact wording is preserved. AI only decides which text goes in which field.'}
              </p>
              <span className={cn('text-xs font-medium', prompt.trim().length < 20 ? 'text-slate-400' : 'text-emerald-600')}>
                {prompt.trim().length} chars
              </span>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={prompt.trim().length < 20}
            className="w-full bg-novax hover:bg-novax-hover text-white"
          >
            Build Deck — {designTemplate.name}
          </Button>
        </div>
      )}

      {/* ── Step 4: Generating ────────────────────────────────── */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-novax-accent" />
          <p className="text-base font-semibold text-slate-800">Structuring your deck...</p>
          <p className="text-sm text-slate-500">
            Applying {designTemplate?.name ?? 'design'} — usually 15–25 seconds.
          </p>
        </div>
      )}

      {/* ── Step 5: Preview ───────────────────────────────────── */}
      {step === 'preview' && deck && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3 flex-wrap gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{deck.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] bg-novax text-white px-2 py-0.5 rounded-full font-bold uppercase">{deck.template}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: deck.branding.background }} />
                  <span className="text-[10px] text-slate-500 font-medium">{designTemplate?.name ?? 'Custom'}</span>
                </div>
                <span className="text-[10px] text-slate-400">{deck.slides.length} slides</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" onClick={() => handleExport('pptx')} disabled={exportingPptx} className="bg-novax hover:bg-novax-hover text-white">
                {exportingPptx && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                PPTX
              </Button>
              <Button size="sm" onClick={() => handleExport('pdf')} disabled={exportingPdf} className="bg-novax hover:bg-novax-hover text-white">
                {exportingPdf && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                PDF
              </Button>
              <button onClick={handleStartOver} className="text-xs text-slate-500 hover:text-novax transition-colors px-2 py-1.5">
                Start Over
              </button>
            </div>
          </div>

          {/* Slides */}
          <div className="space-y-3">
            {deck.slides.map((slide, idx) => {
              const b = deck.branding
              const isDark    = slide.type === 'cover' || slide.type === 'metrics' || slide.type === 'cta'
              const isSection = slide.type === 'section_header'
              const isWhy     = slide.type === 'campaign' && slide.tag === 'why'

              const bg     = isSection ? `${b.primary}12` : isDark ? b.background : b.surface
              const titleC = isDark ? b.surface  : b.primary
              const bodyC  = isDark ? b.accent   : b.body
              const mutedC = isDark ? `${b.surface}80` : b.muted
              const ac     = b.accent

              const tovBullets    = (slide.bullets ?? []).filter(bl => bl.startsWith('TOV:')).map(bl => bl.replace(/^TOV:\s*/, ''))
              const whyBullets    = (slide.bullets ?? []).filter(bl => bl.startsWith('WHY:')).map(bl => bl.replace(/^WHY:\s*/, ''))
              const normalBullets = isWhy ? [] : (slide.bullets ?? [])

              return (
                <div
                  key={slide.id}
                  className="w-full rounded-xl overflow-hidden shadow-md relative"
                  style={{ aspectRatio: '16/9', backgroundColor: bg, fontFamily: b.bodyFont + ', system-ui, sans-serif' }}
                >
                  {/* Slide number */}
                  <div
                    className="absolute top-3 right-4 text-[9px] font-bold tabular-nums"
                    style={{ color: isDark ? `${b.surface}40` : `${b.primary}30` }}
                  >
                    {idx + 1} / {deck.slides.length}
                  </div>

                  {/* Left accent bar — light slides */}
                  {!isDark && !isSection && (
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: ac }} />
                  )}

                  <div
                    className="absolute inset-0 flex flex-col"
                    style={{
                      padding: 'clamp(14px, 2.8vw, 36px)',
                      paddingLeft: !isDark && !isSection ? 'clamp(18px, 3.2vw, 44px)' : undefined,
                    }}
                  >
                    {/* COVER */}
                    {slide.type === 'cover' && (
                      <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                        {slide.tag && (
                          <span className="uppercase tracking-widest font-bold"
                            style={{ fontSize: 'clamp(6px, 0.75vw, 9px)', color: ac }}>
                            {slide.tag}
                          </span>
                        )}
                        <h1 style={{
                          fontSize: 'clamp(17px, 3.4vw, 40px)', fontWeight: 800,
                          color: b.surface, fontFamily: b.titleFont + ', serif', lineHeight: 1.1,
                        }}>
                          {slide.title}
                        </h1>
                        {slide.subtitle && (
                          <>
                            <div style={{ width: '32px', height: '2px', backgroundColor: ac, borderRadius: '2px' }} />
                            <p style={{ fontSize: 'clamp(9px, 1.5vw, 17px)', color: ac, fontWeight: 500 }}>
                              {slide.subtitle}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* SECTION HEADER */}
                    {isSection && (
                      <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                        <div style={{ width: '28px', height: '3px', backgroundColor: ac, borderRadius: '2px' }} />
                        <h2 style={{
                          fontSize: 'clamp(15px, 2.6vw, 30px)', fontWeight: 700,
                          color: b.primary, fontFamily: b.titleFont + ', serif',
                        }}>
                          {slide.title}
                        </h2>
                      </div>
                    )}

                    {/* CAMPAIGN — WHY (2-col) */}
                    {isWhy && (
                      <>
                        <h2 style={{
                          fontSize: 'clamp(10px, 1.4vw, 16px)', fontWeight: 700,
                          color: titleC, fontFamily: b.titleFont + ', serif',
                          marginBottom: 'clamp(6px, 1vw, 12px)',
                        }}>
                          {slide.title}
                        </h2>
                        <div className="flex gap-4 flex-1 min-h-0">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div style={{ width: '3px', height: '11px', backgroundColor: ac, borderRadius: '2px' }} />
                              <p style={{ fontSize: 'clamp(6px, 0.72vw, 8px)', fontWeight: 700, color: ac, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Tone of Voice
                              </p>
                            </div>
                            {tovBullets.map((line, i) => (
                              <p key={i} style={{ fontSize: 'clamp(7px, 0.88vw, 10px)', color: bodyC, paddingLeft: '7px', borderLeft: `1.5px solid ${ac}40`, lineHeight: 1.4 }}>
                                {line}
                              </p>
                            ))}
                          </div>
                          <div className="self-stretch w-px" style={{ backgroundColor: `${b.primary}12` }} />
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div style={{ width: '3px', height: '11px', backgroundColor: ac, borderRadius: '2px' }} />
                              <p style={{ fontSize: 'clamp(6px, 0.72vw, 8px)', fontWeight: 700, color: ac, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Why It Works
                              </p>
                            </div>
                            {whyBullets.map((line, i) => (
                              <p key={i} style={{ fontSize: 'clamp(7px, 0.88vw, 10px)', color: bodyC, paddingLeft: '7px', borderLeft: `1.5px solid ${ac}40`, lineHeight: 1.4 }}>
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* METRICS / CTA — dark, centered */}
                    {(slide.type === 'metrics' || slide.type === 'cta') && (
                      <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                        <h2 style={{
                          fontSize: 'clamp(13px, 2.1vw, 25px)', fontWeight: 700,
                          color: b.surface, fontFamily: b.titleFont + ', serif',
                        }}>
                          {slide.title}
                        </h2>
                        {slide.body && <p style={{ fontSize: 'clamp(8px, 1vw, 12px)', color: `${b.surface}70` }}>{slide.body}</p>}
                        {normalBullets.length > 0 && (
                          <div className="space-y-1.5 w-full max-w-xs">
                            {normalBullets.map((bullet, i) => (
                              <div key={i} className="flex items-center justify-center gap-2">
                                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: ac }} />
                                <p style={{ fontSize: 'clamp(7px, 0.95vw, 11px)', color: ac, textAlign: 'left' }}>{bullet}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* EXECUTIVE SUMMARY / CAMPAIGN / PILLAR */}
                    {!['cover', 'section_header', 'metrics', 'cta'].includes(slide.type) && !isWhy && (
                      <>
                        {slide.tag && slide.tag !== 'why' && (
                          <div className="mb-2">
                            <span style={{
                              fontSize: 'clamp(6px, 0.72vw, 8px)', fontWeight: 700,
                              color: ac, textTransform: 'uppercase', letterSpacing: '0.1em',
                              border: `1px solid ${ac}`, borderRadius: '999px', padding: '1px 7px',
                            }}>
                              {slide.tag}
                            </span>
                          </div>
                        )}
                        <h2 style={{
                          fontSize: 'clamp(11px, 1.75vw, 21px)', fontWeight: 700,
                          color: titleC, fontFamily: b.titleFont + ', serif',
                          lineHeight: 1.2, marginBottom: '3px',
                        }}>
                          {slide.title}
                        </h2>
                        {slide.subtitle && (
                          <p style={{ fontSize: 'clamp(8px, 1vw, 12px)', color: mutedC, marginBottom: '5px', fontStyle: 'italic' }}>
                            {slide.subtitle}
                          </p>
                        )}
                        {(slide.body || normalBullets.length > 0) && (
                          <div style={{ width: '22px', height: '2px', backgroundColor: ac, borderRadius: '1px', margin: '6px 0 8px' }} />
                        )}
                        {slide.body && (
                          <p style={{ fontSize: 'clamp(7px, 0.95vw, 11px)', color: bodyC, lineHeight: 1.6, marginBottom: normalBullets.length > 0 ? '8px' : 0 }}
                            className="line-clamp-5">
                            {slide.body}
                          </p>
                        )}
                        {normalBullets.length > 0 && (
                          <div className="space-y-1.5">
                            {normalBullets.map((bullet, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full mt-1 shrink-0" style={{ backgroundColor: ac }} />
                                <p style={{ fontSize: 'clamp(7px, 0.95vw, 11px)', color: bodyC, lineHeight: 1.4 }}>{bullet}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
