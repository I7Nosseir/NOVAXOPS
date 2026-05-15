'use client'

import { useState } from 'react'
import {
  X, ChevronRight, ChevronLeft, Check,
  Globe,
  Plus, Trash2, Building2, Users, Target,
  MessageSquare, BarChart2, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Identity',        icon: Building2 },
  { id: 2, label: 'Social',          icon: Globe },
  { id: 3, label: 'Competitors',     icon: Target },
  { id: 4, label: 'Brand',           icon: MessageSquare },
  { id: 5, label: 'Tone',            icon: MessageSquare },
  { id: 6, label: 'Audience',        icon: Users },
  { id: 7, label: 'Strategy',        icon: BarChart2 },
  { id: 8, label: 'Goals',           icon: Target },
  { id: 9, label: 'Resources',       icon: FileText },
]

const INDUSTRIES = [
  'Beauty & Cosmetics', 'Fashion & Apparel', 'Food & Beverage', 'Health & Fitness',
  'Real Estate', 'Hospitality & Tourism', 'Retail & E-commerce', 'B2B SaaS',
  'Finance & Banking', 'Healthcare', 'Education', 'Automotive',
  'Entertainment & Media', 'Non-Profit', 'Legal & Professional Services', 'Other',
]

const TIMEZONES = ['UTC+4 (Dubai)', 'UTC+3 (Riyadh)', 'UTC+2 (Cairo)', 'UTC+0 (London)', 'UTC-5 (New York)', 'UTC+8 (Singapore)']
const PACKAGES  = ['Basic', 'Growth', 'Premium', 'Enterprise']
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube', 'pinterest'] as const
const FORMATS   = ['Reels', 'Carousels', 'Static Posts', 'Stories', 'UGC', 'Long-form Video']
const GOALS     = ['Brand Awareness', 'Engagement Growth', 'Lead Generation', 'Sales Conversion', 'Community Building']
const KPIS      = ['Follower Growth', 'Engagement Rate', 'Reach', 'Link Clicks', 'DMs', 'Saves', 'Story Views', 'Conversions']

const VISUAL_STYLES = ['Minimal', 'Bold', 'Luxurious', 'Playful', 'Raw & Authentic', 'Editorial', 'Corporate', 'Street']

type Pillar = { name: string; weight: number }
type Competitor = { name: string; website: string; instagram: string; type: 'direct' | 'aspirational' }

interface FormData {
  // Step 1
  name: string; industry: string; website: string; country: string
  timezone: string; contact_name: string; contact_email: string
  contract_start: string; package: string
  // Step 2
  social: Record<string, string>; primary_platform: string
  // Step 3
  competitors: Competitor[]
  // Step 4
  primary_color: string; secondary_colors: string[]; visual_styles: string[]; font: string
  // Step 5
  tone_formal: number; tone_serious: number; tone_informative: number; tone_reserved: number
  brand_dos: string[]; brand_donts: string[]
  // Step 6
  age_min: number; age_max: number; gender_female_pct: number
  locations: string[]; interests: string[]; pain_points: string[]
  // Step 7
  pillars: Pillar[]; formats: string[]
  posting_freq: Record<string, number>
  // Step 8
  primary_goal: string; kpis: string[]; monthly_volume: number
  // Step 9
  drive_link: string; notes: string; language: 'en' | 'ar' | 'both'
}

const INITIAL: FormData = {
  name: '', industry: '', website: '', country: '', timezone: '', contact_name: '',
  contact_email: '', contract_start: '', package: '',
  social: {}, primary_platform: '',
  competitors: [{ name: '', website: '', instagram: '', type: 'direct' }],
  primary_color: '#1B3D38', secondary_colors: [''], visual_styles: [], font: '',
  tone_formal: 50, tone_serious: 50, tone_informative: 50, tone_reserved: 50,
  brand_dos: [''], brand_donts: [''],
  age_min: 18, age_max: 45, gender_female_pct: 50,
  locations: [''], interests: [''], pain_points: [''],
  pillars: [{ name: '', weight: 100 }], formats: [], posting_freq: {},
  primary_goal: '', kpis: [], monthly_volume: 20,
  drive_link: '', notes: '', language: 'en',
}

function ToneSlider({ label, left, right, value, onChange }: {
  label: string; left: string; right: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{left}</span><span className="font-medium text-slate-700">{label}</span><span>{right}</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-novax cursor-pointer"
      />
    </div>
  )
}

function ListInput({ values, onChange, placeholder }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const update = (i: number, val: string) => { const n = [...values]; n[i] = val; onChange(n) }
  const add = () => onChange([...values, ''])
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input value={v} onChange={e => update(i, e.target.value)} placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all" />
          {values.length > 1 && (
            <button onClick={() => remove(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-novax-muted hover:text-novax font-medium transition-colors">
        <Plus className="w-3 h-3" />Add
      </button>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all bg-white text-slate-800 placeholder:text-slate-400"
const selectCls = `${inputCls} cursor-pointer`

export function NewClientWizard({ onClose, onSave }: { onClose: () => void; onSave: (data: FormData) => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)

  const set = (key: keyof FormData, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  const next = () => setStep(s => Math.min(s + 1, 9))
  const back = () => setStep(s => Math.max(s - 1, 1))

  const progress = ((step - 1) / 8) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">New Client</h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 9 — {STEPS[step - 1].label}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-novax transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>

        {/* Step nav */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-100 overflow-x-auto">
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                step === s.id ? 'bg-novax text-white' : step > s.id ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600'
              )}>
              {step > s.id ? <Check className="w-3 h-3" /> : <span>{s.id}</span>}
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1 — Identity */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Brand Name" required>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Luxe Cosmetics" className={inputCls} />
                </Field>
              </div>
              <Field label="Industry" required>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} className={selectCls}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Website">
                <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://brand.com" className={inputCls} />
              </Field>
              <Field label="Country">
                <input value={form.country} onChange={e => set('country', e.target.value)} placeholder="UAE" className={inputCls} />
              </Field>
              <Field label="Timezone">
                <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className={selectCls}>
                  <option value="">Select timezone</option>
                  {TIMEZONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Contact Name">
                <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Full name" className={inputCls} />
              </Field>
              <Field label="Contact Email">
                <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@brand.com" type="email" className={inputCls} />
              </Field>
              <Field label="Contract Start">
                <input value={form.contract_start} onChange={e => set('contract_start', e.target.value)} type="date" className={inputCls} />
              </Field>
              <Field label="Package">
                <select value={form.package} onChange={e => set('package', e.target.value)} className={selectCls}>
                  <option value="">Select package</option>
                  {PACKAGES.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* Step 2 — Social Profiles */}
          {step === 2 && (
            <div className="space-y-4">
              {PLATFORMS.map(p => (
                <Field key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}>
                  <input
                    value={form.social[p] ?? ''}
                    onChange={e => set('social', { ...form.social, [p]: e.target.value })}
                    placeholder={`https://${p}.com/yourbrand`}
                    className={inputCls}
                  />
                </Field>
              ))}
              <Field label="Primary Platform" required>
                <select value={form.primary_platform} onChange={e => set('primary_platform', e.target.value)} className={selectCls}>
                  <option value="">Where is the main focus?</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* Step 3 — Competitors */}
          {step === 3 && (
            <div className="space-y-5">
              {form.competitors.map((c, i) => (
                <div key={i} className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Competitor {i + 1}</p>
                    {form.competitors.length > 1 && (
                      <button onClick={() => set('competitors', form.competitors.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={c.name} onChange={e => { const n=[...form.competitors]; n[i]={...n[i],name:e.target.value}; set('competitors',n) }}
                      placeholder="Brand name" className={inputCls} />
                    <input value={c.website} onChange={e => { const n=[...form.competitors]; n[i]={...n[i],website:e.target.value}; set('competitors',n) }}
                      placeholder="Website URL" className={inputCls} />
                    <input value={c.instagram} onChange={e => { const n=[...form.competitors]; n[i]={...n[i],instagram:e.target.value}; set('competitors',n) }}
                      placeholder="Instagram handle" className={inputCls} />
                    <select value={c.type} onChange={e => { const n=[...form.competitors]; n[i]={...n[i],type:e.target.value as 'direct'|'aspirational'}; set('competitors',n) }}
                      className={selectCls}>
                      <option value="direct">Direct competitor</option>
                      <option value="aspirational">Aspirational</option>
                    </select>
                  </div>
                </div>
              ))}
              {form.competitors.length < 5 && (
                <button onClick={() => set('competitors', [...form.competitors, { name:'', website:'', instagram:'', type:'direct' }])}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-novax-border hover:text-novax transition-colors w-full justify-center">
                  <Plus className="w-3.5 h-3.5" />Add Competitor
                </button>
              )}
            </div>
          )}

          {/* Step 4 — Brand Identity */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary Brand Color" required>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primary_color}
                      onChange={e => set('primary_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                    <input value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                      placeholder="#000000" className={`${inputCls} flex-1`} />
                  </div>
                </Field>
                <Field label="Font Preference">
                  <input value={form.font} onChange={e => set('font', e.target.value)}
                    placeholder="e.g. Helvetica, Futura" className={inputCls} />
                </Field>
              </div>
              <Field label="Secondary Colors">
                <div className="space-y-2">
                  {form.secondary_colors.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="color" value={c || '#ffffff'}
                        onChange={e => { const n=[...form.secondary_colors]; n[i]=e.target.value; set('secondary_colors',n) }}
                        className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                      <input value={c} onChange={e => { const n=[...form.secondary_colors]; n[i]=e.target.value; set('secondary_colors',n) }}
                        placeholder="#ffffff" className={`${inputCls} flex-1`} />
                      {form.secondary_colors.length > 1 && (
                        <button onClick={() => set('secondary_colors', form.secondary_colors.filter((_,idx)=>idx!==i))}
                          className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      )}
                    </div>
                  ))}
                  {form.secondary_colors.length < 3 && (
                    <button onClick={() => set('secondary_colors', [...form.secondary_colors, ''])}
                      className="flex items-center gap-1.5 text-xs text-novax-muted hover:text-novax font-medium transition-colors">
                      <Plus className="w-3 h-3" />Add color
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Visual Style">
                <div className="flex flex-wrap gap-2">
                  {VISUAL_STYLES.map(s => (
                    <button key={s} onClick={() => {
                      const has = form.visual_styles.includes(s)
                      set('visual_styles', has ? form.visual_styles.filter(x=>x!==s) : [...form.visual_styles, s])
                    }}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.visual_styles.includes(s) ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* Step 5 — Voice & Tone */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-5 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tone Sliders</p>
                <ToneSlider label="Formality" left="Casual" right="Formal" value={form.tone_formal} onChange={v => set('tone_formal', v)} />
                <ToneSlider label="Energy" left="Serious" right="Playful" value={form.tone_serious} onChange={v => set('tone_serious', v)} />
                <ToneSlider label="Purpose" left="Entertaining" right="Informative" value={form.tone_informative} onChange={v => set('tone_informative', v)} />
                <ToneSlider label="Presence" left="Bold" right="Reserved" value={form.tone_reserved} onChange={v => set('tone_reserved', v)} />
              </div>
              <Field label="Brand Do's">
                <ListInput values={form.brand_dos} onChange={v => set('brand_dos', v)} placeholder="e.g. Always lead with the benefit" />
              </Field>
              <Field label="Brand Don'ts">
                <ListInput values={form.brand_donts} onChange={v => set('brand_donts', v)} placeholder="e.g. Never use aggressive sales language" />
              </Field>
            </div>
          )}

          {/* Step 6 — Target Audience */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Age Range">
                  <div className="flex gap-2 items-center">
                    <input type="number" value={form.age_min} onChange={e => set('age_min', Number(e.target.value))} min={13} max={80}
                      placeholder="Min" className={inputCls} />
                    <span className="text-slate-400 text-sm shrink-0">to</span>
                    <input type="number" value={form.age_max} onChange={e => set('age_max', Number(e.target.value))} min={13} max={80}
                      placeholder="Max" className={inputCls} />
                  </div>
                </Field>
                <Field label={`Gender Split — ${form.gender_female_pct}% Female`}>
                  <input type="range" min={0} max={100} value={form.gender_female_pct}
                    onChange={e => set('gender_female_pct', Number(e.target.value))}
                    className="w-full h-1.5 mt-3 rounded-full appearance-none bg-slate-200 accent-novax cursor-pointer" />
                </Field>
              </div>
              <Field label="Key Locations">
                <ListInput values={form.locations} onChange={v => set('locations', v)} placeholder="e.g. Dubai, UAE" />
              </Field>
              <Field label="Audience Interests">
                <ListInput values={form.interests} onChange={v => set('interests', v)} placeholder="e.g. Skincare, wellness" />
              </Field>
              <Field label="Pain Points">
                <ListInput values={form.pain_points} onChange={v => set('pain_points', v)} placeholder="e.g. Overwhelmed by product choices" />
              </Field>
            </div>
          )}

          {/* Step 7 — Content Strategy */}
          {step === 7 && (
            <div className="space-y-5">
              <Field label="Content Pillars">
                <div className="space-y-2">
                  {form.pillars.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={p.name} onChange={e => { const n=[...form.pillars]; n[i]={...n[i],name:e.target.value}; set('pillars',n) }}
                        placeholder={`Pillar ${i + 1} name`} className={`${inputCls} flex-1`} />
                      <input type="number" value={p.weight} onChange={e => { const n=[...form.pillars]; n[i]={...n[i],weight:Number(e.target.value)}; set('pillars',n) }}
                        min={5} max={100} className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted text-center" />
                      <span className="text-xs text-slate-400 shrink-0">%</span>
                      {form.pillars.length > 1 && (
                        <button onClick={() => set('pillars', form.pillars.filter((_,idx)=>idx!==i))}
                          className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      )}
                    </div>
                  ))}
                  {form.pillars.length < 6 && (
                    <button onClick={() => set('pillars', [...form.pillars, { name:'', weight: 0 }])}
                      className="flex items-center gap-1.5 text-xs text-novax-muted hover:text-novax font-medium transition-colors">
                      <Plus className="w-3 h-3" />Add pillar
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Preferred Content Formats">
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map(f => (
                    <button key={f} onClick={() => {
                      const has = form.formats.includes(f)
                      set('formats', has ? form.formats.filter(x=>x!==f) : [...form.formats, f])
                    }}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.formats.includes(f) ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                      {f}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Posting Frequency (posts/week)">
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS.filter(p => form.social[p]).map(p => (
                    <div key={p} className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg">
                      <span className="text-sm text-slate-600 capitalize">{p}</span>
                      <input type="number" min={0} max={21}
                        value={form.posting_freq[p] ?? 3}
                        onChange={e => set('posting_freq', { ...form.posting_freq, [p]: Number(e.target.value) })}
                        className="w-14 text-center text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-novax-muted" />
                    </div>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* Step 8 — Goals & KPIs */}
          {step === 8 && (
            <div className="space-y-5">
              <Field label="Primary Goal" required>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map(g => (
                    <button key={g} onClick={() => set('primary_goal', g)}
                      className={cn('px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all',
                        form.primary_goal === g ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="KPIs to Track">
                <div className="flex flex-wrap gap-2">
                  {KPIS.map(k => (
                    <button key={k} onClick={() => {
                      const has = form.kpis.includes(k)
                      set('kpis', has ? form.kpis.filter(x=>x!==k) : [...form.kpis, k])
                    }}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.kpis.includes(k) ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                      {k}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Monthly Content Volume Target">
                <div className="flex items-center gap-4">
                  <input type="range" min={4} max={120} value={form.monthly_volume}
                    onChange={e => set('monthly_volume', Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-slate-200 accent-novax cursor-pointer" />
                  <span className="text-sm font-semibold text-slate-700 w-20 text-right">{form.monthly_volume} posts</span>
                </div>
              </Field>
            </div>
          )}

          {/* Step 9 — Resources */}
          {step === 9 && (
            <div className="space-y-5">
              <Field label="Language Preference">
                <div className="flex gap-3">
                  {(['en', 'ar', 'both'] as const).map(l => (
                    <button key={l} onClick={() => set('language', l)}
                      className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
                        form.language === l ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                      {l === 'en' ? 'English Only' : l === 'ar' ? 'Arabic Only' : 'English + Arabic'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Google Drive Folder">
                <input value={form.drive_link} onChange={e => set('drive_link', e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…" className={inputCls} />
              </Field>
              <Field label="Internal Notes">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={5}
                  placeholder="Any special instructions, important context, or remarks for the team…"
                  className={`${inputCls} resize-none`} />
              </Field>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={back} disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />Back
          </button>
          <span className="text-xs text-slate-400">{step} / 9</span>
          {step < 9 ? (
            <button onClick={next}
              className="flex items-center gap-1.5 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
              Next<ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => onSave(form)}
              className="flex items-center gap-1.5 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
              <Check className="w-4 h-4" />Create Client
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
