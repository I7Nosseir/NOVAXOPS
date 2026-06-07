'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Zap, ArrowLeft, PlusCircle,
  AlertTriangle, RefreshCw,
  Film, LayoutGrid, Image, Sheet,
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

      // Step 4: Generate 20 hooks
      startStep(3)
      const boldnessPrefix = emotionalTrigger
        ? `CONSTRAINT: Primary emotional trigger = ${emotionalTrigger}. Every hook must activate this emotion as a hard constraint.\n\n`
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
  }

  function handleEditApplied(target: string, newContent: string) {
    if (!contentDoc) return
    const updated: ContentDocument = { ...contentDoc }
    if (target === 'caption') updated.caption = newContent
    setContentDoc(updated)
  }

  function handleExportTxt() {
    if (!contentDoc) return
    const lines: string[] = [
      `CONTENT STUDIO — ${selectedClient?.name ?? 'Client'}`,
      `Type: ${contentDoc.content_type ?? 'reel'} | Platforms: ${inputs.platforms.join(', ')} | Goal: ${inputs.goal} | Language: ${inputs.language}`,
      `Brief: ${inputs.brief}`,
      '',
    ]
    const pieces = contentDoc.pieces ?? [{
      hook: contentDoc.hook, script_sections: contentDoc.script_sections,
      key_broll_list: contentDoc.key_broll_list, caption_preview: contentDoc.caption_preview,
    }]
    pieces.forEach((piece, idx) => {
      if (pieces.length > 1) lines.push(`\n═══ PIECE ${idx + 1} ═══`)
      if (piece.hook) {
        lines.push(`\nHOOK [${piece.hook.tier}] ${piece.hook.score}/30`)
        lines.push(piece.hook.text)
      }
      const pAny = piece as ContentPiece & { slides?: { title: string; body: string }[]; visual_direction?: string; text_overlay?: string }
      if (pAny.slides?.length) {
        lines.push('\nSLIDES:')
        pAny.slides.forEach((s, i) => lines.push(`  ${i + 1}. ${s.title}\n     ${s.body}`))
      } else if (pAny.visual_direction) {
        lines.push(`\nVISUAL DIRECTION:\n  ${pAny.visual_direction}`)
        if (pAny.text_overlay) lines.push(`TEXT OVERLAY: ${pAny.text_overlay}`)
      } else if (piece.script_sections?.length) {
        lines.push(`\nSCRIPT (${(piece as ContentPiece).total_duration ?? ''})`)
        lines.push('─'.repeat(50))
        for (const s of piece.script_sections) {
          lines.push(`\n[${s.section}] — ${s.duration_estimate}`)
          for (const l of s.lines) lines.push(`  ${l}`)
          if (s.visual_note) lines.push(`  Visual: ${s.visual_note}`)
        }
      }
      if (piece.caption_preview) { lines.push('\nCAPTION:'); lines.push(piece.caption_preview) }
      if (piece.key_broll_list?.length) {
        lines.push('\nB-ROLL / ASSETS NEEDED:')
        for (const b of piece.key_broll_list) lines.push(`  - ${b}`)
      }
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `novax-content-${Date.now()}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportExcel() {
    if (!contentDoc) return

    const clientName = selectedClient?.name ?? 'Client'
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const pieces = contentDoc.pieces ?? [{
      type: contentDoc.content_type ?? 'reel',
      index: 0,
      hook: contentDoc.hook,
      script_sections: contentDoc.script_sections ?? [],
      key_broll_list: contentDoc.key_broll_list ?? [],
      caption_preview: contentDoc.caption_preview ?? '',
    } as ContentPiece]

    // ── Build one row per piece ──────────────────────────────────
    const rows = pieces.map((piece, idx) => {
      const pAny = piece as ContentPiece & {
        slides?: { title: string; body: string; visual_note?: string }[]
        visual_direction?: string
        text_overlay?: string
      }
      const hook = piece.hook
      const contentType = (piece.type ?? contentDoc.content_type ?? 'reel')
        .charAt(0).toUpperCase() + (piece.type ?? contentDoc.content_type ?? 'reel').slice(1)

      // Script / content body column
      let scriptColumn = ''
      if (pAny.slides?.length) {
        scriptColumn = pAny.slides
          .map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.body}`)
          .join('\n\n')
      } else if (pAny.visual_direction) {
        scriptColumn = `Visual Direction:\n${pAny.visual_direction}`
        if (pAny.text_overlay) scriptColumn += `\n\nText Overlay: ${pAny.text_overlay}`
      } else if (piece.script_sections?.length) {
        scriptColumn = piece.script_sections
          .map(s => `[${s.section}] (${s.duration_estimate})\n${s.lines.join('\n')}`)
          .join('\n\n')
      }

      // Design guidelines / image description column
      let designColumn = ''
      if (pAny.visual_direction) {
        designColumn = pAny.visual_direction
      } else if (piece.key_broll_list?.length) {
        designColumn = `B-Roll / Assets:\n${piece.key_broll_list.map(b => `• ${b}`).join('\n')}`
      }
      if (piece.production_difficulty) {
        designColumn += designColumn ? `\n\nProduction: ${piece.production_difficulty}` : `Production: ${piece.production_difficulty}`
      }

      return {
        'Date':                    today,
        'Client':                  clientName,
        'Platform':                inputs.platforms.join(', '),
        'Goal':                    inputs.goal,
        'Content Type':            contentType,
        'Piece #':                 pieces.length > 1 ? idx + 1 : 1,
        'Hook':                    hook?.text ?? '',
        'Hook Tier':               hook ? `${hook.tier} (${hook.score}/30)` : '',
        'Hook Type':               hook?.type ?? '',
        'TOV / Brand Voice':       selectedClient?.brand_identity?.tone_of_voice ?? '',
        'Script / Slides / Visual': scriptColumn,
        'Caption':                 piece.caption_preview ?? '',
        'Design Guidelines / Image Description': designColumn,
        'Brand Compliance Notes':  piece.brand_compliance_notes ?? '',
        'Brief':                   inputs.brief,
        'Language':                inputs.language,
      }
    })

    // ── Build workbook ───────────────────────────────────────────
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 16 }, // Client
      { wch: 16 }, // Platform
      { wch: 14 }, // Goal
      { wch: 14 }, // Content Type
      { wch: 8  }, // Piece #
      { wch: 50 }, // Hook
      { wch: 12 }, // Hook Tier
      { wch: 18 }, // Hook Type
      { wch: 20 }, // TOV
      { wch: 60 }, // Script
      { wch: 50 }, // Caption
      { wch: 50 }, // Design
      { wch: 30 }, // Compliance
      { wch: 40 }, // Brief
      { wch: 10 }, // Language
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Content Plan')

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

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Brief</label>
              <textarea value={inputs.brief} onChange={e => setInputs(v => ({ ...v, brief: e.target.value }))}
                placeholder="Describe the content in 2-4 sentences. What is the topic, the key message, what should the audience feel or do after watching?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none" />
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
              onExportTxt={handleExportTxt}
              onExportPdf={() => window.print()}
              onChatOpen={() => setChatOpen(true)}
              onEditApplied={handleEditApplied}
            />
            {/* Excel content plan export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-novax-muted border border-novax-border rounded-xl hover:bg-novax-light transition-colors w-full justify-center"
            >
              <Sheet className="w-3.5 h-3.5" />
              Export as Content Plan (.xlsx)
            </button>
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
