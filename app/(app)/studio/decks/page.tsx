'use client'

import { useState } from 'react'
import {
  ChevronLeft, Flame, Brain, BarChart2, Target,
  Loader2, AlertCircle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import type { DeckTemplate, DeckInputMode, DeckDocument } from '@/lib/deck-types'

type Step = 'template' | 'input' | 'generating' | 'preview'

const TEMPLATES: {
  id: DeckTemplate
  icon: React.ElementType
  title: string
  description: string
}[] = [
  {
    id: 'campaign',
    icon: Flame,
    title: 'Campaign Presentation',
    description: '4–6 campaign ideas with taglines, TOV, and rationale.',
  },
  {
    id: 'strategy',
    icon: Brain,
    title: 'Strategy Deck',
    description: 'Content pillars, platform roles, KPIs, and quarterly roadmap.',
  },
  {
    id: 'report',
    icon: BarChart2,
    title: 'Client Report',
    description: 'Performance summary, top content, learnings, next-month focus.',
  },
  {
    id: 'pitch',
    icon: Target,
    title: 'Pitch Deck',
    description: 'Problem, solution, proof, investment options, and CTA.',
  },
]

const TEMPLATE_LABELS: Record<DeckTemplate, string> = {
  campaign: 'Campaign Presentation',
  strategy: 'Strategy Deck',
  report:   'Client Report',
  pitch:    'Pitch Deck',
}

export default function DeckBuilderPage() {
  const { user } = useAuth()

  const [step,          setStep]         = useState<Step>('template')
  const [template,      setTemplate]     = useState<DeckTemplate | null>(null)
  const [mode,          setMode]         = useState<DeckInputMode>('ai_generate')
  const [prompt,        setPrompt]       = useState('')
  const [deck,          setDeck]         = useState<DeckDocument | null>(null)
  const [error,         setError]        = useState<string | null>(null)
  const [exportingPptx, setExportingPptx] = useState(false)
  const [exportingPdf,  setExportingPdf]  = useState(false)

  function handleSelectTemplate(t: DeckTemplate) {
    setTemplate(t)
    setError(null)
    setStep('input')
  }

  async function handleGenerate() {
    if (!template || prompt.trim().length < 20) {
      setError('Please write at least 20 characters of content.')
      return
    }

    setStep('generating')
    setError(null)

    try {
      const res = await fetch('/api/studio/decks/structure', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template, mode, prompt }),
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
          body:    JSON.stringify({
            tool:   'decks',
            input:  { template, mode, prompt },
            output: { deck: deckData },
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
        body:    JSON.stringify({ deck, format }),
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
    setPrompt('')
    setDeck(null)
    setError(null)
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Deck Builder</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Choose a structure, write your brief, get a presentation — PPTX and PDF.
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

      {/* Step 1 — Template Selection */}
      {step === 'template' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEMPLATES.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className="group text-left p-6 bg-white border border-slate-200 rounded-2xl hover:border-novax-border hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-novax-light flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-novax-muted" />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-novax transition-colors">
                  {t.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-snug">{t.description}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 2 — Input */}
      {step === 'input' && template && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('template')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-novax transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-block bg-novax text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {TEMPLATE_LABELS[template]}
            </span>
          </div>

          {/* Mode toggle */}
          <div className="flex p-1 gap-1 bg-slate-100 rounded-xl w-fit">
            {(['ai_generate', 'exact_text'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === m
                    ? 'bg-novax text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
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
              rows={mode === 'ai_generate' ? 6 : 9}
              placeholder={
                mode === 'ai_generate'
                  ? 'Describe the deck you need. Include client name, industry, goals, campaign ideas, and any branding preferences.\n\nExample: Create a 4-campaign deck for Lusin, a premium Armenian restaurant in Dubai. Campaigns: Heritage Nights, Seasonal Menu, Private Dining, Weekend Brunch. Use a dark, elegant look with gold accents.'
                  : 'Paste your full deck content here exactly as you want it. Gemini will structure it into slides without changing a single word.\n\nInclude branding preferences anywhere in the text (e.g. "Use a clean white background with navy blue accents").'
              }
              className="w-full resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-mono"
            />
            <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
              {mode === 'ai_generate'
                ? 'Include branding preferences in your brief (e.g. "dark background, gold accents, serif titles").'
                : 'Your exact wording will be used as-is. No edits will be made by AI.'}
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={prompt.trim().length < 20}
            className="w-full bg-novax hover:bg-novax-hover text-white"
          >
            Build Deck
          </Button>
        </div>
      )}

      {/* Step 3 — Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-novax-accent" />
          <p className="text-base font-semibold text-slate-800">Structuring your deck...</p>
          <p className="text-sm text-slate-500">This usually takes 10–20 seconds.</p>
        </div>
      )}

      {/* Step 4 — Preview */}
      {step === 'preview' && deck && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{deck.title}</p>
              <span className="shrink-0 bg-novax text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {deck.template}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button
                size="sm"
                onClick={() => handleExport('pptx')}
                disabled={exportingPptx}
                className="bg-novax hover:bg-novax-hover text-white"
              >
                {exportingPptx && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                PPTX
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={exportingPdf}
                className="bg-novax hover:bg-novax-hover text-white"
              >
                {exportingPdf && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                PDF
              </Button>
              <button
                onClick={handleStartOver}
                className="text-xs text-slate-500 hover:text-novax transition-colors px-2"
              >
                Start Over
              </button>
            </div>
          </div>

          {/* Slide count */}
          <p className="text-xs text-slate-400">{deck.slides.length} slides</p>

          {/* Slides */}
          <div className="space-y-4">
            {deck.slides.map((slide, idx) => {
              const isDark = slide.type === 'cover' || slide.type === 'metrics' || slide.type === 'cta'
              const bg     = isDark ? deck.branding.background : deck.branding.surface
              const titleC = isDark ? deck.branding.surface    : deck.branding.primary
              const bodyC  = isDark ? deck.branding.accent     : deck.branding.body
              const mutedC = deck.branding.muted
              const accentC = deck.branding.accent

              const tovBullets = (slide.bullets ?? []).filter(b => b.startsWith('TOV:')).map(b => b.replace(/^TOV:\s*/, ''))
              const whyBullets = (slide.bullets ?? []).filter(b => b.startsWith('WHY:')).map(b => b.replace(/^WHY:\s*/, ''))
              const normalBullets = slide.type !== 'campaign' || slide.tag !== 'why'
                ? (slide.bullets ?? [])
                : []

              return (
                <div
                  key={slide.id}
                  className="w-full rounded-xl overflow-hidden shadow-md"
                  style={{ aspectRatio: '16/9', backgroundColor: bg, fontFamily: deck.branding.bodyFont }}
                >
                  <div className="h-full p-8 flex flex-col">
                    {/* Cover */}
                    {slide.type === 'cover' && (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                        <h1 style={{ fontSize: 'clamp(20px,3.5vw,40px)', fontWeight: 700, color: deck.branding.surface, fontFamily: deck.branding.titleFont }}>
                          {slide.title}
                        </h1>
                        {slide.subtitle && (
                          <p style={{ fontSize: 'clamp(12px,1.8vw,20px)', color: accentC }}>
                            {slide.subtitle}
                          </p>
                        )}
                        {slide.tag && (
                          <p style={{ fontSize: 'clamp(10px,1.2vw,14px)', color: mutedC }}>
                            {slide.tag}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Section header */}
                    {slide.type === 'section_header' && (
                      <div className="flex items-center justify-center h-full">
                        <h2 style={{ fontSize: 'clamp(18px,2.8vw,32px)', fontWeight: 700, color: titleC, fontFamily: deck.branding.titleFont, textAlign: 'center' }}>
                          {slide.title}
                        </h2>
                      </div>
                    )}

                    {/* Campaign — why slide (2-col) */}
                    {slide.type === 'campaign' && slide.tag === 'why' && (
                      <>
                        <h2 style={{ fontSize: 'clamp(13px,1.6vw,20px)', fontWeight: 700, color: titleC, fontFamily: deck.branding.titleFont, marginBottom: 12 }}>
                          {slide.title}
                        </h2>
                        <div className="flex gap-6 flex-1 min-h-0">
                          <div className="flex-1 space-y-1.5">
                            <p style={{ fontSize: 'clamp(9px,1vw,11px)', fontWeight: 700, color: accentC, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Tone of Voice
                            </p>
                            {tovBullets.map((line, i) => (
                              <p key={i} style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: bodyC }}>• {line}</p>
                            ))}
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <p style={{ fontSize: 'clamp(9px,1vw,11px)', fontWeight: 700, color: accentC, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Why It Works
                            </p>
                            {whyBullets.map((line, i) => (
                              <p key={i} style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: bodyC }}>• {line}</p>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* All other slide types */}
                    {!(slide.type === 'cover') &&
                     !(slide.type === 'section_header') &&
                     !(slide.type === 'campaign' && slide.tag === 'why') && (
                      <>
                        {slide.tag && slide.tag !== 'why' && (
                          <p style={{ fontSize: 'clamp(8px,0.9vw,10px)', fontWeight: 700, color: accentC, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {slide.tag}
                          </p>
                        )}
                        <h2 style={{ fontSize: 'clamp(13px,1.8vw,22px)', fontWeight: 700, color: titleC, fontFamily: deck.branding.titleFont, marginBottom: 8 }}>
                          {slide.title}
                        </h2>
                        {slide.subtitle && (
                          <p style={{ fontSize: 'clamp(10px,1.2vw,14px)', color: mutedC, marginBottom: 8 }}>
                            {slide.subtitle}
                          </p>
                        )}
                        {slide.body && (
                          <p style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: bodyC, lineHeight: 1.5, marginBottom: 8 }} className="line-clamp-6">
                            {slide.body}
                          </p>
                        )}
                        {normalBullets.length > 0 && (
                          <ul className="space-y-1 mt-1">
                            {normalBullets.map((bullet, i) => (
                              <li key={i} style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: isDark ? accentC : bodyC }}>
                                • {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>

                  {/* Slide number badge */}
                  <div className="absolute" style={{ display: 'none' }}>
                    {idx + 1}
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
