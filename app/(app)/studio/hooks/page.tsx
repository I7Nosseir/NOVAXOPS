'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Wand2, ArrowLeft, Loader2, CheckCircle, PlusCircle,
  AlertTriangle, RefreshCw, Star, Copy,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import { StudioSaveActions } from '@/components/studio/studio-save-actions'
import { StudioGuidancePanel } from '@/components/studio/studio-guidance-panel'
import { LumaraPrefillButton, LUMARA_BRIEFS } from '@/components/studio/lumara-prefill-button'
import type { ClientIntelligenceSummary } from '@/lib/client-intelligence'
import type {
  HookDocument,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'
import type { GeneratedHook } from '@/app/api/studio/hooks/generate/route'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const GOALS     = ['Engagement', 'Virality', 'Authority', 'Leads', 'Sales', 'Community']

const BOLDNESS_OPTIONS = [
  {
    value: 'familiar',
    label: 'Familiar',
    description: 'Safe for any audience',
    prefix: '',
  },
  {
    value: 'unexpected',
    label: 'Unexpected',
    description: 'Push the boundary',
    prefix: 'Push boundaries. Challenge conventional thinking. ',
  },
  {
    value: 'edge',
    label: 'Edge',
    description: 'Make them uncomfortable',
    prefix: 'Be provocative. Include hooks that challenge the audience\'s beliefs. ',
  },
]

type PageState = 'brief' | 'loading' | 'document'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function HookLabPage() {
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
  const [audience,  setAudience]  = useState<'B2C' | 'B2B'>('B2C')
  const [goal,      setGoal]      = useState('Engagement')
  const [language,  setLanguage]  = useState<'english' | 'arabic'>('english')
  const [dialect,   setDialect]   = useState<'egyptian' | 'saudi'>('egyptian')
  const [brief,     setBrief]     = useState(params?.get('brief') ?? '')
  const [boldness,  setBoldness]  = useState<'familiar' | 'unexpected' | 'edge'>('familiar')

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>([
    { label: 'Divergent pass — 20 hooks, no filter', status: 'pending' },
    { label: '3C scoring',                           status: 'pending' },
    { label: 'SCAMPER refinement on weak hooks',     status: 'pending' },
    { label: 'Ranking and selecting',                status: 'pending' },
  ])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Sessions list
  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Document
  const [hookDoc,             setHookDoc]             = useState<HookDocument | null>(null)
  const [bossBrief,           setBossBrief]           = useState<BossBrief | null>(null)
  const [chatHistory,         setChatHistory]         = useState<ChatMessage[]>([])
  const [intelligenceSummary, setIntelligenceSummary] = useState<ClientIntelligenceSummary | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  // ── Fetch session history ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch(`/api/studio/session?tool=hooks&created_by=${user?.id ?? ''}&limit=10`)
        const data = await res.json() as { sessions: StudioSession[] }
        setSessions(data.sessions ?? [])
      } catch { /* silent */ } finally {
        setSessionsLoading(false)
      }
    }
    loadSessions()
  }, [user?.id])

  // ── Resume from session_id param ────────────────────────────────────────────
  useEffect(() => {
    const sid = params?.get('session_id')
    if (!sid) return
    fetch(`/api/studio/session/${sid}`)
      .then(r => r.json())
      .then((data: { session?: StudioSession }) => {
        const s = data.session
        if (!s || s.status !== 'complete') return
        setSessionId(sid)
        setHookDoc((s.outputs as { hooks?: HookDocument }).hooks ?? null)
        setBossBrief(s.boss_brief ?? null)
        setChatHistory(s.chat_history ?? [])
        setPageState('document')
      })
      .catch(() => {})
  }, [params])

  // ── Intelligence summary (for Based On panel) ──────────────────────────────
  useEffect(() => {
    if (pageState !== 'document' || !clientId) return
    fetch(`/api/clients/${clientId}/intelligence-summary`)
      .then(r => r.json())
      .then((data: ClientIntelligenceSummary) => setIntelligenceSummary(data))
      .catch(() => {})
  }, [pageState, clientId])

  // ── Schedule handler — opens Publishing with caption pre-filled ─────────────
  function handleSchedule(caption: string) {
    const platform = platforms[0] ?? 'instagram'
    const platformKey = platform.toLowerCase().replace(/\s*\(.*\)/, '').replace(/\s+/g, '_')
    const q = new URLSearchParams({ caption, client: clientId, platform: platformKey })
    router.push(`/publishing?${q.toString()}`)
  }

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== 'loading') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  // ── Session click: load a previous session's document ──────────────────────
  function handleSessionClick(session: StudioSession) {
    if (session.status === 'complete' && session.outputs) {
      const doc = (session.outputs as { hooks?: HookDocument }).hooks ?? null
      if (doc) {
        setHookDoc(doc)
        setBossBrief(session.boss_brief ?? null)
        setChatHistory(session.chat_history ?? [])
        setSessionId(session.id)
        setPageState('document')
      }
    }
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!brief.trim()) return
    setError(null)

    const boldnessOption = BOLDNESS_OPTIONS.find(b => b.value === boldness)
    const briefWithBoldness = (boldnessOption?.prefix ?? '') + brief.trim()

    // Reset loading steps
    setLoadingSteps([
      { label: 'Divergent pass — 20 hooks, no filter', status: 'active' },
      { label: '3C scoring',                           status: 'pending' },
      { label: 'SCAMPER refinement on weak hooks',     status: 'pending' },
      { label: 'Ranking and selecting',                status: 'pending' },
    ])
    setPageState('loading')

    try {
      // Create session
      const sessRes = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:       'hooks',
          client_id:  clientId || null,
          created_by: user?.id ?? null,
          name:       `${selectedClient?.name ?? 'Hooks'} — ${platforms[0]}`,
          brief,
          inputs:     { clientId, platforms, audience, goal, language, dialect, boldness },
        }),
      })
      const sessData = await sessRes.json() as { session?: { id: string } }
      const sid = sessData.session?.id ?? null
      if (sid) setSessionId(sid)

      // Step 1+2: Generate hooks (single call, two-pass happens in the API)
      const hookRes = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:       briefWithBoldness,
          platform:    platforms[0],
          audience,
          goal,
          brand_voice: selectedClient?.brand_identity?.tone_of_voice,
          language,
          dialect,
          client_id:   clientId || undefined,
        }),
      })
      const hookData = await hookRes.json() as { hooks?: GeneratedHook[]; error?: string }
      if (!hookRes.ok) throw new Error(hookData.error ?? 'Hook generation failed')
      const hooks = hookData.hooks ?? []

      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === 0) return { ...s, status: 'complete', insight: '20 hooks generated — no self-censoring' }
        if (i === 1) return { ...s, status: 'complete', insight: 'Scoring complete' }
        if (i === 2) return { ...s, status: 'active' }
        return s
      }))

      // Step 3: SCAMPER (visual — completed instantly, the API handles it)
      await new Promise(r => setTimeout(r, 400))
      const weakCount = hooks.filter(h => (h.clarity_score + h.context_score + h.curiosity_score) < 15).length
      setLoadingSteps(prev => prev.map((s, i) => {
        if (i === 2) return { ...s, status: 'complete', insight: `${weakCount} hooks refined via SCAMPER` }
        if (i === 3) return { ...s, status: 'active' }
        return s
      }))

      // Step 4: rank
      await new Promise(r => setTimeout(r, 300))
      const tierCounts = hooks.reduce<Record<string, number>>((acc, h) => {
        acc[h.virality_tier] = (acc[h.virality_tier] ?? 0) + 1; return acc
      }, {})
      const bestHook = [...hooks].sort((a, b) => b.total_score - a.total_score)[0]

      setLoadingSteps(prev => prev.map((s, i) =>
        i === 3 ? { ...s, status: 'complete', insight: `S-tier: ${tierCounts['S'] ?? 0}, A-tier: ${tierCounts['A'] ?? 0}` } : s
      ))

      // Assemble HookDocument
      const doc: HookDocument = {
        hooks: hooks.map(h => ({
          hook_text:       h.hook_text,
          hook_type:       h.hook_type,
          virality_tier:   h.virality_tier as 'S' | 'A' | 'B' | 'C',
          clarity_score:   h.clarity_score,
          context_score:   h.context_score,
          curiosity_score: h.curiosity_score,
          total_score:     h.total_score,
          format_rec:      h.format_rec,
          format_note:     h.format_note,
          headline:        h.headline,
          body:            h.body,
          cta:             h.cta,
        })),
        tier_summary: {
          S: tierCounts['S'] ?? 0,
          A: tierCounts['A'] ?? 0,
          B: tierCounts['B'] ?? 0,
          C: tierCounts['C'] ?? 0,
        },
        best_hook: bestHook ? {
          hook_text:      bestHook.hook_text,
          hook_type:      bestHook.hook_type,
          virality_tier:  bestHook.virality_tier as 'S' | 'A' | 'B' | 'C',
          clarity_score:  bestHook.clarity_score,
          context_score:  bestHook.context_score,
          curiosity_score: bestHook.curiosity_score,
          total_score:    bestHook.total_score,
        } : null,
        platform:  platforms[0],
        language,
        boldness,
      }
      setHookDoc(doc)

      // Boss Brief
      let bb: BossBrief | null = null
      let bbAttempts = 0
      while (bbAttempts < 2) {
        try {
          const bbRes = await fetch('/api/studio/brief-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brief, mode: 'boss_brief', hook: bestHook?.hook_text, client: selectedClient ? { name: selectedClient.name } : null }),
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

      // Save session + prepend to session list
      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { hooks: doc }, boss_brief: bb }),
        })
          .then(r => { if (!r.ok) toast.error('Session could not be saved. Copy your output now.') })
          .catch(() => toast.error('Session could not be saved. Copy your output now.'))
        const newSession: StudioSession = {
          id: sid,
          name: `${selectedClient?.name ?? 'Hooks'} — ${platforms[0]}`,
          tool: 'hooks',
          status: 'complete',
          outputs: { hooks: doc },
          boss_brief: bb,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          client_id: clientId || null,
          created_by: user?.id ?? null,
          brief,
          inputs: { clientId, platforms, audience, goal, language, boldness },
          chat_history: [],
          edit_history: [],
          structured_answers: {},
          executive_summary: null,
          signal_report_used: null,
          metricool_snapshot: null,
          performance: null,
          performance_verdict: null,
        }
        setSessions(prev => [newSession, ...prev])
      }

      setPageState('document')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Try again.')
      setPageState('brief')
    }
  }

  function handleNewSession() {
    setPageState('brief')
    setSessionId(null)
    setHookDoc(null)
    setBossBrief(null)
    setChatHistory([])
    setError(null)
    setBrief('')
  }

  return (
    <div className="max-w-5xl">
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
          <p className="text-xs text-slate-500">Two-pass generation — divergent then convergent</p>
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
          <StudioGuidancePanel
            title="How Hook Lab works"
            description="Hook Lab uses a two-pass approach: first it diverges (generates 20 raw hooks with no filter) then converges (scores each with the 3C framework and applies SCAMPER mutations to find the most differentiated top 3)."
            items={[
              { term: '3C Scoring', definition: 'Rates every hook on Clarity (does it land instantly?), Curiosity (does it create an open loop?), and Conversion (does it push action?). Each axis is 1–10.' },
              { term: 'SCAMPER', definition: 'A creative mutation filter: Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse. Applied after scoring to push the top hooks further.' },
              { term: 'Boldness', definition: 'Familiar = safe, relatable openings. Unexpected = pattern interrupt, counter-intuitive. Edge = provocative, polarising.' },
            ]}
            tips={[
              { label: 'Best brief', tip: 'Describe the post topic + one emotional tension in your audience — not just a product description.' },
              { label: 'Tone match', tip: 'Set boldness to match your client\'s risk tolerance before generating.' },
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client (optional)</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                <option value="">No client (global)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platform</label>
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

            {/* Audience + Goal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audience</label>
                <div className="flex gap-1.5">
                  {(['B2C', 'B2B'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={cn(
                        'flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                        audience === a ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Goal</label>
                <select
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
                >
                  {GOALS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hook Language</label>
              <div className="flex gap-2 mb-2">
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
                <div className="flex gap-2">
                  {([
                    { value: 'egyptian', label: 'Egyptian — مصري' },
                    { value: 'saudi',    label: 'Saudi — سعودي' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDialect(opt.value)}
                      className={cn(
                        'flex-1 py-1.5 text-[11px] rounded-lg font-medium border transition-all',
                        dialect === opt.value
                          ? 'bg-novax-light text-novax border-novax-border'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Boldness — inline question */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">How bold should these hooks be?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BOLDNESS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBoldness(opt.value as 'familiar' | 'unexpected' | 'edge')}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                      boldness === opt.value
                        ? 'border-novax bg-novax-light'
                        : 'border-slate-200 bg-white hover:border-novax-border',
                    )}
                  >
                    <span className={cn(
                      'text-xs font-semibold mb-0.5',
                      boldness === opt.value ? 'text-novax' : 'text-slate-800',
                    )}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-slate-500">{opt.description}</span>
                    {boldness === opt.value && (
                      <CheckCircle className="w-3.5 h-3.5 text-novax mt-1.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Brief */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Content Brief</label>
                <LumaraPrefillButton
                  onPrefill={(id, b) => { setClientId(id); setBrief(b) }}
                  brief={LUMARA_BRIEFS.hooks}
                />
              </div>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Describe the content in 2-3 sentences. What is the topic, the angle, the key message?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!brief.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Generate Hooks
          </button>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={`${selectedClient?.name ?? 'Hooks'} — ${platforms[0]}`}
          tool="hooks"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && hookDoc && (
        <div className="space-y-3">
          <StudioDocument
            tool="hooks"
            clientName={selectedClient?.name ?? ''}
            clientColor={selectedClient?.color ?? '#1B3D38'}
            clientId={selectedClient?.id}
            platforms={platforms}
            content={hookDoc}
            bossBrief={bossBrief}
            language={language}
            onExportPdf={() => window.print()}
            onSchedule={handleSchedule}
            intelligenceSummary={intelligenceSummary}
            onEditApplied={(target, newContent) => {
              if (!hookDoc) return
              const idx = parseInt(target.replace('hook_', ''), 10)
              if (!isNaN(idx)) {
                const updated = { ...hookDoc, hooks: hookDoc.hooks.map((h, i) => i === idx ? { ...h, hook_text: newContent } : h) }
                setHookDoc(updated)
              }
            }}
          />
          <StudioSaveActions
            client={selectedClient}
            contentSummary={hookDoc.hooks?.slice(0, 3).map(h => h.hook_text).join('\n') ?? ''}
            documentTitle={`${selectedClient?.name ?? 'Hooks'} — Hook Lab Top 3`}
            taskTitle={hookDoc.hooks?.[0]?.hook_text ?? 'Hook Lab Output'}
            contextCategory="Campaign Feedback"
          />
        </div>
      )}

      {/* Studio chat — self-contained overlay */}
      {pageState === 'document' && sessionId && (
        <StudioChatbot
          key={sessionId}
          sessionId={sessionId}
          sessionContext={{ tool: 'hooks', document: hookDoc, client: selectedClient }}
          initialHistory={chatHistory}
          onEditDetected={(edit: EditPayload) => {
            const idx = parseInt(edit.target.replace('hook_', ''), 10)
            if (!isNaN(idx) && hookDoc) {
              setHookDoc({ ...hookDoc, hooks: hookDoc.hooks.map((h, i) => i === idx ? { ...h, hook_text: edit.new_content } : h) })
            }
          }}
        />
      )}
    </div>
  )
}
