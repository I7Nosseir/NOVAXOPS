'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Loader2, CheckCircle, PlusCircle,
  RefreshCw, ArrowRight, TriangleAlert,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioGuidancePanel } from '@/components/studio/studio-guidance-panel'
import type {
  PostMortemDiagnosis,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const FORMATS   = ['Reel', 'Static', 'Carousel', 'Story', 'Live', 'Text post', 'Video']

const LOADING_STEPS_INITIAL: LoadingStep[] = [
  { label: 'Analyzing the hook',             status: 'pending' },
  { label: 'Checking format performance',    status: 'pending' },
  { label: 'Reviewing timing',               status: 'pending' },
  { label: 'Scoring the caption',            status: 'pending' },
  { label: 'Writing verdict',                status: 'pending' },
]

const LOADING_INSIGHTS = [
  'Hook analysis complete',
  'Format analysis complete',
  'Timing analysis complete',
  'Caption analysis complete',
  'Diagnosis ready',
]

type PageState = 'select' | 'loading' | 'document'
type InputMode = 'session' | 'manual'

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  likely_cause:        { label: 'LIKELY CAUSE',        bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',    dot: 'bg-red-400'     },
  contributing_factor: { label: 'CONTRIBUTING FACTOR', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',  dot: 'bg-amber-400'   },
  not_the_issue:       { label: 'NOT THE ISSUE',       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PostMortemPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const { clients } = useClients()
  const { user }    = useAuth()

  // State machine
  const [pageState, setPageState] = useState<PageState>('select')
  const [error,     setError]     = useState<string | null>(null)

  // Selectors
  const [inputMode,   setInputMode]   = useState<InputMode>('session')
  const [clientId,    setClientId]    = useState(params?.get('client') ?? '')
  const [sessions,    setSessions]    = useState<StudioSession[]>([])
  const [selectedSid, setSelectedSid] = useState<string | null>(null)
  const [sessLoading, setSessLoading] = useState(false)

  // Manual input
  const [manPlatform,    setManPlatform]    = useState('Instagram')
  const [manFormat,      setManFormat]      = useState('Reel')
  const [manHook,        setManHook]        = useState('')
  const [manCaption,     setManCaption]     = useState('')
  const [manPublishDate, setManPublishDate] = useState('')
  const [manEr,          setManEr]          = useState('')
  const [manClientAvgEr, setManClientAvgEr] = useState('')

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(LOADING_STEPS_INITIAL)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Document
  const [diagnosis,   setDiagnosis]   = useState<PostMortemDiagnosis | null>(null)
  const [sessionName, setSessionName] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const selectedSession = sessions.find(s => s.id === selectedSid)

  // ── Load sessions ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    setSessLoading(true)
    fetch(`/api/studio/session?created_by=${user.id}&limit=20`)
      .then(r => r.json())
      .then((data: { sessions?: StudioSession[] }) => setSessions(data.sessions ?? []))
      .catch(() => {})
      .finally(() => setSessLoading(false))
  }, [user?.id])

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== 'loading') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  // ── Run post-mortem ──────────────────────────────────────────────────────────
  async function handleRun() {
    setError(null)

    const name = inputMode === 'session' && selectedSession
      ? selectedSession.name
      : `Manual — ${manPlatform} ${manFormat}`
    setSessionName(name)

    // All 4 analyses run in parallel — show all as active, then all complete
    setLoadingSteps(LOADING_STEPS_INITIAL.map((s, i) => ({
      ...s,
      status: i < 4 ? 'active' : 'pending',
    })))
    setPageState('loading')

    try {
      const erVal       = parseFloat(manEr) || 0
      const avgErVal    = parseFloat(manClientAvgEr) || 0
      const payload =
        inputMode === 'session'
          ? { session_id: selectedSid, client_id: clientId || null }
          : {
              client_id: clientId || null,
              session_data: {
                brief:        '',
                hook_text:    manHook,
                hook_type:    'unknown',
                format:       manFormat,
                caption:      manCaption,
                publish_time: manPublishDate,
                platform:     manPlatform,
              },
              performance: {
                engagement_rate: erVal,
                vs_client_avg:   erVal - avgErVal,
                reach:           0,
                saves:           0,
              },
              client_context: {
                client_name:       selectedClient?.name ?? '',
                best_format:       manFormat,
                best_posting_time: manPublishDate,
                avg_er:            avgErVal,
                top_hook_types:    [],
              },
            }

      const res = await fetch('/api/studio/postmortem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { diagnosis?: PostMortemDiagnosis; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Post-mortem failed')

      // Mark all complete simultaneously (parallel analyses)
      setLoadingSteps(LOADING_STEPS_INITIAL.map((s, i) => ({
        ...s,
        status: 'complete',
        insight: LOADING_INSIGHTS[i],
      })))

      setDiagnosis(data.diagnosis ?? null)
      setPageState('document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Post-mortem failed.')
      setPageState('select')
    }
  }

  function handleRerunWithFixes() {
    if (!diagnosis) return
    const url = new URL('/studio/content', window.location.origin)
    if (clientId) url.searchParams.set('client', clientId)
    if (diagnosis.verdict_brief) url.searchParams.set('brief', diagnosis.verdict_brief)
    router.push(url.pathname + url.search)
  }

  function handleNewSession() {
    setPageState('select')
    setDiagnosis(null)
    setError(null)
    setSelectedSid(null)
    setManHook('')
    setManCaption('')
  }

  const canRun = inputMode === 'session' ? !!selectedSid : !!manHook.trim()

  return (
    <div className="max-w-3xl">
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
            <TriangleAlert className="w-4 h-4 text-amber-500" />
            Why Didn't This Work
          </h1>
          <p className="text-xs text-slate-500">Post-mortem diagnostic — hook, format, timing, caption</p>
        </div>
        {(pageState === 'select' || pageState === 'document') && (
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button
            onClick={() => { setError(null); setPageState('select') }}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      )}

      {/* ── SELECT state ── */}
      {pageState === 'select' && (
        <div className="space-y-5">
          <StudioGuidancePanel
            title="How Post-Mortem works"
            description="Post-Mortem diagnoses why a piece of content underperformed using a 4-dimension framework: Hook (did the first 1–3 seconds stop the scroll?), Format (was the structure right for the platform?), Timing (was it posted at the wrong moment?), and Caption (did the text reinforce or fight the visual?)."
            items={[
              { term: 'Hook Failure', definition: 'The content had a weak or generic opening — audience scrolled past before the value was clear.' },
              { term: 'Format Mismatch', definition: 'The content type didn\'t match the platform behavior — e.g. a talking-head reel on a visual-first feed.' },
              { term: 'Timing Signal', definition: 'Posted outside peak activity windows for the account or conflicting with a cultural moment that drowned it out.' },
              { term: 'Caption Gap', definition: 'The caption failed to carry the hook forward, add context, or drive a specific action (save, share, comment).' },
            ]}
            tips={[
              { label: 'Most value', tip: 'Give the actual engagement numbers — views, saves, shares — not just "it didn\'t perform." Specificity improves the diagnosis.' },
              { label: 'Compare', tip: 'Run a post-mortem on a top performer and a bottom performer on the same day — the contrast reveals the real pattern.' },
            ]}
          />
          {/* Input mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('session')}
              className={cn(
                'flex-1 py-2 text-xs rounded-xl font-semibold border-2 transition-all',
                inputMode === 'session' ? 'border-novax bg-novax-light text-novax' : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              Select a session
            </button>
            <button
              onClick={() => setInputMode('manual')}
              className={cn(
                'flex-1 py-2 text-xs rounded-xl font-semibold border-2 transition-all',
                inputMode === 'manual' ? 'border-novax bg-novax-light text-novax' : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              Enter manually
            </button>
          </div>

          {/* Client selector (both modes) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client (for Metricool context)</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
            >
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Session mode */}
          {inputMode === 'session' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {sessLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              )}
              {!sessLoading && sessions.length === 0 && (
                <div className="flex flex-col items-center py-10 text-center">
                  <AlertTriangle className="w-7 h-7 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No sessions found. Run a Content Studio session first.</p>
                </div>
              )}
              {!sessLoading && sessions.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {sessions.map(s => {
                    const isBelow = s.performance_verdict === 'below' || s.performance_verdict === 'significantly_below'
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSid(s.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          selectedSid === s.id ? 'bg-novax-light' : isBelow ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50',
                        )}
                      >
                        <div className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          s.status === 'complete' ? 'bg-emerald-400' : 'bg-slate-300',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {s.tool} · {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {isBelow && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Below avg
                          </span>
                        )}
                        {selectedSid === s.id && (
                          <CheckCircle className="w-4 h-4 text-novax shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Manual mode */}
          {inputMode === 'manual' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              {/* Platform + Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platform</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.slice(0, 4).map(p => (
                      <button
                        key={p}
                        onClick={() => setManPlatform(p)}
                        className={cn(
                          'px-2 py-1 text-[10px] rounded-lg font-medium border transition-all',
                          manPlatform === p ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Format</label>
                  <select
                    value={manFormat}
                    onChange={e => setManFormat(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
                  >
                    {FORMATS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {/* Hook */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hook text (first line / on-screen text)</label>
                <textarea
                  value={manHook}
                  onChange={e => setManHook(e.target.value)}
                  placeholder="Paste the opening hook or on-screen text..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Caption</label>
                <textarea
                  value={manCaption}
                  onChange={e => setManCaption(e.target.value)}
                  placeholder="Paste the full caption..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Publish date + ER */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Publish date/time</label>
                  <input
                    type="datetime-local"
                    value={manPublishDate}
                    onChange={e => setManPublishDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Engagement rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manEr}
                    onChange={e => setManEr(e.target.value)}
                    placeholder="e.g. 1.2"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Client avg ER */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client average ER %</label>
                <input
                  type="number"
                  step="0.1"
                  value={manClientAvgEr}
                  onChange={e => setManClientAvgEr(e.target.value)}
                  placeholder="e.g. 5.2"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Run Post-Mortem
          </button>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={sessionName}
          tool="postmortem"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && diagnosis && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-0.5">{sessionName}</p>
            <h2 className="text-base font-bold text-slate-900">Post-Mortem Diagnostic</h2>
            {diagnosis.result && (
              <div className="flex items-center gap-3 mt-2">
                <span className={cn(
                  'text-sm font-bold',
                  (diagnosis.result.vs_client_average ?? diagnosis.result.vs_avg ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600',
                )}>
                  ER {diagnosis.result.er}%
                </span>
                <span className="text-xs text-slate-400">
                  vs client avg {diagnosis.result.client_avg_er ?? '-'}%
                  {(diagnosis.result.vs_client_average ?? diagnosis.result.vs_avg) != null && (
                    <span className={cn('ml-1 font-semibold', (diagnosis.result.vs_client_average ?? diagnosis.result.vs_avg ?? 0) < 0 ? 'text-red-500' : 'text-emerald-500')}>
                      ({(diagnosis.result.vs_client_average ?? diagnosis.result.vs_avg ?? 0) > 0 ? '+' : ''}{diagnosis.result.vs_client_average ?? diagnosis.result.vs_avg ?? 0}%)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Diagnostic rows */}
          {[
            { key: 'hook',    label: 'Hook',    data: diagnosis.hook_analysis },
            { key: 'format',  label: 'Format',  data: diagnosis.format_analysis },
            { key: 'timing',  label: 'Timing',  data: diagnosis.timing_analysis },
            { key: 'caption', label: 'Caption', data: diagnosis.caption_analysis },
          ].map(row => {
            if (!row.data) return null
            const statusKey = row.data.status ?? 'not_the_issue'
            const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['not_the_issue']
            return (
              <div key={row.key} className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dot)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{row.label}</span>
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide', cfg.text)}>{cfg.label}</span>
                    </div>
                    <p className={cn('text-sm leading-relaxed', cfg.text)}>{row.data.finding}</p>
                    {row.data.fix && (
                      <p className={cn('text-xs italic mt-1.5', cfg.text)}>
                        Fix: {row.data.fix}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Verdict */}
          {diagnosis.verdict && (
            <div className="bg-novax rounded-2xl p-6">
              <p className="text-[10px] font-bold text-novax-accent uppercase tracking-widest mb-2">Verdict</p>
              <p className="text-sm text-white leading-relaxed mb-4">{diagnosis.verdict}</p>
              <button
                onClick={handleRerunWithFixes}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Rerun with fixes
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
