'use client'

import { useState, useRef, useCallback, useId, useLayoutEffect, useEffect } from 'react'
import {
  Wand2, Download, Plus, Trash2, Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, RefreshCw, Sparkles, ChevronDown, GripHorizontal,
  ImagePlus, X, Layers, Maximize2, AtSign, ChevronRight,
  Info, Pencil, Check, Brain, Save, ExternalLink,
  ChevronUp, Target, Zap, Eye, LayoutGrid, User, Sunset,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IdeationOutput, IdeationConcept } from '@/app/api/ai-image/ideate/route'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string; text: string; x: number; y: number
  fontSize: number; fontFamily: string; color: string
  bold: boolean; italic: boolean; shadow: boolean
  outline: boolean; outlineColor: string; align: 'left' | 'center' | 'right'
}

interface TOVItem {
  id: string; text: string; role: 'headline' | 'tagline' | 'body' | 'callout'
}

interface RefImage {
  id: string   // stable: 'ref1', 'ref2', etc.
  data: string // base64
  mime: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview'

const MODELS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini Flash',      tag: 'Fast · Reference', supportsRef: true  },
  { id: 'gemini-2.5-flash-image',         label: 'Gemini Flash 2.5',  tag: 'Reference',         supportsRef: true  },
  { id: 'imagen-4.0-fast-generate-001',   label: 'Imagen 4 Fast',     tag: 'Fast · Native AR',  supportsRef: false },
  { id: 'imagen-4.0-generate-001',        label: 'Imagen 4',          tag: 'Native AR · HQ',    supportsRef: false },
]

const SUPPORTS_NATIVE_AR = new Set([
  'imagen-4.0-fast-generate-001', 'imagen-4.0-generate-001',
])

const STYLES = [
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'cinematic',      label: 'Cinematic'       },
  { id: 'product',        label: 'Product Shot'    },
  { id: 'lifestyle',      label: 'Lifestyle'       },
  { id: 'illustration',   label: 'Illustration'    },
  { id: 'abstract',       label: 'Abstract'        },
]

const ASPECT_RATIOS = [
  { id: '1:1',  label: '1:1',  w: 1,  h: 1  },
  { id: '4:5',  label: '4:5',  w: 4,  h: 5  },
  { id: '9:16', label: '9:16', w: 9,  h: 16 },
  { id: '16:9', label: '16:9', w: 16, h: 9  },
  { id: '3:4',  label: '3:4',  w: 3,  h: 4  },
]

const FONTS = [
  { id: 'Arial, sans-serif',                   label: 'Arial'           },
  { id: 'Georgia, serif',                       label: 'Georgia'         },
  { id: 'Impact, Haettenschweiler, sans-serif', label: 'Impact'          },
  { id: '"Times New Roman", serif',            label: 'Times New Roman' },
  { id: '"Courier New", monospace',            label: 'Courier New'     },
  { id: 'Verdana, sans-serif',                 label: 'Verdana'         },
]

const TOV_ROLES: { id: TOVItem['role']; label: string }[] = [
  { id: 'headline', label: 'Headline' },
  { id: 'tagline',  label: 'Tagline'  },
  { id: 'body',     label: 'Body'     },
  { id: 'callout',  label: 'Callout'  },
]

// ── Template system ────────────────────────────────────────────────────────────

type TemplateCategory = 'product' | 'ugc' | 'lifestyle'

interface TemplateField {
  key: string
  label: string
  type: 'text' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
}

interface ImageTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  fields: TemplateField[]
  build: (v: Record<string, string>) => string
}

const IMAGE_TEMPLATES: ImageTemplate[] = [
  {
    id: 'hero-product',
    name: 'Hero Product Shot',
    category: 'product',
    description: 'Premium editorial product against a styled surface',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. matte black perfume bottle' },
      { key: 'surface', label: 'Surface', type: 'select', options: [
        { value: 'polished black marble with gold veining', label: 'Black Marble' },
        { value: 'white marble with subtle veining', label: 'White Marble' },
        { value: 'brushed dark concrete', label: 'Dark Concrete' },
        { value: 'rich walnut wood grain', label: 'Dark Wood' },
        { value: 'reflective black glass shelf', label: 'Black Glass' },
      ]},
      { key: 'lighting', label: 'Lighting', type: 'select', options: [
        { value: 'dramatic single-source side lighting, deep rich shadows, warm metallic reflections', label: 'Dramatic & Moody' },
        { value: 'soft diffused ethereal lighting, delicate shadows, refined atmosphere', label: 'Soft & Ethereal' },
        { value: 'warm golden hour light, gentle glowing highlights', label: 'Golden Warm' },
        { value: 'clean three-point studio lighting, pristine clarity', label: 'Clean Studio' },
      ]},
    ],
    build: (v) => `${v.product} on ${v.surface}, ${v.lighting}, ultra-premium editorial atmosphere, commercial product photography, 8K detail, advertising campaign quality`,
  },
  {
    id: 'flat-lay',
    name: 'Flat Lay Scene',
    category: 'product',
    description: 'Overhead flat lay with curated styling elements',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. skincare serum bottle' },
      { key: 'background', label: 'Background', type: 'select', options: [
        { value: 'crisp white linen fabric', label: 'White Linen' },
        { value: 'warm beige marble', label: 'Beige Marble' },
        { value: 'dark slate stone', label: 'Dark Slate' },
        { value: 'light natural wood', label: 'Natural Wood' },
        { value: 'sage green linen', label: 'Sage Green' },
      ]},
      { key: 'accents', label: 'Accent Items', type: 'text', placeholder: 'e.g. dried flowers, small stones, leaves' },
    ],
    build: (v) => `Overhead flat lay of ${v.product} on ${v.background}, surrounded by ${v.accents}, perfect spacing and symmetry, editorial product photography, natural diffused light, magazine quality composition`,
  },
  {
    id: 'lifestyle-product',
    name: 'Lifestyle Product',
    category: 'product',
    description: 'Product in a real-world aspirational environment',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. leather handbag' },
      { key: 'setting', label: 'Setting', type: 'select', options: [
        { value: 'sun-drenched modern apartment with floor-to-ceiling windows', label: 'Modern Apartment' },
        { value: 'stylish outdoor café terrace', label: 'Outdoor Café' },
        { value: 'minimalist home office desk', label: 'Home Office' },
        { value: 'luxury hotel suite', label: 'Luxury Hotel' },
        { value: 'lush green garden', label: 'Garden' },
      ]},
      { key: 'mood', label: 'Mood', type: 'select', options: [
        { value: 'warm and luxurious, rich textures', label: 'Warm & Luxurious' },
        { value: 'fresh and clean, bright natural light', label: 'Fresh & Clean' },
        { value: 'urban and modern, editorial edge', label: 'Urban & Modern' },
        { value: 'natural and organic, earthy warmth', label: 'Natural & Organic' },
      ]},
    ],
    build: (v) => `${v.product} in a ${v.setting}, ${v.mood} atmosphere, natural lifestyle photography, authentic and aspirational, editorial quality`,
  },
  {
    id: 'beauty-closeup',
    name: 'Beauty Close-up',
    category: 'product',
    description: 'Macro product detail with beauty editorial lighting',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. rose gold face oil' },
      { key: 'elements', label: 'Key Elements', type: 'text', placeholder: 'e.g. rose petals, dewy droplets' },
      { key: 'atmosphere', label: 'Atmosphere', type: 'select', options: [
        { value: 'ethereal and dreamy, soft bokeh, translucent glow', label: 'Ethereal & Dreamy' },
        { value: 'bold and dramatic, high contrast precision', label: 'Bold & Dramatic' },
        { value: 'fresh and clean, bright airy minimal', label: 'Fresh & Clean' },
        { value: 'warm and indulgent, rich golden tones', label: 'Warm & Luxe' },
      ]},
    ],
    build: (v) => `Extreme close-up macro of ${v.product}, ${v.elements} surrounding it, ${v.atmosphere}, premium beauty editorial photography, ultra-refined and delicate atmosphere, 8K detail`,
  },
  {
    id: 'ugc-unboxing',
    name: 'Authentic Unboxing',
    category: 'ugc',
    description: 'Real unboxing moment — creator-style content',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. luxury skincare gift set' },
      { key: 'energy', label: 'Creator Energy', type: 'select', options: [
        { value: 'excited and delighted, genuine surprise expression', label: 'Excited & Surprised' },
        { value: 'calm and aesthetic, slow luxurious reveal', label: 'Calm & Aesthetic' },
        { value: 'warm and genuine, natural smile of satisfaction', label: 'Natural & Warm' },
      ]},
      { key: 'setting', label: 'Setting', type: 'select', options: [
        { value: 'clean white desk with soft window light', label: 'Clean White Desk' },
        { value: 'cozy home environment, warm ambient light', label: 'Cozy Home' },
        { value: 'bedroom vanity with ring light glow', label: 'Bedroom Vanity' },
        { value: 'natural light near a large window', label: 'Natural Light Window' },
      ]},
    ],
    build: (v) => `Person's hands carefully unboxing ${v.product}, ${v.energy}, ${v.setting} background, authentic UGC content creator style, warm soft natural light, real-life relatable feel, trustworthy composition`,
  },
  {
    id: 'day-in-life',
    name: 'Day in the Life',
    category: 'ugc',
    description: 'Product integrated into a real daily routine',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. morning supplement' },
      { key: 'lifestyle', label: 'Lifestyle Type', type: 'select', options: [
        { value: 'busy professional, polished and efficient', label: 'Busy Professional' },
        { value: 'wellness-focused, mindful and serene', label: 'Wellness-Focused' },
        { value: 'creative and artistic, expressive environment', label: 'Creative & Artistic' },
        { value: 'luxury leisure, effortlessly indulgent', label: 'Luxury Leisure' },
      ]},
      { key: 'time', label: 'Moment', type: 'select', options: [
        { value: 'morning routine, soft golden morning light', label: 'Morning Routine' },
        { value: 'afternoon break, warm daylight', label: 'Afternoon Break' },
        { value: 'evening wind-down, warm ambient light', label: 'Evening Wind-Down' },
      ]},
    ],
    build: (v) => `Person using ${v.product} during their ${v.time}, ${v.lifestyle} lifestyle, authentic lifestyle photography, candid real moment, editorial documentary style, aspirational but relatable`,
  },
  {
    id: 'product-review',
    name: 'Product Review Moment',
    category: 'ugc',
    description: 'Genuine reaction moment that builds trust',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. ceramic coffee mug' },
      { key: 'emotion', label: 'Reaction', type: 'select', options: [
        { value: 'genuine delight and satisfaction', label: 'Genuine Delight' },
        { value: 'thoughtful appreciation and quality recognition', label: 'Thoughtful Appreciation' },
        { value: 'pleasant surprise at quality', label: 'Surprising Discovery' },
      ]},
      { key: 'setting', label: 'Setting', type: 'select', options: [
        { value: 'cozy home kitchen, warm morning light', label: 'Home Kitchen' },
        { value: 'stylish café interior', label: 'Café' },
        { value: 'bright modern home living space', label: 'Home Living Space' },
      ]},
    ],
    build: (v) => `Person holding and closely examining ${v.product} with an expression of ${v.emotion}, ${v.setting}, authentic review content aesthetic, warm natural light, real moment captured, genuinely trustworthy composition`,
  },
  {
    id: 'morning-ritual',
    name: 'Morning Ritual',
    category: 'lifestyle',
    description: 'Curated morning scene with aspirational energy',
    fields: [
      { key: 'product', label: 'Product / Category', type: 'text', placeholder: 'e.g. matcha powder and ceramic bowl' },
      { key: 'aesthetic', label: 'Aesthetic', type: 'select', options: [
        { value: 'minimal and modern, clean lines, muted tones', label: 'Minimal & Modern' },
        { value: 'warm and cozy, soft textures, earthy palette', label: 'Warm & Cozy' },
        { value: 'bright and fresh, light and airy, optimistic', label: 'Bright & Fresh' },
        { value: 'dark and moody, dramatic shadows, rich tones', label: 'Dark & Moody' },
      ]},
    ],
    build: (v) => `${v.product} in a curated morning ritual scene, ${v.aesthetic}, soft morning light streaming through window, lifestyle flat lay and environmental styling, aspirational daily routine, magazine-quality composition`,
  },
  {
    id: 'luxury-moment',
    name: 'Luxury Moment',
    category: 'lifestyle',
    description: 'Premium brand placed in high-end environment',
    fields: [
      { key: 'product', label: 'Product', type: 'text', placeholder: 'e.g. scented candle collection' },
      { key: 'environment', label: 'Environment', type: 'select', options: [
        { value: 'high-end hotel suite with marble and floor-to-ceiling windows', label: 'Luxury Hotel Suite' },
        { value: 'modern penthouse with panoramic city views', label: 'Modern Penthouse' },
        { value: 'exclusive spa retreat with natural stone and soft candles', label: 'Spa Retreat' },
        { value: 'intimate fine dining setting with soft candlelight', label: 'Fine Dining' },
      ]},
      { key: 'emotion', label: 'Emotion', type: 'select', options: [
        { value: 'calm and deeply indulgent, pure relaxation', label: 'Calm & Indulgent' },
        { value: 'romantic and intimate, soft warmth', label: 'Romantic & Intimate' },
        { value: 'sophisticated and powerful, confident quiet luxury', label: 'Sophisticated & Powerful' },
      ]},
    ],
    build: (v) => `${v.product} in a ${v.environment}, ${v.emotion} emotional tone, ultra-luxury lifestyle photography, rich textures and premium materials, warm ambient light, aspirational premium campaign editorial quality`,
  },
  {
    id: 'campaign-hero',
    name: 'Campaign Hero',
    category: 'lifestyle',
    description: 'World-class advertising hero shot',
    fields: [
      { key: 'subject', label: 'Product / Subject', type: 'text', placeholder: 'e.g. new limited edition fragrance bottle' },
      { key: 'theme', label: 'Visual Theme', type: 'select', options: [
        { value: 'power and success, bold and commanding', label: 'Power & Success' },
        { value: 'natural beauty, organic and pure, earthy warmth', label: 'Natural Beauty' },
        { value: 'urban edge, raw energy, modern cool', label: 'Urban Edge' },
        { value: 'timeless elegance, classic luxury, refined', label: 'Timeless Elegance' },
      ]},
      { key: 'background', label: 'Background', type: 'select', options: [
        { value: 'dramatic architectural structure, geometric shadows', label: 'Dramatic Architecture' },
        { value: 'epic natural landscape at golden hour', label: 'Natural Landscape' },
        { value: 'pure studio infinity background, seamless', label: 'Studio Infinity' },
        { value: 'authentic urban street, editorial grit', label: 'Urban Street' },
      ]},
    ],
    build: (v) => `Campaign hero shot of ${v.subject}, ${v.theme} visual direction, ${v.background}, professional advertising photography, cinematic compression and power, world-class production quality, iconic and unforgettable`,
  },
]

const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: React.ElementType }[] = [
  { id: 'product',   label: 'Product',   icon: LayoutGrid },
  { id: 'ugc',       label: 'UGC',       icon: User       },
  { id: 'lifestyle', label: 'Lifestyle', icon: Sunset     },
]

function newLayer(id: string): TextLayer {
  return { id, text: 'Your Text Here', x: 10, y: 10, fontSize: 36, fontFamily: 'Arial, sans-serif', color: '#FFFFFF', bold: true, italic: false, shadow: true, outline: false, outlineColor: '#000000', align: 'left' }
}

// ── Mini Components ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description: string
}) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-start gap-3 text-left">
      <div className={cn('mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors relative', checked ? 'bg-novax' : 'bg-slate-200')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
      <div>
        <p className={cn('text-xs font-semibold transition-colors', checked ? 'text-slate-800' : 'text-slate-600')}>{label}</p>
        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{description}</p>
      </div>
    </button>
  )
}

function ScoreDot({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i < score ? 'bg-novax-accent' : 'bg-slate-200')} />
      ))}
    </div>
  )
}

// ── TemplateBuilder ───────────────────────────────────────────────────────────

function TemplateBuilder({ onApply }: { onApply: (prompt: string) => void }) {
  const [category, setCategory] = useState<TemplateCategory>('product')
  const [selected, setSelected] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const templates = IMAGE_TEMPLATES.filter(t => t.category === category)
  const activeTemplate = IMAGE_TEMPLATES.find(t => t.id === selected) ?? null

  const handleSelect = (id: string) => {
    if (selected === id) { setSelected(null); setValues({}); return }
    setSelected(id)
    setValues({})
  }

  const handleApply = () => {
    if (!activeTemplate) return
    const allFilled = activeTemplate.fields.every(f => values[f.key]?.trim())
    if (!allFilled) return
    onApply(activeTemplate.build(values))
  }

  const allFilled = activeTemplate ? activeTemplate.fields.every(f => values[f.key]?.trim()) : false

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-1">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setCategory(cat.id); setSelected(null); setValues({}) }}
            className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border',
              category === cat.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax')}>
            <cat.icon className="w-3 h-3" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {templates.map(t => (
          <button key={t.id} onClick={() => handleSelect(t.id)}
            className={cn('px-2.5 py-2.5 text-left border rounded-xl transition-all',
              selected === t.id
                ? 'bg-novax-light border-novax-border-active'
                : 'border-slate-200 hover:border-novax-border bg-white')}>
            <p className={cn('text-[11px] font-semibold leading-tight', selected === t.id ? 'text-novax' : 'text-slate-700')}>{t.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Field form — appears when a template is selected */}
      {activeTemplate && (
        <div className="bg-novax-light border border-novax-border rounded-xl p-3 space-y-2.5">
          {activeTemplate.fields.map(field => (
            <div key={field.key}>
              <label className="text-[10px] font-semibold text-novax uppercase tracking-wider block mb-1">{field.label}</label>
              {field.type === 'text' ? (
                <input
                  value={values[field.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-2.5 py-2 text-xs border border-novax-border bg-white rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted"
                />
              ) : (
                <div className="relative">
                  <select
                    value={values[field.key] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-novax-border bg-white rounded-lg text-slate-700 outline-none focus:border-novax-muted appearance-none pr-7">
                    <option value="">Select {field.label.toLowerCase()}…</option>
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          ))}
          <button onClick={handleApply} disabled={!allFilled}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
            <Wand2 className="w-3 h-3" />
            Build Prompt
          </button>
        </div>
      )}
    </div>
  )
}

// ── DraggableText ─────────────────────────────────────────────────────────────

function DraggableText({ layer, selected, onSelect, onUpdate, onDelete, containerRef }: {
  layer: TextLayer; selected: boolean; onSelect: () => void
  onUpdate: (patch: Partial<TextLayer>) => void; onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  const focused = useRef(false)
  const dragging = useRef(false)
  const startPos = useRef({ mx: 0, my: 0, lx: 0, ly: 0 })

  useLayoutEffect(() => {
    if (textRef.current && !focused.current && textRef.current.innerText !== layer.text)
      textRef.current.innerText = layer.text
  }, [layer.text])

  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); onSelect()
    dragging.current = true
    startPos.current = { mx: e.clientX, my: e.clientY, lx: layer.x, ly: layer.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    onUpdate({
      x: Math.max(0, Math.min(95, startPos.current.lx + ((e.clientX - startPos.current.mx) / rect.width) * 100)),
      y: Math.max(0, Math.min(95, startPos.current.ly + ((e.clientY - startPos.current.my) / rect.height) * 100)),
    })
  }
  const handleDragPointerUp = () => { dragging.current = false }

  return (
    <div style={{ position: 'absolute', left: `${layer.x}%`, top: `${layer.y}%` }} onClick={e => { e.stopPropagation(); onSelect() }}>
      {selected && (
        <div onPointerDown={handleDragPointerDown} onPointerMove={handleDragPointerMove} onPointerUp={handleDragPointerUp}
          style={{ touchAction: 'none' }}
          className="absolute -top-6 left-0 right-0 min-w-[80px] h-6 flex items-center justify-between px-1.5 bg-novax/90 rounded-t-md cursor-move select-none z-10"
        >
          <GripHorizontal className="w-3 h-3 text-white/70 shrink-0" />
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center justify-center w-4 h-4 text-white/70 hover:text-white text-sm leading-none shrink-0">×</button>
        </div>
      )}
      <span ref={textRef} contentEditable suppressContentEditableWarning
        onFocus={() => { focused.current = true; onSelect() }}
        onBlur={e => { focused.current = false; const v = e.currentTarget.innerText; if (v !== layer.text) onUpdate({ text: v }) }}
        onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
        style={{
          font: `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.fontSize}px ${layer.fontFamily}`,
          color: layer.color,
          textShadow: layer.shadow ? '2px 2px 8px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)' : undefined,
          WebkitTextStroke: layer.outline ? `2px ${layer.outlineColor}` : undefined,
          textAlign: layer.align, display: 'block', whiteSpace: 'pre-wrap', minWidth: '3em', cursor: 'text',
          outline: selected ? '2px solid rgba(91,180,174,0.8)' : '2px solid transparent', outlineOffset: '3px', borderRadius: '2px',
        }}
      />
    </div>
  )
}

// ── Text Controls ─────────────────────────────────────────────────────────────

function TextControls({ layer, onUpdate }: { layer: TextLayer; onUpdate: (patch: Partial<TextLayer>) => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Text Formatting</p>
      <div className="relative">
        <select value={layer.fontFamily} onChange={e => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted appearance-none bg-white">
          {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      <div className="flex items-center gap-2">
        <Type className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input type="range" min={12} max={120} step={2} value={layer.fontSize} onChange={e => onUpdate({ fontSize: Number(e.target.value) })} className="flex-1 accent-novax" />
        <span className="text-xs font-mono text-slate-600 w-8 text-right">{layer.fontSize}px</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-14 shrink-0">Color</label>
        <input type="color" value={layer.color} onChange={e => onUpdate({ color: e.target.value })} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
        <input type="text" value={layer.color} onChange={e => onUpdate({ color: e.target.value })} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-700 outline-none focus:border-novax-muted" />
      </div>
      <div className="flex items-center gap-1.5">
        {[{ Icon: Bold, key: 'bold' }, { Icon: Italic, key: 'italic' }].map(({ Icon, key }) => (
          <button key={key} onClick={() => onUpdate({ [key]: !layer[key as keyof TextLayer] })}
            className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors', layer[key as keyof TextLayer] ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {(['left', 'center', 'right'] as const).map(a => {
            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
            return (
              <button key={a} onClick={() => onUpdate({ align: a })}
                className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors', layer.align === a ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {[{ key: 'shadow', label: 'Shadow' }, { key: 'outline', label: 'Outline' }].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={layer[key as keyof TextLayer] as boolean} onChange={e => onUpdate({ [key]: e.target.checked })} className="accent-novax rounded" />
            {label}
          </label>
        ))}
        {layer.outline && <input type="color" value={layer.outlineColor} onChange={e => onUpdate({ outlineColor: e.target.value })} className="w-6 h-6 rounded border border-slate-200 cursor-pointer p-0.5" />}
      </div>
    </div>
  )
}

// ── Ideation Output Renderer ──────────────────────────────────────────────────

function IdeationResult({ output, onUseConcept }: { output: IdeationOutput; onUseConcept: (concept: IdeationConcept) => void }) {
  const [openSection, setOpenSection] = useState<string | null>('concepts')
  const [openConcept, setOpenConcept] = useState<number | null>(null)

  const toggle = (id: string) => setOpenSection(s => s === id ? null : id)

  const Section = ({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-novax-accent" />
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        {openSection === id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {openSection === id && <div className="p-4">{children}</div>}
    </div>
  )

  return (
    <div className="space-y-2 mt-4">
      {/* Campaign line spotlight */}
      <div className="bg-novax rounded-xl p-4">
        <p className="text-[10px] text-white/60 uppercase tracking-widest mb-1">Campaign Line</p>
        <p className="text-white font-semibold text-sm leading-snug">{output.execution.campaign_line}</p>
      </div>

      <Section id="decode" icon={Target} title="Brief Decode">
        <div className="space-y-2.5">
          {[
            { label: 'Real Problem', value: output.decode.core_problem },
            { label: 'Creative Tension', value: output.decode.tension },
            { label: 'Success Looks Like', value: output.decode.success },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="scan" icon={Eye} title="Cultural Scan">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Cultural Forces</p>
            <div className="space-y-1">
              {output.cultural_scan.forces.map((f, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-700 leading-snug">
                  <span className="text-novax-accent shrink-0 mt-0.5">→</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category Clichés to Avoid</p>
            <div className="space-y-1">
              {output.cultural_scan.category_clichees.map((c, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-500 leading-snug line-through">
                  <span className="no-underline text-red-400 shrink-0 mt-0.5">✕</span>
                  <span className="no-underline text-slate-500">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">White Space</p>
            <p className="text-xs text-novax font-medium leading-snug">{output.cultural_scan.white_space}</p>
          </div>
        </div>
      </Section>

      <Section id="reframes" icon={Zap} title="5 Problem Reframes">
        <div className="space-y-3">
          {output.reframes.map((r, i) => (
            <div key={i} className="border-l-2 border-novax-border pl-3">
              <p className="text-xs font-semibold text-slate-700 leading-snug">{r.problem_as}</p>
              <p className="text-[10px] text-novax-muted mt-0.5">{r.territory}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="concepts" icon={Brain} title={`7 Concepts  ·  Top picks: ${output.top_picks.map(i => i + 1).join(', ')}`}>
        <div className="space-y-2">
          {output.concepts.map((c, i) => {
            const isTop = output.top_picks.includes(i)
            const isOpen = openConcept === i
            const totalScore = c.scores.clarity + c.scores.contrast + c.scores.credibility
            return (
              <div key={i} className={cn('border rounded-xl overflow-hidden', isTop ? 'border-novax-border' : 'border-slate-200')}>
                <button onClick={() => setOpenConcept(isOpen ? null : i)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors', isTop ? 'bg-novax-light hover:bg-novax-light-hover' : 'bg-white hover:bg-slate-50')}>
                  <span className={cn('shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', isTop ? 'bg-novax text-white' : 'bg-slate-200 text-slate-600')}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800 truncate">{c.name}</span>
                      {isTop && <span className="text-[9px] font-bold text-novax bg-novax/10 px-1.5 py-0.5 rounded-full">TOP PICK</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{c.archetype}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400">{totalScore}/15</span>
                    {isOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
                    <p className="text-[11px] font-medium text-novax-muted italic leading-snug">{c.one_liner}</p>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">The Idea</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{c.idea}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Visual Direction</p>
                      <p className="text-xs text-slate-600 leading-relaxed italic">{c.visual_direction}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Why It Works</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{c.why_it_works}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {[
                        { label: 'Clarity', value: c.scores.clarity },
                        { label: 'Contrast', value: c.scores.contrast },
                        { label: 'Credibility', value: c.scores.credibility },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[9px] text-slate-400 mb-1">{label}</p>
                          <ScoreDot score={value} />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onUseConcept(c)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Use as Generate Prompt
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section id="execution" icon={Sparkles} title="Executional Vectors (Top Concept)">
        <div className="space-y-3">
          {[
            { label: 'Reel (15–30s)', value: output.execution.reel },
            { label: 'Carousel', value: output.execution.carousel },
            { label: 'Static Post', value: output.execution.static },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIImagePage() {
  // Usage cap
  const [capRemaining, setCapRemaining] = useState<number | null>(null)
  const [capLimit] = useState(50)

  useEffect(() => {
    fetch('/api/ai-image/cap')
      .then(r => r.json())
      .then((d: { remaining?: number }) => { if (typeof d.remaining === 'number') setCapRemaining(d.remaining) })
      .catch(() => {})
  }, [])

  // Template picker
  const [showTemplates, setShowTemplates] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<'generate' | 'resize' | 'think' | 'tov'>('generate')

  // Generate state
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNeg, setShowNeg] = useState(false)

  // Canvas state
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState('image/png')
  const [textLayers, setTextLayers] = useState<TextLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Multi-reference images
  const [refImages, setRefImages] = useState<RefImage[]>([])
  const refCounter = useRef(0)

  // Edit mode
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Save to library
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)

  // Resize mode
  const [resizeSource, setResizeSource] = useState<{ data: string; mime: string } | null>(null)
  const [resizeToggles, setResizeToggles] = useState({ hasText: false, hasLogo: false, hasSubject: false, extendBackground: true })
  const [resizing, setResizing] = useState(false)
  const [resizeError, setResizeError] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [autoDetected, setAutoDetected] = useState<{ hasText: boolean; hasLogo: boolean; hasSubject: boolean } | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ w: number; h: number } | null>(null)

  // Text on Visuals
  const [tovItems, setTovItems] = useState<TOVItem[]>([{ id: 'tov-1', text: '', role: 'headline' }])
  const [brandColors, setBrandColors] = useState<string[]>(['#FFFFFF', '#1B3D38'])
  const [applyingDesign, setApplyingDesign] = useState(false)
  const [tovError, setTovError] = useState<string | null>(null)

  // Think / Ideation
  const [thinkContext, setThinkContext] = useState('')
  const [thinkProblem, setThinkProblem] = useState('')
  const [thinkAudience, setThinkAudience] = useState('')
  const [thinkConstraints, setThinkConstraints] = useState('')
  const [thinking, setThinking] = useState(false)
  const [thinkError, setThinkError] = useState<string | null>(null)
  const [ideationOutput, setIdeationOutput] = useState<IdeationOutput | null>(null)

  // Refs
  const layerCounter = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)
  const resizeInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const uid = useId()

  const selectedModel = MODELS.find(m => m.id === model) ?? MODELS[0]
  const nativeAR = SUPPORTS_NATIVE_AR.has(model)
  const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio) ?? ASPECT_RATIOS[0]
  const isLoading = generating || resizing || editing

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - refImages.length)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        const [meta, data] = dataUrl.split(',')
        const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'image/png'
        refCounter.current += 1
        setRefImages(prev => [...prev, { id: `ref${refCounter.current}`, data, mime }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const insertMention = (refId: string) => {
    const ta = promptRef.current
    if (!ta) return
    const start = ta.selectionStart ?? prompt.length
    const mention = `@${refId}`
    setPrompt(p => p.slice(0, start) + mention + p.slice(ta.selectionEnd ?? start))
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + mention.length, start + mention.length) }, 0)
  }

  const runDetect = async (data: string, mime: string) => {
    setDetecting(true); setAutoDetected(null)
    try {
      const res = await fetch('/api/ai-image/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: data, mimeType: mime }),
      })
      const result = await res.json() as { hasText?: boolean; hasLogo?: boolean; hasSubject?: boolean }
      const detected = {
        hasText: Boolean(result.hasText),
        hasLogo: Boolean(result.hasLogo),
        hasSubject: Boolean(result.hasSubject),
      }
      setAutoDetected(detected)
      setResizeToggles(t => ({ ...t, ...detected }))
    } catch { /* ignore — toggles stay at current values */ }
    finally { setDetecting(false) }
  }

  const getImageDimensions = (data: string, mime: string): Promise<{ w: number; h: number }> =>
    new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = `data:${mime};base64,${data}`
    })

  const handleResizeSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const [meta, data] = dataUrl.split(',')
      const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'image/png'
      setResizeSource({ data, mime })
      const dims = await getImageDimensions(data, mime)
      if (dims.w > 0) setSourceDimensions(dims)
      void runDetect(data, mime)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Load the currently-generated image into the resize tab
  const handleResizeCurrent = () => {
    if (!imageData) return
    setResizeSource({ data: imageData, mime: imageMime })
    setSourceDimensions(null)
    setActiveTab('resize')
    void getImageDimensions(imageData, imageMime).then(dims => { if (dims.w > 0) setSourceDimensions(dims) })
    void runDetect(imageData, imageMime)
  }

  const autoSave = (imageData: string, mimeType: string, savePrompt: string) => {
    void fetch('/api/ai-image/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, mimeType, prompt: savePrompt, aspectRatio }),
    }).then(r => r.json()).then((d: { url?: string }) => { if (d.url) setSavedUrl(d.url) }).catch(() => {})
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true); setError(null); setTextLayers([]); setSelectedId(null); setSavedUrl(null)
    try {
      const res = await fetch('/api/ai-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, style, aspectRatio, negativePrompt, model, mode: 'generate',
          ...(refImages.length > 0 && selectedModel.supportsRef ? { referenceImages: refImages } : {}),
        }),
      })
      const data = await res.json() as { imageData?: string; mimeType?: string; error?: string; remaining?: number }
      if (!res.ok || data.error) { setError(data.error ?? 'Generation failed'); return }
      const mime = data.mimeType ?? 'image/png'
      setImageData(data.imageData!); setImageMime(mime)
      if (typeof data.remaining === 'number') setCapRemaining(data.remaining)
      autoSave(data.imageData!, mime, prompt)
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error')
    } finally { setGenerating(false) }
  }

  const handleResize = async () => {
    if (!resizeSource) return
    setResizing(true); setResizeError(null); setTextLayers([]); setSelectedId(null); setSavedUrl(null)
    try {
      const res = await fetch('/api/ai-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '', aspectRatio,
          model: model.startsWith('imagen') ? DEFAULT_MODEL : model,
          mode: 'resize',
          referenceImages: [{ id: 'source', data: resizeSource.data, mime: resizeSource.mime }],
          resizeToggles,
        }),
      })
      const data = await res.json() as { imageData?: string; mimeType?: string; error?: string; remaining?: number }
      if (!res.ok || data.error) { setResizeError(data.error ?? 'Resize failed'); return }
      const mime = data.mimeType ?? 'image/png'
      setImageData(data.imageData!); setImageMime(mime)
      if (typeof data.remaining === 'number') setCapRemaining(data.remaining)
      autoSave(data.imageData!, mime, `Resized: ${prompt || 'image'}`)
    } catch (e) { setResizeError(e instanceof Error ? e.message : 'Network error')
    } finally { setResizing(false) }
  }

  const handleEdit = async () => {
    if (!imageData || !editPrompt.trim()) return
    setEditing(true); setEditError(null); setSavedUrl(null)
    try {
      const res = await fetch('/api/ai-image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, mimeType: imageMime, editPrompt: editPrompt.trim(), model: DEFAULT_MODEL }),
      })
      const data = await res.json() as { imageData?: string; mimeType?: string; error?: string }
      if (!res.ok || data.error) { setEditError(data.error ?? 'Edit failed'); return }
      const mime = data.mimeType ?? 'image/png'
      setImageData(data.imageData!); setImageMime(mime)
      autoSave(data.imageData!, mime, `Edited: ${editPrompt.trim()}`)
      setEditPrompt('')
    } catch (e) { setEditError(e instanceof Error ? e.message : 'Network error')
    } finally { setEditing(false) }
  }

  const handleSaveToLibrary = async () => {
    if (!imageData) return
    setSaving(true)
    try {
      const res = await fetch('/api/ai-image/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, mimeType: imageMime, prompt, aspectRatio }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Save failed'); return }
      setSavedUrl(data.url ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error')
    } finally { setSaving(false) }
  }

  const handleThink = async () => {
    if (!thinkProblem.trim()) return
    setThinking(true); setThinkError(null); setIdeationOutput(null)
    try {
      const res = await fetch('/api/ai-image/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: thinkContext, problem: thinkProblem, audience: thinkAudience, constraints: thinkConstraints }),
      })
      const data = await res.json() as { output?: IdeationOutput; error?: string }
      if (!res.ok || data.error) { setThinkError(data.error ?? 'Ideation failed'); return }
      setIdeationOutput(data.output!)
    } catch (e) { setThinkError(e instanceof Error ? e.message : 'Network error')
    } finally { setThinking(false) }
  }

  const handleUseConcept = (concept: IdeationConcept) => {
    setPrompt(`${concept.one_liner}. ${concept.visual_direction}`.slice(0, 2000))
    setActiveTab('generate')
  }

  const handleApplyDesign = async () => {
    if (!imageData) return
    const items = tovItems.filter(i => i.text.trim())
    if (!items.length) return
    setApplyingDesign(true); setTovError(null)
    try {
      const res = await fetch('/api/ai-image/text-placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, mimeType: imageMime, textItems: items.map(i => ({ text: i.text, role: i.role })), brandColors }),
      })
      const data = await res.json() as { layers?: Partial<TextLayer>[]; error?: string }
      if (!res.ok || data.error) { setTovError(data.error ?? 'AI design failed'); return }
      const newLayers: TextLayer[] = (data.layers ?? []).map((l, i) => {
        layerCounter.current += 1
        return {
          id: `${uid}-tov-${layerCounter.current}`,
          text: l.text ?? items[i]?.text ?? 'Text',
          x: typeof l.x === 'number' ? Math.max(0, Math.min(90, l.x)) : 5,
          y: typeof l.y === 'number' ? Math.max(0, Math.min(90, l.y)) : 5 + i * 15,
          fontSize: typeof l.fontSize === 'number' ? Math.max(12, Math.min(120, l.fontSize)) : 36,
          fontFamily: l.fontFamily ?? 'Arial, sans-serif',
          color: l.color ?? '#FFFFFF',
          bold: l.bold ?? false, italic: l.italic ?? false, shadow: l.shadow ?? true,
          outline: l.outline ?? false, outlineColor: l.outlineColor ?? '#000000',
          align: (['left', 'center', 'right'].includes(l.align ?? '') ? l.align : 'left') as 'left' | 'center' | 'right',
        }
      })
      setTextLayers(newLayers)
      if (newLayers.length > 0) setSelectedId(newLayers[0].id)
    } catch (e) { setTovError(e instanceof Error ? e.message : 'Network error')
    } finally { setApplyingDesign(false) }
  }

  const addTextLayer = () => {
    layerCounter.current += 1
    const id = `${uid}-layer-${layerCounter.current}`
    setTextLayers(prev => [...prev, newLayer(id)])
    setSelectedId(id)
  }

  const updateLayer = useCallback((id: string, patch: Partial<TextLayer>) => {
    setTextLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }, [])

  const deleteLayer = useCallback((id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const handleDownload = async () => {
    if (!imageData) return
    setExporting(true)
    try {
      const canvas = document.createElement('canvas')
      const img = new Image()
      img.src = `data:${imageMime};base64,${imageData}`
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject })
      const imgAR = img.naturalWidth / img.naturalHeight
      const targetAR = ar.w / ar.h
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
      if (imgAR > targetAR + 0.005) { sw = Math.round(img.naturalHeight * targetAR); sx = Math.round((img.naturalWidth - sw) / 2) }
      else if (imgAR < targetAR - 0.005) { sh = Math.round(img.naturalWidth / targetAR); sy = Math.round((img.naturalHeight - sh) / 2) }
      canvas.width = sw; canvas.height = sh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const scale = sw / rect.width
        for (const layer of textLayers) {
          const x = (layer.x / 100) * sw; const y = (layer.y / 100) * sh
          const scaledFont = Math.round(layer.fontSize * scale)
          ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${scaledFont}px ${layer.fontFamily}`
          ctx.textBaseline = 'top'; ctx.textAlign = layer.align as CanvasTextAlign
          if (layer.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = scaledFont * 0.2; ctx.shadowOffsetX = scaledFont * 0.05; ctx.shadowOffsetY = scaledFont * 0.05 }
          if (layer.outline) { ctx.strokeStyle = layer.outlineColor; ctx.lineWidth = scaledFont * 0.08; ctx.lineJoin = 'round'; for (const [i, line] of layer.text.split('\n').entries()) ctx.strokeText(line, x, y + i * scaledFont * 1.2) }
          ctx.fillStyle = layer.color
          for (const [i, line] of layer.text.split('\n').entries()) ctx.fillText(line, x, y + i * scaledFont * 1.2)
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
        }
      }
      const link = document.createElement('a'); link.download = 'novax-ai-image.png'; link.href = canvas.toDataURL('image/png'); link.click()
    } catch { /* ignore */ } finally { setExporting(false) }
  }

  const selectedLayer = textLayers.find(l => l.id === selectedId) ?? null
  const aspectStyle = {
    aspectRatio: `${ar.w} / ${ar.h}`,
    maxWidth: ar.w > ar.h ? '100%' : `${(ar.w / ar.h) * 100}%`,
    maxHeight: ar.h > ar.w ? 520 : 400,
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 h-full min-h-[calc(100vh-8rem)]">

      {/* ── Left Panel ── */}
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto pb-4">

        {/* Tab bar */}
        <div className="grid grid-cols-3 bg-slate-100 rounded-xl p-1 gap-1">
          {([
            { id: 'generate', label: 'Generate', icon: Wand2 },
            { id: 'think',    label: 'Think',    icon: Brain },
            { id: 'tov',      label: 'Text',     icon: Type },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn('flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold rounded-lg transition-all',
                activeTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Generate tab ── */}
        {activeTab === 'generate' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">AI Image Generation</p>
            </div>

            {/* Template picker */}
            <div>
              <button onClick={() => setShowTemplates(p => !p)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-novax transition-colors">
                <ChevronRight className={cn('w-3 h-3 transition-transform', showTemplates && 'rotate-90')} />
                Content templates
              </button>
              {showTemplates && (
                <div className="mt-2">
                  <TemplateBuilder onApply={p => { setPrompt(p.slice(0, 2000)); setShowTemplates(false) }} />
                </div>
              )}
            </div>

            {/* Reference images */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Reference Images <span className="font-normal text-slate-400">({refImages.length}/5)</span>
                </label>
                {!selectedModel.supportsRef && refImages.length > 0 && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Switch to Gemini</span>
                )}
              </div>
              {refImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {refImages.map(ref => (
                    <div key={ref.id} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:${ref.mime};base64,${ref.data}`} alt={ref.id} className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 rounded-b-lg font-mono">@{ref.id}</div>
                      <button onClick={() => setRefImages(prev => prev.filter(r => r.id !== ref.id))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {refImages.length < 5 && (
                    <button onClick={() => refInputRef.current?.click()}
                      className="w-14 h-14 flex flex-col items-center justify-center gap-0.5 border-2 border-dashed border-slate-200 hover:border-novax-border rounded-lg text-slate-400 hover:text-novax transition-colors">
                      <Plus className="w-4 h-4" /><span className="text-[9px]">Add</span>
                    </button>
                  )}
                </div>
              )}
              {refImages.length === 0 && (
                <button onClick={() => refInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 hover:border-novax-border rounded-xl text-xs text-slate-500 hover:text-novax transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  Product · Logo · Character · Brand asset
                </button>
              )}
              <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefImageUpload} />
            </div>

            {/* Mention chips */}
            {refImages.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <AtSign className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">Click to mention in prompt</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {refImages.map(ref => (
                    <button key={ref.id} onClick={() => insertMention(ref.id)}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium border border-novax-border text-novax hover:bg-novax-light rounded transition-colors">
                      @{ref.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Prompt</label>
                <span className={cn('text-[10px] font-mono', prompt.length > 1800 ? 'text-amber-500' : 'text-slate-400')}>{prompt.length}/2000</span>
              </div>
              <textarea ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value.slice(0, 2000))} rows={4}
                placeholder="A luxury skincare product on a marble surface… use @ref1 for the product shape"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none" />
            </div>

            {/* Negative prompt */}
            <button onClick={() => setShowNeg(p => !p)} className="text-xs text-slate-500 hover:text-novax transition-colors flex items-center gap-1">
              <Plus className={cn('w-3 h-3 transition-transform', showNeg && 'rotate-45')} />
              Negative prompt
            </button>
            {showNeg && (
              <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} rows={2}
                placeholder="blurry, low quality, text, watermark…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-500 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none" />
            )}

            {/* Model */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Model</label>
              <div className="space-y-1">
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => setModel(m.id)}
                    className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                      model === m.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax')}>
                    <span>{m.label}</span>
                    <span className={cn('text-[10px] font-normal', model === m.id ? 'text-white/70' : 'text-slate-400')}>{m.tag}</span>
                  </button>
                ))}
              </div>
              {!nativeAR && <p className="text-[10px] text-slate-400 mt-1.5">Aspect ratio is included in the prompt</p>}
            </div>

            {/* Style */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={cn('px-2 py-2 rounded-lg text-xs font-medium transition-all border',
                      style === s.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AR */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Aspect Ratio</label>
              <div className="flex items-end gap-1.5">
                {ASPECT_RATIOS.map(a => (
                  <button key={a.id} onClick={() => setAspectRatio(a.id)}
                    className={cn('flex-1 flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all',
                      aspectRatio === a.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-500 hover:border-novax-border')}>
                    <div className={cn('rounded-sm border-2', aspectRatio === a.id ? 'border-white/70' : 'border-slate-300')}
                      style={{ width: Math.round(20 * (a.w / Math.max(a.w, a.h))), height: Math.round(20 * (a.h / Math.max(a.w, a.h))) }} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily cap indicator */}
            {capRemaining !== null && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Daily limit</span>
                <span className={cn('font-mono font-semibold', capRemaining <= 5 ? 'text-amber-500' : capRemaining === 0 ? 'text-red-500' : 'text-slate-400')}>
                  {capRemaining} / {capLimit} remaining
                </span>
              </div>
            )}

            <button onClick={handleGenerate} disabled={!prompt.trim() || generating || capRemaining === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
            </button>
            {capRemaining === 0 && <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 text-center">Daily limit reached — resets at midnight</p>}
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}
          </div>
        )}

        {/* ── Resize tab ── */}
        {activeTab === 'resize' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">AI Image Resizer</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload an image or use the current generated image — get it recomposed for the new dimensions with all elements preserved.
            </p>

            {resizeSource ? (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:${resizeSource.mime};base64,${resizeSource.data}`} alt="Source" className="w-full h-36 object-cover" />
                  <button onClick={() => { setResizeSource(null); setAutoDetected(null); setSourceDimensions(null) }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {detecting && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center gap-1.5 px-2 py-1.5">
                      <RefreshCw className="w-3 h-3 text-white animate-spin shrink-0" />
                      <p className="text-white text-[10px]">Analysing image content…</p>
                    </div>
                  )}
                  {!detecting && autoDetected && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center gap-1.5 px-2 py-1.5">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <p className="text-white text-[10px]">Auto-detected:</p>
                      {autoDetected.hasText    && <span className="text-[9px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded">Text</span>}
                      {autoDetected.hasLogo    && <span className="text-[9px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded">Logo</span>}
                      {autoDetected.hasSubject && <span className="text-[9px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded">Subject</span>}
                      {!autoDetected.hasText && !autoDetected.hasLogo && !autoDetected.hasSubject && <span className="text-white/70 text-[9px]">Background only</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => resizeInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-200 hover:border-novax-border rounded-xl text-xs text-slate-500 hover:text-novax transition-colors">
                  <ImagePlus className="w-6 h-6" />
                  Upload image to resize
                </button>
                {imageData && (
                  <button onClick={handleResizeCurrent}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-novax-border text-novax hover:bg-novax-light rounded-xl text-xs font-medium transition-colors">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Use current generated image
                  </button>
                )}
              </div>
            )}
            <input ref={resizeInputRef} type="file" accept="image/*" className="hidden" onChange={handleResizeSourceUpload} />

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Target Aspect Ratio</label>
              <div className="flex items-end gap-1.5">
                {ASPECT_RATIOS.map(a => (
                  <button key={a.id} onClick={() => setAspectRatio(a.id)}
                    className={cn('flex-1 flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all',
                      aspectRatio === a.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-500 hover:border-novax-border')}>
                    <div className={cn('rounded-sm border-2', aspectRatio === a.id ? 'border-white/70' : 'border-slate-300')}
                      style={{ width: Math.round(20 * (a.w / Math.max(a.w, a.h))), height: Math.round(20 * (a.h / Math.max(a.w, a.h))) }} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <p className="text-xs font-semibold text-slate-600">What&apos;s in your image?</p>
                {autoDetected && !detecting && (
                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Auto-set</span>
                )}
                <div className="group relative ml-auto">
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute right-0 top-5 w-56 bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-lg z-20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity leading-relaxed">
                    Detected automatically from your image. Each toggle activates precision-enforcement instructions. You can override any toggle.
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Toggle checked={resizeToggles.hasText} onChange={v => setResizeToggles(t => ({ ...t, hasText: v }))} label="Contains text or headline" description="Verbatim reproduction — every character identical" />
                <Toggle checked={resizeToggles.hasLogo} onChange={v => setResizeToggles(t => ({ ...t, hasLogo: v }))} label="Contains a logo or brand mark" description="Pixel-precise copy — fine lines, emblems, crests" />
                <Toggle checked={resizeToggles.hasSubject} onChange={v => setResizeToggles(t => ({ ...t, hasSubject: v }))} label="Contains a person or product" description="Subject kept fully visible, never cropped" />
                <Toggle checked={resizeToggles.extendBackground} onChange={v => setResizeToggles(t => ({ ...t, extendBackground: v }))} label="Extend background" description={resizeToggles.extendBackground ? 'AI extends canvas · original pixels composited back on top' : 'Sharp crops to target ratio — no AI involved'} />
              </div>
            </div>

            {/* Gemini model picker for resize */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Model <span className="font-normal text-slate-400">(Gemini required)</span></label>
              </div>
              <div className="space-y-1">
                {MODELS.filter(m => m.supportsRef).map(m => (
                  <button key={m.id} onClick={() => setModel(m.id)}
                    className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                      model === m.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax')}>
                    <span>{m.label}</span>
                    <span className={cn('text-[10px] font-normal', model === m.id ? 'text-white/70' : 'text-slate-400')}>{m.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              if (!sourceDimensions || !resizeToggles.extendBackground) return null
              const srcAR = sourceDimensions.w / sourceDimensions.h
              const tgt = ASPECT_RATIOS.find(a => a.id === aspectRatio)
              if (!tgt) return null
              const tgtAR = tgt.w / tgt.h
              const ratio = Math.max(srcAR / tgtAR, tgtAR / srcAR)
              if (ratio < 1.7) return null
              const isExtreme = ratio >= 2.5
              return (
                <div className={cn('rounded-xl border px-3 py-2.5 text-xs leading-relaxed', isExtreme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700')}>
                  <p className="font-semibold mb-0.5">{isExtreme ? 'Extreme AR change' : 'Large AR change'} ({(srcAR).toFixed(2)} → {(tgtAR).toFixed(2)})</p>
                  <p className="text-[10px] leading-relaxed opacity-80">
                    {isExtreme
                      ? 'The original image will occupy less than 35% of the output canvas. The extension area is too large for faithful background extension — try Smart Crop instead.'
                      : 'The extension area is large. AI may not perfectly match the background. Consider Smart Crop if fidelity is critical.'}
                  </p>
                  <button onClick={() => setResizeToggles(t => ({ ...t, extendBackground: false }))}
                    className="mt-1.5 text-[10px] font-semibold underline">
                    Switch to Smart Crop
                  </button>
                </div>
              )
            })()}

            <button onClick={handleResize} disabled={!resizeSource || resizing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              {resizing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Recomposing…</> : <><Maximize2 className="w-4 h-4" /> Resize Image</>}
            </button>
            {resizeError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{resizeError}</p>}
          </div>
        )}

        {/* ── Think tab ── */}
        {activeTab === 'think' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">Creative Ideation</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Run a 7-phase creative thinking session — Brief Decode → Cultural Scan → Reframes → 7 Concepts → Scoring → Top Picks → Execution.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Problem / Goal <span className="text-red-400">*</span></label>
                <textarea value={thinkProblem} onChange={e => setThinkProblem(e.target.value)} rows={3}
                  placeholder="We need to launch the new Noir fragrance to 25-35 year olds who feel luxury is out of reach…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Brand / Context</label>
                <textarea value={thinkContext} onChange={e => setThinkContext(e.target.value)} rows={2}
                  placeholder="Premium fragrance brand, known for minimalist packaging, price point $120…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Audience</label>
                <input value={thinkAudience} onChange={e => setThinkAudience(e.target.value)}
                  placeholder="Urban professionals 25–35, aspirational, social-media native…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Constraints <span className="font-normal text-slate-400">(optional)</span></label>
                <input value={thinkConstraints} onChange={e => setThinkConstraints(e.target.value)}
                  placeholder="No celebrities, must work across Instagram + TikTok, max 30s video…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted" />
              </div>
            </div>

            <button onClick={handleThink} disabled={!thinkProblem.trim() || thinking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              {thinking
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Thinking (7 phases)…</>
                : <><Brain className="w-4 h-4" /> Start Creative Session</>}
            </button>
            {thinkError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{thinkError}</p>}

            {ideationOutput && <IdeationResult output={ideationOutput} onUseConcept={handleUseConcept} />}
          </div>
        )}

        {/* ── Text on Visuals tab ── */}
        {activeTab === 'tov' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">AI Design Expert</p>
            </div>
            <div className="space-y-3">
              {tovItems.map(item => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <input type="text" value={item.text}
                      onChange={e => setTovItems(prev => prev.map(t => t.id === item.id ? { ...t, text: e.target.value } : t))}
                      placeholder={item.role === 'headline' ? 'NOVAX SKINCARE' : item.role === 'tagline' ? 'Luxury Redefined' : item.role === 'callout' ? 'Shop Now' : 'Supporting text…'}
                      className="flex-1 px-2.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted" />
                    {tovItems.length > 1 && (
                      <button onClick={() => setTovItems(prev => prev.filter(t => t.id !== item.id))} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {TOV_ROLES.map(r => (
                      <button key={r.id} onClick={() => setTovItems(prev => prev.map(t => t.id === item.id ? { ...t, role: r.id } : t))}
                        className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors', item.role === r.id ? 'bg-novax text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {tovItems.length < 4 && (
                <button onClick={() => setTovItems(prev => [...prev, { id: `tov-${Date.now()}`, text: '', role: 'tagline' }])}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-novax transition-colors">
                  <Plus className="w-3 h-3" /> Add text element
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Brand Colors</label>
              <div className="flex flex-wrap gap-3">
                {brandColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input type="color" value={c} onChange={e => setBrandColors(prev => prev.map((pc, pi) => pi === i ? e.target.value : pc))} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                    <input type="text" value={c} onChange={e => setBrandColors(prev => prev.map((pc, pi) => pi === i ? e.target.value : pc))} className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-700 outline-none focus:border-novax-muted" />
                  </div>
                ))}
                {brandColors.length < 3 && (
                  <button onClick={() => setBrandColors(prev => [...prev, '#000000'])} className="flex items-center gap-1 text-xs text-slate-500 hover:text-novax transition-colors">
                    <Plus className="w-3 h-3" /> Color
                  </button>
                )}
              </div>
            </div>
            <button onClick={handleApplyDesign} disabled={!imageData || applyingDesign || tovItems.every(i => !i.text.trim())}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              {applyingDesign ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Apply AI Design</>}
            </button>
            {!imageData && <p className="text-[10px] text-center text-slate-400">Generate or resize an image first</p>}
            {tovError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{tovError}</p>}
            <div className="border-t border-slate-100 pt-3">
              <button onClick={addTextLayer} disabled={!imageData}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border border-novax-border text-novax hover:bg-novax-light disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Text Layer Manually
              </button>
            </div>
          </div>
        )}

        {selectedLayer && (
          <TextControls layer={selectedLayer} onUpdate={patch => updateLayer(selectedLayer.id, patch)} />
        )}
      </div>

      {/* ── Canvas Area ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Canvas */}
        <div className="flex items-center justify-center flex-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden"
          onClick={() => setSelectedId(null)}>
          {!imageData && !isLoading && (
            <div className="flex flex-col items-center gap-3 text-slate-400 select-none">
              <Wand2 className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                {activeTab === 'resize' ? 'Upload a source image and click Resize' : activeTab === 'think' ? 'Use a top concept to generate an image' : 'Enter a prompt and generate an image'}
              </p>
              <p className="text-xs text-slate-400">{selectedModel.label} · {selectedModel.tag}</p>
            </div>
          )}
          {isLoading && (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <div className="w-16 h-16 rounded-2xl border-4 border-novax-border border-t-novax-accent animate-spin" />
              <p className="text-sm font-medium">
                {resizing ? `Recomposing to ${aspectRatio}…` : editing ? 'Applying surgical edit…' : `Generating with ${selectedModel.label}…`}
              </p>
              <p className="text-xs text-slate-400">
                {resizing ? 'Preserving all elements…' : editing ? 'Changing only what you specified…' : 'This takes about 10–20 seconds'}
              </p>
            </div>
          )}
          {imageData && !isLoading && (
            <div className="relative mx-auto" style={aspectStyle} ref={containerRef}
              onClick={e => { if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG') setSelectedId(null) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:${imageMime};base64,${imageData}`} alt="AI generated" className="w-full h-full object-cover rounded-lg select-none" draggable={false} />
              {textLayers.map(layer => (
                <DraggableText key={layer.id} layer={layer} selected={selectedId === layer.id}
                  onSelect={() => setSelectedId(layer.id)} onUpdate={patch => updateLayer(layer.id, patch)}
                  onDelete={() => deleteLayer(layer.id)} containerRef={containerRef} />
              ))}
            </div>
          )}
        </div>

        {/* Edit panel — appears below canvas when active */}
        {imageData && !isLoading && showEditPanel && (
          <div className="bg-white rounded-xl border border-novax-border p-3 flex gap-2 items-start">
            <Pencil className="w-4 h-4 text-novax-accent shrink-0 mt-2.5" />
            <div className="flex-1 space-y-1.5">
              <textarea
                value={editPrompt}
                onChange={e => setEditPrompt(e.target.value)}
                rows={2}
                placeholder="Make the background darker. Remove the text. Change the car color to red. Add soft fog in the lower third…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button onClick={handleEdit} disabled={!editPrompt.trim() || editing}
                className="flex items-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                {editing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Applying</> : <><Sparkles className="w-3.5 h-3.5" /> Apply</>}
              </button>
              <button onClick={() => { setShowEditPanel(false); setEditPrompt(''); setEditError(null) }}
                className="flex items-center justify-center px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        {imageData && !isLoading && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Left actions */}
            <button onClick={() => { setShowEditPanel(p => !p); setEditError(null) }}
              className={cn('flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors',
                showEditPanel ? 'bg-novax text-white border-novax' : 'border-novax-border text-novax hover:bg-novax-light')}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button onClick={() => setActiveTab('tov')}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
              <Type className="w-3.5 h-3.5" />
              Add Text
            </button>
            {selectedId && (
              <button onClick={() => deleteLayer(selectedId)}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              {/* Save to Library */}
              {savedUrl ? (
                <a href="/assets" className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium transition-colors hover:bg-emerald-100">
                  <Check className="w-3.5 h-3.5" />
                  Saved
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ) : (
                <button onClick={handleSaveToLibrary} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save to Library</>}
                </button>
              )}
              <button onClick={activeTab === 'resize' ? handleResize : handleGenerate}
                disabled={isLoading || (activeTab === 'resize' ? !resizeSource : !prompt.trim())}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                <RefreshCw className="w-3.5 h-3.5" />
                {activeTab === 'resize' ? 'Re-resize' : 'Regenerate'}
              </button>
              <button onClick={handleDownload} disabled={exporting}
                className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {exporting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : <><Download className="w-3.5 h-3.5" /> Download PNG</>}
              </button>
            </div>
          </div>
        )}

        {/* Layer chips */}
        {textLayers.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Text Layers</p>
            <div className="flex flex-wrap gap-2">
              {textLayers.map((layer, i) => (
                <button key={layer.id} onClick={() => setSelectedId(layer.id)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                    selectedId === layer.id ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                  <Type className="w-3 h-3" />
                  Layer {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
