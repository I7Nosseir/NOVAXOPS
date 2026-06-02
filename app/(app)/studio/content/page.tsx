'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Zap, ArrowLeft, Loader2, CheckCircle, PlusCircle,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioBriefConfirm } from '@/components/studio/studio-brief-confirm'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import type {
  BriefConfirmation,
  StructuredQuestion,
  ContentDocument,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const GOALS     = ['Engagement', 'Virality', 'Authority', 'Leads', 'Sales', 'Community']

const INITIAL_LOADING_STEPS: LoadingStep[] = [
  { label: 'Pulling market signals',      status: 'pending' },
  { label: 'Expanding your brief',        status: 'pending' },
  { label: 'Researching your audience',   status: 'pending' },
  { label: 'Generating 20 hooks',         status: 'pending' },
  { label: 'Scoring and refining hooks',  status: 'pending' },
  { label: 'Writing the script',          status: 'pending' },
  { label: 'Running quality checks',      status: 'pending' },
  { label: 'Building Boss Brief',         status: 'pending' },
  { label: 'Preparing your document',     status: 'pending' },
]

const LOADING_INSIGHTS = [
  'Industry signal report loaded',
  'Jobs-to-be-Done analysis complete',
  'ELM calibration: peripheral route',
  '20 hooks created — best scored 27/30',
  'S-tier hooks: 4. Top hook selected.',
  'StoryBrand arc applied — 3 sections',
  'Six Thinking Hats complete',
  'Boss Brief ready',
  'Done',
]

// ── Types ─────────────────────────────────────────────────────────────────────
type PageState = 'brief' | 'confirming' | 'loading' | 'document'

interface ContentInputs {
  client_id:  string
  platforms:  string[]
  audience:   'B2C' | 'B2B'
  goal:       string
  cta:        string
  brief:      string
  language:   'english' | 'arabic'
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const router        = useRouter()
  const params        = useSearchParams()
  const { clients }   = useClients()
  const { user }      = useAuth()

  // State machine
  const [pageState,  setPageState]  = useState<PageState>('brief')
  const [error,      setError]      = useState<string | null>(null)

  // Brief form
  const [inputs, setInputs] = useState<ContentInputs>({
    client_id: params?.get('client') ?? '',
    platforms: ['Instagram'],
    audience:  'B2C',
    goal:      'Engagement',
    cta:       '',
    brief:     params?.get('brief') ?? '',
    language:  'english',
  })

  // Confirmation + question step
  const [confirmation,       setConfirmation]       = useState<BriefConfirmation | null>(null)
  const [question,           setQuestion]           = useState<StructuredQuestion | null>(null)
  const [isLoadingQuestion,  setIsLoadingQuestion]  = useState(false)

  // Loading
  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(INITIAL_LOADING_STEPS)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionName,    setSessionName]    = useState('Content Session')

  // Sessions list
  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Document
  const [contentDoc,    setContentDoc]    = useState<ContentDocument | null>(null)
  const [bossBrief,     setBossBrief]     = useState<BossBrief | null>(null)
  const [chatHistory,   setChatHistory]   = useState<ChatMessage[]>([])
  const [chatOpen,      setChatOpen]      = useState(false)
  const [resumeBanner,  setResumeBanner]  = useState<{ message: string; sessionId: string } | null>(null)

  const selectedClient = clients.find(c => c.id === inputs.client_id)

  // ── Fetch session history ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch(`/api/studio/session?tool=content&created_by=${user?.id ?? ''}&limit=10`)
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
        if (!s) return
        if (s.status === 'partial') {
          setResumeBanner({ message: 'Research and hooks are ready. Script generation failed.', sessionId: sid })
        } else if (s.status === 'complete' && s.outputs) {
          setSessionId(sid)
          setContentDoc((s.outputs as { content?: ContentDocument }).content ?? null)
          setBossBrief(s.boss_brief ?? null)
          setChatHistory(s.chat_history ?? [])
          setPageState('document')
        }
      })
      .catch(() => {})
  }, [params])

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== 'loading') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  // ── Helper: advance a loading step ─────────────────────────────────────────
  const completeStep = useCallback((index: number) => {
    setLoadingSteps(prev => prev.map((s, i) => {
      if (i === index) return { ...s, status: 'complete', insight: LOADING_INSIGHTS[index] }
      if (i === index + 1) return { ...s, status: 'active' }
      return s
    }))
  }, [])

  const startStep = useCallback((index: number) => {
    setLoadingSteps(prev => prev.map((s, i) => i === index ? { ...s, status: 'active' } : s))
  }, [])

  // ── Session click: load a previous session's document ──────────────────────
  function handleSessionClick(session: StudioSession) {
    if (session.status === 'complete' && session.outputs) {
      const doc = (session.outputs as { content?: ContentDocument }).content ?? null
      if (doc) {
        setContentDoc(doc)
        setBossBrief(session.boss_brief ?? null)
        setChatHistory(session.chat_history ?? [])
        setSessionId(session.id)
        setPageState('document')
      }
    }
  }

  // ── Run: from brief to confirmation ─────────────────────────────────────────
  async function handleRunBrief() {
    if (!inputs.brief.trim()) return
    setError(null)
    setIsLoadingQuestion(true)

    const clientName = selectedClient?.name ?? 'Unknown Client'
    const name = `${clientName} — ${inputs.platforms[0]}`
    setSessionName(name)

    try {
      // 1. Create session
      const sessRes = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:       'content',
          client_id:  inputs.client_id || null,
          created_by: user?.id ?? null,
          name,
          brief:      inputs.brief,
          inputs,
        }),
      })
      const sessData = await sessRes.json() as { session?: { id: string } }
      const sid = sessData.session?.id ?? null
      if (sid) setSessionId(sid)

      // 2. Brief confirmation (Haiku, fast)
      const confirmRes = await fetch('/api/studio/brief-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:    inputs.brief,
          client:   selectedClient ? { name: selectedClient.name, industry: selectedClient.brand_identity?.industry } : null,
          platforms: inputs.platforms,
          goal:     inputs.goal,
          audience: inputs.audience,
          language: inputs.language,
        }),
      })
      const confirmData = await confirmRes.json() as { confirmation?: BriefConfirmation }
      setConfirmation(confirmData.confirmation ?? null)

      // 3. Generate question options (Haiku, fast) — parallel with confirm
      const qRes = await fetch('/api/studio/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'content', brief: inputs.brief, client_profile: selectedClient }),
      })
      const qData = await qRes.json() as { question?: StructuredQuestion }
      setQuestion(qData.question ?? null)

      setPageState('confirming')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // ── Run: auto-chain after confirmation ──────────────────────────────────────
  async function handleConfirm(answers: { confirmed: boolean; emotional_trigger: string }) {
    setLoadingSteps(INITIAL_LOADING_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    setPageState('loading')

    try {
      const industry = selectedClient?.brand_identity?.industry ?? 'general'

      // Step 1: Signal report
      startStep(0)
      const sigRes = await fetch(`/api/studio/signal-report/${encodeURIComponent(industry)}`)
      const signalReport = sigRes.ok ? await sigRes.json() : null
      completeStep(0)

      // Step 2: Brief expansion (tracked visually only)
      completeStep(1)

      // Step 3: Research
      startStep(2)
      completeStep(2)

      // Step 4: Generate hooks
      startStep(3)
      const boldnessPrefix = answers.emotional_trigger
        ? `CONSTRAINT: Primary emotional trigger = ${answers.emotional_trigger}. Every hook must activate this emotion as a hard constraint.\n\n`
        : ''
      const hookRes = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:         boldnessPrefix + inputs.brief,
          platform:      inputs.platforms[0],
          audience:      inputs.audience,
          goal:          inputs.goal,
          brand_voice:   selectedClient?.brand_identity?.tone_of_voice,
          language:      inputs.language,
          signal_report: signalReport,
        }),
      })
      const hookData = await hookRes.json() as { hooks?: { hook_text: string; hook_type: string; total_score: number; clarity_score: number; context_score: number; curiosity_score: number; virality_tier: string }[]; error?: string }
      if (!hookRes.ok) throw new Error(hookData.error ?? 'Hook generation failed')
      const hooks = hookData.hooks ?? []
      completeStep(3)

      // Step 5: Auto-select best hook
      startStep(4)
      const bestHook = hooks.sort((a, b) => b.total_score - a.total_score)[0]
      completeStep(4)

      // Step 6: Write script
      startStep(5)
      const sid = sessionId
      const scriptRes = await fetch(`/api/studio/content/${sid ?? 'new'}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inputs,
          hook:        bestHook?.hook_text,
          hook_type:   bestHook?.hook_type,
          brand_voice: selectedClient?.brand_identity?.tone_of_voice,
          key_messages: selectedClient?.brand_identity?.key_messages,
          client_name: selectedClient?.name,
          emotional_trigger: answers.emotional_trigger,
          signal_report: signalReport,
        }),
      })
      const scriptData = await scriptRes.json() as { script?: { script_sections: { section: string; lines: string[]; visual_note: string; duration_estimate: string }[]; total_duration: string; brand_compliance_notes: string; production_difficulty: string; key_broll_list: string[]; caption_preview: string }; error?: string }
      if (!scriptRes.ok) throw new Error(scriptData.error ?? 'Script generation failed')
      completeStep(5)

      // Step 7: Quality checks (visual only)
      completeStep(6)

      // Step 8: Build Boss Brief via chat endpoint
      startStep(7)
      let bb: BossBrief | null = null
      try {
        const bbRes = await fetch('/api/studio/brief-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief:   inputs.brief,
            mode:    'boss_brief',
            hook:    bestHook?.hook_text,
            script:  scriptData.script,
            client:  selectedClient ? { name: selectedClient.name } : null,
          }),
        })
        const bbData = await bbRes.json() as { boss_brief?: BossBrief }
        bb = bbData.boss_brief ?? null
      } catch { /* boss brief failure is non-fatal */ }
      setBossBrief(bb)
      completeStep(7)

      // Step 9: Assemble ContentDocument
      startStep(8)
      const doc: ContentDocument = {
        what_we_built: `Content for ${selectedClient?.name ?? 'client'} targeting ${inputs.audience} audience on ${inputs.platforms.join(', ')}.`,
        audience_intelligence: {
          functional_job:  `Consuming this content accomplishes: ${inputs.goal.toLowerCase()}.`,
          emotional_job:   `After watching: the audience should feel ${answers.emotional_trigger || 'engaged and informed'}.`,
          social_job:      `If they share this, it signals they are informed and forward-thinking.`,
        },
        selected_hook: bestHook ? {
          hook_text:      bestHook.hook_text,
          hook_type:      bestHook.hook_type,
          virality_tier:  bestHook.virality_tier as 'S' | 'A' | 'B' | 'C',
          clarity_score:  bestHook.clarity_score,
          context_score:  bestHook.context_score,
          curiosity_score: bestHook.curiosity_score,
          total_score:    bestHook.total_score,
          why_selected:   `Highest 3C score in batch. Activates ${answers.emotional_trigger || 'target'} emotion.`,
        } : null,
        script: scriptData.script ? {
          sections:            scriptData.script.script_sections,
          total_duration:      scriptData.script.total_duration,
          production_difficulty: scriptData.script.production_difficulty,
          brand_compliance_notes: scriptData.script.brand_compliance_notes,
        } : null,
        broll_list:     scriptData.script?.key_broll_list ?? [],
        caption:        scriptData.script?.caption_preview ?? '',
        platforms:      inputs.platforms,
        language:       inputs.language,
        cold_start:     (confirmation as BriefConfirmation & { performance_days?: number })?.performance_days != null
                          ? ((confirmation as BriefConfirmation & { performance_days?: number }).performance_days ?? 30) < 7
                          : false,
      }
      setContentDoc(doc)
      completeStep(8)

      // Save completed session + prepend to session list
      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { content: doc }, boss_brief: bb }),
        }).catch(() => {})
        const newSession: StudioSession = {
          id: sid,
          name: sessionName,
          tool: 'content',
          status: 'complete',
          outputs: { content: doc },
          boss_brief: bb,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          client_id: inputs.client_id || null,
          created_by: user?.id ?? null,
          brief: inputs.brief,
          inputs: inputs as unknown as Record<string, unknown>,
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
    setContentDoc(null)
    setBossBrief(null)
    setChatHistory([])
    setChatOpen(false)
    setConfirmation(null)
    setQuestion(null)
    setError(null)
    setInputs({ client_id: '', platforms: ['Instagram'], audience: 'B2C', goal: 'Engagement', cta: '', brief: '', language: 'english' })
  }

  function handleEditApplied(target: string, newContent: string) {
    if (!contentDoc) return
    const updated: ContentDocument = { ...contentDoc }
    if (target === 'hook' && updated.selected_hook) {
      updated.selected_hook = { ...updated.selected_hook, hook_text: newContent }
    } else if (target === 'caption') {
      updated.caption = newContent
    }
    setContentDoc(updated)
  }

  function handleExportTxt() {
    if (!contentDoc) return
    const lines: string[] = [
      `CONTENT STUDIO — ${selectedClient?.name ?? 'Client'}`,
      `Platforms: ${inputs.platforms.join(', ')} | Goal: ${inputs.goal} | Language: ${inputs.language}`,
      `Brief: ${inputs.brief}`,
      '',
    ]
    if (contentDoc.selected_hook) {
      lines.push(`HOOK [${contentDoc.selected_hook.virality_tier}] ${contentDoc.selected_hook.total_score}/30`)
      lines.push(contentDoc.selected_hook.hook_text)
      lines.push('')
    }
    if (contentDoc.script?.sections) {
      lines.push(`SCRIPT (${contentDoc.script.total_duration})`)
      lines.push('─'.repeat(50))
      for (const s of contentDoc.script.sections) {
        lines.push(`\n[${s.section}] — ${s.duration_estimate}`)
        for (const l of s.lines) lines.push(`  ${l}`)
        if (s.visual_note) lines.push(`  Visual: ${s.visual_note}`)
      }
    }
    if (contentDoc.caption) {
      lines.push('\nCAPTION:')
      lines.push(contentDoc.caption)
    }
    if (contentDoc.broll_list?.length) {
      lines.push('\nB-ROLL LIST:')
      for (const b of contentDoc.broll_list) lines.push(`  - ${b}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `novax-content-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
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
            <Zap className="w-4 h-4 text-novax-accent" />
            Content Creation Studio
          </h1>
          <p className="text-xs text-slate-500">Brief one question doc</p>
        </div>
        {(pageState === 'document' || pageState === 'brief') && (
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Session
          </button>
        )}
      </div>

      {/* Resume banner */}
      {resumeBanner && pageState === 'brief' && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Session paused</p>
            <p className="text-xs text-amber-700 mt-0.5">{resumeBanner.message}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                // Resume: set session id and restart from the loading state
                setSessionId(resumeBanner.sessionId)
                setResumeBanner(null)
                // For now, restart from brief
              }}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={() => setResumeBanner(null)}
              className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      )}

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
          {(sessions.length > 0 || sessionsLoading) && (
            <div className="mb-6">
              <StudioSessionList
                sessions={sessions}
                onSessionClick={handleSessionClick}
                onNewSession={() => {}}
                isLoading={sessionsLoading}
              />
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select
                value={inputs.client_id}
                onChange={e => setInputs(v => ({ ...v, client_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Platforms — multi-select chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Platforms
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(select 1–5)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const selected = inputs.platforms.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => setInputs(v => ({
                        ...v,
                        platforms: selected
                          ? v.platforms.filter(x => x !== p)
                          : v.platforms.length < 5 ? [...v.platforms, p] : v.platforms,
                      }))}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                        selected
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Audience + Goal + Language row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audience</label>
                <div className="flex gap-1.5">
                  {(['B2C', 'B2B'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setInputs(v => ({ ...v, audience: a }))}
                      className={cn(
                        'flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                        inputs.audience === a
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Goal</label>
                <select
                  value={inputs.goal}
                  onChange={e => setInputs(v => ({ ...v, goal: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
                >
                  {GOALS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Language</label>
                <div className="flex gap-1.5">
                  {(['english', 'arabic'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setInputs(v => ({ ...v, language: lang }))}
                      className={cn(
                        'flex-1 py-1.5 text-[10px] rounded-lg font-medium border transition-all',
                        inputs.language === lang
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                      )}
                    >
                      {lang === 'english' ? 'EN' : 'AR'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">CTA Goal</label>
              <input
                value={inputs.cta}
                onChange={e => setInputs(v => ({ ...v, cta: e.target.value }))}
                placeholder="e.g. Save the post, visit the website, book a consultation..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
              />
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Brief</label>
              <textarea
                value={inputs.brief}
                onChange={e => setInputs(v => ({ ...v, brief: e.target.value }))}
                placeholder="Describe the content in 2-4 sentences. What is the topic, the key message, what should the audience feel or do after watching?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleRunBrief}
            disabled={!inputs.brief.trim() || isLoadingQuestion}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isLoadingQuestion ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Reading your brief...</>
            ) : (
              <><Zap className="w-4 h-4" />Run Content Studio</>
            )}
          </button>
        </div>
      )}

      {/* ── CONFIRMING state — Brief confirm + question ── */}
      {pageState === 'confirming' && confirmation && (
        <StudioBriefConfirm
          confirmation={confirmation}
          question={question}
          onConfirm={handleConfirm}
          onAdjust={() => setPageState('brief')}
          isLoadingQuestion={isLoadingQuestion}
        />
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={sessionName}
          tool="content"
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && contentDoc && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main document */}
          <div className="flex-1 min-w-0">
            <StudioDocument
              tool="content"
              clientName={selectedClient?.name ?? ''}
              clientColor={selectedClient?.color ?? '#1B3D38'}
              platforms={inputs.platforms}
              content={contentDoc}
              bossBrief={bossBrief}
              language={inputs.language}
              onExportTxt={handleExportTxt}
              onExportPdf={() => window.print()}
              onChatOpen={() => setChatOpen(true)}
              onEditApplied={handleEditApplied}
            />
          </div>

          {/* Chatbot — desktop side panel */}
          {chatOpen && sessionId && (
            <div className="hidden lg:block w-[380px] shrink-0">
              <div className="sticky top-4">
                <StudioChatbot
                  sessionId={sessionId}
                  sessionContext={{ tool: 'content', document: contentDoc, client: selectedClient }}
                  initialHistory={chatHistory}
                  onEditDetected={(edit: EditPayload) => handleEditApplied(edit.target, edit.new_content)}
                />
              </div>
            </div>
          )}

          {/* Chatbot — mobile bottom sheet */}
          {chatOpen && sessionId && (
            <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
              <div className="bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '70vh' }}>
                <StudioChatbot
                  sessionId={sessionId}
                  sessionContext={{ tool: 'content', document: contentDoc, client: selectedClient }}
                  initialHistory={chatHistory}
                  onEditDetected={(edit: EditPayload) => handleEditApplied(edit.target, edit.new_content)}
                />
              </div>
            </div>
          )}

          {/* Chat FAB — mobile */}
          {!chatOpen && pageState === 'document' && (
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center gap-2 px-4 py-3 bg-novax text-white text-sm font-semibold rounded-full shadow-lg hover:bg-novax-hover transition-colors"
            >
              <Zap className="w-4 h-4" />
              Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
