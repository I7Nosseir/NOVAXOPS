'use client'

import { useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Wand2, Loader2, Star, Copy, RefreshCw, ArrowLeft, ChevronDown, ChevronUp, BookMarked, CheckCircle, PlusCircle, Download } from 'lucide-react'
import Link from 'next/link'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import type { GeneratedHook } from '@/app/api/studio/hooks/generate/route'

const PLATFORMS  = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const AUDIENCES  = ['B2C', 'B2B']
const GOALS      = ['Virality', 'Authority', 'Engagement', 'Leads', 'Sales', 'Community']
const EMOTIONS   = ['Inspire', 'Educate', 'Entertain', 'Challenge', 'Reassure', 'Shock']

const TIER_CONFIG = {
  S: { label: 'S', color: 'bg-amber-400 text-white',     title: 'Elite — top 1%' },
  A: { label: 'A', color: 'bg-emerald-500 text-white',   title: 'Viral potential' },
  B: { label: 'B', color: 'bg-blue-400 text-white',      title: 'Above average' },
  C: { label: 'C', color: 'bg-slate-300 text-slate-600', title: 'Standard' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  curiosity:      { label: 'Curiosity',       color: 'bg-violet-50 text-violet-700 border border-violet-200' },
  contradiction:  { label: 'Contradiction',   color: 'bg-rose-50 text-rose-700 border border-rose-200'       },
  fear:           { label: 'Fear',            color: 'bg-red-50 text-red-700 border border-red-200'           },
  status:         { label: 'Status',          color: 'bg-amber-50 text-amber-700 border border-amber-200'     },
  authority:      { label: 'Authority',       color: 'bg-blue-50 text-blue-700 border border-blue-200'        },
  transformation: { label: 'Transformation', color: 'bg-teal-50 text-teal-700 border border-teal-200'         },
  emotional:      { label: 'Emotional',       color: 'bg-pink-50 text-pink-700 border border-pink-200'        },
  story:          { label: 'Story',           color: 'bg-orange-50 text-orange-700 border border-orange-200'  },
  shock:          { label: 'Shock',           color: 'bg-slate-800 text-white'                                 },
}

const FORMAT_LABEL: Record<string, string> = {
  vocal:       'Vocal',
  text_block:  'Text Overlay',
  caption:     'Caption',
  all_three:   'All Formats',
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-12">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-novax-accent transition-all"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-4 text-right">{value}</span>
    </div>
  )
}

function HookCard({
  hook,
  index,
  saved,
  language,
  onSave,
  onCopy,
  onRefine,
}: {
  hook: GeneratedHook
  index: number
  saved: boolean
  language: string
  onSave: () => void
  onCopy: () => void
  onRefine: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tier = TIER_CONFIG[hook.virality_tier]
  const type = TYPE_CONFIG[hook.hook_type] ?? { label: hook.hook_type, color: 'bg-slate-100 text-slate-600' }

  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 transition-all hover:shadow-sm',
      saved ? 'border-novax-border bg-novax-light/30' : 'border-slate-200',
    )}>
      <div className="flex items-start gap-3">
        {/* Rank + tier */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">#{index + 1}</span>
          <span className={cn('text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center', tier.color)} title={tier.title}>
            {tier.label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Hook text */}
          <p className="text-sm font-medium text-slate-900 leading-snug mb-2" dir={language === 'arabic' ? 'rtl' : 'ltr'}>{hook.hook_text}</p>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', type.color)}>
              {type.label}
            </span>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
              {FORMAT_LABEL[hook.format_rec] ?? hook.format_rec}
            </span>
            <span className="text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
              {hook.total_score}/30
            </span>
          </div>

          {/* Expand for scores */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 transition-colors mb-1"
          >
            3C Scores
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expanded && (
            <div className="space-y-1 mb-2">
              <ScoreBar label="Clarity" value={hook.clarity_score} />
              <ScoreBar label="Context" value={hook.context_score} />
              <ScoreBar label="Curiosity" value={hook.curiosity_score} />
              {hook.format_note && (
                <p className="text-[10px] text-slate-400 italic mt-1.5">{hook.format_note}</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onSave}
            title={saved ? 'Saved to library' : 'Save to library'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              saved ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50',
            )}
          >
            <Star className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onCopy}
            title="Copy hook"
            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefine}
            title="Generate 3 variations"
            className="p-1.5 rounded-lg text-slate-300 hover:text-novax-muted hover:bg-novax-light transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HookLabPage() {
  const params = useSearchParams()
  const { clients }    = useClients()
  const { user }       = useAuth()

  // Form state
  const [clientId,  setClientId]  = useState(params?.get('client') ?? '')
  const [platform,  setPlatform]  = useState(params?.get('platform') ?? 'Instagram')
  const [audience,  setAudience]  = useState('B2C')
  const [goal,      setGoal]      = useState('Engagement')
  const [emotion,   setEmotion]   = useState('Inspire')
  const [brief,     setBrief]     = useState(params?.get('brief') ?? '')
  const [language,  setLanguage]  = useState<'english' | 'arabic'>('english')
  const [dialect,   setDialect]   = useState<'saudi' | 'egyptian'>('saudi')

  // Result state
  const [hooks,     setHooks]     = useState<GeneratedHook[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [savedIds,  setSavedIds]  = useState<Set<number>>(new Set())
  const [copied,    setCopied]    = useState<number | null>(null)
  const [refining,  setRefining]  = useState<number | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  const handleGenerate = async () => {
    if (!brief.trim()) return
    setLoading(true)
    setError(null)
    setHooks([])
    setSavedIds(new Set())

    try {
      const res = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief.trim(),
          platform,
          audience,
          goal,
          emotion,
          brand_voice: selectedClient?.brand_identity?.tone_of_voice,
          language,
          dialect,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setHooks(data.hooks ?? [])
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate hooks')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (index: number) => {
    const hook = hooks[index]
    if (!hook || savedIds.has(index)) return

    setSavedIds(prev => new Set([...prev, index]))

    // Persist to hook_library via a simple fetch
    fetch('/api/studio/hooks/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:       clientId || null,
        created_by:      user?.id || null,
        hook_text:       hook.hook_text,
        hook_type:       hook.hook_type,
        format_rec:      hook.format_rec,
        clarity_score:   hook.clarity_score,
        context_score:   hook.context_score,
        curiosity_score: hook.curiosity_score,
        virality_tier:   hook.virality_tier,
        platform,
        brief_context:   brief.trim(),
      }),
    }).catch(() => {})
  }

  const handleCopy = (index: number) => {
    const hook = hooks[index]
    if (!hook) return
    navigator.clipboard.writeText(hook.hook_text).catch(() => {})
    setCopied(index)
    setTimeout(() => setCopied(null), 1800)
  }

  const handleRefine = async (index: number) => {
    const hook = hooks[index]
    if (!hook || refining !== null) return
    setRefining(index)

    try {
      const res = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: `Create 3 variations of this hook, keeping the same hook type and emotional trigger but varying the wording, structure, and angle. Original hook: "${hook.hook_text}". Brief context: ${brief}`,
          platform,
          audience,
          goal,
          emotion,
          brand_voice: selectedClient?.brand_identity?.tone_of_voice,
          language,
          dialect,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Refinement failed')

      const variations = (data.hooks ?? []).slice(0, 3) as GeneratedHook[]
      // Insert variations after the current hook
      setHooks(prev => [
        ...prev.slice(0, index + 1),
        ...variations,
        ...prev.slice(index + 1),
      ])
    } catch {
      // ignore refinement errors silently
    } finally {
      setRefining(null)
    }
  }

  const tierCounts = hooks.reduce<Record<string, number>>((acc, h) => {
    acc[h.virality_tier] = (acc[h.virality_tier] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/studio"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-novax-accent" />
            Hook Lab
          </h1>
          <p className="text-xs text-slate-500">One Peak 3C framework — Clarity · Context · Curiosity</p>
        </div>
        <button
          onClick={() => { setBrief(''); setHooks([]); setSavedIds(new Set()); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          New Session
        </button>
        {hooks.length > 0 && (
          <button
            onClick={() => {
              const lines = hooks.map((h, i) => `#${i + 1} [${h.virality_tier}] ${h.hook_text}\nType: ${h.hook_type} | Score: ${h.total_score}/30`).join('\n\n')
              const blob = new Blob([`HOOK LAB EXPORT\nBrief: ${brief}\n\n${lines}`], { type: 'text/plain' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `novax-hooks-${Date.now()}.txt`; a.click()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-novax-muted border border-novax-border rounded-lg hover:bg-novax-light transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Brief</p>

            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Client (optional)</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700"
              >
                <option value="">No client (global)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                      platform === p
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience + Goal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Audience</label>
                <div className="flex gap-1.5">
                  {AUDIENCES.map(a => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={cn(
                        'flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                        audience === a
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Goal</label>
                <select
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
                >
                  {GOALS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Emotion */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Desired Emotion</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map(em => (
                  <button
                    key={em}
                    onClick={() => setEmotion(em)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                      emotion === em
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Hook Language</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['english', 'arabic'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={cn(
                        'flex-1 py-1.5 text-xs rounded-lg font-semibold border transition-all',
                        language === lang ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {lang === 'english' ? 'English' : 'Arabic — عربي'}
                    </button>
                  ))}
                </div>
                {language === 'arabic' && (
                  <div className="flex gap-2 pl-1">
                    <span className="text-[10px] text-slate-400 self-center shrink-0">Dialect:</span>
                    {([
                      { value: 'saudi',    label: 'Saudi — سعودي' },
                      { value: 'egyptian', label: 'Egyptian — مصري' },
                    ] as const).map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDialect(d.value)}
                        className={cn(
                          'flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                          dialect === d.value ? 'bg-novax-light border-novax-border text-novax' : 'bg-white text-slate-500 border-slate-200 hover:border-novax-border',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Content Brief</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Describe the content in 2–3 sentences. What's the topic, the angle, the key message you want to deliver?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!brief.trim() || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating 20 hooks…</>
                : <><Wand2 className="w-4 h-4" />Generate Hooks</>
              }
            </button>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Saved count */}
          {savedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-novax-light border border-novax-border rounded-xl">
              <BookMarked className="w-3.5 h-3.5 text-novax-muted" />
              <span className="text-xs text-novax-muted font-medium">
                {savedIds.size} hook{savedIds.size !== 1 ? 's' : ''} saved to library
              </span>
            </div>
          )}
        </div>

        {/* Results panel */}
        <div ref={resultsRef}>
          {hooks.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Wand2 className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-400">Your 20 hooks will appear here</p>
              <p className="text-xs text-slate-300 mt-1">Ranked by virality score, S → C tier</p>
            </div>
          )}

          {hooks.length > 0 && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{hooks.length}</span> hooks generated
                </p>
                <div className="flex items-center gap-2">
                  {(['S', 'A', 'B', 'C'] as const).map(t => tierCounts[t] ? (
                    <span key={t} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', TIER_CONFIG[t].color)}>
                      {t}·{tierCounts[t]}
                    </span>
                  ) : null)}
                </div>
              </div>

              {hooks.map((hook, i) => (
                <HookCard
                  key={i}
                  hook={hook}
                  index={i}
                  saved={savedIds.has(i)}
                  language={language}
                  onSave={() => handleSave(i)}
                  onCopy={() => handleCopy(i)}
                  onRefine={() => handleRefine(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
