'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronUp, Save, Loader2, CheckCircle2,
  Target, Users, MessageSquare, FileText, Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientNormalizedProfile, SocialPlatform } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────────────────

const PRICE_OPTIONS = [
  { value: 'ultra_premium', label: 'Ultra-premium' },
  { value: 'premium',       label: 'Premium' },
  { value: 'mid_market',    label: 'Mid-market' },
  { value: 'value',         label: 'Value / Mass-market' },
] as const

const GENDER_OPTIONS = [
  { value: 'female',   label: 'Female-led' },
  { value: 'male',     label: 'Male-led' },
  { value: 'balanced', label: 'Balanced' },
] as const

const FORMALITY_OPTIONS = [
  { value: 'very_formal',   label: 'Very Formal' },
  { value: 'professional',  label: 'Professional' },
  { value: 'balanced',      label: 'Balanced' },
  { value: 'friendly',      label: 'Friendly' },
  { value: 'very_casual',   label: 'Very Casual' },
] as const

const EMOJI_OPTIONS = [
  { value: 'never',      label: 'Never' },
  { value: 'on_request', label: 'On request' },
  { value: 'always',     label: 'Always' },
] as const

const GOAL_OPTIONS = [
  { value: 'awareness',  label: 'Brand Awareness' },
  { value: 'lead_gen',   label: 'Lead Generation' },
  { value: 'sales',      label: 'Sales / Conversions' },
  { value: 'retention',  label: 'Retention / Loyalty' },
  { value: 'launch',     label: 'Product Launch' },
  { value: 'community',  label: 'Community Building' },
] as const

const HASHTAG_OPTIONS = EMOJI_OPTIONS

const LANGUAGE_OPTIONS = [
  { value: 'arabic_only',   label: 'Arabic only' },
  { value: 'english_only',  label: 'English only' },
  { value: 'both',          label: 'Arabic + English' },
] as const

const PLATFORM_OPTIONS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'pinterest', label: 'Pinterest' },
]

const VOICE_SUGGESTIONS = [
  'Bold', 'Warm', 'Educational', 'Witty', 'Direct', 'Elegant',
  'Playful', 'Professional', 'Inspirational', 'Authoritative',
  'Conversational', 'Luxurious', 'Minimal', 'Energetic', 'Empathetic',
]

// ── Section definitions ────────────────────────────────────────────────────

interface Section {
  key: string
  label: string
  icon: React.ElementType
  fields: (keyof ClientNormalizedProfile)[]
}

const SECTIONS: Section[] = [
  {
    key: 'positioning',
    label: 'Positioning',
    icon: Target,
    fields: ['positioning_statement', 'primary_offering', 'key_differentiator', 'price_positioning'],
  },
  {
    key: 'audience',
    label: 'Audience',
    icon: Users,
    fields: ['audience_age_range', 'audience_gender_skew', 'audience_location', 'audience_psychographic'],
  },
  {
    key: 'voice',
    label: 'Voice & Language',
    icon: MessageSquare,
    fields: ['brand_voice', 'language', 'arabic_dialect', 'formality', 'emoji_policy'],
  },
  {
    key: 'content',
    label: 'Content Rules',
    icon: FileText,
    fields: ['content_goal', 'primary_cta', 'banned_topics', 'hashtag_policy'],
  },
  {
    key: 'social',
    label: 'Social Presence',
    icon: Radio,
    fields: ['primary_platform', 'secondary_platforms', 'posts_per_week', 'best_posting_times'],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function fieldFilled(value: ClientNormalizedProfile[keyof ClientNormalizedProfile]): boolean {
  if (value == null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return true
  return true
}

function countFilled(profile: ClientNormalizedProfile, fields: (keyof ClientNormalizedProfile)[]): number {
  return fields.filter(f => fieldFilled(profile[f])).length
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FieldLabel({ label, filled }: { label: string; filled: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {filled && <CheckCircle2 className="w-3 h-3 text-emerald-500"/>}
    </div>
  )
}

function SelectField({
  label, value, options, onChange, placeholder,
}: {
  label: string
  value: string | undefined
  options: readonly { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <FieldLabel label={label} filled={!!value}/>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700"
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function TextField({
  label, value, onChange, placeholder, multiline = false, maxLength,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  maxLength?: number
}) {
  const filled = !!value?.trim()
  return (
    <div>
      <FieldLabel label={label} filled={filled}/>
      {multiline ? (
        <textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
        />
      )}
      {maxLength && value && (
        <p className="text-right text-[10px] text-slate-400 mt-0.5">{value.length}/{maxLength}</p>
      )}
    </div>
  )
}

function VoiceChips({
  value,
  onChange,
}: {
  value: string[] | undefined
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')
  const tags = value ?? []

  const add = (word: string) => {
    const w = word.trim()
    if (!w || tags.includes(w) || tags.length >= 5) return
    onChange([...tags, w])
    setInput('')
  }

  const remove = (word: string) => onChange(tags.filter(t => t !== word))

  return (
    <div>
      <FieldLabel label="Brand Voice (3–5 adjectives)" filled={tags.length >= 3}/>
      {/* Current chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(t => (
            <span
              key={t}
              onClick={() => remove(t)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-novax text-white text-[11px] font-semibold cursor-pointer hover:bg-novax-hover transition-colors"
            >
              {t}
              <span className="opacity-70">×</span>
            </span>
          ))}
        </div>
      )}
      {/* Input */}
      {tags.length < 5 && (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
            placeholder="Type an adjective, press Enter"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
          />
        </div>
      )}
      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {VOICE_SUGGESTIONS.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
          <button
            key={s}
            onClick={() => add(s)}
            disabled={tags.length >= 5}
            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 text-slate-500 hover:border-novax hover:text-novax hover:bg-novax-light disabled:opacity-40 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlatformMultiSelect({
  value,
  exclude,
  onChange,
}: {
  value: SocialPlatform[] | undefined
  exclude?: SocialPlatform
  onChange: (v: SocialPlatform[]) => void
}) {
  const selected = value ?? []
  const toggle = (p: SocialPlatform) => {
    if (selected.includes(p)) onChange(selected.filter(x => x !== p))
    else onChange([...selected, p])
  }
  return (
    <div>
      <FieldLabel label="Secondary Platforms" filled={selected.length > 0}/>
      <div className="flex flex-wrap gap-1.5">
        {PLATFORM_OPTIONS.filter(o => o.value !== exclude).map(o => (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              selected.includes(o.value)
                ? 'bg-novax text-white border-novax'
                : 'border-slate-200 text-slate-500 hover:border-novax hover:text-novax hover:bg-novax-light'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Collapsible Section ────────────────────────────────────────────────────

function ProfileSection({
  section,
  profile,
  open,
  onToggle,
  children,
}: {
  section: Section
  profile: ClientNormalizedProfile
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const filled = countFilled(profile, section.fields)
  const total = section.fields.length
  const complete = filled === total
  const Icon = section.icon

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      complete ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          complete ? 'bg-emerald-100' : 'bg-slate-100'
        )}>
          <Icon className={cn('w-3.5 h-3.5', complete ? 'text-emerald-600' : 'text-slate-500')}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{section.label}</span>
            {complete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden" style={{ maxWidth: 80 }}>
              <div
                className={cn('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-novax')}
                style={{ width: `${(filled / total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{filled}/{total}</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0"/> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0"/>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function ClientProfileForm({ clientId, initial }: { clientId: string; initial?: ClientNormalizedProfile }) {
  const [profile, setProfile] = useState<ClientNormalizedProfile>(initial ?? {})
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['positioning']))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (initial) setProfile(initial)
  }, [initial])

  const set = useCallback(<K extends keyof ClientNormalizedProfile>(key: K, val: ClientNormalizedProfile[K]) => {
    setProfile(p => ({ ...p, [key]: val }))
  }, [])

  const toggleSection = (key: string) => {
    setOpenSections(s => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/clients/${clientId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      setSavedAt(new Date())
    } finally {
      setSaving(false)
    }
  }

  const totalFields = SECTIONS.flatMap(s => s.fields).length
  const filledFields = SECTIONS.flatMap(s => s.fields).filter(f => fieldFilled(profile[f])).length
  const completionPct = Math.round((filledFields / totalFields) * 100)

  const showDialect = profile.language === 'arabic_only' || profile.language === 'both'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Client Profile</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filledFields}/{totalFields} fields &mdash; injected at the top of every AI call for this client
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3"/>
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
            Save Profile
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              completionPct === 100 ? 'bg-emerald-500' : 'bg-novax'
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <span className={cn(
          'text-xs font-bold shrink-0',
          completionPct === 100 ? 'text-emerald-600' : 'text-novax'
        )}>
          {completionPct}%
        </span>
      </div>

      {/* Section: Positioning */}
      <ProfileSection
        section={SECTIONS[0]}
        profile={profile}
        open={openSections.has('positioning')}
        onToggle={() => toggleSection('positioning')}
      >
        <TextField
          label="Positioning Statement"
          value={profile.positioning_statement}
          onChange={v => set('positioning_statement', v)}
          placeholder="What you do, for whom, and why differently. (e.g. 'Premium scented candles for UAE homebody women who want luxury at home.')"
          multiline
          maxLength={200}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Primary Offering"
            value={profile.primary_offering}
            onChange={v => set('primary_offering', v)}
            placeholder="e.g. Luxury oud candles"
          />
          <TextField
            label="Key Differentiator"
            value={profile.key_differentiator}
            onChange={v => set('key_differentiator', v)}
            placeholder="The ONE thing that sets them apart"
          />
        </div>
        <SelectField
          label="Price Positioning"
          value={profile.price_positioning}
          options={PRICE_OPTIONS}
          onChange={v => set('price_positioning', v as ClientNormalizedProfile['price_positioning'])}
        />
      </ProfileSection>

      {/* Section: Audience */}
      <ProfileSection
        section={SECTIONS[1]}
        profile={profile}
        open={openSections.has('audience')}
        onToggle={() => toggleSection('audience')}
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Age Range"
            value={profile.audience_age_range}
            onChange={v => set('audience_age_range', v)}
            placeholder="e.g. 25–40"
          />
          <SelectField
            label="Gender Skew"
            value={profile.audience_gender_skew}
            options={GENDER_OPTIONS}
            onChange={v => set('audience_gender_skew', v as ClientNormalizedProfile['audience_gender_skew'])}
          />
        </div>
        <TextField
          label="Location / Region"
          value={profile.audience_location}
          onChange={v => set('audience_location', v)}
          placeholder="e.g. UAE, Saudi Arabia"
        />
        <TextField
          label="Psychographic (Mindset / Lifestyle)"
          value={profile.audience_psychographic}
          onChange={v => set('audience_psychographic', v)}
          placeholder="e.g. Aspirational homebody women who value aesthetic living and self-care rituals"
          multiline
        />
      </ProfileSection>

      {/* Section: Voice & Language */}
      <ProfileSection
        section={SECTIONS[2]}
        profile={profile}
        open={openSections.has('voice')}
        onToggle={() => toggleSection('voice')}
      >
        <VoiceChips value={profile.brand_voice} onChange={v => set('brand_voice', v)}/>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Language"
            value={profile.language}
            options={LANGUAGE_OPTIONS}
            onChange={v => set('language', v as ClientNormalizedProfile['language'])}
          />
          <SelectField
            label="Formality Level"
            value={profile.formality}
            options={FORMALITY_OPTIONS}
            onChange={v => set('formality', v as ClientNormalizedProfile['formality'])}
          />
        </div>
        {showDialect && (
          <TextField
            label="Arabic Dialect"
            value={profile.arabic_dialect}
            onChange={v => set('arabic_dialect', v)}
            placeholder="e.g. Gulf (Khaleeji), Egyptian, Levantine, Modern Standard Arabic"
          />
        )}
        <SelectField
          label="Emoji Policy"
          value={profile.emoji_policy}
          options={EMOJI_OPTIONS}
          onChange={v => set('emoji_policy', v as ClientNormalizedProfile['emoji_policy'])}
        />
      </ProfileSection>

      {/* Section: Content Rules */}
      <ProfileSection
        section={SECTIONS[3]}
        profile={profile}
        open={openSections.has('content')}
        onToggle={() => toggleSection('content')}
      >
        <SelectField
          label="Current Business Goal"
          value={profile.content_goal}
          options={GOAL_OPTIONS}
          onChange={v => set('content_goal', v as ClientNormalizedProfile['content_goal'])}
        />
        <TextField
          label="Primary CTA"
          value={profile.primary_cta}
          onChange={v => set('primary_cta', v)}
          placeholder="e.g. DM us to book, link in bio, save for later"
        />
        <TextField
          label="Banned Topics / Words"
          value={profile.banned_topics}
          onChange={v => set('banned_topics', v)}
          placeholder="Topics, competitors, or associations to never mention"
          multiline
        />
        <SelectField
          label="Hashtag Policy"
          value={profile.hashtag_policy}
          options={HASHTAG_OPTIONS}
          onChange={v => set('hashtag_policy', v as ClientNormalizedProfile['hashtag_policy'])}
        />
      </ProfileSection>

      {/* Section: Social Presence */}
      <ProfileSection
        section={SECTIONS[4]}
        profile={profile}
        open={openSections.has('social')}
        onToggle={() => toggleSection('social')}
      >
        <SelectField
          label="Primary Platform"
          value={profile.primary_platform}
          options={PLATFORM_OPTIONS}
          onChange={v => set('primary_platform', v as SocialPlatform)}
        />
        <PlatformMultiSelect
          value={profile.secondary_platforms}
          exclude={profile.primary_platform as SocialPlatform | undefined}
          onChange={v => set('secondary_platforms', v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Posts Per Week" filled={profile.posts_per_week != null}/>
            <input
              type="number"
              min={1}
              max={30}
              value={profile.posts_per_week ?? ''}
              onChange={e => set('posts_per_week', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <TextField
            label="Best Posting Times"
            value={profile.best_posting_times}
            onChange={v => set('best_posting_times', v)}
            placeholder="e.g. Weekdays 7–9 PM Gulf time"
          />
        </div>
      </ProfileSection>
    </div>
  )
}
