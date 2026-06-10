'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Film, ArrowLeft, Copy, Check, Loader2, CheckCircle, Circle,
  ChevronDown, ChevronUp, AlertTriangle, Camera, Video,
  Clapperboard, Zap, Sparkles, TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { StudioGuidancePanel } from '@/components/studio/studio-guidance-panel'
import { LumaraPrefillButton, LUMARA_BRIEFS } from '@/components/studio/lumara-prefill-button'
import type {
  VisualApproach, VisualDocument, VisualInputs, LoadingStep,
  NarrativePurpose, ScenePrompt,
} from '@/lib/studio-types'

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: 'TikTok / Reels', defaultFormat: '9:16' as const },
  { value: 'YouTube',        defaultFormat: '16:9' as const },
  { value: 'Instagram',      defaultFormat: '1:1'  as const },
  { value: 'Meta Ads',       defaultFormat: '4:5'  as const },
  { value: 'TV / Broadcast', defaultFormat: '16:9' as const },
]

const FORMATS = [
  { value: '9:16' as const, label: '9:16', sub: 'TikTok · Reels · Stories' },
  { value: '16:9' as const, label: '16:9', sub: 'YouTube · TV' },
  { value: '1:1'  as const, label: '1:1',  sub: 'Instagram Feed' },
  { value: '4:5'  as const, label: '4:5',  sub: 'Portrait Feed' },
]

const LENGTHS = ['15s', '30s', '60s', '90s+']

const OBJECTIVES = ['Awareness', 'Traffic', 'Conversions', 'Entertainment', 'Brand Building']

const VIBES = ['Cinematic', 'Dark', 'Luxury', 'Funny', 'Emotional', 'Energetic', 'Mysterious', 'Warm']

const CTA_TYPES = ['Click', 'Buy Now', 'Watch More', 'Learn More', 'Follow', 'Save']

const SCENE_COUNT_MAP: Record<string, string> = {
  '15s': '3-4',
  '30s': '5-7',
  '60s': '8-12',
  '90s+': '12-16',
}

const GENERATING_STEPS: LoadingStep[] = [
  { label: 'Establishing Visual DNA',          status: 'pending' },
  { label: 'Building scene architecture',      status: 'pending' },
  { label: 'Writing image prompts',            status: 'pending' },
  { label: 'Writing video prompts',            status: 'pending' },
  { label: 'Assembling production notes',      status: 'pending' },
  { label: 'Building Boss Brief',              status: 'pending' },
]

const PURPOSE_CONFIG: Record<NarrativePurpose, { label: string; color: string; bg: string }> = {
  HOOK:         { label: 'Hook',         color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200' },
  AGITATE:      { label: 'Agitate',      color: 'text-amber-700',  bg: 'bg-amber-100 border-amber-200' },
  SHIFT:        { label: 'Shift',        color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-200' },
  SOLUTION:     { label: 'Solution',     color: 'text-emerald-700',bg: 'bg-emerald-100 border-emerald-200' },
  SOCIAL_PROOF: { label: 'Social Proof', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
  CTA:          { label: 'CTA',          color: 'text-novax',      bg: 'bg-novax-light border-novax-border' },
  BUILDUP:      { label: 'Build-up',     color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-200' },
  REVEAL:       { label: 'Reveal',       color: 'text-novax-muted',bg: 'bg-novax-light border-novax-border' },
}

type PageState = 'brief' | 'analyzing' | 'approaches' | 'generating' | 'document'

const EMPTY_INPUTS: VisualInputs = {
  client_id: null,
  platform: '',
  format: '9:16',
  length: '30s',
  objective: '',
  audience: '',
  core_message: '',
  vibe: '',
  cta_type: '',
  additional_notes: '',
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax hover:bg-novax-light/50 transition-all"
    >
      {copied
        ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
        : <><Copy className="w-3 h-3" /> {label ?? 'Copy'}</>}
    </button>
  )
}

// ── Loading screen ─────────────────────────────────────────────────────────────

function GeneratingScreen({ steps }: { steps: LoadingStep[] }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="w-full max-w-sm space-y-3">
        <p className="text-sm font-semibold text-slate-700 mb-5 text-center">Generating production package…</p>
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 py-1.5">
            {step.status === 'complete'
              ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              : step.status === 'active'
              ? <Loader2 className="w-4 h-4 text-novax-accent mt-0.5 shrink-0 animate-spin" />
              : <Circle className="w-4 h-4 text-slate-200 mt-0.5 shrink-0" />}
            <span className={cn(
              'text-sm',
              step.status === 'complete' ? 'text-slate-400 line-through' : '',
              step.status === 'active'   ? 'text-slate-800 font-medium' : '',
              step.status === 'pending'  ? 'text-slate-400' : '',
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Approach card ──────────────────────────────────────────────────────────────

function ApproachCard({
  approach,
  index,
  selected,
  onSelect,
}: {
  approach: VisualApproach
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const labels = ['Proven', 'Bold', 'Cinematic']
  const badgeColors = [
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-800',
    'bg-novax text-white',
  ]
  const label     = labels[index] ?? 'Approach'
  const badgeColor= badgeColors[index] ?? 'bg-slate-100 text-slate-600'

  const boldnessColor = approach.boldness >= 8 ? 'bg-red-400'
    : approach.boldness >= 6 ? 'bg-amber-400'
    : 'bg-emerald-400'

  return (
    <button
      onClick={onSelect}
      className={cn(
        'text-left w-full rounded-2xl border-2 transition-all duration-200 overflow-hidden',
        selected
          ? 'border-novax shadow-md'
          : 'border-slate-200 hover:border-novax-border hover:shadow-sm',
      )}
    >
      {/* Header */}
      <div className={cn(
        'px-5 pt-5 pb-4',
        selected ? 'bg-novax-light/40' : 'bg-white',
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', badgeColor)}>
            {label}
          </span>
          {selected && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-novax text-white uppercase tracking-wide">
              Selected
            </span>
          )}
        </div>
        <p className="text-base font-bold text-slate-900 leading-tight">{approach.name}</p>
        <p className="text-sm text-slate-500 mt-0.5 leading-snug">{approach.tagline}</p>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">
            {approach.narrative_arc}
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">
            Hook: {approach.hook_type}
          </span>
        </div>
      </div>

      {/* Hook moment */}
      <div className={cn('px-5 py-3 border-t border-slate-100', selected ? 'bg-novax-light/20' : 'bg-white')}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Opening hook</p>
        <p className="text-xs text-slate-700 leading-relaxed">{approach.hook_moment}</p>
      </div>

      {/* Scene structure */}
      <div className={cn('px-5 py-3 border-t border-slate-100', selected ? 'bg-novax-light/20' : 'bg-slate-50')}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Scene structure</p>
        <div className="space-y-1">
          {approach.scene_structure.slice(0, 5).map((scene, i) => (
            <p key={i} className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
              <span className="text-[10px] font-bold text-novax-accent shrink-0 mt-0.5">{i + 1}</span>
              {scene}
            </p>
          ))}
          {approach.scene_structure.length > 5 && (
            <p className="text-[10px] text-slate-400 italic">+{approach.scene_structure.length - 5} more scenes</p>
          )}
        </div>
      </div>

      {/* Emotional journey */}
      <div className={cn('px-5 py-3 border-t border-slate-100', selected ? 'bg-novax-light/20' : 'bg-white')}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Emotional journey</p>
        <p className="text-xs text-slate-500 italic leading-relaxed">{approach.emotional_journey}</p>
      </div>

      {/* Why it works */}
      <div className={cn(
        'px-5 py-3 border-t',
        selected ? 'bg-novax-light border-novax-border/50' : 'bg-novax-light/50 border-slate-100',
      )}>
        <p className="text-[10px] font-semibold text-novax-muted uppercase tracking-widest mb-1">Why it works</p>
        <p className="text-xs text-novax leading-relaxed">{approach.why_it_works}</p>
      </div>

      {/* Footer: boldness + best for */}
      <div className={cn('px-5 py-3 border-t border-slate-100 flex items-center gap-3', selected ? 'bg-novax-light/20' : 'bg-white')}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-medium">Boldness</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-3 rounded-sm',
                  i < approach.boldness ? boldnessColor : 'bg-slate-200',
                )}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{approach.boldness}/10</span>
        </div>
        <span className="text-slate-200">·</span>
        <p className="text-[10px] text-slate-500 leading-snug">{approach.best_for}</p>
      </div>
    </button>
  )
}

// ── Scene card ─────────────────────────────────────────────────────────────────

function SceneCard({ scene }: { scene: ScenePrompt }) {
  const [showImagePrompt, setShowImagePrompt] = useState(true)
  const [showVideoPrompt, setShowVideoPrompt] = useState(true)

  const purposeCfg = PURPOSE_CONFIG[scene.narrative_purpose] ?? {
    label: scene.narrative_purpose,
    color: 'text-slate-600',
    bg: 'bg-slate-100 border-slate-200',
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Scene header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-novax flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-white">{scene.scene_number}</span>
          </div>
          <span className="text-xs font-semibold text-slate-700">{scene.duration}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide', purposeCfg.bg, purposeCfg.color)}>
            {purposeCfg.label}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-2 py-0.5">{scene.camera_angle}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Voiceover */}
        {scene.voiceover && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 mt-0.5 w-16">Voiceover</span>
            <p className="text-sm text-slate-800 leading-relaxed italic">&ldquo;{scene.voiceover}&rdquo;</p>
          </div>
        )}

        {/* Image prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowImagePrompt(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest hover:text-novax transition-colors"
            >
              <Camera className="w-3 h-3" />
              Image Prompt
              <span className="text-[10px] text-slate-400">(Midjourney · Seedream · Nanobanana)</span>
              {showImagePrompt ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>
            <CopyButton text={scene.image_prompt} label="Copy prompt" />
          </div>
          {showImagePrompt && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap break-words">{scene.image_prompt}</p>
            </div>
          )}
        </div>

        {/* Video prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowVideoPrompt(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest hover:text-novax transition-colors"
            >
              <Video className="w-3 h-3" />
              Video Prompt
              <span className="text-[10px] text-slate-400">(Kling · Higgsfield · Veo3)</span>
              {showVideoPrompt ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>
            <CopyButton text={scene.video_prompt} label="Copy prompt" />
          </div>
          {showVideoPrompt && (
            <div className="bg-novax-light border border-novax-border rounded-xl px-4 py-3">
              <p className="text-xs text-novax leading-relaxed">{scene.video_prompt}</p>
            </div>
          )}
        </div>

        {/* Direction notes */}
        <div className="flex flex-wrap items-start gap-4 pt-1 border-t border-slate-100">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Emotion direction</p>
            <p className="text-xs text-slate-600">{scene.emotion_direction}</p>
          </div>
          {scene.continuity_note && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Connects to next</p>
              <p className="text-xs text-slate-500 italic">{scene.continuity_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Visual anchor card ─────────────────────────────────────────────────────────

function AnchorCard({ anchor }: { anchor: VisualDocument['anchor'] }) {
  return (
    <div className="bg-novax rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-novax-accent font-bold uppercase">Visual DNA</p>
          <p className="text-xs text-white/50 mt-0.5">Inject this anchor into every image prompt — verbatim</p>
        </div>
        <CopyButton text={anchor.full_anchor_text} label="Copy anchor" />
      </div>

      {/* Anchor details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5 border-b border-white/10">
        {[
          { label: 'Style', value: anchor.style },
          { label: 'POV', value: anchor.pov === 'first_person' ? 'First Person (POV)' : 'Cinematic (3rd Person)' },
          { label: 'Subject', value: anchor.subject },
          { label: 'Environment', value: anchor.environment },
          { label: 'Lighting', value: anchor.lighting },
          { label: 'Color Treatment', value: anchor.color_treatment },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-3 bg-novax">
            <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">{label}</p>
            <p className="text-xs text-white/80 leading-relaxed">{value}</p>
          </div>
        ))}
      </div>

      {/* Full anchor text */}
      <div className="px-6 py-4">
        <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-2">Full Anchor Text</p>
        <p className="text-xs text-white/90 leading-relaxed font-mono">{anchor.full_anchor_text}</p>
      </div>
    </div>
  )
}

// ── Production notes ───────────────────────────────────────────────────────────

function ProductionNotes({ notes }: { notes: VisualDocument['production_notes'] }) {
  const [open, setOpen] = useState<string[]>(['hook'])

  function toggle(key: string) {
    setOpen(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const sections = [
    {
      key: 'hook',
      label: 'Hook Checklist',
      content: (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
              notes.hook_checklist.grabs_instantly ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
            )}>
              {notes.hook_checklist.grabs_instantly ? '✓' : '✗'}
            </span>
            <p className="text-xs text-slate-700">Grabs attention instantly</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
              notes.hook_checklist.visually_disruptive ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'
            )}>
              {notes.hook_checklist.visually_disruptive ? '✓' : '!'}
            </span>
            <p className="text-xs text-slate-700">Visually disruptive / emotionally engaging</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 mt-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Hook format</p>
            <p className="text-xs text-slate-700 font-medium">{notes.hook_checklist.hook_format_used}</p>
          </div>
          <p className="text-xs text-slate-500 italic leading-relaxed">{notes.hook_checklist.note}</p>
        </div>
      ),
    },
    {
      key: 'platform',
      label: 'Platform Optimization',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Aspect Ratio', value: notes.platform_notes.aspect_ratio },
            { label: 'Pacing', value: notes.platform_notes.pacing },
            { label: 'Best Thumbnail', value: `Scene ${notes.platform_notes.thumbnail_scene}` },
            { label: 'CTA Placement', value: notes.platform_notes.cta_placement },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
              <p className="text-xs text-slate-800 font-medium leading-snug">{value}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'sound',
      label: 'Sound Direction',
      content: (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Music mood</p>
            <p className="text-xs text-slate-800 leading-relaxed">{notes.sound_direction.music_mood}</p>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Voiceover tone</p>
            <p className="text-xs text-slate-800 leading-relaxed">{notes.sound_direction.voiceover_tone}</p>
          </div>
          {notes.sound_direction.sfx_moments.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Sound effects</p>
              <div className="space-y-1">
                {notes.sound_direction.sfx_moments.map((sfx, i) => (
                  <p key={i} className="text-xs text-slate-600 flex gap-2">
                    <span className="text-novax-accent font-bold shrink-0">·</span>
                    {sfx}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'editing',
      label: 'Editing & Post-Production',
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Upscale priority</p>
            <div className="space-y-1">
              {notes.upscale_priority.map((item, i) => (
                <p key={i} className="text-xs text-slate-600 flex gap-2">
                  <span className="text-amber-500 font-bold shrink-0">↑</span>
                  {item}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Transition notes</p>
            <div className="space-y-1">
              {notes.editing_notes.map((note, i) => (
                <p key={i} className="text-xs text-slate-600 flex gap-2">
                  <span className="text-novax-accent font-bold shrink-0">→</span>
                  {note}
                </p>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-2">
      {sections.map(({ key, label, content }) => (
        <div key={key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(key)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-800">{label}</span>
            {open.includes(key) ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {open.includes(key) && (
            <div className="px-5 pb-4 border-t border-slate-100">
              <div className="pt-4">{content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Boss Brief card ────────────────────────────────────────────────────────────

function BossBriefCard({ brief }: { brief: VisualDocument['boss_brief'] }) {
  const rows = [
    { label: 'What We Made',  value: brief.what_we_made },
    { label: 'Why It Works',  value: brief.why_it_works },
    { label: 'The One Thing', value: brief.the_one_thing, large: true },
    { label: 'Do This Now',   value: brief.do_this_now },
  ]

  return (
    <div className="bg-novax rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <p className="text-xs tracking-[0.2em] text-novax-accent font-bold uppercase">Boss Brief</p>
        <p className="text-xs text-white/40">30-second version</p>
      </div>
      {rows.map(({ label, value, large }) => (
        <div key={label} className="px-6 py-4 border-b border-white/10">
          <p className="text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1">{label}</p>
          <p className={cn('leading-relaxed text-white', large ? 'text-base font-semibold' : 'text-sm')}>{value}</p>
        </div>
      ))}
      {brief.watch_out_for && (
        <div className="px-6 py-4 bg-amber-500/10 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-1">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <p className="text-[10px] tracking-wider text-amber-300 font-bold uppercase">Watch Out For</p>
          </div>
          <p className="text-sm text-amber-100 leading-relaxed">{brief.watch_out_for}</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VisualEnginePage() {
  const { clients } = useClients()

  const [pageState,        setPageState]        = useState<PageState>('brief')
  const [inputs,           setInputs]           = useState<VisualInputs>(EMPTY_INPUTS)
  const [approaches,       setApproaches]       = useState<VisualApproach[]>([])
  const [selectedApproach, setSelectedApproach] = useState<VisualApproach | null>(null)
  const [document,         setDocument]         = useState<VisualDocument | null>(null)
  const [generatingSteps,  setGeneratingSteps]  = useState<LoadingStep[]>(GENERATING_STEPS)
  const [error,            setError]            = useState<string | null>(null)

  // ── Field helpers ────────────────────────────────────────────

  function set<K extends keyof VisualInputs>(key: K, value: VisualInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function selectPlatform(platform: string) {
    const found = PLATFORMS.find(p => p.value === platform)
    setInputs(prev => ({
      ...prev,
      platform,
      format: found?.defaultFormat ?? prev.format,
    }))
  }

  const canAnalyze = !!(
    inputs.platform &&
    inputs.length &&
    inputs.objective &&
    inputs.audience.trim() &&
    inputs.core_message.trim() &&
    inputs.vibe &&
    inputs.cta_type
  )

  // ── Step 1: analyze brief → 3 approaches ────────────────────

  const handleAnalyzeBrief = useCallback(async () => {
    setError(null)
    setPageState('analyzing')
    try {
      const res  = await fetch('/api/studio/visual/approaches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(inputs),
      })
      const data = await res.json() as { approaches?: VisualApproach[]; error?: string }
      if (!res.ok || !data.approaches) {
        throw new Error(data.error ?? 'Failed to generate approaches')
      }
      setApproaches(data.approaches)
      setSelectedApproach(null)
      setPageState('approaches')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('brief')
    }
  }, [inputs])

  // ── Step 2: generate full package from selected approach ─────

  const handleGenerate = useCallback(async () => {
    if (!selectedApproach) return
    setError(null)

    const steps: LoadingStep[] = GENERATING_STEPS.map(s => ({ ...s, status: 'pending' as const }))
    setGeneratingSteps(steps)
    setPageState('generating')

    const advanceStep = (index: number) => {
      setGeneratingSteps(prev => prev.map((s, i) =>
        i < index  ? { ...s, status: 'complete' as const } :
        i === index ? { ...s, status: 'active'  as const } :
        s
      ))
    }

    // Animate steps while waiting (the API call is one request)
    const stepDurations = [800, 1200, 2500, 2500, 1500, 800]
    let cumulativeMs = 0
    const timers: NodeJS.Timeout[] = []
    for (let i = 0; i < stepDurations.length; i++) {
      const delay = cumulativeMs
      timers.push(setTimeout(() => advanceStep(i), delay))
      cumulativeMs += stepDurations[i]
    }

    try {
      const res  = await fetch('/api/studio/visual/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inputs, approach: selectedApproach }),
      })
      const data = await res.json() as { document?: VisualDocument; error?: string }

      timers.forEach(clearTimeout)

      if (!res.ok || !data.document) {
        throw new Error(data.error ?? 'Generation failed')
      }

      setGeneratingSteps(GENERATING_STEPS.map(s => ({ ...s, status: 'complete' as const })))
      await new Promise(r => setTimeout(r, 400))
      setDocument(data.document)
      setPageState('document')
    } catch (err) {
      timers.forEach(clearTimeout)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('approaches')
    }
  }, [inputs, selectedApproach])

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/studio" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Clapperboard className="w-5 h-5 text-novax-accent" />
            <h1 className="text-xl font-bold text-slate-900">Visual Content Engine</h1>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            Full AI video pipeline — concept to scene-by-scene prompts. Image prompts for Midjourney/Seedream. Video prompts for Kling/Higgsfield/Veo3.
          </p>
        </div>
        {pageState !== 'brief' && pageState !== 'analyzing' && (
          <button
            onClick={() => { setPageState('brief'); setDocument(null); setApproaches([]); setSelectedApproach(null) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors shrink-0"
          >
            Start over
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── BRIEF FORM ── */}
      {pageState === 'brief' && (
        <div className="space-y-6">
          <StudioGuidancePanel
            title="How Visual Content Engine works"
            description="Takes your product or brief and generates a visual approach (the creative strategy — e.g. day-in-the-life, transformation arc, sensory-led) then breaks it down into scene-by-scene production prompts ready for Higgsfield or any AI video/image tool."
            items={[
              { term: 'Visual Approach', definition: 'The creative lens for the video — how you want the audience to experience it emotionally before you decide on shots. E.g. "contrast reveal" = before/after. "textural immersion" = close-up product feel.' },
              { term: 'Visual Anchor', definition: 'The single image or moment that the whole video is built around — usually the 3-second shot that makes it shareable.' },
              { term: 'Scene Prompt', definition: 'A Higgsfield-ready description: subject, action, camera movement, lighting, duration. Each prompt is copy-pasteable into an AI video generation tool.' },
              { term: 'Narrative Purpose', definition: 'Why this scene exists in the story — setup, conflict, revelation, payoff. Guides shot selection and order.' },
            ]}
            tips={[
              { label: 'Best brief', tip: 'Describe the sensory experience you want to create ("warm, slow, golden hour") not just the product. Visuals start with feeling.' },
              { label: 'Higgsfield', tip: 'Copy scene prompts directly into Higgsfield\'s prompt field — they\'re pre-formatted for cinematic character-consistent generation.' },
            ]}
          />

          {/* Client + Platform */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">1. Define the Video</p>

            {/* Client */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Client (optional)</label>
              <select
                value={inputs.client_id ?? ''}
                onChange={e => set('client_id', e.target.value || null)}
                className="w-full max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-border bg-white text-slate-700"
              >
                <option value="">No specific client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Platform</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => selectPlatform(p.value)}
                    className={cn(
                      'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                      inputs.platform === p.value
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                    )}
                  >
                    {p.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Aspect Ratio</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => set('format', f.value)}
                    className={cn(
                      'text-xs font-medium rounded-lg px-3 py-2 border transition-colors text-left',
                      inputs.format === f.value
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                    )}
                  >
                    <p className="font-bold">{f.label}</p>
                    <p className={cn('text-[10px] mt-0.5', inputs.format === f.value ? 'text-white/70' : 'text-slate-400')}>{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Length + Objective */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Video Length</label>
                <div className="flex gap-2 flex-wrap">
                  {LENGTHS.map(l => (
                    <button
                      key={l}
                      onClick={() => set('length', l)}
                      className={cn(
                        'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                        inputs.length === l
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                      )}
                    >
                      {l}
                      {SCENE_COUNT_MAP[l] && (
                        <span className={cn('ml-1 text-[10px]', inputs.length === l ? 'text-white/70' : 'text-slate-400')}>
                          ({SCENE_COUNT_MAP[l]} scenes)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Objective</label>
                <div className="flex gap-2 flex-wrap">
                  {OBJECTIVES.map(o => (
                    <button
                      key={o}
                      onClick={() => set('objective', o)}
                      className={cn(
                        'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                        inputs.objective === o
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Audience + Message */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">2. Brief the AI</p>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Target Audience</label>
              <textarea
                value={inputs.audience}
                onChange={e => set('audience', e.target.value)}
                rows={2}
                placeholder="E.g., Women 25-35 who want better skincare but feel overwhelmed by complicated routines. They scroll TikTok during commutes and trust real results over brand promises."
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-novax-border resize-none placeholder:text-slate-400 text-slate-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600">Core Message</label>
                <LumaraPrefillButton
                  onPrefill={(_, b) => set('core_message', b)}
                  brief={LUMARA_BRIEFS.visual}
                />
              </div>
              <textarea
                value={inputs.core_message}
                onChange={e => set('core_message', e.target.value)}
                rows={2}
                placeholder="E.g., Our serum delivers visible results in 7 days without a complicated routine — just 30 seconds, one product, real skin."
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-novax-border resize-none placeholder:text-slate-400 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Vibe / Tone</label>
                <div className="flex flex-wrap gap-2">
                  {VIBES.map(v => (
                    <button
                      key={v}
                      onClick={() => set('vibe', v)}
                      className={cn(
                        'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                        inputs.vibe === v
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">CTA Type</label>
                <div className="flex flex-wrap gap-2">
                  {CTA_TYPES.map(c => (
                    <button
                      key={c}
                      onClick={() => set('cta_type', c)}
                      className={cn(
                        'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                        inputs.cta_type === c
                          ? 'bg-novax text-white border-novax'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Additional Notes <span className="text-slate-400">(optional)</span></label>
              <textarea
                value={inputs.additional_notes}
                onChange={e => set('additional_notes', e.target.value)}
                rows={2}
                placeholder="Brand references, specific shots you have in mind, restrictions, character details, product angles to show..."
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-novax-border resize-none placeholder:text-slate-400 text-slate-800"
              />
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={() => void handleAnalyzeBrief()}
            disabled={!canAnalyze}
            className="w-full flex items-center justify-center gap-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-4 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Analyze Brief — Generate 3 Approaches
          </button>
        </div>
      )}

      {/* ── ANALYZING ── */}
      {pageState === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-8 h-8 text-novax-accent animate-spin" />
          <p className="text-sm font-medium text-slate-700">Analyzing brief, planning your creative approaches…</p>
          <p className="text-xs text-slate-400">Usually takes 5-10 seconds</p>
        </div>
      )}

      {/* ── APPROACHES ── */}
      {pageState === 'approaches' && approaches.length > 0 && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Choose your approach</p>
            <p className="text-xs text-slate-500">
              Three distinct creative treatments for your brief. Select one to generate the full scene-by-scene production package.
            </p>
          </div>

          {/* 3 approach cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {approaches.map((approach, i) => (
              <ApproachCard
                key={approach.id}
                approach={approach}
                index={i}
                selected={selectedApproach?.id === approach.id}
                onSelect={() => setSelectedApproach(approach)}
              />
            ))}
          </div>

          {/* Generate button */}
          {selectedApproach && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500">
                Generating {SCENE_COUNT_MAP[inputs.length] ?? '?'} scenes for <strong>{inputs.length}</strong> on <strong>{inputs.platform}</strong>
              </p>
              <button
                onClick={() => void handleGenerate()}
                className="flex items-center gap-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl px-8 py-4 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Generate Full Production Package — {selectedApproach.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GENERATING ── */}
      {pageState === 'generating' && (
        <GeneratingScreen steps={generatingSteps} />
      )}

      {/* ── DOCUMENT ── */}
      {pageState === 'document' && document && (
        <div className="space-y-6">

          {/* Doc header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Production Package</p>
              <p className="text-lg font-bold text-slate-900">{selectedApproach?.name}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[10px] bg-novax-light border border-novax-border text-novax rounded-full px-2 py-0.5 font-medium">{inputs.platform}</span>
                <span className="text-[10px] bg-novax-light border border-novax-border text-novax rounded-full px-2 py-0.5 font-medium">{inputs.format}</span>
                <span className="text-[10px] bg-novax-light border border-novax-border text-novax rounded-full px-2 py-0.5 font-medium">{inputs.length}</span>
                <span className="text-[10px] bg-novax-light border border-novax-border text-novax rounded-full px-2 py-0.5 font-medium">{document.scenes.length} scenes</span>
                <span className="text-[10px] bg-novax-light border border-novax-border text-novax rounded-full px-2 py-0.5 font-medium">{inputs.objective}</span>
              </div>
            </div>
          </div>

          {/* Visual Anchor */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Visual DNA</p>
            <AnchorCard anchor={document.anchor} />
          </div>

          {/* Workflow reminder */}
          <div className="bg-novax-light border border-novax-border rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-novax mb-2">Production workflow</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-novax-muted font-medium">
              {['1. Copy anchor + image prompt → Midjourney / Seedream / Nanobanana Pro',
                '2. Upscale output (Gigapixel / Bigjpg)',
                '3. Touch up in Canva',
                '4. Copy video prompt → Kling / Higgsfield / Veo3',
                '5. Add voiceover (ElevenLabs) + SFX (Pixabay)',
                '6. Edit in CapCut',
              ].map((step, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-novax text-white text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {step.replace(/^\d+\.\s/, '')}
                  {i < 5 && <span className="text-novax-border mx-0.5">→</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Scenes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Scenes ({document.scenes.length})
            </p>
            <div className="space-y-4">
              {document.scenes.map(scene => (
                <SceneCard key={scene.scene_number} scene={scene} />
              ))}
            </div>
          </div>

          {/* Production notes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Production Notes</p>
            <ProductionNotes notes={document.production_notes} />
          </div>

          {/* Boss Brief */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Boss Brief</p>
            <BossBriefCard brief={document.boss_brief} />
          </div>

          {/* Start over */}
          <div className="flex justify-center pt-4 pb-8">
            <button
              onClick={() => { setPageState('brief'); setDocument(null); setApproaches([]); setSelectedApproach(null) }}
              className="text-sm text-slate-500 hover:text-novax transition-colors"
            >
              Start a new brief
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
