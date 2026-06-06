'use client'

import { useState } from 'react'
import {
  Camera, Copy, CheckCircle, Star, RefreshCw,
  TriangleAlert, MessageSquare, Download, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { AIFeedbackButtons } from '@/components/shared/ai-feedback-buttons'
import type {
  ContentDocument,
  HookDocument,
  HookItem,
  HookTier,
  StrategyDocument,
  CampaignDocument,
  PostMortemDiagnosis,
  BossBrief,
} from '@/lib/studio-types'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StudioDocumentProps {
  tool: 'content' | 'hooks' | 'strategy' | 'campaign' | 'postmortem'
  clientName: string
  clientColor?: string
  clientId?: string
  platforms: string[]
  content:
    | ContentDocument
    | HookDocument
    | StrategyDocument
    | CampaignDocument
    | PostMortemDiagnosis
    | null
  bossBrief?: BossBrief | null
  language?: 'english' | 'arabic'
  onExportTxt?: () => void
  onExportPdf?: () => void
  onChatOpen?: () => void
  onEditApplied?: (target: string, newContent: string) => void
  isLoading?: boolean
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  S: 'bg-amber-400 text-white',
  A: 'bg-emerald-500 text-white',
  B: 'bg-blue-400 text-white',
  C: 'bg-slate-300 text-slate-600',
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0',
        TIER_BADGE[tier] ?? 'bg-slate-200 text-slate-600',
      )}
    >
      {tier}
    </span>
  )
}

function ThreeCBars({
  clarity,
  context,
  curiosity,
  inverted = false,
}: {
  clarity: number
  context: number
  curiosity: number
  inverted?: boolean
}) {
  return (
    <div className="space-y-1.5 mt-3">
      {[
        { label: 'Clarity', value: clarity },
        { label: 'Context', value: context },
        { label: 'Curiosity', value: curiosity },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <span className={cn('text-[10px] w-14 shrink-0', inverted ? 'text-white/50' : 'text-slate-400')}>
            {label}
          </span>
          <div className={cn('flex-1 h-1.5 rounded-full', inverted ? 'bg-white/20' : 'bg-slate-100')}>
            <div
              className="h-full rounded-full bg-novax-accent transition-all"
              style={{ width: `${(value / 10) * 100}%` }}
            />
          </div>
          <span className={cn('text-[10px] w-6 text-right shrink-0', inverted ? 'text-white/50' : 'text-slate-400')}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Document Header (sticky) ─────────────────────────────────────────────────

function DocumentHeader({
  clientName,
  clientColor,
  platforms,
  onExportTxt,
  onExportPdf,
  onChatOpen,
}: Pick<StudioDocumentProps, 'clientName' | 'clientColor' | 'platforms' | 'onExportTxt' | 'onExportPdf' | 'onChatOpen'>) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        {clientColor && (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: clientColor }} />
        )}
        <span className="font-semibold text-slate-900 text-sm truncate">{clientName}</span>
        <div className="flex items-center gap-1 flex-wrap">
          {platforms.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 bg-novax-light text-novax text-[10px] font-medium rounded-full px-2 py-0.5"
            >
              <PlatformIcon platform={p.toLowerCase() as Parameters<typeof PlatformIcon>[0]['platform']} size="xs" />
              {p}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onExportTxt && (
          <button
            onClick={onExportTxt}
            className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Download TXT
          </button>
        )}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export PDF
          </button>
        )}
        {onChatOpen && (
          <button
            onClick={onChatOpen}
            className="flex items-center gap-1 text-xs text-novax-muted border border-novax-border rounded-lg px-2.5 py-1.5 hover:bg-novax-light transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Chat
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Boss Brief ───────────────────────────────────────────────────────────────

function BossBriefSection({ brief }: { brief: BossBrief }) {
  return (
    <div className="bg-novax rounded-2xl overflow-hidden mt-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs tracking-[0.2em] text-novax-accent font-bold">BOSS BRIEF</span>
        <span className="text-xs text-white/50">30-second version</span>
      </div>

      {/* WHAT WE MADE */}
      <div className="px-6 py-4 border-b border-white/10">
        <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">WHAT WE MADE</p>
        <p className="text-sm text-white leading-relaxed">{brief.what_we_made}</p>
      </div>

      {/* WHY THIS WORKS */}
      <div className="px-6 py-4 border-b border-white/10">
        <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">WHY THIS WORKS</p>
        <p className="text-sm text-white leading-relaxed">{brief.why_it_works}</p>
      </div>

      {/* THE ONE THING */}
      <div className="px-6 py-4 border-b border-white/10">
        <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">THE ONE THING</p>
        <p className="text-base font-semibold text-white leading-relaxed">{brief.the_one_thing}</p>
      </div>

      {/* DO THIS NOW */}
      <div className={cn('px-6 py-4', brief.watch_out_for ? 'border-b border-white/10' : '')}>
        <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">DO THIS NOW</p>
        <p className="text-sm text-white leading-relaxed">{brief.do_this_now}</p>
      </div>

      {/* WATCH OUT FOR */}
      {brief.watch_out_for && (
        <div className="bg-amber-500/10 border-l-4 border-amber-400 px-6 py-4">
          <div className="flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] tracking-wider text-amber-300 font-bold uppercase mb-1">WATCH OUT FOR</p>
              <p className="text-sm text-amber-100 leading-relaxed">{brief.watch_out_for}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CONTENT TOOL renderer ────────────────────────────────────────────────────

function ContentToolDocument({
  doc,
  language,
}: {
  doc: ContentDocument
  language?: 'english' | 'arabic'
}) {
  const [copiedCaption, setCopiedCaption] = useState(false)
  const isArabic = language === 'arabic'

  // ContentDocument.hook is the selected hook object
  const hook = doc.hook

  function copyCaption() {
    const cap = doc.caption_preview
    if (!cap) return
    navigator.clipboard.writeText(cap).catch(() => {})
    setCopiedCaption(true)
    setTimeout(() => setCopiedCaption(false), 2000)
  }

  return (
    <div className="p-6 space-y-6">
      {/* WHAT WE BUILT */}
      <div className="bg-novax rounded-2xl p-6">
        <p className="text-[10px] tracking-[0.2em] text-novax-accent font-bold uppercase mb-2">BUILT FOR YOU</p>
        <p className="text-base text-white leading-relaxed">
          {doc.audience_intelligence?.functional_job}
        </p>
      </div>

      {/* AUDIENCE INTELLIGENCE */}
      {doc.audience_intelligence && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {doc.audience_intelligence.functional_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Functional Job</p>
              <p className="text-sm text-slate-700">{doc.audience_intelligence.functional_job}</p>
            </div>
          )}
          {doc.audience_intelligence.emotional_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Emotional Job</p>
              <p className="text-sm text-slate-700">{doc.audience_intelligence.emotional_job}</p>
            </div>
          )}
          {doc.audience_intelligence.social_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Social Job</p>
              <p className="text-sm text-slate-700">{doc.audience_intelligence.social_job}</p>
            </div>
          )}
        </div>
      )}

      {/* SELECTED HOOK — ContentDocument.hook shape */}
      {hook && (
        <div className="bg-novax-light border-2 border-novax-border rounded-2xl p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge tier={hook.tier ?? 'A'} />
            <span className="text-[10px] bg-novax-light border border-novax-border text-novax-muted rounded-full px-2 py-0.5 capitalize">
              {hook.type}
            </span>
            <span className="text-[10px] text-slate-400 font-medium ml-auto">
              {hook.score}/30
            </span>
          </div>
          <p
            className="text-xl font-semibold text-slate-900 leading-snug my-4"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {hook.text}
          </p>
          <ThreeCBars clarity={hook.clarity} context={hook.context} curiosity={hook.curiosity} />
          {hook.why_selected && (
            <p className="text-xs text-novax-muted italic mt-3">Why selected: {hook.why_selected}</p>
          )}
        </div>
      )}

      {/* SCRIPT SECTIONS */}
      {doc.script_sections && doc.script_sections.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-3">THE SCRIPT</p>
          <div className="space-y-4">
            {doc.script_sections.map((section, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-novax-border">
                <div className="bg-novax flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-bold text-white tracking-widest uppercase">
                    {section.section}
                  </span>
                  {section.duration_estimate && (
                    <span className="text-xs text-novax-accent">{section.duration_estimate}</span>
                  )}
                </div>
                <div className="bg-white px-4 py-3 space-y-1" dir={isArabic ? 'rtl' : 'ltr'}>
                  {section.lines.map((line, j) => (
                    <p
                      key={j}
                      className={cn(
                        'leading-relaxed',
                        line.startsWith('[') ? 'text-xs text-slate-400 italic' : 'text-sm text-slate-800',
                      )}
                    >
                      {line}
                    </p>
                  ))}
                  {section.visual_note && (
                    <div className="flex items-start gap-1 border-t border-slate-100 mt-3 pt-3">
                      <Camera className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-novax-muted italic" dir="ltr">{section.visual_note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B-ROLL */}
      {doc.key_broll_list && doc.key_broll_list.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">B-ROLL NEEDED</p>
          <div className="flex flex-wrap gap-2">
            {doc.key_broll_list.map((shot, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                <Camera className="w-3 h-3 text-slate-400 shrink-0" />
                {shot}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CAPTION */}
      {doc.caption_preview && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CAPTION</span>
            <button
              onClick={copyCaption}
              className="flex items-center gap-1 text-xs text-novax-muted hover:text-novax transition-colors"
            >
              {copiedCaption ? (
                <CheckCircle className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copiedCaption ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p
            className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {doc.caption_preview}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── HOOKS TOOL renderer ──────────────────────────────────────────────────────

function HooksToolDocument({
  doc,
  language,
}: {
  doc: HookDocument
  language?: 'english' | 'arabic'
}) {
  const [savedHooks,   setSavedHooks]   = useState<Set<number>>(new Set())
  const [copiedIdx,    setCopiedIdx]    = useState<number | null>(null)
  const [expandedIdx,  setExpandedIdx]  = useState<number | null>(null)
  const isArabic = language === 'arabic'

  // Normalise union hook shape to HookItem for rendering
  const hooks: HookItem[] = (doc.hooks ?? []).map((h, i) => {
    if ('tier' in h) return h as HookItem
    const raw = h as {
      hook_text: string; hook_type: string; virality_tier: string
      clarity_score: number; context_score: number; curiosity_score: number
      total_score: number; format_rec?: string
      headline?: string; body?: string; cta?: string
    }
    return {
      rank:      i + 1,
      hook_text: raw.hook_text,
      hook_type: raw.hook_type,
      format:    raw.format_rec ?? 'vocal',
      tier:      raw.virality_tier as HookTier,
      total_score: raw.total_score,
      clarity:   raw.clarity_score,
      context:   raw.context_score,
      curiosity: raw.curiosity_score,
      headline:  raw.headline,
      body:      raw.body,
      cta:       raw.cta,
    } satisfies HookItem
  })
  const bestHook = hooks.find(h => h.tier === 'S') ?? hooks[0]

  const tierCounts = { S: 0, A: 0, B: 0, C: 0 }
  for (const h of hooks) {
    if (h.tier in tierCounts) tierCounts[h.tier as keyof typeof tierCounts]++
  }

  function toggleSave(idx: number) {
    setSavedHooks(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function copyHook(hook: HookItem, idx: number) {
    const parts = [hook.hook_text]
    if (hook.headline) parts.push(`\n${hook.headline}`)
    if (hook.body)     parts.push(hook.body)
    if (hook.cta)      parts.push(`\nCTA: ${hook.cta}`)
    navigator.clipboard.writeText(parts.join('\n')).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  function toggleExpand(idx: number) {
    setExpandedIdx(prev => (prev === idx ? null : idx))
  }

  return (
    <div className="p-6 space-y-5">
      {/* Summary bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-slate-700 font-medium">{hooks.length} hooks generated</span>
        <div className="flex items-center gap-2">
          {Object.entries(tierCounts).map(([tier, count]) =>
            count > 0 ? (
              <span
                key={tier}
                className={cn(
                  'text-[11px] font-bold rounded-md px-1.5 py-0.5',
                  TIER_BADGE[tier] ?? 'bg-slate-200 text-slate-600',
                )}
              >
                {tier}·{count}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Featured best hook — shows everything */}
      {bestHook && (
        <div className="bg-novax text-white rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <p className="text-[10px] tracking-widest text-novax-accent font-bold uppercase mb-1">BEST HOOK</p>
            <p className="text-xl font-semibold leading-snug mt-3" dir={isArabic ? 'rtl' : 'ltr'}>
              {bestHook.hook_text}
            </p>
            <ThreeCBars clarity={bestHook.clarity} context={bestHook.context} curiosity={bestHook.curiosity} inverted />
          </div>
          {(bestHook.headline || bestHook.body || bestHook.cta) && (
            <div className="border-t border-white/10 px-6 py-4 space-y-3">
              {bestHook.headline && (
                <div>
                  <p className="text-[10px] tracking-widest text-novax-accent font-bold uppercase mb-1">HEADLINE</p>
                  <p className="text-base font-bold text-white leading-snug" dir={isArabic ? 'rtl' : 'ltr'}>{bestHook.headline}</p>
                </div>
              )}
              {bestHook.body && (
                <div>
                  <p className="text-[10px] tracking-widest text-novax-accent font-bold uppercase mb-1">BODY</p>
                  <p className="text-sm text-white/85 leading-relaxed" dir={isArabic ? 'rtl' : 'ltr'}>{bestHook.body}</p>
                </div>
              )}
              {bestHook.cta && (
                <div className="bg-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-novax-accent" dir={isArabic ? 'rtl' : 'ltr'}>{bestHook.cta}</p>
                  <span className="text-[10px] text-white/40 shrink-0 uppercase tracking-wider">CTA</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hook list */}
      <div className="space-y-2">
        {hooks.map((hook, i) => {
          const isSaved    = savedHooks.has(i)
          const isCopied   = copiedIdx === i
          const isExpanded = expandedIdx === i
          const hasContent = hook.headline || hook.body || hook.cta
          return (
            <div
              key={i}
              className={cn(
                'rounded-xl border transition-all',
                isSaved ? 'border-novax-border bg-novax-light/30' : 'border-slate-200 bg-white',
              )}
            >
              {/* Main row */}
              <div className="flex items-start gap-3 p-4">
                {/* Rank + tier */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-[11px] text-slate-400">#{i + 1}</span>
                  <TierBadge tier={hook.tier ?? 'B'} />
                </div>

                {/* Hook text + meta */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-slate-900 leading-snug mb-1.5"
                    dir={isArabic ? 'rtl' : 'ltr'}
                  >
                    {hook.hook_text}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 capitalize">
                      {hook.hook_type}
                    </span>
                    <span className="text-[10px] text-slate-400">{hook.total_score}/30</span>
                    {hasContent && (
                      <button
                        onClick={() => toggleExpand(i)}
                        className="text-[10px] text-novax-muted hover:text-novax font-medium transition-colors"
                      >
                        {isExpanded ? 'Hide content' : 'Headline + Body + CTA'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleSave(i)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      isSaved
                        ? 'text-novax bg-novax-light'
                        : 'text-slate-400 hover:text-novax hover:bg-novax-light',
                    )}
                    title="Save hook"
                  >
                    <Star className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => copyHook(hook, i)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Copy hook + content"
                  >
                    {isCopied ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded content block */}
              {isExpanded && hasContent && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3" dir={isArabic ? 'rtl' : 'ltr'}>
                  {hook.headline && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Headline</p>
                      <p className="text-sm font-semibold text-slate-900">{hook.headline}</p>
                    </div>
                  )}
                  {hook.body && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Body</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{hook.body}</p>
                    </div>
                  )}
                  {hook.cta && (
                    <div className="bg-novax-light border border-novax-border rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-novax">{hook.cta}</p>
                      <span className="text-[10px] text-novax-muted shrink-0 uppercase tracking-wider">CTA</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── STRATEGY TOOL renderer ───────────────────────────────────────────────────

function StrategyToolDocument({ doc }: { doc: StrategyDocument }) {
  return (
    <div className="p-6 space-y-6">
      {doc.executive_summary && (
        <div className="bg-novax rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] text-novax-accent font-bold uppercase mb-2">BUILT FOR YOU</p>
          <p className="text-base text-white leading-relaxed">{doc.executive_summary}</p>
        </div>
      )}

      {doc.phases?.map((phase, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Phase header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-4">
            <span className="text-3xl font-black text-slate-100 leading-none">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-800">{phase.name}</p>
              {phase.diamond_position && (
                <p className="text-xs text-slate-400 mt-0.5">{phase.diamond_position}</p>
              )}
            </div>
          </div>

          {/* Key insight */}
          {phase.key_insight && (
            <div className="bg-novax-light border-l-4 border-novax-border rounded-r-xl p-4 mx-6 my-4">
              <p className="text-[10px] tracking-wider text-novax-muted font-bold uppercase mb-1">THE INSIGHT</p>
              <p className="text-sm font-medium text-novax">{phase.key_insight}</p>
            </div>
          )}

          {/* Content items — phase.content is Record<string, unknown>, render as bullets */}
          {phase.content && (
            <ul className="px-6 pb-5 space-y-1.5">
              {Object.values(phase.content).flatMap((v, j) => {
                const items = Array.isArray(v) ? v as string[] : [String(v)]
                return items.map((item, k) => (
                  <li key={`${j}-${k}`} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-novax-accent mt-0.5 shrink-0">·</span>
                    {item}
                  </li>
                ))
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── CAMPAIGN TOOL renderer ───────────────────────────────────────────────────

function CampaignToolDocument({ doc }: { doc: CampaignDocument }) {
  const BUDGET_BADGE: Record<string, string> = {
    Low: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    High: 'bg-red-100 text-red-700',
  }

  // CampaignDocument uses cultural_tensions (array), inverted_rules (array), creative_domains
  const tensions = doc.cultural_tensions ?? []
  const rules = doc.inverted_rules ?? []

  return (
    <div className="p-6 space-y-6">
      {/* WHAT WE FOUND */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-amber-600 mb-1">Cultural Tensions</p>
          <p className="text-2xl font-black text-amber-700">{tensions.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-red-600 mb-1">Industry Rules Broken</p>
          <p className="text-2xl font-black text-red-700">{rules.length}</p>
        </div>
        {doc.creative_domains && doc.creative_domains.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Creative Domains</p>
            <div className="flex flex-wrap gap-1">
              {doc.creative_domains.map((d, i) => (
                <span key={i} className="text-[10px] bg-novax-light text-novax rounded-full px-2 py-0.5">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TENSION CALLOUT CARDS (top 3) */}
      {tensions.slice(0, 3).map((t, i) => (
        <div key={i} className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
          <p className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-1">CULTURAL TENSION</p>
          <p className="text-sm font-medium text-amber-900 mb-1">{t.tension}</p>
          {t.evidence && <p className="text-xs text-amber-700">{t.evidence}</p>}
        </div>
      ))}

      {/* CAMPAIGN CONCEPT CARDS */}
      {doc.concepts?.map((concept, i) => (
        <div key={i} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
          {/* Concept header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">CONCEPT {i + 1}</span>
              <span className="text-sm font-bold text-slate-800">{concept.campaign_name}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {concept.scoring?.boldness !== undefined && (
                <span className="bg-novax text-white rounded-lg px-2 py-1 text-xs font-bold">
                  Bold {concept.scoring.boldness}
                </span>
              )}
              {concept.scoring?.implementability !== undefined && (
                <span className="bg-emerald-100 text-emerald-700 rounded-lg px-2 py-1 text-xs font-bold">
                  Easy {concept.scoring.implementability}
                </span>
              )}
              {concept.scoring?.virality !== undefined && (
                <span className="bg-violet-100 text-violet-700 rounded-lg px-2 py-1 text-xs font-bold">
                  Viral {concept.scoring.virality}
                </span>
              )}
            </div>
          </div>

          {/* Tagline */}
          <div className="px-6 py-4">
            <p className="text-lg font-semibold text-slate-900 italic">{concept.tagline}</p>
          </div>

          {/* WHY IT WORKS */}
          {concept.why_it_works && (
            <div className="bg-novax-light border border-novax-border rounded-xl mx-6 p-4 my-2">
              <p className="text-[10px] tracking-wider text-novax-muted font-bold uppercase mb-1">WHY IT WORKS</p>
              <p className="text-sm text-novax">{concept.why_it_works}</p>
            </div>
          )}

          {/* EXECUTION STEPS */}
          {concept.execution_steps && concept.execution_steps.length > 0 && (
            <div className="px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Execution Steps</p>
              <div className="space-y-2">
                {concept.execution_steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <span className="text-lg font-black text-novax leading-none mt-0.5 shrink-0 w-5">{j + 1}</span>
                    <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PARTICIPATION MECHANIC */}
          {concept.participation_mechanic && (
            <div className="bg-slate-900 rounded-xl mx-6 p-4 my-2">
              <p className="text-[10px] tracking-wider text-slate-400 font-bold uppercase mb-2">
                HOW THE AUDIENCE BECOMES THE CAMPAIGN
              </p>
              <p className="text-sm text-white font-medium">{concept.participation_mechanic}</p>
            </div>
          )}

          {/* THE SHAREABLE MOMENT */}
          {concept.shareable_moment && (
            <div className="bg-novax rounded-xl mx-6 p-4 my-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Camera className="w-3.5 h-3.5 text-novax-accent" />
                <span className="text-[10px] tracking-wider text-novax-accent font-bold uppercase">
                  THE SHAREABLE MOMENT
                </span>
              </div>
              <p className="text-sm text-novax-accent">{concept.shareable_moment}</p>
            </div>
          )}

          {/* Card footer */}
          <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-xs font-medium rounded-full px-2.5 py-1',
                BUDGET_BADGE[concept.budget] ?? 'bg-slate-100 text-slate-600',
              )}
            >
              {concept.budget} budget
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
              {concept.timeline}
            </span>
            {concept.risk && (
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-1">
                Risk: {concept.risk}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── POST-MORTEM TOOL renderer ────────────────────────────────────────────────

function PostMortemToolDocument({ doc }: { doc: PostMortemDiagnosis }) {
  const STATUS_STYLES = {
    likely_cause: { wrapper: 'bg-red-50 border border-red-200', label: 'text-red-700', labelText: 'LIKELY CAUSE' },
    contributing: { wrapper: 'bg-amber-50 border border-amber-200', label: 'text-amber-700', labelText: 'CONTRIBUTING FACTOR' },
    not_issue: { wrapper: 'bg-emerald-50 border border-emerald-200', label: 'text-emerald-700', labelText: 'NOT THE ISSUE' },
  }

  const erDelta = doc.vs_client_avg ?? 0
  const erPositive = erDelta >= 0

  // PostMortemDiagnosis.analyses has hook/format/timing/caption
  const diagnostics = doc.analyses
    ? [
        { area: 'Hook', data: doc.analyses.hook },
        { area: 'Format', data: doc.analyses.format },
        { area: 'Timing', data: doc.analyses.timing },
        { area: 'Caption', data: doc.analyses.caption },
      ]
    : []

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h2 className="text-base font-semibold text-slate-900">{doc.session_name}</h2>
          {doc.platform && (
            <span className="bg-novax-light text-novax text-[10px] rounded-full px-2 py-0.5">
              {doc.platform}
            </span>
          )}
          {doc.published_at && (
            <span className="text-xs text-slate-400">Posted {doc.published_at}</span>
          )}
        </div>
        {doc.engagement_rate !== undefined && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700">ER {doc.engagement_rate}%</span>
            {doc.vs_client_avg !== undefined && (
              <span className={cn('text-xs font-medium', erPositive ? 'text-emerald-600' : 'text-red-600')}>
                {erPositive ? '+' : ''}{erDelta}% vs client avg
              </span>
            )}
          </div>
        )}
      </div>

      {/* Diagnostic rows */}
      {diagnostics.map(({ area, data }) => {
        if (!data) return null
        const style = STATUS_STYLES[data.verdict] ?? STATUS_STYLES.contributing
        return (
          <div key={area} className={cn('rounded-xl p-4', style.wrapper)}>
            <div className="flex items-start gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{area}</span>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', style.label)}>
                {style.labelText}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{data.finding}</p>
            {data.fix && (
              <p className="text-sm text-novax-muted italic mt-1">Fix: {data.fix}</p>
            )}
          </div>
        )
      })}

      {/* Verdict */}
      {doc.verdict && (
        <div className="bg-novax rounded-2xl p-6">
          <p className="text-[10px] tracking-[0.2em] text-novax-accent font-bold uppercase mb-2">VERDICT</p>
          <p className="text-sm text-white leading-relaxed">{doc.verdict}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main StudioDocument ──────────────────────────────────────────────────────

export function StudioDocument({
  tool,
  clientName,
  clientColor,
  clientId,
  platforms,
  content,
  bossBrief,
  language,
  onExportTxt,
  onExportPdf,
  onChatOpen,
  isLoading = false,
}: StudioDocumentProps) {
  if (isLoading || !content) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
        <div className="h-14 bg-slate-100 border-b border-slate-200" />
        <div className="p-6 space-y-4">
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-48 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div id="printable-studio" className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <DocumentHeader
        clientName={clientName}
        clientColor={clientColor}
        platforms={platforms}
        onExportTxt={onExportTxt}
        onExportPdf={onExportPdf}
        onChatOpen={onChatOpen}
      />

      {tool === 'content' && (
        <ContentToolDocument doc={content as ContentDocument} language={language} />
      )}
      {tool === 'hooks' && (
        <HooksToolDocument doc={content as HookDocument} language={language} />
      )}
      {tool === 'strategy' && (
        <StrategyToolDocument doc={content as StrategyDocument} />
      )}
      {tool === 'campaign' && (
        <CampaignToolDocument doc={content as CampaignDocument} />
      )}
      {tool === 'postmortem' && (
        <PostMortemToolDocument doc={content as PostMortemDiagnosis} />
      )}

      {bossBrief && (
        <div className="px-6 pb-6">
          <BossBriefSection brief={bossBrief} />
        </div>
      )}

      {clientId && content && (
        <div className="px-6 pb-4 border-t border-slate-100 pt-3">
          <AIFeedbackButtons
            clientId={clientId}
            agentType={`studio_${tool}`}
            contentSnapshot={JSON.stringify(content).slice(0, 500)}
          />
        </div>
      )}
    </div>
  )
}
