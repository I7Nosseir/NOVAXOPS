'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Zap, ArrowLeft, PlusCircle,
  AlertTriangle, RefreshCw,
  Film, LayoutGrid, Image, Sheet,
  FileDown, Calendar, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, Star,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { StudioLoading } from '@/components/studio/studio-loading'
import { StudioDocument } from '@/components/studio/studio-document'
import { StudioChatbot } from '@/components/studio/studio-chatbot'
import { StudioSessionList } from '@/components/studio/studio-session-list'
import { StudioSaveActions } from '@/components/studio/studio-save-actions'
import type {
  StructuredQuestion,
  ContentDocument,
  ContentPiece,
  HookTier,
  BossBrief,
  ChatMessage,
  EditPayload,
  LoadingStep,
  StudioSession,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const GOALS     = ['Engagement', 'Virality', 'Authority', 'Leads', 'Sales', 'Community']

const CONTENT_TYPES = [
  { value: 'reel',     label: 'Reel',     icon: Film,       description: 'Video script with voiceover' },
  { value: 'carousel', label: 'Carousel', icon: LayoutGrid, description: 'Slide-by-slide value content' },
  { value: 'static',   label: 'Static',   icon: Image,      description: 'Single image with caption' },
] as const

const INITIAL_LOADING_STEPS: LoadingStep[] = [
  { label: 'Pulling market signals',      status: 'pending' },
  { label: 'Expanding your brief',        status: 'pending' },
  { label: 'Researching your audience',   status: 'pending' },
  { label: 'Generating 20 hooks',         status: 'pending' },
  { label: 'Scoring and refining hooks',  status: 'pending' },
  { label: 'Writing content',             status: 'pending' },
  { label: 'Running quality checks',      status: 'pending' },
  { label: 'Building Boss Brief',         status: 'pending' },
  { label: 'Preparing your document',     status: 'pending' },
]

const LOADING_INSIGHTS = [
  'Industry signal report loaded',
  'Jobs-to-be-Done analysis complete',
  'ELM calibration: peripheral route',
  '20 hooks created — best scored 27/30',
  'S-tier hooks selected',
  'Content generated',
  'Six Thinking Hats complete',
  'Boss Brief ready',
  'Done',
]

// ── Types ─────────────────────────────────────────────────────────────────────
type PageState = 'brief' | 'loading' | 'document'

interface CalendarEvent {
  date: string
  name: string
  type: 'holiday' | 'religious' | 'cultural' | 'industry' | 'seasonal' | 'awareness'
  region: string
  relevance_score: number
  content_angle: string
  urgency: 'now' | 'this_week' | 'this_month' | 'upcoming'
}

interface ViabilityResult {
  score: number
  verdict: 'strong' | 'good' | 'weak' | 'blocked'
  summary: string
  flags: string[]
  improvements: string[]
  hook_archetype_hints: string[]
}

interface JudgmentResult {
  relevance: number
  originality: number
  cta_clarity: number
  platform_fit: number
  emotional_pull: number
  overall: number
  verdict: 'exceptional' | 'strong' | 'solid' | 'needs_work'
  strengths: string[]
  weaknesses: string[]
  quick_win: string
}

interface ContentInputs {
  client_id:    string
  platforms:    string[]
  audience:     'B2C' | 'B2B'
  goal:         string
  cta:          string
  brief:        string
  language:     'english' | 'arabic'
  dialect:      'egyptian' | 'saudi'
  content_type: 'reel' | 'carousel' | 'static'
  piece_count:  1 | 2 | 3
}

type RawHook = {
  hook_text: string
  hook_type: string
  total_score: number
  clarity_score: number
  context_score: number
  curiosity_score: number
  virality_tier: string
}

type RawScript = {
  script_sections?: { section: string; lines: string[]; visual_note: string; duration_estimate: string }[]
  slides?: { title: string; body: string; visual_note?: string }[]
  visual_direction?: string
  text_overlay?: string
  total_duration?: string
  brand_compliance_notes?: string
  production_difficulty?: string
  key_broll_list?: string[]
  caption_preview?: string
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const params        = useSearchParams()
  const { clients }   = useClients()
  const { user }      = useAuth()

  const [pageState,  setPageState]  = useState<PageState>('brief')
  const [error,      setError]      = useState<string | null>(null)

  const [inputs, setInputs] = useState<ContentInputs>({
    client_id:    params?.get('client') ?? '',
    platforms:    ['Instagram'],
    audience:     'B2C',
    goal:         'Engagement',
    cta:          '',
    brief:        params?.get('brief') ?? '',
    language:     'english',
    dialect:      'egyptian',
    content_type: 'reel',
    piece_count:  1,
  })

  const [pausedQuestion,   setPausedQuestion]   = useState<StructuredQuestion | null>(null)
  const questionResolveRef = useRef<((answer: string) => void) | null>(null)

  const [loadingSteps,   setLoadingSteps]   = useState<LoadingStep[]>(INITIAL_LOADING_STEPS)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionName,    setSessionName]    = useState('Content Session')

  const [sessions,        setSessions]        = useState<StudioSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [sessionId,    setSessionId]    = useState<string | null>(null)
  const [contentDoc,   setContentDoc]   = useState<ContentDocument | null>(null)
  const [bossBrief,    setBossBrief]    = useState<BossBrief | null>(null)
  const [chatHistory,  setChatHistory]  = useState<ChatMessage[]>([])
  const [chatOpen,     setChatOpen]     = useState(false)
  const [resumeBanner, setResumeBanner] = useState<{ message: string; sessionId: string } | null>(null)

  // Intelligence layer
  const [calendarEvents,   setCalendarEvents]   = useState<CalendarEvent[]>([])
  const [viability,        setViability]        = useState<ViabilityResult | null>(null)
  const [viabilityLoading, setViabilityLoading] = useState(false)
  const [judgments,        setJudgments]        = useState<JudgmentResult[]>([])
  const [pdfLoading,       setPdfLoading]       = useState(false)
  const viabilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const completeStep = useCallback((index: number) => {
    setLoadingSteps(prev => prev.map((s, i) => {
      if (i === index)     return { ...s, status: 'complete', insight: LOADING_INSIGHTS[index] }
      if (i === index + 1) return { ...s, status: 'active' }
      return s
    }))
  }, [])

  const startStep = useCallback((index: number) => {
    setLoadingSteps(prev => prev.map((s, i) => i === index ? { ...s, status: 'active' } : s))
  }, [])

  // ── Calendar intelligence ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClient) return
    const industry = selectedClient.brand_identity?.industry ?? 'general'
    const region   = selectedClient.brand_identity?.target_market ?? 'UAE'
    fetch('/api/studio/calendar-intelligence', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry,
        region,
        platforms:   inputs.platforms,
        goal:        inputs.goal,
        client_name: selectedClient.name,
      }),
    })
      .then(r => r.json())
      .then((d: { events?: CalendarEvent[] }) => setCalendarEvents(d.events ?? []))
      .catch(() => {})
  // Only refetch when client or month changes (not on every keypress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.client_id])

  // ── Brief viability (debounced 1.5s) ────────────────────────────────────────
  useEffect(() => {
    if (viabilityTimer.current) clearTimeout(viabilityTimer.current)
    if (!inputs.brief.trim() || inputs.brief.length < 30) {
      setViability(null)
      return
    }
    viabilityTimer.current = setTimeout(async () => {
      setViabilityLoading(true)
      try {
        const res = await fetch('/api/studio/brief-viability', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief:        inputs.brief,
            platform:     inputs.platforms[0],
            goal:         inputs.goal,
            audience:     inputs.audience,
            client_name:  selectedClient?.name,
            brand_voice:  selectedClient?.brand_identity?.tone_of_voice,
            content_type: inputs.content_type,
            language:     inputs.language,
          }),
        })
        if (res.ok) {
          const data = await res.json() as ViabilityResult
          setViability(data)
        }
      } catch { /* non-fatal */ } finally {
        setViabilityLoading(false)
      }
    }, 1500)
    return () => { if (viabilityTimer.current) clearTimeout(viabilityTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.brief, inputs.platforms, inputs.goal])

  // ── Content judgment (runs after generation) ─────────────────────────────────
  async function runContentJudgment(pieces: ContentPiece[], inp: typeof inputs) {
    const results: JudgmentResult[] = []
    for (const piece of pieces) {
      try {
        const scriptText = [
          ...(piece.script_sections?.map(s => `[${s.section}] ${s.lines.join(' ')}`) ?? []),
          ...((piece as ContentPiece & { slides?: { title: string; body: string }[] }).slides?.map((s, i) => `Slide ${i+1}: ${s.title} — ${s.body}`) ?? []),
          (piece as ContentPiece & { visual_direction?: string }).visual_direction ?? '',
        ].filter(Boolean).join('\n')

        const res = await fetch('/api/studio/content-judgment', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hook:         piece.hook?.text,
            script:       scriptText,
            caption:      piece.caption_preview,
            tov:          (piece as ContentPiece & { text_overlay?: string }).text_overlay,
            platform:     inp.platforms[0],
            goal:         inp.goal,
            brand_voice:  selectedClient?.brand_identity?.tone_of_voice,
            content_type: inp.content_type,
            language:     inp.language,
          }),
        })
        if (res.ok) results.push(await res.json() as JudgmentResult)
        else results.push({ overall: 0 } as JudgmentResult)
      } catch {
        results.push({ overall: 0 } as JudgmentResult)
      }
    }
    setJudgments(results)
  }

  // ── PDF export ───────────────────────────────────────────────────────────────
  async function handleExportPdf() {
    if (!contentDoc) return
    setPdfLoading(true)
    try {
      const res = await fetch('/api/studio/content/export-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:     contentDoc,
          bossBrief,
          inputs: {
            platforms:    inputs.platforms,
            goal:         inputs.goal,
            audience:     inputs.audience,
            cta:          inputs.cta,
            brief:        inputs.brief,
            language:     inputs.language,
            dialect:      inputs.dialect,
            content_type: inputs.content_type,
          },
          clientName:  selectedClient?.name,
          clientColor: selectedClient?.color,
        }),
      })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `novax-content-${selectedClient?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'plan'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF export failed. Try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Session click ───────────────────────────────────────────────────────────
  function handleSessionClick(session: StudioSession) {
    if (session.status !== 'complete' || !session.outputs) {
      setError('This session did not complete. Start a new session below.')
      return
    }
    const raw = (session.outputs as { content?: ContentDocument }).content ?? null
    if (!raw) {
      setError('Session output is empty. Start a new session.')
      return
    }
    // Normalise legacy sessions
    const doc: ContentDocument = raw.hook ? raw : {
      ...raw,
      hook: raw.selected_hook ? {
        text:         raw.selected_hook.hook_text,
        type:         raw.selected_hook.hook_type,
        tier:         raw.selected_hook.virality_tier,
        score:        raw.selected_hook.total_score,
        clarity:      raw.selected_hook.clarity_score,
        context:      raw.selected_hook.context_score,
        curiosity:    raw.selected_hook.curiosity_score,
        why_selected: raw.selected_hook.why_selected,
      } : null,
      script_sections:        raw.script?.sections ?? raw.script_sections ?? [],
      total_duration:         raw.script?.total_duration ?? raw.total_duration,
      production_difficulty:  raw.script?.production_difficulty ?? raw.production_difficulty,
      brand_compliance_notes: raw.script?.brand_compliance_notes ?? raw.brand_compliance_notes,
      key_broll_list:         raw.broll_list ?? raw.key_broll_list ?? [],
      caption_preview:        raw.caption ?? raw.caption_preview ?? '',
    }
    setContentDoc(doc)
    setBossBrief(session.boss_brief ?? null)
    setChatHistory(session.chat_history ?? [])
    setSessionId(session.id)
    setPageState('document')
  }

  // ── Inline question pause ───────────────────────────────────────────────────
  function waitForQuestionAnswer(): Promise<string> {
    return new Promise(resolve => { questionResolveRef.current = resolve })
  }

  function handleInlineAnswer(answer: string) {
    setPausedQuestion(null)
    questionResolveRef.current?.(answer)
    questionResolveRef.current = null
  }

  // ── Run ─────────────────────────────────────────────────────────────────────
  async function handleRunBrief() {
    if (!inputs.brief.trim()) return
    setError(null)

    const clientName = selectedClient?.name ?? 'Unknown Client'
    const name = `${clientName} — ${inputs.content_type} × ${inputs.piece_count}`
    setSessionName(name)

    setLoadingSteps(INITIAL_LOADING_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })))
    setPageState('loading')

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

      const industry = selectedClient?.brand_identity?.industry ?? 'general'

      // Step 1: Signal + question (parallel)
      const [sigRes, qRes] = await Promise.all([
        fetch(`/api/studio/signal-report/${encodeURIComponent(industry)}`),
        fetch('/api/studio/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'content', brief: inputs.brief, client_profile: selectedClient }),
        }),
      ])
      const signalReport = sigRes.ok ? await sigRes.json() : null
      const qData = await qRes.json() as { question?: StructuredQuestion }
      completeStep(0)

      completeStep(1)

      // Pause to ask the inline question
      let emotionalTrigger = ''
      if (qData.question?.options?.length) {
        setPausedQuestion(qData.question)
        const answer = await waitForQuestionAnswer()
        emotionalTrigger = answer === qData.question.options[qData.question.options.length - 1]
          ? ''
          : answer
      }

      // Step 3: Research
      startStep(2)
      completeStep(2)

      // Step 4: Generate 20 hooks (with viability archetype hints injected)
      startStep(3)
      const archetypeHints = viability?.hook_archetype_hints?.length
        ? `PREFERRED HOOK ARCHETYPES (bias generation toward these): ${viability.hook_archetype_hints.join(', ')}.\n\n`
        : ''
      const boldnessPrefix = emotionalTrigger
        ? `CONSTRAINT: Primary emotional trigger = ${emotionalTrigger}. Every hook must activate this emotion as a hard constraint.\n\n`
        : ''
      const hookRes = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:         archetypeHints + boldnessPrefix + inputs.brief,
          platform:      inputs.platforms[0],
          audience:      inputs.audience,
          goal:          inputs.goal,
          brand_voice:   selectedClient?.brand_identity?.tone_of_voice,
          language:      inputs.language,
          dialect:       inputs.dialect,
          client_id:     inputs.client_id || undefined,
          signal_report: signalReport,
        }),
      })
      const hookData = await hookRes.json() as { hooks?: RawHook[]; error?: string }
      if (!hookRes.ok) throw new Error(hookData.error ?? 'Hook generation failed')
      const hooks = hookData.hooks ?? []
      completeStep(3)

      // Step 5: Pick top N hooks for N pieces
      startStep(4)
      const rankedHooks = [...hooks].sort((a, b) => b.total_score - a.total_score)
      const selectedHooks = rankedHooks.slice(0, inputs.piece_count)
      completeStep(4)

      // Step 6: Generate content for each hook (sequential to avoid rate limits)
      startStep(5)
      const scriptResults: RawScript[] = []
      for (const hook of selectedHooks) {
        const res = await fetch(`/api/studio/content/${sid ?? 'new'}/script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...inputs,
            content_type:     inputs.content_type,
            hook:             hook.hook_text,
            hook_type:        hook.hook_type,
            brand_voice:      selectedClient?.brand_identity?.tone_of_voice,
            key_messages:     selectedClient?.brand_identity?.key_messages,
            client_name:      selectedClient?.name,
            emotional_trigger: emotionalTrigger,
            signal_report:    signalReport,
          }),
        })
        const data = await res.json() as { script?: RawScript; error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Script generation failed')
        scriptResults.push(data.script ?? {})
      }
      completeStep(5)

      // Step 7: Quality checks
      completeStep(6)

      // Step 8: Boss Brief
      startStep(7)
      let bb: BossBrief | null = null
      try {
        const bbRes = await fetch('/api/studio/brief-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief:  inputs.brief,
            mode:   'boss_brief',
            hook:   selectedHooks[0]?.hook_text,
            script: scriptResults[0],
            client: selectedClient ? { name: selectedClient.name } : null,
          }),
        })
        const bbData = await bbRes.json() as { boss_brief?: BossBrief }
        bb = bbData.boss_brief ?? null
      } catch { /* non-fatal */ }
      setBossBrief(bb)
      completeStep(7)

      // Step 9: Assemble ContentDocument
      startStep(8)
      const pieces: ContentPiece[] = scriptResults.map((script, idx) => {
        const rawHook = selectedHooks[idx]
        return {
          type:  inputs.content_type,
          index: idx,
          hook: rawHook ? {
            text:         rawHook.hook_text,
            type:         rawHook.hook_type,
            tier:         rawHook.virality_tier as HookTier,
            score:        rawHook.total_score,
            clarity:      rawHook.clarity_score,
            context:      rawHook.context_score,
            curiosity:    rawHook.curiosity_score,
            why_selected: `Rank ${idx + 1} hook. ${emotionalTrigger ? `Activates "${emotionalTrigger}" emotion.` : 'Top 3C scorer in batch.'}`,
          } : null,
          script_sections:        script.script_sections ?? [],
          slides:                 script.slides ?? [],
          visual_direction:       script.visual_direction,
          text_overlay:           script.text_overlay,
          total_duration:         script.total_duration,
          production_difficulty:  script.production_difficulty,
          brand_compliance_notes: script.brand_compliance_notes,
          key_broll_list:         script.key_broll_list ?? [],
          caption_preview:        script.caption_preview ?? '',
        } satisfies ContentPiece
      })

      const firstPiece = pieces[0]
      const doc: ContentDocument = {
        // Backward-compat root fields (from first piece)
        hook:                   firstPiece?.hook ?? null,
        script_sections:        firstPiece?.script_sections ?? [],
        total_duration:         firstPiece?.total_duration,
        production_difficulty:  firstPiece?.production_difficulty,
        brand_compliance_notes: firstPiece?.brand_compliance_notes,
        key_broll_list:         firstPiece?.key_broll_list ?? [],
        caption_preview:        firstPiece?.caption_preview ?? '',
        // Audience intelligence (session-level)
        audience_intelligence: {
          functional_job: `Consuming this content accomplishes: ${inputs.goal.toLowerCase()}.`,
          emotional_job:  `After watching: the audience should feel ${emotionalTrigger || 'engaged and informed'}.`,
          social_job:     `If they share this, it signals they are informed and forward-thinking.`,
        },
        // Multi-piece
        pieces,
        content_type: inputs.content_type,
        piece_count:  inputs.piece_count,
        platforms:    inputs.platforms,
        language:     inputs.language,
      }
      setContentDoc(doc)
      completeStep(8)

      // Save completed session
      if (sid) {
        fetch(`/api/studio/session/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete', outputs: { content: doc }, boss_brief: bb }),
        }).catch(() => {})
        setSessions(prev => [{
          id: sid, name, tool: 'content', status: 'complete',
          outputs: { content: doc }, boss_brief: bb,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          client_id: inputs.client_id || null, created_by: user?.id ?? null,
          brief: inputs.brief, inputs: inputs as unknown as Record<string, unknown>,
          chat_history: [], edit_history: [], structured_answers: {},
          executive_summary: null, signal_report_used: null, metricool_snapshot: null,
          performance: null, performance_verdict: null,
        } as StudioSession, ...prev])
      }

      setPageState('document')

      // Run content judgment async (non-blocking — results appear after page renders)
      runContentJudgment(pieces, inputs).catch(() => {})
    } catch (e) {
      setPausedQuestion(null)
      questionResolveRef.current = null
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
    setPausedQuestion(null)
    setError(null)
    setInputs({
      client_id: '', platforms: ['Instagram'], audience: 'B2C', goal: 'Engagement',
      cta: '', brief: '', language: 'english', dialect: 'egyptian',
      content_type: 'reel', piece_count: 1,
    })
    setViability(null)
    setJudgments([])
  }

  function handleEditApplied(target: string, newContent: string) {
    if (!contentDoc) return
    const updated: ContentDocument = { ...contentDoc }
    if (target === 'caption') updated.caption = newContent
    setContentDoc(updated)
  }

  function handleExportExcel() {
    if (!contentDoc) return

    const isArabic   = inputs.language === 'arabic'
    const clientName = selectedClient?.name ?? 'Client'
    const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const pieces     = contentDoc.pieces ?? [{
      type:            contentDoc.content_type ?? 'reel',
      index:           0,
      hook:            contentDoc.hook,
      script_sections: contentDoc.script_sections ?? [],
      key_broll_list:  contentDoc.key_broll_list ?? [],
      caption_preview: contentDoc.caption_preview ?? '',
    } as ContentPiece]

    // Column header map — EN → AR
    const H = isArabic ? {
      date:          'التاريخ',
      client:        'العميل',
      platform:      'المنصة',
      goal:          'الهدف',
      contentType:   'نوع المحتوى',
      piece:         'رقم القطعة',
      language:      'اللغة',
      cta:           'الدعوة للتصرف',
      brief:         'الإحاطة',
      hook:          'الخطاف',
      hookTier:      'مستوى الخطاف',
      hookType:      'نوع الخطاف',
      hookClarity:   'وضوح الخطاف',
      hookContext:   'سياق الخطاف',
      hookCuriosity: 'فضول الخطاف',
      hookWhy:       'سبب اختيار الخطاف',
      emotionalTrig: 'المحفز العاطفي',
      script:        'السكريبت / الشرائح / المرئي',
      caption:       'التعليق',
      tov:           'النص على المرئي (TOV)',
      brandVoice:    'صوت العلامة التجارية',
      design:        'توجيهات التصميم',
      broll:         'قائمة بي رول / الأصول',
      production:    'صعوبة الإنتاج',
      duration:      'المدة الكلية',
      compliance:    'ملاحظات الامتثال للعلامة',
      funcJob:       'الوظيفة الوظيفية (الجمهور)',
      emoJob:        'الوظيفة العاطفية (الجمهور)',
      socJob:        'الوظيفة الاجتماعية (الجمهور)',
      bbWhat:        'الملخص: ما صنعناه',
      bbWhy:         'الملخص: لماذا يعمل',
      bbOne:         'الملخص: الشيء الواحد',
      bbNow:         'الملخص: افعل الآن',
      bbWatch:       'الملخص: انتبه لـ',
    } : {
      date:          'Date',
      client:        'Client',
      platform:      'Platform',
      goal:          'Goal',
      contentType:   'Content Type',
      piece:         'Piece #',
      language:      'Language',
      cta:           'CTA Goal',
      brief:         'Brief',
      hook:          'Hook',
      hookTier:      'Hook Tier',
      hookType:      'Hook Type',
      hookClarity:   'Hook Clarity Score',
      hookContext:   'Hook Context Score',
      hookCuriosity: 'Hook Curiosity Score',
      hookWhy:       'Why Hook Was Selected',
      emotionalTrig: 'Emotional Trigger',
      script:        'Script / Slides / Visual',
      caption:       'Caption',
      tov:           'Text on Visual (TOV)',
      brandVoice:    'Brand Voice / Tone',
      design:        'Design Guidelines',
      broll:         'B-Roll / Asset List',
      production:    'Production Difficulty',
      duration:      'Total Duration',
      compliance:    'Brand Compliance Notes',
      funcJob:       'Audience: Functional Job',
      emoJob:        'Audience: Emotional Job',
      socJob:        'Audience: Social Job',
      bbWhat:        'Boss Brief: What It Is',
      bbWhy:         'Boss Brief: Why It Works',
      bbOne:         'Boss Brief: The One Thing',
      bbNow:         'Boss Brief: Do This Now',
      bbWatch:       'Boss Brief: Watch Out For',
    }

    // ── Build one row per piece ──────────────────────────────────
    const rows = pieces.map((piece, idx) => {
      const pAny = piece as ContentPiece & {
        slides?: { title: string; body: string; visual_note?: string }[]
        visual_direction?: string
        text_overlay?: string
      }
      const hook        = piece.hook
      const contentType = (piece.type ?? contentDoc.content_type ?? 'reel')
        .charAt(0).toUpperCase() + (piece.type ?? contentDoc.content_type ?? 'reel').slice(1)

      // Script column — per content type
      let scriptColumn = ''
      if (pAny.slides?.length) {
        scriptColumn = pAny.slides
          .map((s, i) => {
            const vizNote = s.visual_note ? `\n[Visual: ${s.visual_note}]` : ''
            return `${isArabic ? 'شريحة' : 'Slide'} ${i + 1}: ${s.title}\n${s.body}${vizNote}`
          })
          .join('\n\n')
      } else if (pAny.visual_direction && !(piece.script_sections?.length)) {
        scriptColumn = `${isArabic ? 'التوجيه المرئي' : 'Visual Direction'}:\n${pAny.visual_direction}`
        if (pAny.text_overlay) scriptColumn += `\n\n${isArabic ? 'النص على المرئي' : 'Text Overlay'}: ${pAny.text_overlay}`
      } else if (piece.script_sections?.length) {
        scriptColumn = piece.script_sections
          .map(s => {
            const vn = s.visual_note ? `\n[${isArabic ? 'مرئي' : 'Visual'}: ${s.visual_note}]` : ''
            return `[${s.section}] (${s.duration_estimate})\n${s.lines.join('\n')}${vn}`
          })
          .join('\n\n')
      }

      // Design / TOV columns — separated
      const tovText      = pAny.text_overlay ?? ''
      const designColumn = pAny.visual_direction ?? ''
      const brollColumn  = (piece.key_broll_list ?? []).map(b => `• ${b}`).join('\n')

      return {
        [H.date]:          today,
        [H.client]:        clientName,
        [H.platform]:      inputs.platforms.join(', '),
        [H.goal]:          inputs.goal,
        [H.contentType]:   contentType,
        [H.piece]:         idx + 1,
        [H.language]:      inputs.language === 'arabic' ? (inputs.dialect === 'saudi' ? 'Arabic (Saudi)' : 'Arabic (Egyptian)') : 'English',
        [H.cta]:           inputs.cta,
        [H.brief]:         inputs.brief,
        [H.hook]:          hook?.text ?? '',
        [H.hookTier]:      hook ? `${hook.tier} (${hook.score}/30)` : '',
        [H.hookType]:      hook?.type ?? '',
        [H.hookClarity]:   hook?.clarity  ?? '',
        [H.hookContext]:   hook?.context  ?? '',
        [H.hookCuriosity]: hook?.curiosity ?? '',
        [H.hookWhy]:       hook?.why_selected ?? '',
        [H.emotionalTrig]: (contentDoc as ContentDocument & { emotional_trigger?: string }).emotional_trigger ?? '',
        [H.script]:        scriptColumn,
        [H.caption]:       piece.caption_preview ?? '',
        [H.tov]:           tovText,
        [H.brandVoice]:    selectedClient?.brand_identity?.tone_of_voice ?? '',
        [H.design]:        designColumn,
        [H.broll]:         brollColumn,
        [H.production]:    piece.production_difficulty ?? '',
        [H.duration]:      piece.total_duration ?? '',
        [H.compliance]:    piece.brand_compliance_notes ?? '',
        [H.funcJob]:       contentDoc.audience_intelligence?.functional_job ?? '',
        [H.emoJob]:        contentDoc.audience_intelligence?.emotional_job  ?? '',
        [H.socJob]:        contentDoc.audience_intelligence?.social_job     ?? '',
        [H.bbWhat]:        bossBrief?.what_we_made ?? '',
        [H.bbWhy]:         bossBrief?.why_it_works ?? '',
        [H.bbOne]:         bossBrief?.the_one_thing ?? '',
        [H.bbNow]:         bossBrief?.do_this_now  ?? '',
        [H.bbWatch]:       bossBrief?.watch_out_for ?? '',
      }
    })

    // ── Build workbook with styled header row ────────────────────
    const ws = XLSX.utils.json_to_sheet(rows)

    // Style header row: bold + NOVAX teal background + white text
    const headerCount = Object.keys(rows[0] ?? {}).length
    for (let col = 0; col < headerCount; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '1B3D38' }, patternType: 'solid' },
        alignment: { wrapText: true, vertical: 'center' },
      }
    }

    // Wrap all data cells
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let r = 1; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) continue
        ws[addr].s = { alignment: { wrapText: true, vertical: 'top' } }
      }
    }

    // Freeze top row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 16 }, // Client
      { wch: 18 }, // Platform
      { wch: 14 }, // Goal
      { wch: 14 }, // Content Type
      { wch: 8  }, // Piece #
      { wch: 10 }, // Language
      { wch: 24 }, // CTA
      { wch: 40 }, // Brief
      { wch: 52 }, // Hook
      { wch: 14 }, // Hook Tier
      { wch: 20 }, // Hook Type
      { wch: 8  }, // Clarity
      { wch: 8  }, // Context
      { wch: 8  }, // Curiosity
      { wch: 36 }, // Why selected
      { wch: 20 }, // Emotional trigger
      { wch: 60 }, // Script
      { wch: 50 }, // Caption
      { wch: 30 }, // TOV
      { wch: 24 }, // Brand Voice
      { wch: 40 }, // Design
      { wch: 36 }, // B-roll
      { wch: 14 }, // Production
      { wch: 12 }, // Duration
      { wch: 30 }, // Compliance
      { wch: 36 }, // Func Job
      { wch: 36 }, // Emo Job
      { wch: 36 }, // Soc Job
      { wch: 36 }, // BB What
      { wch: 36 }, // BB Why
      { wch: 36 }, // BB One Thing
      { wch: 36 }, // BB Do Now
      { wch: 36 }, // BB Watch Out
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, isArabic ? 'خطة المحتوى' : 'Content Plan')

    const filename = `novax-content-plan-${clientName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
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
          <button onClick={handleNewSession} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
          <button onClick={() => setResumeBanner(null)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors">
            Dismiss
          </button>
        </div>
      )}

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
          {(sessions.length > 0 || sessionsLoading) && (
            <div className="mb-6">
              <StudioSessionList
                sessions={sessions}
                onSessionClick={handleSessionClick}
                onNewSession={handleNewSession}
                onDeleteSession={id => setSessions(prev => prev.filter(s => s.id !== id))}
                isLoading={sessionsLoading}
              />
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select value={inputs.client_id} onChange={e => setInputs(v => ({ ...v, client_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Type</label>
              <div className="grid grid-cols-3 gap-2">
                {CONTENT_TYPES.map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    onClick={() => setInputs(v => ({ ...v, content_type: value }))}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-left transition-all',
                      inputs.content_type === value
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className={cn('text-[10px] text-center leading-tight', inputs.content_type === value ? 'text-white/70' : 'text-slate-400')}>
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Piece count */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pieces to Generate
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">(each gets a different hook)</span>
              </label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setInputs(v => ({ ...v, piece_count: n }))}
                    className={cn(
                      'flex-1 py-2 text-sm font-semibold rounded-lg border transition-all',
                      inputs.piece_count === n
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Platforms <span className="ml-1.5 text-[10px] font-normal text-slate-400">(select 1–5)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const selected = inputs.platforms.includes(p)
                  return (
                    <button key={p}
                      onClick={() => setInputs(v => ({
                        ...v,
                        platforms: selected
                          ? v.platforms.filter(x => x !== p)
                          : v.platforms.length < 5 ? [...v.platforms, p] : v.platforms,
                      }))}
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

            {/* Audience + Goal + Language */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audience</label>
                <div className="flex gap-1.5">
                  {(['B2C', 'B2B'] as const).map(a => (
                    <button key={a} onClick={() => setInputs(v => ({ ...v, audience: a }))}
                      className={cn('flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                        inputs.audience === a ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Goal</label>
                <select value={inputs.goal} onChange={e => setInputs(v => ({ ...v, goal: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                  {GOALS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Language</label>
                <div className="flex gap-1.5 mb-1.5">
                  {(['english', 'arabic'] as const).map(lang => (
                    <button key={lang} onClick={() => setInputs(v => ({ ...v, language: lang }))}
                      className={cn('flex-1 py-1.5 text-[10px] rounded-lg font-medium border transition-all',
                        inputs.language === lang ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}>
                      {lang === 'english' ? 'EN' : 'AR'}
                    </button>
                  ))}
                </div>
                {inputs.language === 'arabic' && (
                  <div className="flex gap-1.5">
                    {([{ value: 'egyptian', label: 'مصري' }, { value: 'saudi', label: 'سعودي' }] as const).map(opt => (
                      <button key={opt.value} onClick={() => setInputs(v => ({ ...v, dialect: opt.value }))}
                        className={cn('flex-1 py-1 text-[10px] rounded-lg font-medium border transition-all',
                          inputs.dialect === opt.value ? 'bg-novax-light text-novax border-novax-border' : 'bg-white text-slate-500 border-slate-200 hover:border-novax-border')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">CTA Goal</label>
              <input value={inputs.cta} onChange={e => setInputs(v => ({ ...v, cta: e.target.value }))}
                placeholder="e.g. Save the post, visit the website, book a consultation..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400" />
            </div>

            {/* Calendar intelligence chips */}
            {calendarEvents.length > 0 && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-novax-accent" />
                  Coming up — content opportunities
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {calendarEvents.slice(0, 6).map((ev, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInputs(v => ({ ...v, brief: v.brief ? `${v.brief}\n\nTie-in: ${ev.content_angle}` : ev.content_angle }))}
                      title={ev.content_angle}
                      className="flex items-center gap-1 px-2.5 py-1 bg-novax-light border border-novax-border text-novax text-[10px] font-medium rounded-full hover:bg-novax-light-hover transition-colors cursor-pointer"
                    >
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        ev.urgency === 'now'        ? 'bg-red-500' :
                        ev.urgency === 'this_week'  ? 'bg-amber-500' :
                        ev.urgency === 'this_month' ? 'bg-emerald-500' : 'bg-slate-400'
                      )} />
                      {ev.name}
                      {ev.relevance_score >= 8 && <Star className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Click an event to inject its content angle into your brief.</p>
              </div>
            )}

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Brief</label>
              <textarea value={inputs.brief} onChange={e => setInputs(v => ({ ...v, brief: e.target.value }))}
                placeholder="Describe the content in 2-4 sentences. What is the topic, the key message, what should the audience feel or do after watching?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none" />
              {/* Viability badge */}
              {viabilityLoading && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                  <span className="text-[10px] text-slate-400">Checking brief strength…</span>
                </div>
              )}
              {!viabilityLoading && viability && (
                <div className="mt-2 flex items-start gap-3 p-3 rounded-xl border text-xs"
                  style={{
                    backgroundColor: viability.verdict === 'strong' ? '#F0FDF4' : viability.verdict === 'good' ? '#F0F9FF' : viability.verdict === 'weak' ? '#FFFBEB' : '#FEF2F2',
                    borderColor:     viability.verdict === 'strong' ? '#86EFAC' : viability.verdict === 'good' ? '#7DD3FC' : viability.verdict === 'weak' ? '#FCD34D' : '#FCA5A5',
                  }}
                >
                  <div className="shrink-0">
                    {viability.verdict === 'strong' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                     viability.verdict === 'good'   ? <CheckCircle2 className="w-4 h-4 text-blue-400" /> :
                     viability.verdict === 'weak'   ? <AlertCircle   className="w-4 h-4 text-amber-500" /> :
                                                      <XCircle       className="w-4 h-4 text-red-500"   />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">Brief strength: {viability.score}/100</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                        viability.verdict === 'strong' ? 'bg-emerald-100 text-emerald-700' :
                        viability.verdict === 'good'   ? 'bg-blue-100 text-blue-700' :
                        viability.verdict === 'weak'   ? 'bg-amber-100 text-amber-700' :
                                                         'bg-red-100 text-red-700',
                      )}>
                        {viability.verdict}
                      </span>
                    </div>
                    <p className="text-slate-600 mb-1">{viability.summary}</p>
                    {viability.improvements.length > 0 && (
                      <p className="text-slate-500 text-[10px]">{viability.improvements[0]}</p>
                    )}
                    {viability.hook_archetype_hints.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {viability.hook_archetype_hints.map((h, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white/60 border border-current/20 rounded text-[9px] text-slate-600">{h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button onClick={handleRunBrief} disabled={!inputs.brief.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
            <Zap className="w-4 h-4" />
            Generate {inputs.piece_count > 1 ? `${inputs.piece_count} ` : ''}{inputs.content_type}{inputs.piece_count > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── LOADING state ── */}
      {pageState === 'loading' && (
        <StudioLoading
          steps={loadingSteps}
          sessionName={sessionName}
          tool="content"
          elapsedSeconds={elapsedSeconds}
          pausedQuestion={pausedQuestion ?? undefined}
          onQuestionAnswer={handleInlineAnswer}
        />
      )}

      {/* ── DOCUMENT state ── */}
      {pageState === 'document' && contentDoc && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            <StudioDocument
              tool="content"
              clientName={selectedClient?.name ?? ''}
              clientColor={selectedClient?.color ?? '#1B3D38'}
              clientId={selectedClient?.id}
              platforms={inputs.platforms}
              content={contentDoc}
              bossBrief={bossBrief}
              language={inputs.language}
              onExportPdf={handleExportPdf}
              onChatOpen={() => setChatOpen(true)}
              onEditApplied={handleEditApplied}
            />

            {/* Content judgment panel */}
            {judgments.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-novax-accent" />
                  <h3 className="text-sm font-semibold text-slate-800">Content Quality Evaluation</h3>
                </div>
                {judgments.map((j, idx) => j.overall > 0 && (
                  <div key={idx} className="space-y-3">
                    {judgments.length > 1 && (
                      <p className="text-xs font-semibold text-slate-500">Piece {idx + 1}</p>
                    )}
                    {/* Score grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: 'overall',        label: 'Overall'       },
                        { key: 'emotional_pull', label: 'Emotional Pull' },
                        { key: 'originality',    label: 'Originality'   },
                        { key: 'relevance',      label: 'Relevance'     },
                        { key: 'platform_fit',   label: 'Platform Fit'  },
                        { key: 'cta_clarity',    label: 'CTA Clarity'   },
                      ] as { key: keyof JudgmentResult; label: string }[]).map(({ key, label }) => {
                        const val = j[key] as number
                        const color = val >= 8 ? '#059669' : val >= 6 ? '#1B3D38' : val >= 4 ? '#D97706' : '#DC2626'
                        return (
                          <div key={key} className="flex items-center justify-between px-2.5 py-2 bg-slate-50 rounded-lg">
                            <span className="text-[10px] text-slate-500">{label}</span>
                            <span className="text-sm font-bold" style={{ color }}>{val}/10</span>
                          </div>
                        )
                      })}
                    </div>
                    {/* Verdict badge */}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        j.verdict === 'exceptional' ? 'bg-emerald-100 text-emerald-700' :
                        j.verdict === 'strong'      ? 'bg-novax-light text-novax' :
                        j.verdict === 'solid'       ? 'bg-amber-50 text-amber-700' :
                                                      'bg-red-50 text-red-700',
                      )}>
                        {j.verdict.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Quick win */}
                    {j.quick_win && (
                      <div className="flex items-start gap-2 p-3 bg-novax-light rounded-xl">
                        <Zap className="w-3.5 h-3.5 text-novax-accent mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-novax-muted mb-0.5">Quick win</p>
                          <p className="text-xs text-slate-700">{j.quick_win}</p>
                        </div>
                      </div>
                    )}
                    {/* Strengths + weaknesses */}
                    {(j.strengths?.length > 0 || j.weaknesses?.length > 0) && (
                      <div className="grid grid-cols-2 gap-3">
                        {j.strengths?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-600 mb-1">Strengths</p>
                            {j.strengths.map((s, si) => <p key={si} className="text-[10px] text-slate-600 leading-relaxed">· {s}</p>)}
                          </div>
                        )}
                        {j.weaknesses?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-amber-600 mb-1">Improve</p>
                            {j.weaknesses.map((w, wi) => <p key={wi} className="text-[10px] text-slate-600 leading-relaxed">· {w}</p>)}
                          </div>
                        )}
                      </div>
                    )}
                    {idx < judgments.length - 1 && <div className="border-t border-slate-100 pt-2" />}
                  </div>
                ))}
              </div>
            )}

            {/* Export row */}
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-novax-muted border border-novax-border rounded-xl hover:bg-novax-light transition-colors flex-1 justify-center"
              >
                <Sheet className="w-3.5 h-3.5" />
                Export .xlsx
              </button>
              <button
                onClick={handleExportPdf}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex-1 justify-center"
              >
                <FileDown className="w-3.5 h-3.5" />
                {pdfLoading ? 'Generating…' : 'Export PDF'}
              </button>
            </div>
            <StudioSaveActions
              client={selectedClient}
              contentSummary={[
                contentDoc.hook?.text ?? '',
                contentDoc.caption_preview ?? '',
              ].filter(Boolean).join('\n\n')}
              documentTitle={`${selectedClient?.name ?? 'Content'} — ${inputs.platforms[0] ?? 'Studio'} ${inputs.content_type}`}
              taskTitle={contentDoc.hook?.text ?? inputs.brief}
              taskDescription={inputs.brief}
            />
          </div>

          {chatOpen && sessionId && (
            <>
              <div className="hidden lg:block w-[380px] shrink-0">
                <div className="sticky top-4">
                  <StudioChatbot sessionId={sessionId}
                    sessionContext={{ tool: 'content', document: contentDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => handleEditApplied(edit.target, edit.new_content)} />
                </div>
              </div>
              <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
                <div className="bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '70vh' }}>
                  <StudioChatbot sessionId={sessionId}
                    sessionContext={{ tool: 'content', document: contentDoc, client: selectedClient }}
                    initialHistory={chatHistory}
                    onEditDetected={(edit: EditPayload) => handleEditApplied(edit.target, edit.new_content)} />
                </div>
              </div>
            </>
          )}

          {!chatOpen && pageState === 'document' && (
            <button onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center gap-2 px-4 py-3 bg-novax text-white text-sm font-semibold rounded-full shadow-lg hover:bg-novax-hover transition-colors">
              <Zap className="w-4 h-4" />
              Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
