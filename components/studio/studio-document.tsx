'use client'

import { useState } from 'react'
import {
  Camera, Copy, CheckCircle, Star,
  TriangleAlert, MessageSquare, Download, FileText, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { AIFeedbackButtons } from '@/components/shared/ai-feedback-buttons'
import type {
  ContentDocument,
  ContentPiece,
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

// ─── Platform normalizer ──────────────────────────────────────────────────────
// Maps any display name (e.g. "X (Twitter)", "Snapchat") to a SocialPlatform key.
// Returns null for unsupported platforms so PlatformIcon is skipped safely.
type KnownPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'twitter' | 'youtube' | 'pinterest'
function toPlatformKey(name: string): KnownPlatform | null {
  const lower = name.toLowerCase().trim()
  if (lower === 'instagram') return 'instagram'
  if (lower === 'facebook') return 'facebook'
  if (lower === 'linkedin') return 'linkedin'
  if (lower === 'tiktok') return 'tiktok'
  if (lower === 'youtube') return 'youtube'
  if (lower === 'pinterest') return 'pinterest'
  if (lower === 'twitter' || lower.includes('twitter') || lower === 'x') return 'twitter'
  return null
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
          {platforms.map(p => {
            const key = toPlatformKey(p)
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 bg-novax-light text-novax text-[10px] font-medium rounded-full px-2 py-0.5"
              >
                {key && <PlatformIcon platform={key} size="xs" />}
                {p}
              </span>
            )
          })}
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
            onClick={() => {
              const el = document.getElementById('printable-studio')
              if (!el) { onExportPdf(); return }
              const win = window.open('', '_blank', 'width=900,height=700')
              if (!win) { onExportPdf(); return }
              const styles = Array.from(
                document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
              ).map(s => s.outerHTML).join('\n')
              win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:0;padding:0;background:#fff;font-family:system-ui,sans-serif}
  button,[data-print-hide]{display:none!important}
  @page{size:A4 portrait;margin:12mm 16mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
${styles}
</head><body>${el.outerHTML}</body></html>`)
              win.document.close()
              win.focus()
              setTimeout(() => { win.print(); win.close() }, 600)
            }}
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

// ─── CONTENT TOOL — single piece expandable card ─────────────────────────────

function ContentPieceCard({
  piece,
  index,
  total,
  language,
  defaultOpen,
}: {
  piece: ContentPiece
  index: number
  total: number
  language?: 'english' | 'arabic'
  defaultOpen?: boolean
}) {
  const [expanded, setExpanded]   = useState(defaultOpen ?? false)
  const [copied,   setCopied]     = useState(false)
  const isArabic = language === 'arabic'
  const hook = piece.hook
  const slides = (piece as ContentPiece & { slides?: { title: string; body: string; visual_note?: string }[] }).slides
  const visualDirection = (piece as ContentPiece & { visual_direction?: string }).visual_direction
  const textOverlay     = (piece as ContentPiece & { text_overlay?: string }).text_overlay

  const typeLabel =
    piece.type === 'carousel' ? `${slides?.length ?? 0} slides` :
    piece.type === 'static'   ? 'static post' :
    piece.total_duration ?? 'reel'

  function copyCaption() {
    if (!piece.caption_preview) return
    navigator.clipboard.writeText(piece.caption_preview).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('rounded-2xl border overflow-hidden transition-all', expanded ? 'border-novax-border' : 'border-slate-200 bg-white')}>
      {/* ── Collapsed header — always visible ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-slate-50 transition-colors group"
      >
        {/* Index + Tier */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {total > 1 && (
            <span className="text-[10px] text-slate-400 font-medium w-4 text-center">#{index + 1}</span>
          )}
          {hook && <TierBadge tier={hook.tier ?? 'A'} />}
        </div>

        {/* Hook text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug" dir={isArabic ? 'rtl' : 'ltr'}>
            {hook?.text ?? textOverlay ?? 'No hook generated'}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {hook && (
              <>
                <span className="text-[10px] text-slate-400">{hook.score}/30</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 capitalize">{hook.type}</span>
              </>
            )}
            <span className="text-[10px] text-novax-muted font-medium">{typeLabel}</span>
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform duration-200', expanded && 'rotate-180')} />
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-slate-100">

          {/* 3C bars + why selected */}
          {hook && (
            <div className="px-5 py-4 bg-novax-light/40 border-b border-slate-100">
              <ThreeCBars clarity={hook.clarity} context={hook.context} curiosity={hook.curiosity} />
              {hook.why_selected && (
                <p className="text-xs text-novax-muted italic mt-2">{hook.why_selected}</p>
              )}
            </div>
          )}

          {/* ── REEL: script sections ── */}
          {piece.script_sections && piece.script_sections.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">THE SCRIPT</p>
              <div className="space-y-3">
                {piece.script_sections.map((section, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-novax-border">
                    <div className="bg-novax flex items-center justify-between px-4 py-2">
                      <span className="text-xs font-bold text-white tracking-widest uppercase">{section.section}</span>
                      {section.duration_estimate && (
                        <span className="text-xs text-novax-accent">{section.duration_estimate}</span>
                      )}
                    </div>
                    <div className="bg-white px-4 py-3 space-y-1" dir={isArabic ? 'rtl' : 'ltr'}>
                      {section.lines.map((line, j) => (
                        <p key={j} className={cn('leading-relaxed', line.startsWith('[') ? 'text-xs text-slate-400 italic' : 'text-sm text-slate-800')}>
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

          {/* ── CAROUSEL: slides ── */}
          {slides && slides.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{slides.length} SLIDES</p>
              <div className="space-y-2">
                {slides.map((slide, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-black text-novax leading-none shrink-0 w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 mb-1" dir={isArabic ? 'rtl' : 'ltr'}>{slide.title}</p>
                        <p className="text-xs text-slate-600 leading-relaxed" dir={isArabic ? 'rtl' : 'ltr'}>{slide.body}</p>
                        {slide.visual_note && (
                          <div className="flex items-start gap-1 mt-2">
                            <Camera className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-slate-400 italic">{slide.visual_note}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STATIC: visual direction + text overlay ── */}
          {visualDirection && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3">
              {textOverlay && (
                <div className="bg-novax rounded-xl p-4">
                  <p className="text-[10px] tracking-widest text-novax-accent font-bold uppercase mb-1">TEXT OVERLAY</p>
                  <p className="text-xl font-bold text-white leading-snug" dir={isArabic ? 'rtl' : 'ltr'}>{textOverlay}</p>
                </div>
              )}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Camera className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">VISUAL DIRECTION</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{visualDirection}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B-roll / assets */}
          {piece.key_broll_list && piece.key_broll_list.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {piece.type === 'static' ? 'ASSETS NEEDED' : 'B-ROLL NEEDED'}
              </p>
              <div className="flex flex-wrap gap-2">
                {piece.key_broll_list.map((shot, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium">
                    <Camera className="w-3 h-3 text-slate-400 shrink-0" />
                    {shot}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          {piece.caption_preview && (
            <div className="px-5 py-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CAPTION</span>
                  <button onClick={copyCaption} className="flex items-center gap-1 text-xs text-novax-muted hover:text-novax transition-colors">
                    {copied ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap" dir={isArabic ? 'rtl' : 'ltr'}>
                  {piece.caption_preview}
                </p>
              </div>
            </div>
          )}
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
  // Build a pieces array — use doc.pieces if present, else synthesize from root fields
  const pieces: ContentPiece[] = doc.pieces && doc.pieces.length > 0
    ? doc.pieces
    : [{
        type:                   (doc.content_type ?? 'reel'),
        index:                  0,
        hook:                   doc.hook ?? null,
        script_sections:        doc.script_sections ?? [],
        total_duration:         doc.total_duration,
        production_difficulty:  doc.production_difficulty,
        brand_compliance_notes: doc.brand_compliance_notes,
        key_broll_list:         doc.key_broll_list ?? [],
        caption_preview:        doc.caption_preview ?? '',
      } as ContentPiece]

  return (
    <div className="p-6 space-y-5">
      {/* Session-level audience intelligence */}
      {doc.audience_intelligence && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {doc.audience_intelligence.functional_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Functional Job</p>
              <p className="text-xs text-slate-700 leading-relaxed">{doc.audience_intelligence.functional_job}</p>
            </div>
          )}
          {doc.audience_intelligence.emotional_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Emotional Job</p>
              <p className="text-xs text-slate-700 leading-relaxed">{doc.audience_intelligence.emotional_job}</p>
            </div>
          )}
          {doc.audience_intelligence.social_job && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Social Job</p>
              <p className="text-xs text-slate-700 leading-relaxed">{doc.audience_intelligence.social_job}</p>
            </div>
          )}
        </div>
      )}

      {/* Piece count summary */}
      {pieces.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-semibold text-slate-700">{pieces.length} pieces generated</span>
          <span className="text-xs text-slate-400">— each with a different hook. Click to expand.</span>
        </div>
      )}

      {/* Expandable piece cards */}
      <div className="space-y-3">
        {pieces.map((piece, i) => (
          <ContentPieceCard
            key={i}
            piece={piece}
            index={i}
            total={pieces.length}
            language={language}
            defaultOpen={pieces.length === 1}
          />
        ))}
      </div>
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
  // Month persona adjective colors cycle
  const PERSONA_COLORS = [
    'bg-novax-light text-novax border-novax-border',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-slate-100 text-slate-600 border-slate-200',
  ]

  return (
    <div className="p-6 space-y-8">

      {/* ── IDENTITY BLOCK ── */}
      {(doc.campaign_line || doc.positioning_statement) && (
        <div className="bg-novax rounded-2xl p-6 space-y-3">
          {doc.campaign_line && (
            <p className="text-2xl font-bold text-white leading-snug">
              {doc.campaign_line}
            </p>
          )}
          {doc.quarter && doc.year && (
            <p className="text-xs tracking-widest text-novax-accent font-bold uppercase">
              {doc.quarter} {doc.year} Strategy
            </p>
          )}
          {doc.quarter_role && (
            <p className="text-sm text-white/80 leading-relaxed border-t border-white/10 pt-3">
              {doc.quarter_role}
            </p>
          )}
          {doc.identity_shift && (
            <p className="text-xs italic text-novax-accent/80">{doc.identity_shift}</p>
          )}
        </div>
      )}

      {/* ── CONTENT PILLARS ── */}
      {doc.content_pillars && doc.content_pillars.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">CONTENT PHILOSOPHY — PILLARS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doc.content_pillars.map((p, i) => (
              <div key={i} className={cn(
                'rounded-xl border p-4',
                i === 0 ? 'sm:col-span-2 bg-novax-light border-novax-border' : 'bg-white border-slate-200',
              )}>
                <p className={cn('text-xs font-bold uppercase tracking-wider mb-1', i === 0 ? 'text-novax' : 'text-slate-500')}>
                  {p.name}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 italic mt-2 text-center">Partners and products appear as part of life, not advertisements.</p>
        </div>
      )}

      {/* ── STRATEGY ARC ── */}
      {doc.strategy_arc && doc.strategy_arc.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">THE STRATEGY IN ACTION</p>
          <div className="space-y-2">
            {doc.strategy_arc.map((phase, i) => (
              <div key={i} className={cn(
                'flex items-start gap-4 p-4 rounded-xl border',
                i % 2 === 0 ? 'bg-slate-50 border-slate-200' : 'bg-white border-novax-border',
              )}>
                <span className="text-3xl font-black text-slate-100 leading-none shrink-0 w-10">
                  {phase.number}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{phase.phase_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{phase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLATFORM ROLES ── */}
      {doc.platform_roles && doc.platform_roles.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">CONTENT STRATEGY — PLATFORMS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {doc.platform_roles.map((pr, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-novax uppercase tracking-wider mb-1">{pr.platform}</p>
                <p className="text-xs font-semibold text-slate-600 mb-2">Role: {pr.role}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{pr.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTHLY TACTICS ── */}
      {doc.monthly_tactics && doc.monthly_tactics.length > 0 && (
        <div className="space-y-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">MONTHLY TACTICS</p>
          {doc.monthly_tactics.map((m, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Month header */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-slate-400 font-medium">{m.month}</p>
                  <span className="text-slate-200">·</span>
                  <p className="text-xs font-bold text-novax uppercase tracking-wider">Role: {m.role}</p>
                </div>
                <p className="text-base font-bold text-slate-900 mt-1">{m.theme_line}</p>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Description */}
                {m.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">{m.description}</p>
                )}

                {/* Brand Persona */}
                {(m.brand_persona_adjectives?.length > 0 || m.brand_persona_description) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Brand Persona</p>
                    {m.brand_persona_adjectives?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {m.brand_persona_adjectives.map((adj, j) => (
                          <span key={j} className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border', PERSONA_COLORS[i % PERSONA_COLORS.length])}>
                            {adj}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.brand_persona_description && (
                      <p className="text-xs text-slate-500 italic">{m.brand_persona_description}</p>
                    )}
                  </div>
                )}

                {/* Focus + Outcome side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {m.focus?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Focus</p>
                      <ul className="space-y-1.5">
                        {m.focus.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-amber-800">
                            <span className="text-amber-400 mt-0.5 shrink-0">·</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.outcome?.length > 0 && (
                    <div className="bg-novax rounded-xl p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-novax-accent mb-2">Outcome</p>
                      <ul className="space-y-1.5">
                        {m.outcome.map((o, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-white/85">
                            <span className="text-novax-accent mt-0.5 shrink-0">·</span>
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FORMAT ROLES ── */}
      {doc.format_roles && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">CONTENT STRATEGY — FORMAT ROLES</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'REELS',             items: doc.format_roles.reels },
              { label: 'MOTION GRAPHICS',   items: doc.format_roles.motion_graphics },
              { label: 'STATIC / CAROUSEL', items: doc.format_roles.static_carousel },
            ].map(({ label, items }) => items?.length ? (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-novax uppercase tracking-wider mb-2">{label}</p>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="text-slate-300 mt-0.5 shrink-0">_</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* ── TENANT / PARTNER INTEGRATION ── */}
      {doc.tenant_integration && doc.tenant_integration.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">PARTNER INTEGRATION PRINCIPLE</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {doc.tenant_integration.map((item, i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-4">
                <p className="text-xs text-white/80 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STRATEGY FLOW ── */}
      {doc.strategy_flow && doc.strategy_flow.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            {doc.quarter && doc.year ? `${doc.quarter} ${doc.year}` : 'STRATEGY'} — FULL FLOW
          </p>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200" />
            <div className="space-y-4 pl-14">
              {doc.strategy_flow.map((beat, i) => {
                const isLeft = i % 2 === 0
                return (
                  <div key={i} className="relative">
                    {/* Beat circle */}
                    <div className={cn(
                      'absolute -left-14 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black',
                      isLeft ? 'bg-novax text-white' : 'bg-slate-700 text-white',
                    )}>
                      {beat.beat}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-xs font-bold', isLeft ? 'text-novax' : 'text-slate-600')}>
                          {beat.label}
                        </span>
                        <span className="text-slate-200 text-xs">·</span>
                        <span className="text-xs text-slate-400">{beat.phase}</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{beat.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FALLBACK: legacy phase format ── */}
      {!doc.monthly_tactics?.length && doc.phases?.map((phase, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-4">
            <span className="text-3xl font-black text-slate-100 leading-none">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <p className="text-sm font-bold text-slate-800">{phase.name}</p>
              {phase.diamond_position && <p className="text-xs text-slate-400 mt-0.5">{phase.diamond_position}</p>}
            </div>
          </div>
          {phase.key_insight && (
            <div className="bg-novax-light border-l-4 border-novax-border rounded-r-xl p-4 mx-6 my-4">
              <p className="text-[10px] tracking-wider text-novax-muted font-bold uppercase mb-1">THE INSIGHT</p>
              <p className="text-sm font-medium text-novax">{phase.key_insight}</p>
            </div>
          )}
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
