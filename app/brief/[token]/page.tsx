'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle, XCircle, Loader2, ChevronLeft,
  Image, LayoutGrid, Video, Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentBriefData, ContentType } from '@/lib/types'

// ── NOVAX logo mark ───────────────────────────────────────────────────────────

function NovaLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-novax flex items-center justify-center shrink-0">
        <span className="text-white font-black text-[11px] tracking-tighter">NX</span>
      </div>
      <span className="text-sm font-bold text-slate-900 tracking-tight">NOVAX</span>
    </div>
  )
}

// ── Option datasets ───────────────────────────────────────────────────────────

const CONTENT_TYPES: { id: ContentType; label: string; desc: string; Icon: typeof Image }[] = [
  { id: 'static',   label: 'Static Image', desc: 'Single photo or graphic',    Icon: Image },
  { id: 'carousel', label: 'Carousel',     desc: 'Multi-slide swipeable post', Icon: LayoutGrid },
  { id: 'reel',     label: 'Reel',         desc: 'Short video (15–60 sec)',     Icon: Video },
  { id: 'story',    label: 'Story',        desc: 'Vertical temporary content',  Icon: Smartphone },
]

const VISUAL_FEELINGS = [
  { id: 'Bold & Impactful',   desc: 'Strong visuals, high contrast' },
  { id: 'Clean & Minimal',    desc: 'White space, simplicity first' },
  { id: 'Luxury & Premium',   desc: 'Elegant, refined aesthetic' },
  { id: 'Warm & Inviting',    desc: 'Friendly, approachable feel' },
  { id: 'Playful & Fun',      desc: 'Energetic, vibrant, youthful' },
  { id: 'Professional',       desc: 'Trustworthy, corporate tone' },
]

const SUBJECT_FOCUS = [
  { id: 'People',             desc: 'People are the main subject' },
  { id: 'Product only',       desc: 'Product is the hero' },
  { id: 'Abstract / Graphic', desc: 'No real subjects — graphic art' },
  { id: 'Mix of both',        desc: 'People and product together' },
]

const TEXT_ON_IMAGE = [
  { id: 'No text',       desc: 'Purely visual — no written words' },
  { id: 'Headline only', desc: 'One short, punchy line' },
  { id: 'Detailed copy', desc: 'Headline + supporting body text' },
]

const SLIDE_COUNTS = [4, 6, 8, 10]

const FIRST_SLIDE_TYPES = [
  { id: 'Bold claim',        desc: 'A strong, direct statement' },
  { id: 'Hook question',     desc: 'A question that draws you in' },
  { id: 'Statistic',         desc: 'A striking number or fact' },
  { id: 'Problem statement', desc: 'The pain point we solve' },
]

const LAST_SLIDE_CTAS = [
  { id: 'Follow us',       desc: 'Ask them to follow the account' },
  { id: 'Send us a DM',    desc: 'Invite them to message directly' },
  { id: 'Visit the link',  desc: 'Drive traffic to a URL' },
  { id: 'Save for later',  desc: 'Encourage saving the post' },
]

const TEXT_DENSITIES = [
  { id: 'Minimal text',  desc: 'Very few words per slide' },
  { id: 'Balanced',      desc: 'Some text, mostly visual' },
  { id: 'Text-heavy',    desc: 'Educational, info-dense slides' },
]

const REEL_DURATIONS = ['15 seconds', '30 seconds', '60 seconds']

const OPENING_STYLES = [
  { id: 'Bold text hook',   desc: 'Strong on-screen text appears immediately' },
  { id: 'Action shot',      desc: 'Jump straight into movement or action' },
  { id: 'Question overlay', desc: 'Open with a question overlaid on video' },
  { id: 'Product reveal',   desc: 'Dramatic slow reveal of the product' },
  { id: 'Before & after',   desc: 'Show the result first, then rewind' },
]

const ON_CAMERA = [
  { id: 'Person only',          desc: 'Someone on camera throughout' },
  { id: 'Product focus',        desc: 'Product is the main subject' },
  { id: 'Person & product',     desc: 'Both appear in the reel' },
  { id: 'Motion graphic only',  desc: 'Animated graphics, no live footage' },
]

const MUSIC_VIBES = [
  { id: 'Energetic & upbeat',    desc: 'Fast-paced, high energy' },
  { id: 'Cinematic & emotional', desc: 'Slow, dramatic, inspiring' },
  { id: 'Trending / viral',      desc: 'Whatever is trending right now' },
  { id: 'Calm & peaceful',       desc: 'Soft, relaxed background music' },
]

const REEL_GOALS = [
  { id: 'Brand awareness',  desc: 'Introduce or reinforce the brand' },
  { id: 'Product education', desc: 'Explain what we do or sell' },
  { id: 'Promotion / offer', desc: 'Drive sales or highlight an offer' },
  { id: 'Entertainment',    desc: 'Entertain the audience, not sell' },
  { id: 'Social proof',     desc: 'Testimonial or results-driven content' },
]

const STORY_PURPOSES = [
  { id: 'Announcement',      desc: 'Share news or a launch' },
  { id: 'Poll',              desc: 'Ask the audience something' },
  { id: 'Q&A',              desc: 'Answer questions from followers' },
  { id: 'Behind the scenes', desc: 'Show the human side of the brand' },
  { id: 'Countdown',         desc: 'Build anticipation for something coming' },
]

const STORY_INTERACTIVE = [
  'Poll', 'Question sticker', 'Countdown timer', 'Link sticker', 'None',
]

const URGENCY_OPTIONS = [
  { id: 'By the deadline',  desc: 'Whenever the due date is — that is fine' },
  { id: 'As soon as possible', desc: 'We need this urgently, sooner is better' },
  { id: 'Flexible',         desc: 'No hard deadline, take your time' },
]

// ── Reusable card components ──────────────────────────────────────────────────

function CardOption({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left border rounded-xl p-3.5 transition-all cursor-pointer',
        selected
          ? 'border-novax bg-novax-light ring-1 ring-novax'
          : 'border-slate-200 hover:border-novax-border bg-white',
        className,
      )}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-sm font-semibold text-slate-800 mb-3">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </p>
  )
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all',
        active
          ? 'bg-novax text-white border-novax'
          : 'border-slate-200 text-slate-600 hover:border-novax-border bg-white',
      )}
    >
      {children}
    </button>
  )
}

// ── Page state ────────────────────────────────────────────────────────────────

interface BriefInfo {
  task_title: string
  client_name: string
  client_color: string
  status: string
}

type FormState = Partial<ContentBriefData> & { submitter_name: string }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [briefInfo, setBriefInfo] = useState<BriefInfo | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>({ submitter_name: '' })
  const [interactiveEls, setInteractiveEls] = useState<string[]>([])
  const [linkRefs, setLinkRefs] = useState(['', '', ''])

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/brief-requests/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setFetchError(data.error); return }
        setBriefInfo(data)
        if (data.status === 'submitted') setSubmitted(true)
      })
      .catch(() => setFetchError('Failed to load brief request.'))
      .finally(() => setLoading(false))
  }, [token])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const isStepValid = (): boolean => {
    if (step === 1) return !!form.content_type
    if (step === 2) {
      if (form.content_type === 'static')   return !!form.main_message?.trim()
      if (form.content_type === 'carousel') return !!form.carousel_topic?.trim()
      if (form.content_type === 'reel')     return !!form.key_message?.trim()
      if (form.content_type === 'story')    return !!form.story_message?.trim()
      return false
    }
    if (step === 3) return !!form.urgency
    if (step === 4) return !!form.submitter_name?.trim()
    return false
  }

  const handleNext = () => { if (isStepValid()) setStep(s => s + 1) }

  const handleSubmit = async () => {
    if (!isStepValid() || !token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: ContentBriefData = {
        ...(form as ContentBriefData),
        content_type: form.content_type!,
        interactive_elements: interactiveEls,
        reference_links: linkRefs.filter(l => l.trim()),
      }
      const res = await fetch(`/api/brief-requests/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setSubmitError(data.error ?? 'Submission failed.'); return }
      setSubmitted(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Static states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-novax-muted animate-spin" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Link not found</h2>
          <p className="text-sm text-slate-500">{fetchError}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Brief submitted</h2>
          <p className="text-sm text-slate-500">
            Your creative brief has been received. The team will get started and reach out if they have questions.
          </p>
        </div>
      </div>
    )
  }

  if (!briefInfo) return null

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">What type of content is this?</h2>
      <p className="text-sm text-slate-500 mb-6">Select the format you need designed.</p>
      <div className="grid grid-cols-2 gap-3">
        {CONTENT_TYPES.map(({ id, label, desc, Icon }) => (
          <CardOption
            key={id}
            selected={form.content_type === id}
            onClick={() => { set('content_type', id); setStep(2) }}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center mb-2.5',
              form.content_type === id ? 'bg-novax' : 'bg-slate-100',
            )}>
              <Icon className={cn('w-4 h-4', form.content_type === id ? 'text-white' : 'text-slate-500')} />
            </div>
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
          </CardOption>
        ))}
      </div>
    </div>
  )

  const renderStep2Static = () => (
    <div className="space-y-8">
      <div>
        <FieldLabel required>What is the main message for this post?</FieldLabel>
        <textarea
          value={form.main_message ?? ''}
          onChange={e => set('main_message', e.target.value)}
          rows={3}
          placeholder="e.g. Announce our new summer collection — bold, aspirational, product-focused"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <div>
        <FieldLabel>What feeling should this image give?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {VISUAL_FEELINGS.map(o => (
            <CardOption key={o.id} selected={form.visual_feeling === o.id} onClick={() => set('visual_feeling', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>What should the image show?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {SUBJECT_FOCUS.map(o => (
            <CardOption key={o.id} selected={form.subject_focus === o.id} onClick={() => set('subject_focus', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>How much text should appear on the image?</FieldLabel>
        <div className="space-y-2">
          {TEXT_ON_IMAGE.map(o => (
            <CardOption key={o.id} selected={form.text_on_image === o.id} onClick={() => set('text_on_image', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Reference links for style or inspiration (optional)</FieldLabel>
        <div className="space-y-2">
          {linkRefs.map((link, i) => (
            <input
              key={i}
              value={link}
              onChange={e => {
                const next = [...linkRefs]
                next[i] = e.target.value
                setLinkRefs(next)
              }}
              placeholder={`Reference link ${i + 1}`}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-novax text-slate-700 placeholder:text-slate-400"
            />
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep2Carousel = () => (
    <div className="space-y-8">
      <div>
        <FieldLabel required>What is this carousel about?</FieldLabel>
        <textarea
          value={form.carousel_topic ?? ''}
          onChange={e => set('carousel_topic', e.target.value)}
          rows={3}
          placeholder="e.g. 5 reasons to choose our product — educational, benefit-driven, persuasive"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <div>
        <FieldLabel>How many slides?</FieldLabel>
        <div className="flex gap-3 flex-wrap">
          {SLIDE_COUNTS.map(n => (
            <PillButton key={n} active={form.slide_count === n} onClick={() => set('slide_count', n)}>
              {n} slides
            </PillButton>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>What should the first slide be?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {FIRST_SLIDE_TYPES.map(o => (
            <CardOption key={o.id} selected={form.first_slide_type === o.id} onClick={() => set('first_slide_type', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>What should the last slide say?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {LAST_SLIDE_CTAS.map(o => (
            <CardOption key={o.id} selected={form.last_slide_cta === o.id} onClick={() => set('last_slide_cta', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Overall mood?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {VISUAL_FEELINGS.map(o => (
            <CardOption key={o.id} selected={form.visual_feeling === o.id} onClick={() => set('visual_feeling', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>How much text per slide?</FieldLabel>
        <div className="space-y-2">
          {TEXT_DENSITIES.map(o => (
            <CardOption key={o.id} selected={form.text_density === o.id} onClick={() => set('text_density', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep2Reel = () => (
    <div className="space-y-8">
      <div>
        <FieldLabel required>In one sentence — what is the core message?</FieldLabel>
        <textarea
          value={form.key_message ?? ''}
          onChange={e => set('key_message', e.target.value)}
          rows={2}
          placeholder="e.g. This product saves busy people 2 hours every single day"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <div>
        <FieldLabel>How long should the reel be?</FieldLabel>
        <div className="flex gap-3 flex-wrap">
          {REEL_DURATIONS.map(d => (
            <PillButton key={d} active={form.duration === d} onClick={() => set('duration', d)}>
              {d}
            </PillButton>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>How should the reel open?</FieldLabel>
        <div className="space-y-2">
          {OPENING_STYLES.map(o => (
            <CardOption key={o.id} selected={form.opening_style === o.id} onClick={() => set('opening_style', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Who or what appears in the reel?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {ON_CAMERA.map(o => (
            <CardOption key={o.id} selected={form.on_camera === o.id} onClick={() => set('on_camera', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>What music vibe fits this reel?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {MUSIC_VIBES.map(o => (
            <CardOption key={o.id} selected={form.music_vibe === o.id} onClick={() => set('music_vibe', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400 mt-0.5">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>What should this reel achieve?</FieldLabel>
        <div className="space-y-2">
          {REEL_GOALS.map(o => (
            <CardOption key={o.id} selected={form.reel_goal === o.id} onClick={() => set('reel_goal', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Any specific scenes or moments to include? (optional)</FieldLabel>
        <textarea
          value={form.specific_scenes ?? ''}
          onChange={e => set('specific_scenes', e.target.value)}
          rows={3}
          placeholder="e.g. Must show the product being unboxed, then someone using it outdoors in daylight"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
    </div>
  )

  const renderStep2Story = () => (
    <div className="space-y-8">
      <div>
        <FieldLabel required>What is this story's message?</FieldLabel>
        <textarea
          value={form.story_message ?? ''}
          onChange={e => set('story_message', e.target.value)}
          rows={2}
          placeholder="e.g. Announce our weekend flash sale — 20% off everything, 48 hours only"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <div>
        <FieldLabel>What is the purpose of this story?</FieldLabel>
        <div className="space-y-2">
          {STORY_PURPOSES.map(o => (
            <CardOption key={o.id} selected={form.story_purpose === o.id} onClick={() => set('story_purpose', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Interactive elements (select all that apply)</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {STORY_INTERACTIVE.map(el => {
            const active = interactiveEls.includes(el)
            return (
              <button
                key={el}
                type="button"
                onClick={() =>
                  setInteractiveEls(prev =>
                    active ? prev.filter(e => e !== el) : [...prev, el],
                  )
                }
                className={cn(
                  'px-4 py-2 rounded-full border text-sm font-medium transition-all',
                  active
                    ? 'bg-novax text-white border-novax'
                    : 'border-slate-200 text-slate-600 hover:border-novax-border bg-white',
                )}
              >
                {el}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => {
    const type = form.content_type
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Tell us exactly what you need</h2>
          <p className="text-sm text-slate-500">The more detail you provide, the fewer revisions needed.</p>
        </div>
        {type === 'static'   && renderStep2Static()}
        {type === 'carousel' && renderStep2Carousel()}
        {type === 'reel'     && renderStep2Reel()}
        {type === 'story'    && renderStep2Story()}
      </div>
    )
  }

  const renderStep3 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">When do you need this?</h2>
        <p className="text-sm text-slate-500">Help us prioritise your request correctly.</p>
      </div>
      <div>
        <FieldLabel>Target date (optional)</FieldLabel>
        <input
          type="date"
          value={form.needed_by ?? ''}
          onChange={e => set('needed_by', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-novax text-slate-700"
        />
      </div>
      <div>
        <FieldLabel required>How urgent is this request?</FieldLabel>
        <div className="space-y-2">
          {URGENCY_OPTIONS.map(o => (
            <CardOption key={o.id} selected={form.urgency === o.id} onClick={() => set('urgency', o.id)}>
              <p className="text-sm font-semibold text-slate-800">{o.id}</p>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </CardOption>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Almost done</h2>
        <p className="text-sm text-slate-500">Add any final details and submit.</p>
      </div>
      <div>
        <FieldLabel>Anything else the designer should know? (optional)</FieldLabel>
        <textarea
          value={form.additional_notes ?? ''}
          onChange={e => set('additional_notes', e.target.value)}
          rows={4}
          placeholder="e.g. Avoid using red, make sure the logo is prominent, we love the style from our March campaign"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-novax resize-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <div>
        <FieldLabel required>Your name</FieldLabel>
        <input
          type="text"
          value={form.submitter_name ?? ''}
          onChange={e => set('submitter_name', e.target.value)}
          placeholder="e.g. Sara from Marketing"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-novax text-slate-700 placeholder:text-slate-400"
        />
      </div>
      {submitError && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3 border border-red-100">
          {submitError}
        </p>
      )}
    </div>
  )

  const STEP_LABELS = ['Content type', 'Details', 'Timeline', 'Final notes']
  const valid = isStepValid()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <NovaLogo />
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-xs text-slate-400">Creative Brief</span>
          <span className="text-[11px] font-semibold text-novax-muted bg-novax-light px-2.5 py-1 rounded-full border border-novax-border">
            Step {step} of 4
          </span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b border-slate-100 px-5 py-2.5">
        <div className="flex gap-1.5 mb-1.5">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                s <= step ? 'bg-novax' : 'bg-slate-200',
              )}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-400">{STEP_LABELS[step - 1]}</p>
      </div>

      {/* Task context banner */}
      <div className="bg-novax-light border-b border-novax-border px-5 py-2.5">
        <p className="text-xs text-novax-muted">
          Brief for: <span className="font-semibold text-novax">{briefInfo.task_title}</span>
        </p>
      </div>

      {/* Form body */}
      <div className="flex-1 max-w-lg mx-auto w-full px-5 py-8">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Footer navigation */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex items-center gap-3">
        {step === 1 ? (
          <p className="text-xs text-slate-400 w-full text-center">
            Select a content type above to continue
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!valid}
                className="flex-1 py-2.5 rounded-xl bg-novax hover:bg-novax-hover text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!valid || submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-novax hover:bg-novax-hover text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit Brief'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
