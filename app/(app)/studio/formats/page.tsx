'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Flame, ArrowLeft, PlusCircle, ChevronDown,
  Star, Copy, CheckCircle, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import { StudioGuidancePanel } from '@/components/studio/studio-guidance-panel'
import { LumaraPrefillButton, LUMARA_BRIEFS } from '@/components/studio/lumara-prefill-button'
import type { LoadingStep, StudioSession } from '@/lib/studio-types'
import type { FormatResult } from '@/app/api/studio/formats/generate/route'

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']

const LOADING_STEPS: LoadingStep[] = [
  { label: 'Analysing niche trends',       status: 'pending' },
  { label: 'Mapping psychological levers',  status: 'pending' },
  { label: 'Generating 5 viral formats',    status: 'pending' },
  { label: 'Validating three-law criteria', status: 'pending' },
  { label: 'Assembling format report',      status: 'pending' },
]

const DIFFICULTY_BADGE: Record<string, string> = {
  Easy:   'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  Hard:   'bg-red-100 text-red-700',
}

const REUSE_BADGE: Record<string, string> = {
  'One-off':   'bg-slate-100 text-slate-600',
  'Series':    'bg-blue-100 text-blue-700',
  'Evergreen': 'bg-novax-light text-novax',
}

// ── Format card ────────────────────────────────────────────────────────────────

function FormatCard({
  format,
  index,
  isSaved,
  onSave,
}: {
  format: FormatResult
  index: number
  isSaved: boolean
  onSave: () => void
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const [copied,   setCopied]   = useState(false)

  const lawsPassed = format.three_law_validation.filter(l => l.passes).length

  function copyFormat() {
    const lines = [
      `FORMAT: ${format.format_name}`,
      `${format.format_tagline}`,
      ``,
      `HOOK STACK: ${format.hook_stack.join(' → ')}`,
      ``,
      `EPISODE STRUCTURE:`,
      ...format.episode_structure.map((b, i) => `  ${i + 1}. ${b}`),
      ``,
      `PAYOFF: ${format.payoff_architecture}`,
      `WHY VIRAL: ${format.why_viral}`,
      `Platform: ${format.best_platform} | Length: ${format.best_length}`,
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      expanded ? 'border-novax-border' : 'border-slate-200 bg-white',
    )}>
      {/* Header — always visible */}
      <div className="flex items-start gap-3 p-5">
        {/* Index */}
        <span className="text-2xl font-black text-slate-100 leading-none shrink-0 w-8 mt-0.5">{index + 1}</span>

        {/* Name + tagline */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-sm font-bold text-slate-900">{format.format_name}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{format.format_tagline}</p>
        </button>

        {/* Meta badges */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5', DIFFICULTY_BADGE[format.difficulty] ?? 'bg-slate-100 text-slate-600')}>
            {format.difficulty}
          </span>
          <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5', REUSE_BADGE[format.reusability] ?? 'bg-slate-100 text-slate-600')}>
            {format.reusability}
          </span>
          <span className="text-[10px] bg-novax text-white font-bold rounded-full px-2 py-0.5">
            {lawsPassed}/3 laws
          </span>
          <button
            onClick={onSave}
            className={cn('p-1.5 rounded-lg transition-colors', isSaved ? 'text-novax bg-novax-light' : 'text-slate-400 hover:text-novax hover:bg-novax-light')}
          >
            <Star className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={copyFormat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">

          {/* Hook Stack */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Hook Stack</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {format.hook_stack.map((h, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-xs font-semibold bg-novax text-white rounded-lg px-2.5 py-1">{h}</span>
                  {i < format.hook_stack.length - 1 && (
                    <span className="text-slate-300 text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Episode Structure */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Episode Structure</p>
            <div className="space-y-1.5">
              {format.episode_structure.map((beat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg font-black text-slate-100 leading-none w-6 shrink-0">{i + 1}</span>
                  <p className="text-sm text-slate-700 leading-snug">{beat}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Three-law validation */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Three-Law Validation</p>
            <div className="space-y-2">
              {format.three_law_validation.map((law, i) => (
                <div key={i} className={cn('rounded-xl p-3 border', law.passes ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', law.passes ? 'text-emerald-700' : 'text-red-600')}>
                      {law.passes ? 'PASS' : 'FAIL'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{law.law}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{law.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payoff + Why viral */}
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-novax rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-novax-accent mb-1">Payoff Architecture</p>
              <p className="text-sm text-white leading-relaxed">{format.payoff_architecture}</p>
            </div>
            <div className="bg-novax-light border border-novax-border rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-novax-muted mb-1">Why It Goes Viral</p>
              <p className="text-sm text-novax leading-relaxed">{format.why_viral}</p>
            </div>
          </div>

          {/* Platform + Length */}
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap bg-slate-50">
            <span className="text-[10px] text-slate-500 font-medium">Best on</span>
            <span className="text-xs font-semibold text-novax bg-novax-light border border-novax-border rounded-full px-2.5 py-0.5">{format.best_platform}</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-xs text-slate-600">{format.best_length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FormatsPage() {
  const { clients } = useClients()
  const { user }    = useAuth()

  const [pageState,  setPageState]  = useState<'brief' | 'loading' | 'results'>('brief')
  const [error,      setError]      = useState<string | null>(null)
  const [niche,      setNiche]      = useState('')
  const [clientId,   setClientId]   = useState('')
  const [platform,   setPlatform]   = useState('Instagram')
  const [language,   setLanguage]   = useState<'english' | 'arabic'>('english')

  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(LOADING_STEPS)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [formats,        setFormats]        = useState<FormatResult[]>([])
  const [savedIdx,       setSavedIdx]       = useState<Set<number>>(new Set())

  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionId,       setSessionId]       = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  // Auto-fill niche from client industry
  useEffect(() => {
    if (selectedClient?.brand_identity?.industry) {
      setNiche(selectedClient.brand_identity.industry)
    }
  }, [selectedClient])

  useEffect(() => {
    async function loadSessions() {
      try {
        const res  = await fetch(`/api/studio/session?tool=formats&created_by=${user?.id ?? ''}&limit=10`)
        const data = await res.json() as { sessions: StudioSession[] }
        setSessions(data.sessions ?? [])
      } catch { /* silent */ } finally {
        setSessionsLoading(false)
      }
    }
    loadSessions()
  }, [user?.id])

  useEffect(() => {
    if (pageState !== 'loading') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  function handleSessionClick(session: StudioSession) {
    if (session.status === 'complete' && session.outputs) {
      const saved = (session.outputs as { formats?: FormatResult[] }).formats ?? []
      if (saved.length) {
        setFormats(saved)
        setSessionId(session.id)
        setPageState('results')
      }
    }
  }

  async function handleGenerate() {
    if (!niche.trim()) return
    setError(null)

    setLoadingSteps(LOADING_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    setPageState('loading')

    const name = `${niche} — ${platform}`

    try {
      // Create session
      const sessRes = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'formats', client_id: clientId || null,
          created_by: user?.id ?? null, name, brief: niche,
          inputs: { niche, platform, language, clientId },
        }),
      })
      const sessData = await sessRes.json() as { session?: { id: string } }
      const sid = sessData.session?.id ?? null
      if (sid) setSessionId(sid)

      // Simulate step progression
      const DELAYS = [2, 5, 9, 14, 18]
      DELAYS.forEach((delay, idx) => {
        setTimeout(() => {
          setLoadingSteps(prev => prev.map((s, i) => {
            if (i === idx)     return { ...s, status: 'complete' }
            if (i === idx + 1) return { ...s, status: 'active' }
            return s
          }))
        }, delay * 1000)
      })

      const res = await fetch('/api/studio/formats/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, platform, language }),
      })
      const data = await res.json() as { formats?: FormatResult[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      const generated = data.formats ?? []
      setFormats(generated)
      setLoadingSteps(LOADING_STEPS.map(s => ({ ...s, status: 'complete' as const })))

      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { formats: generated } }),
        }).catch(() => {})
        setSessions(prev => [{
          id: sid, name, tool: 'formats', status: 'complete',
          outputs: { formats: generated }, boss_brief: null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          client_id: clientId || null, created_by: user?.id ?? null,
          brief: niche, inputs: { niche, platform, language },
          chat_history: [], edit_history: [], structured_answers: {},
          executive_summary: null, signal_report_used: null,
          metricool_snapshot: null, performance: null, performance_verdict: null,
        } as StudioSession, ...prev])
      }

      setPageState('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.')
      setPageState('brief')
    }
  }

  function handleNewSession() {
    setPageState('brief'); setFormats([]); setSessionId(null)
    setSavedIdx(new Set()); setError(null)
  }

  function toggleSave(idx: number) {
    setSavedIdx(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Flame className="w-4 h-4 text-novax-accent" />
            Peak Format Generator
          </h1>
          <p className="text-xs text-slate-500">5 viral content formats — hook stack, 3-law validation, episode structure</p>
        </div>
        {pageState !== 'loading' && (
          <button onClick={handleNewSession} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <PlusCircle className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* ── BRIEF ── */}
      {pageState === 'brief' && (
        <div className="space-y-5">
          <StudioGuidancePanel
            title="How Peak Format Generator works"
            description="Enter a content niche and get 5 proven viral content formats — each dissected into its structural components so you can replicate the pattern, not just the topic."
            items={[
              { term: 'Hook Stack', definition: 'Each format comes with 2–4 hooks of different types (curiosity, pattern interrupt, identity challenge, social proof) so you can test which opening works best.' },
              { term: '3-Law Validation', definition: 'Every format is validated against 3 rules: Does it create an immediate open loop? Does it reward completion? Does it drive a share-worthy emotion at the end?' },
              { term: 'Episode Structure', definition: 'The beat-by-beat breakdown of the content — what happens in each 3–5 seconds of a reel or each slide of a carousel.' },
              { term: 'Payoff Architecture', definition: 'Where and how the emotional payoff lands — saves are driven by utility at the end, shares by surprise or identity, comments by controversy or question.' },
            ]}
            tips={[
              { label: 'Niche', tip: 'Be specific — "luxury perfume UAE" beats "perfume." The more specific, the more differentiated the formats.' },
              { label: 'Save & reuse', tip: 'Save your favourite formats to the library — they inject into Hook Lab and Content Studio automatically.' },
            ]}
          />
          {(sessions.length > 0 || sessionsLoading) && (
            <div className="mb-6">
              <StudioSessionList
                sessions={sessions}
                onSessionClick={handleSessionClick}
                onDeleteSession={id => setSessions(prev => prev.filter(s => s.id !== id))}
                isLoading={sessionsLoading}
              />
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client <span className="font-normal text-slate-400">(optional — pre-fills niche)</span></label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Niche */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Niche / Industry</label>
                <LumaraPrefillButton
                  onPrefill={(id, b) => { setClientId(id); setNiche(b) }}
                  brief={LUMARA_BRIEFS.formats}
                />
              </div>
              <input
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g. Fire protection systems, Luxury real estate, Women's fitness coaching…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">Be specific — "B2B fire safety equipment for contractors" beats "safety"</p>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setPlatform(p)}
                    className={cn('px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                      platform === p ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Output Language</label>
              <div className="flex gap-2">
                {(['english', 'arabic'] as const).map(lang => (
                  <button key={lang} onClick={() => setLanguage(lang)}
                    className={cn('px-4 py-1.5 text-xs rounded-lg font-medium border transition-all',
                      language === lang ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                    {lang === 'english' ? 'English' : 'Arabic'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={!niche.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
            <Flame className="w-4 h-4" />
            Generate 5 Viral Formats
          </button>
        </div>
      )}

      {/* ── LOADING ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={`${niche} — ${platform}`}
          tool="formats"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── RESULTS ── */}
      {pageState === 'results' && formats.length > 0 && (
        <div className="space-y-5">
          {/* Summary bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">5 formats for</span>
            <span className="text-sm text-novax font-bold">{niche}</span>
            <span className="text-xs text-slate-400">on {platform}</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">{savedIdx.size} saved</span>
            </div>
          </div>

          {/* Format cards */}
          <div className="space-y-3">
            {formats.map((fmt, i) => (
              <FormatCard
                key={i}
                format={fmt}
                index={i}
                isSaved={savedIdx.has(i)}
                onSave={() => toggleSave(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
