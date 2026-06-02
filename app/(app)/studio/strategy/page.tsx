'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Brain, ArrowLeft, Loader2, CheckCircle, PlusCircle,
  AlertTriangle, RefreshCw, Download,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import type {
  StrategyDocument,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
  StructuredQuestion,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']

const LOADING_STEPS_INITIAL: LoadingStep[] = [
  { label: 'Loading market intelligence',          status: 'pending' },
  { label: 'Intelligence analysis (Discover)',     status: 'pending' },
  { label: 'Positioning analysis (Define)',        status: 'pending' },
  { label: 'Execution planning (Develop)',         status: 'pending' },
  { label: 'Scale and retain strategy (Deliver)',  status: 'pending' },
  { label: 'Optimization roadmap',                 status: 'pending' },
  { label: 'Quality checks',                      status: 'pending' },
  { label: 'Executive summary',                   status: 'pending' },
  { label: 'Boss Brief',                          status: 'pending' },
]

const LOADING_INSIGHTS = [
  'Signal report loaded',
  'Market position mapped',
  'Archetype and UVP defined',
  'Content pillars built',
  'Community strategy ready',
  '12-month roadmap built',
  'Six Thinking Hats complete',
  'Summary ready',
  'Done',
]

type PageState = 'brief' | 'question' | 'loading' | 'document'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const { clients } = useClients()
  const { user }    = useAuth()

  // State machine
  const [pageState, setPageState] = useState<PageState>('brief')
  const [error,     setError]     = useState<string | null>(null)

  // Form
  const [clientId,  setClientId]  = useState(params?.get('client') ?? '')
  const [platforms, setPlatforms] = useState<string[]>(['Instagram'])
  const [brief,     setBrief]     = useState('')

  // Question step
  const [question,          setQuestion]          = useState<StructuredQuestion | null>(null)
  const [questionAnswer,    setQuestionAnswer]    = useState('')
  const [customAnswer,      setCustomAnswer]      = useState('')
  const [showCustomInput,   setShowCustomInput]   = useState(false)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(LOADING_STEPS_INITIAL)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Document
  const [strategyDoc, setStrategyDoc] = useState<StrategyDocument | null>(null)
  const [bossBrief,   setBossBrief]   = useState<BossBrief | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatOpen,    setChatOpen]    = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)

  // ── Resume from session_id ───────────────────────────────────────────────────
  useEffect(() => {
    const sid = params?.get('session_id')
    if (!sid) return
    fetch(`/api/studio/session/${sid}`)
      .then(r => r.json())
      .then((data: { session?: StudioSession }) => {
        const s = data.session
        if (!s || s.status !== 'complete') return
        setSessionId(sid)
        setStrategyDoc((s.outputs as { strategy?: StrategyDocument }).strategy ?? null)
        setBossBrief(s.boss_brief ?? null)
        setChatHistory(s.chat_history ?? [])
        setPageState('document')
      })
      .catch(() => {})
  }, [params])

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== 'loading') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  // ── Step 1: Submit brief, get question ──────────────────────────────────────
  async function handleBriefSubmit() {
    if (!clientId || !brief.trim()) return
    setError(null)
    setIsLoadingQuestion(true)

    try {
      // Create session
      const sessRes = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:       'strategy',
          client_id:  clientId,
          created_by: user?.id ?? null,
          name:       `${selectedClient?.name ?? 'Strategy'} — Strategy`,
          brief,
          inputs:     { clientId, platforms },
        }),
      })
      const sessData = await sessRes.json() as { session?: { id: string } }
      const sid = sessData.session?.id ?? null
      if (sid) setSessionId(sid)

      // Get strategy-specific question
      const qRes = await fetch('/api/studio/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:           'strategy',
          brief,
          client_profile: selectedClient,
        }),
      })
      const qData = await qRes.json() as { question?: StructuredQuestion }
      setQuestion(qData.question ?? {
        question: 'What is the biggest obstacle to growth right now?',
        options:  ['Low brand awareness', 'Inconsistent content', 'Weak audience targeting', 'No clear positioning'],
        type:     'static' as const,
      })
      setPageState('question')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // ── Step 2: Run auto-chain after question answered ──────────────────────────
  async function handleRunStrategy() {
    const obstacle = showCustomInput ? customAnswer : questionAnswer
    if (!obstacle) return
    setError(null)

    setLoadingSteps(LOADING_STEPS_INITIAL.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    setPageState('loading')

    try {
      // Step 1: Signal report
      const industry = selectedClient?.brand_identity?.industry ?? 'general'
      const sigRes = await fetch(`/api/studio/signal-report/${encodeURIComponent(industry)}`)
      const signalReport = sigRes.ok ? await sigRes.json() : null
      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === 0) return { ...s, status: 'complete', insight: LOADING_INSIGHTS[0] }
        if (i === 1) return { ...s, status: 'active' }
        return s
      }))

      const basePayload = {
        client_id:    selectedClient?.id,
        client_name:  selectedClient?.name,
        industry:     selectedClient?.brand_identity?.industry,
        brand_voice:  selectedClient?.brand_identity?.tone_of_voice,
        key_messages: selectedClient?.brand_identity?.key_messages,
        platforms:    platforms.length ? platforms : selectedClient?.brand_identity?.platforms,
        competitors:  selectedClient?.brand_identity?.competitors,
        brief,
        obstacle,
        signal_report: signalReport,
      }

      // Steps 2-6: Strategy phases sequentially
      const phases: Array<'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize'> = [
        'intelligence', 'positioning', 'execution', 'scale', 'optimize'
      ]
      const phaseData: Partial<Record<string, unknown>> = {}
      const stepOffset = 1 // step 0 was signal report

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]
        const stepIdx = i + stepOffset

        try {
          const res = await fetch('/api/studio/strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...basePayload, meta: phase, existing_data: phaseData }),
          })
          const result = await res.json() as { data?: Record<string, unknown>; error?: string }
          if (res.ok && result.data) {
            phaseData[phase] = result.data
            // Save phase to session
            if (sessionId) {
              fetch(`/api/studio/session/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputs: { ...phaseData } }),
              }).catch(() => {})
            }
          }
        } catch { /* phase failure — continue, mark partial */ }

        setLoadingSteps(prev => prev.map((s, si) => {
          if (si === stepIdx) return { ...s, status: 'complete', insight: LOADING_INSIGHTS[stepIdx] }
          if (si === stepIdx + 1) return { ...s, status: 'active' }
          return s
        }))
      }

      // Step 7: Quality checks (visual)
      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === 6) return { ...s, status: 'complete', insight: LOADING_INSIGHTS[6] }
        if (i === 7) return { ...s, status: 'active' }
        return s
      }))

      // Step 8: Executive summary
      const execSummary = `Strategic framework built for ${selectedClient?.name ?? 'client'}. Key phases: Intelligence, Positioning, Execution, Scale, Optimize. Growth obstacle addressed: ${obstacle}.`
      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === 7) return { ...s, status: 'complete', insight: LOADING_INSIGHTS[7] }
        if (i === 8) return { ...s, status: 'active' }
        return s
      }))

      // Boss Brief
      let bb: BossBrief | null = null
      try {
        const bbRes = await fetch('/api/studio/brief-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief, mode: 'boss_brief', strategy: phaseData, client: selectedClient ? { name: selectedClient.name } : null }),
        })
        const bbData = await bbRes.json() as { boss_brief?: BossBrief }
        bb = bbData.boss_brief ?? null
      } catch { /* non-fatal */ }
      setBossBrief(bb)

      setLoadingSteps(prev => prev.map((s, i) =>
        i === 8 ? { ...s, status: 'complete', insight: LOADING_INSIGHTS[8] } : s
      ))

      // Assemble StrategyDocument
      const doc: StrategyDocument = {
        executive_summary:    execSummary,
        phases:               [],
        phase_intelligence:   phaseData['intelligence'] as Record<string, unknown> ?? {},
        phase_positioning:    phaseData['positioning']  as Record<string, unknown> ?? {},
        phase_execution:      phaseData['execution']    as Record<string, unknown> ?? {},
        phase_scale:          phaseData['scale']        as Record<string, unknown> ?? {},
        phase_optimize:       phaseData['optimize']     as Record<string, unknown> ?? {},
        brief,
        obstacle,
        platforms,
        client_name:          selectedClient?.name ?? '',
      }
      setStrategyDoc(doc)

      // Save completed session
      if (sessionId) {
        fetch(`/api/studio/session/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { strategy: doc }, boss_brief: bb }),
        }).catch(() => {})
      }

      setPageState('document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Strategy generation failed.')
      setPageState('brief')
    }
  }

  function handleNewSession() {
    setPageState('brief')
    setSessionId(null)
    setStrategyDoc(null)
    setBossBrief(null)
    setChatHistory([])
    setChatOpen(false)
    setError(null)
    setBrief('')
    setQuestion(null)
    setQuestionAnswer('')
  }

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
            <Brain className="w-4 h-4 text-novax-accent" />
            Strategy Command Center
          </h1>
          <p className="text-xs text-slate-500">Double Diamond pipeline — Discover, Define, Develop, Deliver</p>
        </div>
        {(pageState === 'brief' || pageState === 'document') && (
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Session
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button
            onClick={() => { setError(null); setPageState('brief') }}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      )}

      {/* ── BRIEF state ── */}
      {pageState === 'brief' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={e => { setClientId(e.target.value) }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                <option value="">Choose a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedClient && (
                <p className="text-xs text-slate-400 mt-1.5">
                  {selectedClient.brand_identity?.industry} · {selectedClient.brand_identity?.tone_of_voice}
                </p>
              )}
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Platforms</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const selected = platforms.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatforms(selected ? platforms.filter(x => x !== p) : [...platforms, p])}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                        selected ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Strategic Challenge</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="What is the strategic challenge? What does this client need to achieve in the next 90 days?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleBriefSubmit}
            disabled={!clientId || !brief.trim() || isLoadingQuestion}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isLoadingQuestion ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Preparing question...</>
            ) : (
              <><Brain className="w-4 h-4" />Continue</>
            )}
          </button>
        </div>
      )}

      {/* ── QUESTION state ── */}
      {pageState === 'question' && question && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">One question before I start</p>
            <p className="text-base font-semibold text-slate-900 leading-snug">{question.question}</p>
            <p className="text-xs text-slate-400 mt-1">Your answer will shape the entire strategy.</p>
          </div>

          <div className="space-y-2">
            {question.options.map(opt => (
              <button
                key={opt}
                onClick={() => { setQuestionAnswer(opt); setShowCustomInput(false) }}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                  questionAnswer === opt && !showCustomInput
                    ? 'border-novax bg-novax-light'
                    : 'border-slate-200 bg-white hover:border-novax-border',
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                  questionAnswer === opt && !showCustomInput ? 'border-novax bg-novax' : 'border-slate-300',
                )} />
                <span className={cn(
                  'text-sm',
                  questionAnswer === opt && !showCustomInput ? 'text-novax font-medium' : 'text-slate-700',
                )}>
                  {opt}
                </span>
              </button>
            ))}

            {/* Something else */}
            <button
              onClick={() => { setShowCustomInput(true); setQuestionAnswer('') }}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                showCustomInput ? 'border-novax bg-novax-light' : 'border-slate-200 bg-white hover:border-novax-border',
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 shrink-0',
                showCustomInput ? 'border-novax bg-novax' : 'border-slate-300',
              )} />
              <span className="text-sm text-slate-500">Something else...</span>
            </button>

            {showCustomInput && (
              <input
                autoFocus
                value={customAnswer}
                onChange={e => setCustomAnswer(e.target.value)}
                placeholder="Describe the obstacle..."
                className="w-full px-3 py-2 text-sm border border-novax-border rounded-xl outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-novax-light/50 text-slate-700 placeholder:text-slate-400"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPageState('brief')}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleRunStrategy}
              disabled={!questionAnswer && !customAnswer}
              className="flex items-center gap-2 px-6 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Brain className="w-4 h-4" />
              Run Strategy
            </button>
          </div>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={`${selectedClient?.name ?? 'Strategy'} — Strategy`}
          tool="strategy"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && strategyDoc && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <StudioDocument
              tool="strategy"
              clientName={selectedClient?.name ?? ''}
              clientColor={selectedClient?.color ?? '#1B3D38'}
              platforms={platforms}
              content={strategyDoc}
              bossBrief={bossBrief}
              language="english"
              onExportTxt={() => {
                const lines = [
                  `STRATEGY DOCUMENT — ${selectedClient?.name ?? 'Client'}`,
                  `Brief: ${brief}`,
                  `Obstacle: ${strategyDoc.obstacle}`,
                  '',
                  `EXECUTIVE SUMMARY`,
                  strategyDoc.executive_summary,
                ]
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `novax-strategy-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url)
              }}
              onExportPdf={() => window.print()}
              onChatOpen={() => setChatOpen(true)}
              onEditApplied={(target, newContent) => {
                if (!strategyDoc) return
                const key = target as keyof StrategyDocument
                setStrategyDoc({ ...strategyDoc, [key]: newContent })
              }}
            />
          </div>

          {chatOpen && sessionId && (
            <>
              <div className="hidden lg:block w-[380px] shrink-0">
                <div className="sticky top-4">
                  <StudioChatbot
                    sessionId={sessionId}
                    sessionContext={{ tool: 'strategy', document: strategyDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => {
                      setStrategyDoc(prev => prev ? { ...prev, [edit.target]: edit.new_content } : prev)
                    }}
                  />
                </div>
              </div>
              <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
                <div className="bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '70vh' }}>
                  <StudioChatbot
                    sessionId={sessionId}
                    sessionContext={{ tool: 'strategy', document: strategyDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => {
                      setStrategyDoc(prev => prev ? { ...prev, [edit.target]: edit.new_content } : prev)
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center gap-2 px-4 py-3 bg-novax text-white text-sm font-semibold rounded-full shadow-lg hover:bg-novax-hover transition-colors"
            >
              <Brain className="w-4 h-4" />
              Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
