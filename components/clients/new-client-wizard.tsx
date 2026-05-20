'use client'

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2, Building2, Mic2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateClient } from '@/lib/hooks/use-clients'
import type { CreateClientInput } from '@/lib/hooks/use-clients'
import type { Client } from '@/lib/types'

const STEPS = [
  { id: 1, label: 'Core',      icon: Building2 },
  { id: 2, label: 'Voice',     icon: Mic2 },
  { id: 3, label: 'Publishing', icon: Send },
]

const INDUSTRIES = [
  'Beauty & Cosmetics', 'Fashion & Apparel', 'Food & Beverage', 'Health & Fitness',
  'Dental & Healthcare', 'Real Estate', 'Hospitality & Tourism', 'Retail & E-commerce',
  'Finance & Banking', 'Education', 'Automotive', 'Legal & Professional Services',
  'Entertainment & Media', 'B2B SaaS', 'Non-Profit', 'Other',
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook'  },
  { id: 'tiktok',    label: 'TikTok'    },
  { id: 'linkedin',  label: 'LinkedIn'  },
  { id: 'twitter',   label: 'Twitter'   },
  { id: 'youtube',   label: 'YouTube'   },
]

interface FormState {
  // Step 1
  name: string
  industry: string
  primary_color: string
  language: 'en' | 'ar' | 'both'
  website: string
  // Step 2
  tone_formal: number
  tone_energy: number
  dialect: 'msa' | 'saudi' | 'egyptian' | 'gulf'
  audience: string
  key_messages: [string, string, string]
  // Step 3
  metricool_blog_id: string
  platforms: string[]
  posts_per_week: number
}

const INIT: FormState = {
  name: '', industry: '', primary_color: '#1B3D38', language: 'en', website: '',
  tone_formal: 50, tone_energy: 50, dialect: 'msa',
  audience: '',
  key_messages: ['', '', ''],
  metricool_blog_id: '', platforms: ['instagram', 'facebook'], posts_per_week: 4,
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all bg-white text-slate-800 placeholder:text-slate-400'
const selectCls = `${inputCls} cursor-pointer`

function Slider({ label, left, right, value, onChange }: {
  label: string; left: string; right: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="text-slate-400">{left}</span>
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="text-slate-400">{right}</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-novax cursor-pointer" />
    </div>
  )
}

export function NewClientWizard({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (client: Client) => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INIT)
  const [error, setError] = useState<string | null>(null)
  const createClient = useCreateClient()

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const togglePlatform = (id: string) =>
    set('platforms', form.platforms.includes(id)
      ? form.platforms.filter(p => p !== id)
      : [...form.platforms, id]
    )

  const setMsg = (i: number, val: string) => {
    const msgs = [...form.key_messages] as [string, string, string]
    msgs[i] = val
    set('key_messages', msgs)
  }

  function canAdvance(): boolean {
    if (step === 1) return !!form.name.trim() && !!form.industry
    if (step === 2) return !!form.audience.trim()
    return true
  }

  async function handleCreate() {
    setError(null)
    const input: CreateClientInput = {
      name: form.name.trim(),
      industry: form.industry,
      primary_color: form.primary_color,
      language: form.language,
      dialect: form.dialect,
      website: form.website,
      tone_formal: form.tone_formal,
      tone_energy: form.tone_energy,
      audience: form.audience.trim(),
      key_messages: form.key_messages.filter(Boolean),
      metricool_blog_id: form.metricool_blog_id.trim() || undefined,
      platforms: form.platforms,
      posts_per_week: form.posts_per_week,
    }
    try {
      const client = await createClient.mutateAsync(input)
      onSave(client)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
    }
  }

  const progress = ((step - 1) / 2) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">New Client</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step} of 3 — {STEPS[step - 1].label}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-0.5 bg-slate-100 shrink-0">
          <div className="h-full bg-novax transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Step tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-slate-100 shrink-0">
          {STEPS.map(s => (
            <button key={s.id}
              onClick={() => step > s.id && setStep(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                step === s.id ? 'bg-novax text-white' :
                step > s.id ? 'bg-novax-light text-novax cursor-pointer hover:bg-novax-light-hover' :
                'text-slate-400 cursor-default'
              )}>
              {step > s.id ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Step 1: Core ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Privea Dent" className={inputCls} autoFocus />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Industry <span className="text-red-400">*</span></label>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} className={selectCls}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primary_color}
                      onChange={e => set('primary_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 shrink-0" />
                    <input value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                      placeholder="#000000" className={`${inputCls} flex-1`} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Content Language</label>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                    {(['en', 'ar', 'both'] as const).map(l => (
                      <button key={l} onClick={() => set('language', l)}
                        className={cn('flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors',
                          form.language === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        {l === 'en' ? 'EN' : l === 'ar' ? 'AR' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Website <span className="text-slate-400 font-normal">(optional)</span></label>
                <input value={form.website} onChange={e => set('website', e.target.value)}
                  placeholder="https://brand.com" className={inputCls} type="url" />
              </div>
            </>
          )}

          {/* ── Step 2: Voice ── */}
          {step === 2 && (
            <>
              <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Brand Tone</p>
                <Slider label="Formality" left="Casual" right="Formal"
                  value={form.tone_formal} onChange={v => set('tone_formal', v)} />
                <Slider label="Energy" left="Serious" right="Playful"
                  value={form.tone_energy} onChange={v => set('tone_energy', v)} />
              </div>

              {(form.language === 'ar' || form.language === 'both') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Arabic Dialect</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'msa',      label: 'MSA (فصحى)',      desc: 'Pan-Arab, formal' },
                      { id: 'saudi',    label: 'Saudi (خليجي)',    desc: 'KSA / Gulf social media' },
                      { id: 'egyptian', label: 'Egyptian (مصري)',  desc: 'Most understood dialect' },
                      { id: 'gulf',     label: 'Gulf (خليجي عام)', desc: 'UAE, Kuwait, Qatar, Oman' },
                    ] as const).map(d => (
                      <button key={d.id}
                        onClick={() => set('dialect', d.id)}
                        className={cn(
                          'text-left px-3 py-2 rounded-lg border text-xs transition-all',
                          form.dialect === d.id
                            ? 'border-novax-border-active bg-novax-light text-novax'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}>
                        <p className="font-semibold">{d.label}</p>
                        <p className="text-[10px] mt-0.5 opacity-60">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Target Audience <span className="text-red-400">*</span>
                </label>
                <textarea value={form.audience} onChange={e => set('audience', e.target.value)}
                  rows={3} placeholder="e.g. Adults 25–45 in Dubai seeking premium dental care. Value aesthetics, hygiene, and a pain-free experience."
                  className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Key Messages <span className="text-slate-400 font-normal">(up to 3)</span>
                </label>
                <div className="space-y-2">
                  {form.key_messages.map((msg, i) => (
                    <input key={i} value={msg} onChange={e => setMsg(i, e.target.value)}
                      placeholder={`Message ${i + 1}…`} className={inputCls} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Publishing ── */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Metricool Blog ID</label>
                <p className="text-[11px] text-slate-400 mb-1.5">
                  Found in your Metricool URL: <span className="font-mono">?blogId=<span className="text-novax-muted">6276264</span></span>
                </p>
                <input value={form.metricool_blog_id}
                  onChange={e => set('metricool_blog_id', e.target.value)}
                  placeholder="e.g. 6276264"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Active Platforms</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                        form.platforms.includes(p.id)
                          ? 'border-novax-border-active bg-novax-light text-novax'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Posts per week — <span className="text-novax font-semibold">{form.posts_per_week}</span>
                </label>
                <input type="range" min={1} max={14} value={form.posts_per_week}
                  onChange={e => set('posts_per_week', Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-novax cursor-pointer" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>1/week</span><span>14/week</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mx-6 mb-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 shrink-0">{error}</p>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            {step > 1 && <ChevronLeft className="w-4 h-4" />}
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={createClient.isPending}
              className="flex items-center gap-1.5 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {createClient.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
                : <><Check className="w-4 h-4" />Create Client</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
