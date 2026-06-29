'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Brain, ArrowLeft,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportStrategyPdf } from '@/lib/strategy-export'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import { StudioGuidancePanel } from '@/components/studio/studio-guidance-panel'
import { LumaraPrefillButton, LUMARA_BRIEFS } from '@/components/studio/lumara-prefill-button'
import type {
  StrategyDocument,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Snapchat', 'X (Twitter)', 'Facebook']
const QUARTERS  = ['Q1', 'Q2', 'Q3', 'Q4'] as const
const YEARS     = [2025, 2026, 2027]

const LOADING_STEPS: LoadingStep[] = [
  { label: 'Loading market signals and cultural context',    status: 'pending' },
  { label: 'Analysing brand positioning and competitive gaps', status: 'pending' },
  { label: 'Excavating audience insight',                    status: 'pending' },
  { label: 'Mapping content pillars',                        status: 'pending' },
  { label: 'Building quarterly strategy arc',                status: 'pending' },
  { label: 'Writing monthly tactics with cultural anchors',  status: 'pending' },
  { label: 'Defining platform roles and format strategy',    status: 'pending' },
  { label: 'Reflection agent reviewing for depth and specificity', status: 'pending' },
  { label: 'Sharpening and finalising strategy document',    status: 'pending' },
]

type PageState = 'brief' | 'loading' | 'document'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const params      = useSearchParams()
  const { clients } = useClients()
  const { user }    = useAuth()

  // State machine
  const [pageState, setPageState] = useState<PageState>('brief')
  const [error,     setError]     = useState<string | null>(null)

  // Form
  const [clientId,         setClientId]         = useState(params?.get('client') ?? '')
  const [platforms,        setPlatforms]        = useState<string[]>(['Instagram', 'TikTok'])
  const [quarter,          setQuarter]          = useState<typeof QUARTERS[number]>('Q2')
  const [year,             setYear]             = useState(new Date().getFullYear())
  const [brief,            setBrief]            = useState('')
  const [campaignTheme,    setCampaignTheme]    = useState('')
  const [culturalMoments,  setCulturalMoments]  = useState('')
  const [brandPersona,     setBrandPersona]     = useState('')
  const [tenantNotes,      setTenantNotes]      = useState('')

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(LOADING_STEPS)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Sessions list
  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Session + document
  const [sessionId,     setSessionId]     = useState<string | null>(null)
  const [strategyDoc,   setStrategyDoc]   = useState<StrategyDocument | null>(null)
  const [bossBrief,     setBossBrief]     = useState<BossBrief | null>(null)
  const [chatHistory,   setChatHistory]   = useState<ChatMessage[]>([])
  const [pdfExporting,  setPdfExporting]  = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)

  // ── Fetch session history ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadSessions() {
      try {
        const res  = await fetch(`/api/studio/session?tool=strategy&created_by=${user?.id ?? ''}&limit=10`)
        const data = await res.json() as { sessions: StudioSession[] }
        setSessions(data.sessions ?? [])
      } catch { /* silent */ } finally {
        setSessionsLoading(false)
      }
    }
    loadSessions()
  }, [user?.id])

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

  // ── Session click ───────────────────────────────────────────────────────────
  function handleSessionClick(session: StudioSession) {
    if (session.status === 'complete' && session.outputs) {
      const doc = (session.outputs as { strategy?: StrategyDocument }).strategy ?? null
      if (doc) {
        setStrategyDoc(doc)
        setBossBrief(session.boss_brief ?? null)
        setChatHistory(session.chat_history ?? [])
        setSessionId(session.id)
        setPageState('document')
      }
    }
  }

  // ── Simulate step progression during the API call ───────────────────────────
  function startStepSimulation(apiPromise: Promise<unknown>) {
    const STEP_DELAYS = [6, 14, 24, 36, 50, 65, 80, 105, 130]
    setLoadingSteps(LOADING_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    let done = false
    apiPromise.finally(() => { done = true })

    STEP_DELAYS.forEach((delay, idx) => {
      setTimeout(() => {
        if (done) return
        setLoadingSteps(prev => prev.map((s, i) => {
          if (i === idx)     return { ...s, status: 'complete' }
          if (i === idx + 1) return { ...s, status: 'active' }
          return s
        }))
      }, delay * 1000)
    })
  }

  // ── Run ─────────────────────────────────────────────────────────────────────
  async function handleRun() {
    if (!brief.trim()) return
    setError(null)

    const name = `${selectedClient?.name ?? 'Strategy'} — ${quarter} ${year}`

    // Create session
    const sessRes = await fetch('/api/studio/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool:       'strategy',
        client_id:  clientId || null,
        created_by: user?.id ?? null,
        name,
        brief,
        inputs: { clientId, platforms, quarter, year, campaignTheme, culturalMoments, brandPersona, tenantNotes },
      }),
    })
    const sessData = await sessRes.json() as { session?: { id: string } }
    const sid = sessData.session?.id ?? null
    if (sid) setSessionId(sid)

    setPageState('loading')

    try {
      const industry = selectedClient?.brand_identity?.industry ?? 'general'
      const sigRes   = await fetch(`/api/studio/signal-report/${encodeURIComponent(industry)}`)
      const signal   = sigRes.ok ? await sigRes.json() : null

      const apiPromise = fetch('/api/studio/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:        clientId || null,
          user_id:          user?.id,
          client_name:      selectedClient?.name ?? 'Client',
          industry,
          brand_voice:      selectedClient?.brand_identity?.tone_of_voice,
          key_messages:     selectedClient?.brand_identity?.key_messages,
          competitors:      selectedClient?.competitor_context,
          platforms,
          brief,
          quarter,
          year,
          campaign_theme:   campaignTheme || undefined,
          cultural_moments: culturalMoments || undefined,
          brand_persona:    brandPersona || undefined,
          tenant_notes:     tenantNotes || undefined,
          signal_report:    signal,
        }),
      })

      startStepSimulation(apiPromise)

      const apiRes = await apiPromise
      setLoadingSteps(LOADING_STEPS.map(s => ({ ...s, status: 'complete' as const })))

      const data = await apiRes.json() as { strategy?: StrategyDocument; error?: string }
      if (!apiRes.ok) throw new Error(data.error ?? 'Strategy generation failed')

      const doc = data.strategy ?? { executive_summary: '', platforms, brief, quarter, year }
      setStrategyDoc(doc)

      // Boss Brief
      let bb: BossBrief | null = null
      let bbAttempts = 0
      while (bbAttempts < 2) {
        try {
          const bbRes = await fetch('/api/studio/brief-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brief, mode: 'boss_brief',
              strategy: { campaign_line: doc.campaign_line, quarter_role: doc.quarter_role },
              client:   selectedClient ? { name: selectedClient.name } : null,
            }),
          })
          if (!bbRes.ok) throw new Error('Boss Brief API error')
          const bbData = await bbRes.json() as { boss_brief?: BossBrief }
          bb = bbData.boss_brief ?? null
          break
        } catch {
          bbAttempts++
        }
      }
      if (!bb) toast.error('Executive summary unavailable — generation failed.')
      setBossBrief(bb)

      // Save session
      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { strategy: doc }, boss_brief: bb }),
        })
          .then(r => { if (!r.ok) toast.error('Session could not be saved. Copy your output now.') })
          .catch(() => toast.error('Session could not be saved. Copy your output now.'))
        setSessions(prev => [{
          id: sid, name, tool: 'strategy', status: 'complete',
          outputs: { strategy: doc }, boss_brief: bb,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          client_id: clientId || null, created_by: user?.id ?? null,
          brief, inputs: { clientId, platforms, quarter, year },
          chat_history: [], edit_history: [], structured_answers: {},
          executive_summary: doc.positioning_statement ?? null,
          signal_report_used: null, metricool_snapshot: null, performance: null, performance_verdict: null,
        } as StudioSession, ...prev])
      }

      setPageState('document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Strategy generation failed.')
      setPageState('brief')
    }
  }

  function handleNewSession() {
    setPageState('brief'); setSessionId(null); setStrategyDoc(null); setBossBrief(null)
    setChatHistory([]); setError(null); setBrief('')
    setCampaignTheme(''); setCulturalMoments(''); setBrandPersona(''); setTenantNotes('')
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
            <Brain className="w-4 h-4 text-novax-accent" />
            Strategy Command Center
          </h1>
          <p className="text-xs text-slate-500">Quarterly social media strategy — Esplanade format</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button onClick={() => { setError(null); setPageState('brief') }} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold">
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      )}

      {/* ── BRIEF state ── */}
      {pageState === 'brief' && (
        <div className="space-y-5">
          <StudioGuidancePanel
            title="How Strategy Command Center works"
            description="Generates a full quarterly social media strategy in the Esplanade format — a structured 17-phase framework covering brand positioning, platform roles, content pillars, monthly arc, tactical calendar, and format mix."
            items={[
              { term: 'Esplanade Format', definition: 'A NOVAX-proprietary strategy framework that covers audience posture, cultural moment, brand arc, platform strategy, content pillars, and monthly cadence in a single coherent document.' },
              { term: 'Content Pillars', definition: 'The 3–5 recurring themes that anchor all content — each with its own tone, format affinity, and audience job-to-be-done.' },
              { term: 'Platform Role', definition: 'How each platform serves a different function in the funnel — e.g. Instagram = top-of-funnel awareness, LinkedIn = authority building.' },
              { term: 'Monthly Arc', definition: 'The narrative rhythm across a quarter: what the brand "says" in Month 1 vs 2 vs 3, and how content evolves as the audience warms.' },
            ]}
            tips={[
              { label: 'Best brief', tip: 'Include a specific growth goal (e.g. "get 500 saves/week on Instagram") and one cultural moment or season you\'re building around.' },
              { label: 'Export', tip: 'Use the Export PDF button to download a professionally formatted PDF of the full strategy — ready to share with the client.' },
            ]}
          />
          {(sessions.length > 0 || sessionsLoading) && (
            <div className="mb-6">
              <StudioSessionList sessions={sessions} onSessionClick={handleSessionClick} onDeleteSession={id => setSessions(prev => prev.filter(s => s.id !== id))} isLoading={sessionsLoading} />
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedClient && (
                <p className="text-xs text-slate-400 mt-1">{selectedClient.brand_identity?.industry} · {selectedClient.brand_identity?.tone_of_voice}</p>
              )}
            </div>

            {/* Quarter + Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quarter</label>
                <div className="flex gap-1.5">
                  {QUARTERS.map(q => (
                    <button key={q} onClick={() => setQuarter(q)}
                      className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                        quarter === q ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Year</label>
                <div className="flex gap-1.5">
                  {YEARS.map(y => (
                    <button key={y} onClick={() => setYear(y)}
                      className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                        year === y ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platforms</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const sel = platforms.includes(p)
                  return (
                    <button key={p} onClick={() => setPlatforms(sel ? platforms.filter(x => x !== p) : [...platforms, p])}
                      className={cn('px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                        sel ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Strategic Brief */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Strategic Brief</label>
                <LumaraPrefillButton
                  onPrefill={(id, b) => { setClientId(id); setBrief(b) }}
                  brief={LUMARA_BRIEFS.strategy}
                />
              </div>
              <textarea value={brief} onChange={e => setBrief(e.target.value)}
                placeholder="What is the strategic challenge and goal for this quarter? What does the brand need to own, change, or achieve? What makes this quarter different?"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none" />
            </div>

            {/* Campaign Theme (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Campaign Theme / Line
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(optional — AI will create one if blank)</span>
              </label>
              <input value={campaignTheme} onChange={e => setCampaignTheme(e.target.value)}
                placeholder={`e.g. "When the City Doesn't Sleep" · "Energy of the City"`}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400" />
            </div>

            {/* Cultural Moments */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Key Cultural Moments This Quarter
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(holidays, seasons, events)</span>
              </label>
              <input value={culturalMoments} onChange={e => setCulturalMoments(e.target.value)}
                placeholder="e.g. Ramadan starts March 1 · Saudi Founding Day Feb 22 · Eid Al-Fitr late March"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400" />
            </div>

            {/* Brand Persona Direction */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Brand Persona Direction
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(optional — adjectives or description)</span>
              </label>
              <input value={brandPersona} onChange={e => setBrandPersona(e.target.value)}
                placeholder="e.g. Bold · Nocturnal · Cinematic · Unapologetic — or describe the tone shift"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400" />
            </div>

            {/* Tenant / Partner Integration */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Partner / Tenant Integration Notes
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(optional)</span>
              </label>
              <input value={tenantNotes} onChange={e => setTenantNotes(e.target.value)}
                placeholder="e.g. Tenants appear as part of life, not ads · No prices or promotions in content"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400" />
            </div>
          </div>

          <button onClick={handleRun} disabled={!brief.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
            <Brain className="w-4 h-4" />
            Build {quarter} {year} Strategy
          </button>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={`${selectedClient?.name ?? 'Strategy'} — ${quarter} ${year}`}
          tool="strategy"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && strategyDoc && (
        <StudioDocument
          tool="strategy"
          clientName={selectedClient?.name ?? strategyDoc.client_name ?? ''}
          clientColor={selectedClient?.color ?? '#1B3D38'}
          platforms={platforms}
          content={strategyDoc}
          bossBrief={bossBrief}
          language="english"
          pdfExporting={pdfExporting}
          onExportPdf={async () => {
            if (!strategyDoc || pdfExporting) return
            setPdfExporting(true)
            try {
              await exportStrategyPdf(
                strategyDoc,
                selectedClient?.name ?? strategyDoc.client_name ?? 'Client',
                selectedClient?.color,
                platforms,
                bossBrief,
              )
              toast.success('Strategy PDF downloaded')
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'PDF export failed'
              console.error('[strategy-pdf] export failed', e)
              toast.error(`PDF export failed: ${msg}`)
            } finally {
              setPdfExporting(false)
            }
          }}
          onEditApplied={(target, newContent) => {
            if (!strategyDoc) return
            setStrategyDoc({ ...strategyDoc, [target]: newContent })
          }}
        />
      )}

      {/* Studio chat — self-contained overlay */}
      {pageState === 'document' && sessionId && (
        <StudioChatbot
          key={sessionId}
          sessionId={sessionId}
          sessionContext={{ tool: 'strategy', document: strategyDoc, client: selectedClient }}
          initialHistory={chatHistory}
          onEditDetected={(edit: EditPayload) => setStrategyDoc(prev => prev ? { ...prev, [edit.target]: edit.new_content } : prev)}
        />
      )}
    </div>
  )
}
