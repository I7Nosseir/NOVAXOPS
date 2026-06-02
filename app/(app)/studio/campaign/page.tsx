'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Flame, ArrowLeft, Loader2, CheckCircle, PlusCircle,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import type {
  CampaignDocument,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']

const BOLDNESS_OPTIONS = [
  { value: 'safe',        label: 'Safe',          description: 'Polished, low-risk, brand-approved' },
  { value: 'disrupting',  label: 'Disrupting',    description: 'Unexpected — challenges category norms' },
  { value: 'redbull',     label: 'Red Bull level', description: 'Provocative — designed to divide and spread' },
]

const CONSTRAINT_OPTIONS = [
  { value: 'budget',     label: 'Budget tight',      description: 'Low-cost execution only' },
  { value: 'timeline',   label: 'Timeline short',    description: 'Must launch in 2 weeks' },
  { value: 'brandsafe',  label: 'Brand-safe only',   description: 'No controversy, no risk' },
  { value: 'none',       label: 'None',              description: 'No constraints' },
]

const LOADING_STEPS_INITIAL: LoadingStep[] = [
  { label: 'Mining cultural tensions',          status: 'pending' },
  { label: 'Inverting industry rules',          status: 'pending' },
  { label: 'Cross-domain stimulation',          status: 'pending' },
  { label: 'Divergent ideation — 15 concepts',  status: 'pending' },
  { label: 'Designing participatory mechanics', status: 'pending' },
  { label: 'Convergent scoring',                status: 'pending' },
  { label: 'Writing execution briefs',          status: 'pending' },
]

const LOADING_INSIGHTS = [
  '5 tensions identified',
  '5 rule inversions ready',
  '3 creative domains applied',
  '15 raw concepts generated',
  'Audience engagement mechanics designed',
  'Top 5 concepts selected',
  'Done',
]

// Phase step timing simulation (seconds per step before API returns)
const STEP_DURATIONS = [20, 20, 15, 25, 20, 15, 20]

type PageState = 'warning' | 'brief' | 'loading' | 'document'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CampaignIgniterPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const { clients } = useClients()
  const { user }    = useAuth()

  // State machine
  const [pageState, setPageState] = useState<PageState>('warning')
  const [error,     setError]     = useState<string | null>(null)

  // Form
  const [clientId,   setClientId]   = useState(params?.get('client') ?? '')
  const [industry,   setIndustry]   = useState('')
  const [audience,   setAudience]   = useState('')
  const [platforms,  setPlatforms]  = useState<string[]>(['Instagram'])
  const [boldness,   setBoldness]   = useState<'safe' | 'disrupting' | 'redbull'>('disrupting')
  const [constraint, setConstraint] = useState<'budget' | 'timeline' | 'brandsafe' | 'none'>('none')
  const [brief,      setBrief]      = useState('')

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(LOADING_STEPS_INITIAL)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const stepTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentStepRef  = useRef(0)

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Document
  const [campaignDoc, setCampaignDoc] = useState<CampaignDocument | null>(null)
  const [bossBrief,   setBossBrief]   = useState<BossBrief | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatOpen,    setChatOpen]    = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)

  // Pre-fill industry from client
  useEffect(() => {
    if (selectedClient?.brand_identity?.industry && !industry) {
      setIndustry(selectedClient.brand_identity.industry)
    }
  }, [selectedClient, industry])

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
        setCampaignDoc((s.outputs as { campaign?: CampaignDocument }).campaign ?? null)
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

  // ── Simulate step progression while waiting for API ──────────────────────────
  function startStepSimulation(apiPromise: Promise<unknown>) {
    currentStepRef.current = 0
    setLoadingSteps(LOADING_STEPS_INITIAL.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))

    let done = false
    apiPromise.finally(() => { done = true })

    function advanceStep() {
      if (done) return
      const idx = currentStepRef.current
      if (idx >= LOADING_STEPS_INITIAL.length - 1) return

      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === idx)     return { ...s, status: 'complete', insight: LOADING_INSIGHTS[idx] }
        if (i === idx + 1) return { ...s, status: 'active' }
        return s
      }))
      currentStepRef.current = idx + 1
      stepTimerRef.current = setTimeout(advanceStep, STEP_DURATIONS[idx + 1] * 1000)
    }

    stepTimerRef.current = setTimeout(advanceStep, STEP_DURATIONS[0] * 1000)
  }

  // ── Run Campaign ─────────────────────────────────────────────────────────────
  async function handleRun() {
    if (!brief.trim()) return
    setError(null)

    const name = `${selectedClient?.name ?? 'Campaign'} — Igniter`

    setPageState('loading')

    try {
      // Create session
      const sessRes = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:       'campaign',
          client_id:  clientId || null,
          created_by: user?.id ?? null,
          name,
          brief,
          inputs:     { clientId, industry, audience, platforms, boldness, constraint },
        }),
      })
      const sessData = await sessRes.json() as { session?: { id: string } }
      const sid = sessData.session?.id ?? null
      if (sid) setSessionId(sid)

      // Signal report
      const effectiveIndustry = industry || selectedClient?.brand_identity?.industry || 'general'
      const sigRes = await fetch(`/api/studio/signal-report/${encodeURIComponent(effectiveIndustry)}`)
      const signalReport = sigRes.ok ? await sigRes.json() : null

      // Start the main API call + simulate progress
      const apiPromise = fetch('/api/studio/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    clientId || null,
          client_name:  selectedClient?.name,
          industry:     effectiveIndustry,
          audience:     audience || selectedClient?.brand_identity?.target_audience,
          platforms,
          boldness,
          constraint,
          brief,
          brand_voice:  selectedClient?.brand_identity?.tone_of_voice,
          signal_report: signalReport,
          session_id:   sid,
        }),
      })

      startStepSimulation(apiPromise)

      const apiRes = await apiPromise
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)

      // Complete all steps
      setLoadingSteps(LOADING_STEPS_INITIAL.map((s, i) => ({
        ...s,
        status: 'complete',
        insight: LOADING_INSIGHTS[i],
      })))

      const data = await apiRes.json() as { campaign?: CampaignDocument; error?: string; boss_brief?: BossBrief }
      if (!apiRes.ok) throw new Error(data.error ?? 'Campaign generation failed')

      const doc: CampaignDocument = data.campaign ?? {
        concepts:          [],
        cultural_tensions: [],
        inverted_rules:    [],
        creative_domains:  [],
      }
      setCampaignDoc(doc)

      const bb = data.boss_brief ?? null
      setBossBrief(bb)

      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { campaign: doc }, boss_brief: bb }),
        }).catch(() => {})
      }

      setPageState('document')
    } catch (e) {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
      setError(e instanceof Error ? e.message : 'Campaign generation failed.')
      setPageState('brief')
    }
  }

  function handleNewSession() {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    setPageState('warning')
    setSessionId(null)
    setCampaignDoc(null)
    setBossBrief(null)
    setChatHistory([])
    setChatOpen(false)
    setError(null)
    setBrief('')
  }

  const progressPercent = Math.round(
    (loadingSteps.filter(s => s.status === 'complete').length / LOADING_STEPS_INITIAL.length) * 100
  )

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
            <Flame className="w-4 h-4 text-novax-accent" />
            Campaign Igniter
          </h1>
          <p className="text-xs text-slate-500">Cultural tensions · Constraint inversion · Cross-domain thinking · Execution briefs</p>
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

      {/* ── WARNING state ── */}
      {pageState === 'warning' && (
        <div className="bg-novax-light border border-novax-border rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-novax flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-novax mb-1">This one takes 3-4 minutes</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                We are doing real creative work — cultural analysis, constraint mapping, cross-domain thinking, and execution briefs for every concept. Worth the wait.
              </p>
              <button
                onClick={() => setPageState('brief')}
                className="flex items-center gap-2 px-5 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Flame className="w-4 h-4" />
                Got it — show brief
              </button>
            </div>
          </div>
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
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Industry</label>
              <input
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Beauty, Technology, Food & Beverage, Fitness..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
              />
            </div>

            {/* Target audience */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Audience</label>
              <textarea
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="Who is this campaign for? Age, mindset, behavior, what they care about..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platforms</label>
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

            {/* Boldness */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">How bold are we going?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BOLDNESS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBoldness(opt.value as typeof boldness)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                      boldness === opt.value ? 'border-novax bg-novax-light' : 'border-slate-200 bg-white hover:border-novax-border',
                    )}
                  >
                    <span className={cn('text-xs font-semibold mb-0.5', boldness === opt.value ? 'text-novax' : 'text-slate-800')}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Constraint */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Any constraint to design around?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CONSTRAINT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConstraint(opt.value as typeof constraint)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                      constraint === opt.value ? 'border-novax bg-novax-light' : 'border-slate-200 bg-white hover:border-novax-border',
                    )}
                  >
                    <span className={cn('text-xs font-semibold mb-0.5', constraint === opt.value ? 'text-novax' : 'text-slate-800')}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">What is this campaign about?</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Describe the campaign objective, the product or service, and what success looks like..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={!brief.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Flame className="w-4 h-4" />
            Run Campaign Igniter
          </button>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <div className="space-y-6">
          <StudioLoading
            steps={loadingSteps}
            sessionName={`${selectedClient?.name ?? 'Campaign'} — Igniter`}
            tool="campaign"
            elapsedSeconds={elapsedSeconds}
            totalSteps={LOADING_STEPS_INITIAL.length}
            completedSteps={loadingSteps.filter(s => s.status === 'complete').length}
          />
          {/* Progress bar */}
          <div className="max-w-sm mx-auto">
            <div className="bg-slate-100 rounded-full h-1.5">
              <div
                className="h-full rounded-full bg-novax transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 text-right mt-1">{progressPercent}%</p>
          </div>
        </div>
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && campaignDoc && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <StudioDocument
              tool="campaign"
              clientName={selectedClient?.name ?? ''}
              clientColor={selectedClient?.color ?? '#1B3D38'}
              platforms={platforms}
              content={campaignDoc}
              bossBrief={bossBrief}
              language="english"
              onExportTxt={() => {
                const lines = [
                  `CAMPAIGN IGNITER — ${selectedClient?.name ?? 'Client'}`,
                  `Brief: ${brief}`,
                  `Boldness: ${boldness} | Constraint: ${constraint}`,
                  '',
                  `${campaignDoc.concepts?.length ?? 0} concepts generated.`,
                ]
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `novax-campaign-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url)
              }}
              onExportPdf={() => window.print()}
              onChatOpen={() => setChatOpen(true)}
              onEditApplied={(target, newContent) => {
                if (!campaignDoc) return
                const [, idxStr, field] = target.split('_')
                const idx = parseInt(idxStr, 10)
                if (!isNaN(idx) && campaignDoc.concepts?.[idx]) {
                  const updated = { ...campaignDoc }
                  updated.concepts = [...updated.concepts]
                  updated.concepts[idx] = { ...updated.concepts[idx], [field]: newContent }
                  setCampaignDoc(updated)
                }
              }}
            />
          </div>

          {chatOpen && sessionId && (
            <>
              <div className="hidden lg:block w-[380px] shrink-0">
                <div className="sticky top-4">
                  <StudioChatbot
                    sessionId={sessionId}
                    sessionContext={{ tool: 'campaign', document: campaignDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => {
                      const parts = edit.target.split('_')
                      const idx   = parseInt(parts[1], 10)
                      const field = parts[2]
                      if (!isNaN(idx) && campaignDoc.concepts?.[idx]) {
                        const updated = { ...campaignDoc }
                        updated.concepts = [...updated.concepts]
                        updated.concepts[idx] = { ...updated.concepts[idx], [field]: edit.new_content }
                        setCampaignDoc(updated)
                      }
                    }}
                  />
                </div>
              </div>
              <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
                <div className="bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '70vh' }}>
                  <StudioChatbot
                    sessionId={sessionId}
                    sessionContext={{ tool: 'campaign', document: campaignDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => {
                      const parts = edit.target.split('_')
                      const idx   = parseInt(parts[1], 10)
                      const field = parts[2]
                      if (!isNaN(idx) && campaignDoc.concepts?.[idx]) {
                        const updated = { ...campaignDoc }
                        updated.concepts = [...updated.concepts]
                        updated.concepts[idx] = { ...updated.concepts[idx], [field]: edit.new_content }
                        setCampaignDoc(updated)
                      }
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
              <Flame className="w-4 h-4" />
              Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
