'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Zap, ArrowLeft, ArrowRight, Loader2, CheckCircle,
  RefreshCw, ChevronDown, ChevronUp, Wand2, FileText,
  Star, Sparkles, Copy,
} from 'lucide-react'
import Link from 'next/link'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import type { GeneratedHook } from '@/app/api/studio/hooks/generate/route'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Phase1 {
  client_id: string
  platform: string
  audience: string
  goal: string
  emotion: string
  cta: string
  brief: string
}

interface ResearchData {
  audience_psychology: Record<string, unknown> | null
  trend_intelligence: Record<string, unknown> | null
  performance_context: Record<string, unknown> | null
}

interface ScriptSection {
  section: string
  lines: string[]
  visual_note: string
  duration_estimate: string
}

interface ScriptData {
  script_sections: ScriptSection[]
  total_duration: string
  brand_compliance_notes: string
  production_difficulty: string
  key_broll_list: string[]
  caption_preview: string
}

type Phase = 'define' | 'research' | 'hooks' | 'script' | 'done'

// ── Constants ──────────────────────────────────────────────────────────────────
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'X (Twitter)']
const AUDIENCES = ['B2C', 'B2B']
const GOALS     = ['Virality', 'Authority', 'Engagement', 'Leads', 'Sales', 'Community']
const EMOTIONS  = ['Inspire', 'Educate', 'Entertain', 'Challenge', 'Reassure', 'Shock']

const PHASES: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'define',   label: 'Define',    icon: FileText },
  { key: 'research', label: 'Research',  icon: Sparkles },
  { key: 'hooks',    label: 'Hooks',     icon: Wand2 },
  { key: 'script',   label: 'Script',    icon: Zap },
]

const TIER_CONFIG = {
  S: 'bg-amber-400 text-white',
  A: 'bg-emerald-500 text-white',
  B: 'bg-blue-400 text-white',
  C: 'bg-slate-300 text-slate-600',
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ResearchCard({ title, data, icon: Icon }: { title: string; data: Record<string, unknown> | null; icon: React.ElementType }) {
  const [open, setOpen] = useState(true)
  if (!data) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-novax-muted" />
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {key.replace(/_/g, ' ')}
              </p>
              {Array.isArray(value) ? (
                <ul className="space-y-0.5">
                  {(value as string[]).map((item, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                      <span className="text-novax-accent mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-700">{String(value)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const { clients } = useClients()
  const { user }    = useAuth()

  const [phase,    setPhase]    = useState<Phase>('define')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Phase data
  const [p1, setP1] = useState<Phase1>({
    client_id: params?.get('client') ?? '',
    platform:  params?.get('platform') ?? 'Instagram',
    audience:  'B2C',
    goal:      'Engagement',
    emotion:   'Inspire',
    cta:       '',
    brief:     params?.get('brief') ?? '',
  })
  const [research,       setResearch]       = useState<ResearchData | null>(null)
  const [hooks,          setHooks]          = useState<GeneratedHook[]>([])
  const [selectedHook,   setSelectedHook]   = useState<GeneratedHook | null>(null)
  const [script,         setScript]         = useState<ScriptData | null>(null)
  const [copiedCaption,  setCopiedCaption]  = useState(false)

  const selectedClient = clients.find(c => c.id === p1.client_id)

  // ── Phase transitions ────────────────────────────────────────────────────────
  const runResearch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/content/new/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p1,
          brand_voice:   selectedClient?.brand_identity?.tone_of_voice,
          industry:      selectedClient?.brand_identity?.industry,
          key_messages:  selectedClient?.brand_identity?.key_messages,
          client_name:   selectedClient?.name,
        }),
      })
      const data = await res.json() as ResearchData
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Research failed')
      setResearch(data)
      setPhase('research')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research failed')
    } finally {
      setLoading(false)
    }
  }, [p1, selectedClient])

  const runHooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:       p1.brief,
          platform:    p1.platform,
          audience:    p1.audience,
          goal:        p1.goal,
          emotion:     p1.emotion,
          brand_voice: selectedClient?.brand_identity?.tone_of_voice,
        }),
      })
      const data = await res.json() as { hooks: GeneratedHook[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Hook generation failed')
      setHooks(data.hooks ?? [])
      setPhase('hooks')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hook generation failed')
    } finally {
      setLoading(false)
    }
  }, [p1, selectedClient])

  const runScript = useCallback(async () => {
    if (!selectedHook) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/content/new/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p1,
          hook:                selectedHook.hook_text,
          hook_type:           selectedHook.hook_type,
          audience_psychology: research?.audience_psychology,
          trend_intelligence:  research?.trend_intelligence,
          brand_voice:         selectedClient?.brand_identity?.tone_of_voice,
          key_messages:        selectedClient?.brand_identity?.key_messages,
          client_name:         selectedClient?.name,
        }),
      })
      const data = await res.json() as { script: ScriptData; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Script generation failed')
      setScript(data.script)
      setPhase('script')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Script generation failed')
    } finally {
      setLoading(false)
    }
  }, [p1, selectedHook, research, selectedClient])

  // ── Render ───────────────────────────────────────────────────────────────────
  const phaseIdx = PHASES.findIndex(p => p.key === phase)

  return (
    <div className="max-w-4xl">
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
          <p className="text-xs text-slate-500">Define · Research · Hooks · Script</p>
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-0 mb-8 bg-slate-50 border border-slate-200 rounded-xl p-1 overflow-x-auto">
        {PHASES.map((p, i) => {
          const done    = i < phaseIdx
          const current = i === phaseIdx
          return (
            <div key={p.key} className="flex items-center flex-1 min-w-0">
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg flex-1 transition-all',
                current ? 'bg-white shadow-sm text-slate-900'
                  : done ? 'text-novax-muted'
                  : 'text-slate-400',
              )}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <p.icon className={cn('w-3.5 h-3.5 shrink-0', current ? 'text-novax-accent' : '')} />
                }
                <span className="text-xs font-semibold truncate">{p.label}</span>
              </div>
              {i < PHASES.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Phase 1: Define ── */}
      {phase === 'define' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select
                value={p1.client_id}
                onChange={e => setP1(v => ({ ...v, client_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                <option value="">No specific client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setP1(v => ({ ...v, platform: p }))}
                    className={cn('px-2.5 py-1 text-xs rounded-lg font-medium border transition-all',
                      p1.platform === p ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                  >{p}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Audience */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audience</label>
                <div className="flex gap-1.5">
                  {AUDIENCES.map(a => (
                    <button key={a} onClick={() => setP1(v => ({ ...v, audience: a }))}
                      className={cn('flex-1 py-1.5 text-xs rounded-lg font-medium border transition-all',
                        p1.audience === a ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                    >{a}</button>
                  ))}
                </div>
              </div>
              {/* Goal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Goal</label>
                <select value={p1.goal} onChange={e => setP1(v => ({ ...v, goal: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                  {GOALS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              {/* Emotion */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Desired Emotion</label>
                <select value={p1.emotion} onChange={e => setP1(v => ({ ...v, emotion: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700">
                  {EMOTIONS.map(em => <option key={em}>{em}</option>)}
                </select>
              </div>
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">CTA Goal</label>
              <input
                value={p1.cta}
                onChange={e => setP1(v => ({ ...v, cta: e.target.value }))}
                placeholder="e.g. Get them to visit the website, book a consultation, save the post..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
              />
            </div>

            {/* Brief */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Content Brief</label>
              <textarea
                value={p1.brief}
                onChange={e => setP1(v => ({ ...v, brief: e.target.value }))}
                placeholder="Describe the content in 2–4 sentences. What's the topic, the key message, what should the audience feel or do after watching/reading this?"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={runResearch}
            disabled={!p1.brief.trim() || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Running AI Research…' : 'Start AI Research'}
          </button>
        </div>
      )}

      {/* ── Phase 2: Research ── */}
      {phase === 'research' && research && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <ResearchCard title="Audience Psychology" data={research.audience_psychology} icon={Sparkles} />
            <ResearchCard title="Trend Intelligence" data={research.trend_intelligence} icon={Zap} />
            <ResearchCard title="Performance Context" data={research.performance_context} icon={CheckCircle} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPhase('define')}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Back
            </button>
            <button
              onClick={runHooks}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {loading ? 'Generating Hooks…' : 'Generate Hooks'}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 3: Hooks ── */}
      {phase === 'hooks' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{hooks.length}</span> hooks generated — select one to write the script
            </p>
            <button
              onClick={runHooks}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              Regenerate
            </button>
          </div>

          <div className="space-y-2">
            {hooks.map((hook, i) => {
              const tier = TIER_CONFIG[hook.virality_tier] ?? 'bg-slate-300 text-slate-600'
              const selected = selectedHook?.hook_text === hook.hook_text
              return (
                <button
                  key={i}
                  onClick={() => setSelectedHook(selected ? null : hook)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border-2 transition-all',
                    selected
                      ? 'border-novax bg-novax-light shadow-sm'
                      : 'border-slate-200 bg-white hover:border-novax-border hover:bg-novax-light/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', tier)}>
                      {hook.virality_tier}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 leading-snug mb-1">{hook.hook_text}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded capitalize">{hook.hook_type}</span>
                        <span className="text-[10px] text-slate-400">{hook.total_score}/30</span>
                      </div>
                    </div>
                    {selected && <CheckCircle className="w-4 h-4 text-novax shrink-0 mt-0.5" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPhase('research')}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Back
            </button>
            <button
              onClick={runScript}
              disabled={!selectedHook || loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {loading ? 'Writing Script…' : 'Write Script'}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 4: Script ── */}
      {phase === 'script' && script && (
        <div className="space-y-5">
          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-novax-light border border-novax-border rounded-xl">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Duration:</span>
              <span className="text-xs font-semibold text-slate-800">{script.total_duration}</span>
            </div>
            <div className="w-px h-3 bg-novax-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Production:</span>
              <span className="text-xs font-semibold text-slate-800">{script.production_difficulty}</span>
            </div>
            {script.brand_compliance_notes && (
              <>
                <div className="w-px h-3 bg-novax-border" />
                <p className="text-xs text-novax-muted italic">{script.brand_compliance_notes}</p>
              </>
            )}
          </div>

          {/* Script sections */}
          <div className="space-y-3">
            {script.script_sections.map((section, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-novax uppercase tracking-wider">{section.section}</span>
                    <span className="text-[10px] text-slate-400">{section.duration_estimate}</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {section.lines.map((line, j) => (
                    <p key={j} className={cn('text-sm leading-relaxed',
                      line.startsWith('[') ? 'text-slate-400 italic text-xs' : 'text-slate-800')}
                    >{line}</p>
                  ))}
                  {section.visual_note && (
                    <p className="text-xs text-novax-muted mt-2 pt-2 border-t border-slate-100 italic">
                      {section.visual_note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* B-roll list */}
          {script.key_broll_list?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">Key B-Roll Shots</p>
              <ul className="space-y-1">
                {script.key_broll_list.map((shot, i) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                    <span className="text-novax-accent shrink-0">·</span>{shot}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Caption preview + actions */}
          <div className="flex gap-3">
            <button onClick={() => setPhase('hooks')}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Back
            </button>
            <button
              onClick={() => {
                if (script.caption_preview) {
                  navigator.clipboard.writeText(script.caption_preview).catch(() => {})
                  setCopiedCaption(true)
                  setTimeout(() => setCopiedCaption(false), 2000)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {copiedCaption ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCaption ? 'Copied!' : 'Copy Caption'}
            </button>
            <Link
              href={`/publishing?brief=${encodeURIComponent(script.caption_preview ?? '')}&client=${p1.client_id}`}
              className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Schedule Post
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
