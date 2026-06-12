'use client'

import { useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, Loader2, CheckCircle, Copy, RefreshCw, ChevronDown, ChevronUp,
  Upload, Link2, X, Image as ImageIcon, Hash, Zap, BookmarkPlus,
  GripVertical, Plus, Layers, Download, FileSpreadsheet, AlertCircle,
  StopCircle, Clock, Search, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { convertGoogleDriveUrl } from '@/lib/google-drive'
import type {
  CopyFramework, CopyLength, EmojiStyle, HashtagStyle, CopyLanguage, CopyDialect,
  CopyImage, CopyDocument, SlideCaption,
} from '@/lib/studio-types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'X (Twitter)', 'Facebook', 'YouTube', 'Snapchat']

// ── Test presets ──────────────────────────────────────────────────────────────

const COPY_PRESETS = {
  lumara: {
    clientId:  'b1a2c3d4-e5f6-7890-abcd-ef1234567890',
    language:  'ar' as CopyLanguage,
    dialect:   'gulf' as CopyDialect,
    platform:  'Instagram',
    framework: 'pas' as CopyFramework,
    brief:     'Lumara Barrier Repair Serum launch week. Show the ritual: apply at night, wake up to visibly calmer skin. Aspirational but real — no CGI glow, actual texture and skin response.',
    variants:  2 as 1|2|3,
  },
  nike: {
    clientId:  '',
    language:  'en' as CopyLanguage,
    dialect:   'gulf' as CopyDialect,
    platform:  'Instagram',
    framework: 'storybrand' as CopyFramework,
    brief:     'Nike Air Max limited drop. UAE sneaker culture, street-authentic. The shoe is the hero — no corporate gloss. Goal: drive saves and DMs on Instagram.',
    variants:  2 as 1|2|3,
  },
} as const

const FRAMEWORKS: { value: CopyFramework; label: string; desc: string }[] = [
  { value: 'auto',             label: 'Auto',             desc: 'AI picks the best framework for the content' },
  { value: 'aida',             label: 'AIDA',             desc: 'Attention → Interest → Desire → Action' },
  { value: 'pas',              label: 'PAS',              desc: 'Problem → Agitate → Solution' },
  { value: 'bab',              label: 'BAB',              desc: 'Before → After → Bridge' },
  { value: 'hook_story_offer', label: 'Hook-Story-Offer', desc: 'Hook + Micro-story + Offer' },
  { value: '4ps',              label: '4Ps',              desc: 'Promise → Picture → Proof → Push' },
  { value: 'storybrand',       label: 'StoryBrand',       desc: 'Audience as hero, brand as guide' },
  { value: 'pastor',           label: 'PASTOR',           desc: 'Problem → Amplify → Story → Transformation → Offer → Response' },
]

const ARCHETYPES = [
  { value: 'auto',          label: 'Auto' },
  { value: 'honest_expert', label: 'Honest Expert' },
  { value: 'community',     label: 'Enthusiastic Community' },
  { value: 'ambitious',     label: 'Ambitious Guide' },
  { value: 'discovery',     label: 'Discovery Friend' },
  { value: 'quiet',         label: 'Quiet Confidence' },
  { value: 'witty',         label: 'Witty Spirit' },
]

const DIALECTS: { value: CopyDialect; label: string }[] = [
  { value: 'saudi',    label: 'Saudi' },
  { value: 'egyptian', label: 'Egyptian' },
  { value: 'gulf',     label: 'Gulf (Pan-Gulf)' },
  { value: 'msa',      label: 'MSA (Formal)' },
]

const LENGTH_OPTIONS: { value: CopyLength; label: string; range: string }[] = [
  { value: 'micro',    label: 'Micro',    range: '<50 chars' },
  { value: 'short',    label: 'Short',    range: '50–150' },
  { value: 'medium',   label: 'Medium',   range: '150–300' },
  { value: 'long',     label: 'Long',     range: '300–500' },
  { value: 'extended', label: 'Extended', range: '500+' },
]

const EMOJI_OPTIONS: { value: EmojiStyle; label: string }[] = [
  { value: 'none',     label: 'None' },
  { value: 'minimal',  label: 'Minimal (1–2)' },
  { value: 'moderate', label: 'Moderate (3–5)' },
  { value: 'rich',     label: 'Rich (6+)' },
]

const HASHTAG_OPTIONS: { value: HashtagStyle; label: string; range: string }[] = [
  { value: 'none',     label: 'None',     range: '' },
  { value: 'minimal',  label: 'Minimal',  range: '3–5' },
  { value: 'standard', label: 'Standard', range: '8–12' },
  { value: 'max',      label: 'Max',      range: '20–30' },
]

// ── Carousel slot type ────────────────────────────────────────────────────────

interface CarouselSlot {
  id: string
  base64: string | null
  mimeType: string
  driveUrl: string
  preview: string | null
  note: string
}

function makeSlot(id: string): CarouselSlot {
  return { id, base64: null, mimeType: 'image/jpeg', driveUrl: '', preview: null, note: '' }
}

// ── Bulk types ────────────────────────────────────────────────────────────────

interface BulkRow {
  row_number: number
  drive_url: string
  brief: string
  platform?: string
  language?: string
  dialect?: string
  framework?: string
  caption_length?: string
  emoji_style?: string
  hashtag_style?: string
  cta_mode?: string
  custom_cta?: string
  post_goal?: string
  offer_promo?: string
  variant_count: number
  is_carousel: boolean
  slide_count: number
}

interface BulkResult extends BulkRow {
  status: 'pending' | 'processing' | 'done' | 'error'
  captions: string[]
  slide_captions: string[]
  hashtags: string[]
  framework_used: string
  provider: string
  error?: string
}

// ── Canvas resize ─────────────────────────────────────────────────────────────

async function resizeToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const img = new window.Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1024
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const resized = canvas.toDataURL('image/jpeg', 0.85)
        resolve({ base64: resized.split(',')[1] ?? '', mimeType: 'image/jpeg' })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

// ── Bulk helpers (module-level, no hooks) ─────────────────────────────────────

function downloadBulkTemplate() {
  const headers = [
    'drive_url', 'brief', 'platform', 'language', 'dialect', 'framework',
    'caption_length', 'emoji_style', 'hashtag_style', 'cta_mode', 'custom_cta',
    'post_goal', 'offer_promo', 'variant_count',
  ]
  const examples = [
    [
      'https://drive.google.com/file/d/EXAMPLE_ID/view',
      'Product launch. Emphasize limited stock.',
      'instagram', 'ar', 'saudi', 'auto', 'medium', 'none', 'none', 'auto', '', 'conversion', '', 1,
    ],
    [
      'https://drive.google.com/file/d/SLIDE1/view;https://drive.google.com/file/d/SLIDE2/view',
      'Carousel tutorial — swipe to see all steps',
      'instagram', 'ar', 'saudi', 'aida', 'long', 'minimal', 'minimal', 'auto', '', 'engagement', '20% off', 1,
    ],
    [
      '',
      'Ramadan greeting post. Warm and heartfelt. No product mention.',
      'instagram', 'ar', 'saudi', 'storybrand', 'medium', 'none', 'none', 'none', '', 'awareness', '', 2,
    ],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 70 : i === 1 ? 45 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Copy Bulk')
  XLSX.writeFile(wb, 'copy_bulk_template.xlsx')
}

async function parseBulkExcel(file: File): Promise<BulkRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        const rows: BulkRow[] = jsonRows
          .slice(0, 50)
          .map((r, i) => {
            const raw = String(r['drive_url'] ?? r['Drive URL'] ?? r['drive_urls'] ?? '').trim()
            const urls = raw.split(/[;\n]/).map(u => u.trim()).filter(Boolean)
            const vc = Number(r['variant_count'] ?? r['Variants'] ?? 1)
            return {
              row_number:     i + 1,
              drive_url:      raw,
              brief:          String(r['brief'] ?? r['Brief'] ?? '').trim(),
              platform:       String(r['platform'] ?? r['Platform'] ?? '').trim().toLowerCase() || undefined,
              language:       String(r['language'] ?? r['Language'] ?? '').trim().toLowerCase() || undefined,
              dialect:        String(r['dialect'] ?? r['Dialect'] ?? '').trim().toLowerCase() || undefined,
              framework:      String(r['framework'] ?? r['Framework'] ?? '').trim().toLowerCase() || undefined,
              caption_length: String(r['caption_length'] ?? r['Caption Length'] ?? '').trim().toLowerCase() || undefined,
              emoji_style:    String(r['emoji_style'] ?? r['Emoji Style'] ?? '').trim().toLowerCase() || undefined,
              hashtag_style:  String(r['hashtag_style'] ?? r['Hashtag Style'] ?? '').trim().toLowerCase() || undefined,
              cta_mode:       String(r['cta_mode'] ?? r['CTA Mode'] ?? '').trim().toLowerCase() || undefined,
              custom_cta:     String(r['custom_cta'] ?? r['Custom CTA'] ?? '').trim() || undefined,
              post_goal:      String(r['post_goal'] ?? r['Post Goal'] ?? '').trim().toLowerCase() || undefined,
              offer_promo:    String(r['offer_promo'] ?? r['Offer/Promo'] ?? '').trim() || undefined,
              variant_count:  Math.min(Math.max(isNaN(vc) ? 1 : vc, 1), 3),
              is_carousel:    urls.length > 1,
              slide_count:    urls.length,
            }
          })
          .filter(r => r.drive_url || r.brief)

        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function exportBulkResults(results: BulkResult[]) {
  const rows = results.map(r => {
    const obj: Record<string, unknown> = {
      Row:    r.row_number,
      Status: r.status,
      Type:   r.is_carousel ? `Carousel (${r.slide_count})` : r.drive_url ? 'Single' : 'Text',
      'Drive URL': r.drive_url,
      Brief:  r.brief,
    }
    for (let i = 1; i <= 3; i++) obj[`Caption ${i}`] = r.captions[i - 1] ?? ''
    if (r.slide_captions.length > 0) obj['Slide Captions'] = r.slide_captions.join(' ; ')
    obj.Hashtags       = r.hashtags.join(' ')
    obj.Framework      = r.framework_used
    obj.Provider       = r.provider
    obj.Error          = r.error ?? ''
    return obj
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const keys = Object.keys(rows[0] ?? {})
  ws['!cols'] = keys.map(k => ({
    wch: Math.max(k.length + 2, ...rows.slice(0, 20).map(r => Math.min(String(r[k] ?? '').length, 80)))
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Results')
  XLSX.writeFile(wb, `copy_bulk_${new Date().toISOString().slice(0, 10)}.xlsx`)
  toast.success('Results exported')
}

// ── Loading component ─────────────────────────────────────────────────────────

type LoadStep = { label: string; status: 'pending' | 'active' | 'complete' }

function CopyLoading({ steps, elapsed }: { steps: LoadStep[]; elapsed: number }) {
  const allPending = steps.every(s => s.status === 'pending')
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {allPending ? (
        <div className="text-center">
          <p className="text-2xl font-black text-novax tracking-tight">NOVAX</p>
          <p className="text-sm text-slate-500 mt-2">Preparing Copy Engine...</p>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-1">
          {steps.map((step, i) => (
            <div key={i} className={cn('flex items-center gap-3 py-2', step.status === 'pending' && 'opacity-40')}>
              {step.status === 'pending'  && <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
              {step.status === 'active'   && <Loader2 className="w-4 h-4 text-novax-accent animate-spin shrink-0" />}
              {step.status === 'complete' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
              <span className={cn(
                'text-sm',
                step.status === 'active' && 'text-slate-800 font-medium',
                step.status === 'pending' && 'text-slate-400',
              )}>
                {step.label}
              </span>
            </div>
          ))}
          {elapsed > 2 && <p className="text-xs text-slate-400 mt-4 text-right">{elapsed}s</p>}
        </div>
      )}
    </div>
  )
}

// ── Slide caption card ────────────────────────────────────────────────────────

function SlideCaptionCard({ sc, language }: { sc: SlideCaption; language: CopyLanguage }) {
  const [copied, setCopied] = useState(false)
  const isArabic = language === 'ar'

  function copy() {
    navigator.clipboard.writeText(sc.caption).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="shrink-0 w-6 h-6 rounded-full bg-novax text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
        {sc.slide_index}
      </span>
      <p dir={isArabic ? 'rtl' : 'ltr'} className="flex-1 text-sm text-slate-800 leading-snug">{sc.caption}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-slate-400">{sc.char_count}c</span>
        <button onClick={copy}
          className={cn('p-1.5 rounded-lg transition-colors',
            copied ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-novax hover:bg-novax-light')}
        >
          {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ── Variant card ──────────────────────────────────────────────────────────────

function VariantCard({
  variant, hashtags, altText, showHashtags, language, onSaveExample,
}: {
  variant: CopyDocument['variants'][number]
  hashtags: string[]
  altText: string
  showHashtags: boolean
  language: CopyLanguage
  onSaveExample: () => void
}) {
  const [copied,   setCopied]   = useState(false)
  const [hashOpen, setHashOpen] = useState(false)
  const [altOpen,  setAltOpen]  = useState(false)
  const isArabic = language === 'ar'

  function copyCaption() {
    const text = showHashtags && hashOpen
      ? `${variant.caption}\n\n${hashtags.join(' ')}`
      : variant.caption
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Variant {variant.variant_index}</span>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-novax-light text-novax-muted rounded-full border border-novax-border">
            {variant.framework_used}
          </span>
          <span className="px-2 py-0.5 text-[10px] text-slate-400 bg-white rounded-full border border-slate-200">
            {variant.char_count} chars
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onSaveExample} title="Save as approved example"
            className="p-1.5 rounded-lg text-slate-400 hover:text-novax hover:bg-novax-light transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={copyCaption}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              copied
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-novax-border hover:text-novax',
            )}
          >
            {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="p-4">
        <p dir={isArabic ? 'rtl' : 'ltr'}
          className={cn('text-sm text-slate-800 whitespace-pre-wrap leading-relaxed', isArabic && 'font-arabic')}
        >
          {variant.caption}
        </p>
      </div>
      {hashtags.length > 0 && (
        <div className="border-t border-slate-100">
          <button onClick={() => setHashOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{hashtags.length} hashtags</span>
            {hashOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {hashOpen && (
            <div className="px-4 pb-3">
              <p dir={isArabic ? 'rtl' : 'ltr'} className="text-xs text-novax-muted leading-relaxed">{hashtags.join(' ')}</p>
            </div>
          )}
        </div>
      )}
      {altText && (
        <div className="border-t border-slate-100">
          <button onClick={() => setAltOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Alt text</span>
            {altOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {altOpen && (
            <div className="px-4 pb-3">
              <p className="text-xs text-slate-500 leading-relaxed">{altText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sortable carousel slot ────────────────────────────────────────────────────

function SortableSlot({
  slot, index, imageMode, onFileSelect, onDriveInput, onNoteChange, onRemove, canRemove,
}: {
  slot: CarouselSlot
  index: number
  imageMode: 'upload' | 'drive'
  onFileSelect: (slotId: string, file: File | null) => void
  onDriveInput: (slotId: string, value: string) => void
  onNoteChange: (slotId: string, value: string) => void
  onRemove: (slotId: string) => void
  canRemove: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const localRef = useRef<HTMLInputElement>(null)

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 group">
      <button {...attributes} {...listeners}
        className="mt-3 p-1 rounded text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-500">Slide {index + 1}</span>
          {canRemove && (
            <button onClick={() => onRemove(slot.id)}
              className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {imageMode === 'upload' ? (
          <div>
            <input ref={localRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(slot.id, f); e.target.value = '' }}
            />
            {slot.preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.preview} alt={`Slide ${index + 1}`}
                  className="w-full max-h-32 object-contain rounded-xl border border-slate-200 bg-slate-50"
                />
                <button onClick={() => onFileSelect(slot.id, null)}
                  className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => localRef.current?.click()}
                className="w-full flex items-center gap-2 justify-center py-5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-novax-border hover:text-novax-muted transition-all text-xs font-medium"
              >
                <Upload className="w-4 h-4" />
                Add image
              </button>
            )}
          </div>
        ) : (
          <input type="text" value={slot.driveUrl} onChange={e => onDriveInput(slot.id, e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
          />
        )}
        <input type="text" value={slot.note} onChange={e => onNoteChange(slot.id, e.target.value)}
          placeholder="Slide note (optional) — e.g. 'feature close-up', 'before photo'"
          className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
        />
      </div>
    </div>
  )
}

// ── Bulk section ──────────────────────────────────────────────────────────────

function BulkSection({ clients }: { clients: Array<{ id: string; name: string }> }) {
  // Global defaults (used when row doesn't specify its own value)
  const [clientId,     setClientId]     = useState('')
  const [language,     setLanguage]     = useState<CopyLanguage>('ar')
  const [dialect,      setDialect]      = useState<CopyDialect>('saudi')
  const [platform,     setPlatform]     = useState('instagram')
  const [framework,    setFramework]    = useState<CopyFramework>('auto')
  const [captionLen,   setCaptionLen]   = useState<CopyLength>('medium')
  const [variants,     setVariants]     = useState<1|2|3>(1)
  const [emojiStyle,   setEmojiStyle]   = useState<EmojiStyle>('none')
  const [hashtagStyle, setHashtagStyle] = useState<HashtagStyle>('none')
  const [defaultsOpen, setDefaultsOpen] = useState(false)

  // Workflow state
  const [step,       setStep]       = useState<'setup' | 'preview' | 'processing' | 'done'>('setup')
  const [parsedRows, setParsedRows] = useState<BulkRow[]>([])
  const [results,    setResults]    = useState<BulkResult[]>([])
  const [parseError, setParseError] = useState('')
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [countdown,  setCountdown]  = useState(0)
  const abortRef   = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doneCount  = results.filter(r => r.status === 'done').length
  const errorCount = results.filter(r => r.status === 'error').length
  const estSeconds = parsedRows.length * 10

  async function handleFileUpload(file: File) {
    setParseError('')
    try {
      const rows = await parseBulkExcel(file)
      if (rows.length === 0) { setParseError('No valid rows found. Make sure each row has a drive_url or a brief.'); return }
      setParsedRows(rows)
      setStep('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file')
    }
  }

  async function runGeneration() {
    abortRef.current = false
    setStep('processing')
    setCurrentIdx(-1)
    setCountdown(0)

    const initialResults: BulkResult[] = parsedRows.map(r => ({
      ...r,
      status:        'pending',
      captions:      [],
      slide_captions: [],
      hashtags:      [],
      framework_used: '',
      provider:      '',
    }))
    setResults(initialResults)

    for (let i = 0; i < parsedRows.length; i++) {
      if (abortRef.current) break

      setCurrentIdx(i)
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r))

      const row = parsedRows[i]
      const driveUrls = row.drive_url.split(/[;\n]/).map(u => u.trim()).filter(Boolean)
      const images: CopyImage[] = driveUrls.map((u, si) => ({
        type: 'drive', data: u, mime_type: 'image/jpeg', slide_index: si,
      }))

      try {
        const res = await fetch('/api/studio/copy/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id:      clientId || undefined,
            language:       (row.language as CopyLanguage)       || language,
            dialect:        (row.dialect as CopyDialect)         || dialect,
            platform:       (row.platform || platform).toLowerCase().replace(/\s+/g, '_').replace('(twitter)', '').replace('x_', 'x'),
            framework:      (row.framework as CopyFramework)     || framework,
            caption_length: (row.caption_length as CopyLength)   || captionLen,
            tone_intensity: 3,
            emoji_style:    (row.emoji_style as EmojiStyle)      || emojiStyle,
            hashtag_style:  (row.hashtag_style as HashtagStyle)  || hashtagStyle,
            cta_mode:       row.cta_mode   || 'auto',
            custom_cta:     row.custom_cta || '',
            variant_count:  row.variant_count || variants,
            brief:          row.brief        || '',
            offer_promo:    row.offer_promo  || '',
            post_goal:      row.post_goal    || 'engagement',
            disclosure:     'none',
            tone_archetype: 'auto',
            images:         images.length > 0 ? images : undefined,
            force_gemini:   true,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Generation failed')

        const doc = data as CopyDocument
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status:         'done',
          captions:       doc.variants.map(v => v.caption),
          slide_captions: doc.slide_captions?.map(sc => sc.caption) ?? [],
          hashtags:       doc.hashtags,
          framework_used: doc.framework_used,
          provider:       doc.provider,
        } : r))
      } catch (err) {
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: 'error',
          error:  err instanceof Error ? err.message : 'Unknown error',
        } : r))
      }

      // 10 s countdown before next row
      if (i < parsedRows.length - 1 && !abortRef.current) {
        for (let c = 10; c > 0; c--) {
          if (abortRef.current) break
          setCountdown(c)
          await new Promise(r => setTimeout(r, 1000))
        }
        setCountdown(0)
      }
    }

    setCurrentIdx(-1)
    setStep('done')
  }

  function handleStop() {
    abortRef.current = true
  }

  function resetBulk() {
    setParsedRows([]); setResults([]); setParseError(''); setStep('setup')
    setCurrentIdx(-1); setCountdown(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Setup step ────────────────────────────────────────────────

  if (step === 'setup') {
    return (
      <div className="space-y-6">
        {/* Instructions */}
        <div className="p-4 bg-novax-light border border-novax-border rounded-2xl space-y-2">
          <p className="text-xs font-semibold text-novax uppercase tracking-wide">How it works</p>
          <ol className="text-sm text-novax-muted space-y-1 list-decimal list-inside">
            <li>Download the Excel template below</li>
            <li>Fill in Drive URLs + briefs (one row = one post)</li>
            <li>Upload the file — generation runs automatically with 10s between each call</li>
          </ol>
          <p className="text-xs text-novax-muted mt-1">Drive-only (no local image uploads in bulk mode). Max 50 rows per run.</p>
        </div>

        <button
          onClick={downloadBulkTemplate}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-novax-border bg-novax-light/60 text-novax-muted text-sm font-semibold rounded-2xl hover:bg-novax-light transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Excel Template
        </button>

        {/* Global defaults (collapsible) */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setDefaultsOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-700">Global defaults</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{language.toUpperCase()} · {dialect} · {platform} · {framework}</span>
              {defaultsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {defaultsOpen && (
            <div className="px-4 pb-5 pt-3 border-t border-slate-100 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</p>
                  <select value={clientId} onChange={e => setClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-novax-border-active"
                  >
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform</p>
                  <select value={platform} onChange={e => setPlatform(e.target.value.toLowerCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-novax-border-active"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Language</p>
                <div className="flex gap-2">
                  {(['en', 'ar', 'both'] as CopyLanguage[]).map(l => (
                    <button key={l} onClick={() => setLanguage(l)}
                      className={cn('flex-1 py-2 rounded-xl text-xs font-semibold border transition-all',
                        language === l ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                    >
                      {l === 'en' ? 'EN' : l === 'ar' ? 'AR' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              {(language === 'ar' || language === 'both') && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dialect</p>
                  <div className="grid grid-cols-4 gap-2">
                    {DIALECTS.map(d => (
                      <button key={d.value} onClick={() => setDialect(d.value)}
                        className={cn('py-2 rounded-xl text-xs font-semibold border transition-all',
                          dialect === d.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Framework</p>
                  <select value={framework} onChange={e => setFramework(e.target.value as CopyFramework)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-novax-border-active"
                  >
                    {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variants per post</p>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map(n => (
                      <button key={n} onClick={() => setVariants(n)}
                        className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                          variants === n ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Caption length</p>
                <div className="flex flex-wrap gap-2">
                  {LENGTH_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setCaptionLen(o.value)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        captionLen === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                    >
                      {o.label} <span className="opacity-60">{o.range}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emojis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setEmojiStyle(o.value)}
                        className={cn('px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                          emojiStyle === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HASHTAG_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setHashtagStyle(o.value)}
                        className={cn('px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                          hashtagStyle === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload area */}
        <div className="space-y-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-novax-border hover:text-novax-muted transition-all group"
          >
            <FileSpreadsheet className="w-8 h-8 group-hover:text-novax" />
            <span className="text-sm font-semibold">Upload filled Excel file</span>
            <span className="text-xs">.xlsx, .xls, .csv — max 50 rows</span>
          </button>
          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{parseError}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Preview step ──────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{parsedRows.length} rows ready</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Estimated time: ~{estSeconds >= 60 ? `${Math.round(estSeconds / 60)}m` : `${estSeconds}s`}
              {' '}({parsedRows.length} posts × 10s)
            </p>
          </div>
          <button onClick={resetBulk}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Change file
          </button>
        </div>

        {/* Row table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_1fr_80px] text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <span>#</span><span>Drive URL</span><span>Brief</span><span>Type</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {parsedRows.map(row => (
              <div key={row.row_number} className="grid grid-cols-[40px_1fr_1fr_80px] items-center px-4 py-2.5 text-xs">
                <span className="text-slate-400 font-mono">{row.row_number}</span>
                <span className="text-slate-600 truncate pr-2">
                  {row.drive_url
                    ? (row.is_carousel ? `${row.slide_count} slide URLs` : row.drive_url.slice(0, 30) + '…')
                    : <span className="text-slate-400 italic">no image</span>
                  }
                </span>
                <span className="text-slate-600 truncate pr-2">
                  {row.brief || <span className="text-slate-400 italic">no brief</span>}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit',
                  row.is_carousel ? 'bg-purple-100 text-purple-700' : row.drive_url ? 'bg-novax-light text-novax-muted' : 'bg-slate-100 text-slate-600',
                )}>
                  {row.is_carousel ? `Carousel` : row.drive_url ? 'Single' : 'Text'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={resetBulk}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <button onClick={runGeneration}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-novax text-white hover:bg-novax-hover transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" />
            Generate {parsedRows.length} Posts
          </button>
        </div>
      </div>
    )
  }

  // ── Processing step ───────────────────────────────────────────

  if (step === 'processing') {
    const done    = results.filter(r => r.status === 'done' || r.status === 'error').length
    const total   = results.length
    const pct     = total > 0 ? Math.round((done / total) * 100) : 0

    return (
      <div className="space-y-5">
        {/* Progress header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Generating... {done}/{total} done</p>
            <button onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <StopCircle className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-novax rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400 text-right">{pct}%</p>
        </div>

        {/* Row status list */}
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <div key={r.row_number}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border text-xs transition-colors',
                r.status === 'processing' ? 'bg-novax-light border-novax-border' :
                r.status === 'done'       ? 'bg-white border-slate-200' :
                r.status === 'error'      ? 'bg-red-50 border-red-200' :
                'bg-white border-slate-100 opacity-50',
              )}
            >
              {/* Status icon */}
              <div className="shrink-0 mt-0.5">
                {r.status === 'pending'    && <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                {r.status === 'processing' && <Loader2 className="w-4 h-4 text-novax-accent animate-spin" />}
                {r.status === 'done'       && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                {r.status === 'error'      && <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Row {r.row_number}</span>
                  {r.status === 'processing' && countdown > 0 && i === currentIdx + 1 && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" /> next in {countdown}s
                    </span>
                  )}
                  {r.status === 'done' && r.captions[0] && (
                    <span className="text-slate-400 truncate">{r.captions[0].slice(0, 50)}…</span>
                  )}
                  {r.status === 'error' && (
                    <span className="text-red-600">{r.error}</span>
                  )}
                </div>
                {r.status === 'pending' && countdown > 0 && i === currentIdx + 1 && (
                  <p className="text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Starting in {countdown}s
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Done step ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">Done</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {doneCount} succeeded{errorCount > 0 ? `, ${errorCount} failed` : ''}
          </p>
        </div>
        <button onClick={resetBulk}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-novax-light text-novax border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New run
        </button>
      </div>

      <button
        onClick={() => exportBulkResults(results)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-novax text-white text-sm font-semibold rounded-2xl hover:bg-novax-hover transition-colors shadow-sm"
      >
        <Download className="w-4 h-4" />
        Export Results Excel
      </button>

      <div className="space-y-2 max-h-[28rem] overflow-y-auto">
        {results.map(r => (
          <ResultRow key={r.row_number} result={r} />
        ))}
      </div>
    </div>
  )
}

// ── Result row (used in bulk done step) ───────────────────────────────────────

function ResultRow({ result }: { result: BulkResult }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  function copy(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx); setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden',
      result.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
    )}>
      <button onClick={() => result.status === 'done' && setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        {result.status === 'done'  && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
        {result.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Row {result.row_number}</span>
            {result.is_carousel && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">Carousel</span>
            )}
          </div>
          {result.status === 'done' && result.captions[0] && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{result.captions[0].slice(0, 70)}…</p>
          )}
          {result.status === 'error' && (
            <p className="text-xs text-red-600 mt-0.5">{result.error}</p>
          )}
        </div>
        {result.status === 'done' && (
          open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && result.status === 'done' && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {result.drive_url && (() => {
            const thumbUrls = result.drive_url
              .split(/[;\n]/).map(u => u.trim()).filter(Boolean)
              .map(u => {
                const { url } = convertGoogleDriveUrl(u)
                return url
                  ? (url.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${url}` : url)
                  : null
              })
              .filter((u): u is string => !!u)
            if (!thumbUrls.length) return null
            return (
              <div className="flex gap-2 flex-wrap pb-1">
                {thumbUrls.map((src, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={src} alt={`Slide ${i + 1}`}
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200 bg-slate-50 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ))}
                {result.is_carousel && (
                  <span className="self-center text-[10px] text-slate-400">{thumbUrls.length} slides</span>
                )}
              </div>
            )
          })()}
          {result.slide_captions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Slide captions</p>
              {result.slide_captions.map((sc, i) => (
                <p key={i} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <span className="font-semibold text-novax-muted mr-1.5">{i + 1}</span>{sc}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {result.captions.map((cap, i) => (
              <div key={i} className="flex items-start gap-2">
                <p className="flex-1 text-xs text-slate-800 bg-slate-50 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {cap}
                </p>
                <button onClick={() => copy(cap, i)}
                  className={cn('p-1.5 rounded-lg shrink-0 mt-1 transition-colors',
                    copied === i ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-novax hover:bg-novax-light')}
                >
                  {copied === i ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
          {result.hashtags.length > 0 && (
            <p className="text-[11px] text-novax-muted">{result.hashtags.join(' ')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pinterest Inspiration Lab ─────────────────────────────────────────────────

type InspirationPhase = 'idle' | 'probing' | 'clusters' | 'harvesting' | 'results'

interface InsLabCluster {
  id: 'A' | 'B' | 'C' | 'D'
  label: string
  description: string
  samplePins: { id: string; imageUrl: string; title: string; description: string; saveCount: number }[]
  pinIds: string[]
}

interface InsLabPin {
  id: string
  imageUrl: string
  title: string
  description: string
  saveCount: number
  compositeScore: number
  scoreRationale: string
  styleClusterId?: string
}

export interface InsLabRef {
  pinId:           string
  title:           string
  description:     string
  elementBorrowed: string
  elementLabel:    string
}

const BORROW_ELEMENTS: { value: string; label: string }[] = [
  { value: 'hook_structure',     label: 'Hook structure' },
  { value: 'sentence_rhythm',    label: 'Sentence rhythm' },
  { value: 'cta_pattern',        label: 'CTA pattern' },
  { value: 'opening_line',       label: 'Opening line' },
  { value: 'tone_voice',         label: 'Tone / voice' },
  { value: 'structural_formula', label: 'Structural formula' },
]

function InspirationLabSection({
  clientId,
  defaultPlatform,
  language: parentLanguage,
  contentType: parentContentType,
  onRefsChange,
  onSessionReady,
}: {
  clientId: string
  defaultPlatform: string
  language: CopyLanguage
  contentType: string
  onRefsChange: (refs: InsLabRef[]) => void
  onSessionReady: (sessionId: string | null) => void
}) {
  const [phase,          setPhase]          = useState<InspirationPhase>('idle')
  const [brief,          setBrief]          = useState('')
  const [selPlatforms,   setSelPlatforms]   = useState<string[]>([defaultPlatform || 'Instagram'])
  const [sessionId,      setSessionId]      = useState<string | null>(null)
  const [clusters,      setClusters]      = useState<InsLabCluster[]>([])
  const [feedback,      setFeedback]      = useState<Record<string, 'more' | 'less' | null>>({})
  const [pins,          setPins]          = useState<InsLabPin[]>([])
  const [probeCount,    setProbeCount]    = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  const [loadMsg,       setLoadMsg]       = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [savedRefs,    setSavedRefs]    = useState<Record<string, InsLabRef>>({})
  const [borrowingPin, setBorrowingPin] = useState<string | null>(null)

  const notifyRefs = (next: Record<string, InsLabRef>) => {
    onRefsChange(Object.values(next))
  }

  function toggleFeedback(clusterId: string, val: 'more' | 'less') {
    setFeedback(prev => ({ ...prev, [clusterId]: prev[clusterId] === val ? null : val }))
  }

  function reset() {
    setPhase('idle'); setBrief(''); setSessionId(null)
    setClusters([]); setFeedback({}); setPins([]); setError(null)
    setSavedRefs({}); setBorrowingPin(null); notifyRefs({})
    onSessionReady(null)
  }

  function togglePlatform(p: string) {
    setSelPlatforms(prev =>
      prev.includes(p)
        ? prev.length > 1 ? prev.filter(v => v !== p) : prev  // keep at least 1
        : [...prev, p]
    )
  }

  function scoreColor(s: number) {
    if (s >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (s >= 7) return 'bg-novax-light text-novax-muted border-novax-border'
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  async function saveBorrowRef(pin: InsLabPin, elementValue: string) {
    const el = BORROW_ELEMENTS.find(e => e.value === elementValue)
    if (!el) return
    setBorrowingPin(null)

    // Optimistic update
    const ref: InsLabRef = {
      pinId:           pin.id,
      title:           pin.title,
      description:     pin.description,
      elementBorrowed: elementValue,
      elementLabel:    el.label,
    }
    const next = { ...savedRefs, [pin.id]: ref }
    setSavedRefs(next)
    notifyRefs(next)

    // Persist to DB (fire-and-forget)
    fetch('/api/studio/copy/inspiration/borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pin.id, element_borrowed: elementValue }),
    }).catch(() => {/* best-effort */})
  }

  function removeBorrowRef(pinId: string) {
    const next = { ...savedRefs }
    delete next[pinId]
    setSavedRefs(next)
    notifyRefs(next)
  }

  async function startProbe() {
    if (!brief.trim()) { toast.error('Enter a brief first'); return }
    setPhase('probing')
    setError(null)
    setLoadMsg('Searching Pinterest across 8 creative angles...')
    try {
      const res = await fetch('/api/studio/copy/inspiration/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief_text:   brief,
          platform:     selPlatforms.join(','),
          platforms:    selPlatforms,
          client_id:    clientId || undefined,
          language:     parentLanguage,
          content_type: parentContentType,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Probe failed')
      }
      const data = await res.json()
      setSessionId(data.sessionId)
      onSessionReady(data.sessionId ?? null)
      setClusters(data.clusters ?? [])
      setProbeCount(data.probeCount ?? 0)
      const init: Record<string, 'more' | 'less' | null> = {}
      ;(data.clusters ?? []).forEach((c: InsLabCluster) => { init[c.id] = null })
      setFeedback(init)
      setPhase('clusters')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('idle')
    }
  }

  async function submitFeedback() {
    if (!sessionId) return
    const hasMore = Object.values(feedback).some(v => v === 'more')
    if (!hasMore) { toast.error('Mark at least one direction as "More like this"'); return }
    try {
      await fetch('/api/studio/copy/inspiration/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, feedback }),
      })
    } catch { /* saved best-effort */ }
    setPhase('harvesting')
    setLoadMsg('Running targeted deep search and scoring ~100 pins...')
    try {
      const res = await fetch('/api/studio/copy/inspiration/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Harvest failed')
      }
      const data = await res.json()
      setPins(data.pins ?? [])
      setFilteredCount(data.filteredCount ?? 0)
      setPhase('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Harvest failed')
      setPhase('clusters')
    }
  }

  // ── idle ───────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="space-y-5">
        <div className="p-4 bg-novax-light border border-novax-border rounded-2xl">
          <p className="text-xs font-semibold text-novax-muted">How it works</p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Enter your copy brief. The engine searches Pinterest across 8 creative angles, groups results into 4 style clusters, gets your feedback, then runs a targeted deep search and scores ~100 pins to surface the 50 most structurally useful references.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Platform{selPlatforms.length > 1 ? `s (${selPlatforms.length})` : ''}
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  selPlatforms.includes(p)
                    ? 'bg-novax text-white border-novax'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {selPlatforms.length > 1 && (
            <p className="text-[11px] text-novax-muted">
              Inspiration will be optimised for all selected platforms. Separate variants are generated per platform.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Copy brief</label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            rows={4}
            placeholder="Describe what you're writing. Include the product, target audience, tone, and goal. The more specific, the better the references."
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={startProbe}
          disabled={!brief.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all',
            brief.trim()
              ? 'bg-novax text-white hover:bg-novax-hover shadow-sm hover:shadow-md active:scale-[0.99]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          <Search className="w-4 h-4" />
          Find Inspiration References
        </button>
        <p className="text-center text-xs text-slate-400">Takes 30–45 seconds · Searches Pinterest across 8 creative angles</p>
      </div>
    )
  }

  // ── loading ────────────────────────────────────────────────────

  if (phase === 'probing' || phase === 'harvesting') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-10 h-10 text-novax animate-spin" />
        <p className="text-sm font-semibold text-slate-700">{loadMsg}</p>
        {phase === 'harvesting' && (
          <p className="text-xs text-slate-400 text-center max-w-xs">
            Generating targeted queries, scraping Pinterest, and scoring each pin for structural value
          </p>
        )}
      </div>
    )
  }

  // ── clusters ───────────────────────────────────────────────────

  if (phase === 'clusters') {
    const moreClusters = Object.values(feedback).filter(v => v === 'more').length
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">4 Style Clusters Found</p>
            <p className="text-xs text-slate-500 mt-0.5">{probeCount} pins scanned · Select directions to explore deeper</p>
          </div>
          <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <RefreshCw className="w-3 h-3" />
            Start over
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {clusters.map(cluster => (
            <div
              key={cluster.id}
              className={cn(
                'border rounded-2xl overflow-hidden transition-all',
                feedback[cluster.id] === 'more'  && 'border-novax-border-active bg-novax-light/50',
                feedback[cluster.id] === 'less'  && 'border-slate-200 bg-slate-50 opacity-60',
                feedback[cluster.id] === null    && 'border-slate-200 bg-white',
              )}
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-novax text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {cluster.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{cluster.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{cluster.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleFeedback(cluster.id, 'more')}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      feedback[cluster.id] === 'more'
                        ? 'bg-novax text-white border-novax'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-novax-border hover:text-novax',
                    )}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    More
                  </button>
                  <button
                    onClick={() => toggleFeedback(cluster.id, 'less')}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      feedback[cluster.id] === 'less'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700',
                    )}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    Less
                  </button>
                </div>
              </div>

              {cluster.samplePins.length > 0 && (
                <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                  {cluster.samplePins.slice(0, 3).map(pin => (
                    <div key={pin.id} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      {pin.imageUrl ? (
                        <img
                          src={pin.imageUrl}
                          alt={pin.title || 'Pin'}
                          className="w-full h-20 object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center bg-slate-100">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                      {pin.title && (
                        <p className="text-[10px] text-slate-600 px-1.5 py-1 line-clamp-2 leading-tight">{pin.title}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={submitFeedback}
          disabled={moreClusters === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all',
            moreClusters > 0
              ? 'bg-novax text-white hover:bg-novax-hover shadow-sm hover:shadow-md active:scale-[0.99]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          <Search className="w-4 h-4" />
          {moreClusters > 0
            ? `Deep Search (${moreClusters} direction${moreClusters > 1 ? 's' : ''} approved)`
            : 'Deep Search'}
        </button>
        <p className="text-center text-xs text-slate-400">Takes 35–50 seconds · Scores ~100 pins, returns top 50</p>
      </div>
    )
  }

  // ── results ────────────────────────────────────────────────────

  const savedRefCount  = Object.keys(savedRefs).length
  const savedRefValues = Object.values(savedRefs)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">{filteredCount} Inspiration References</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Scored by visual, caption, and structural borrowability
            {savedRefCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-novax text-white">
                {savedRefCount} borrowed
              </span>
            )}
          </p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <RefreshCw className="w-3 h-3" />
          New search
        </button>
      </div>

      {/* Saved refs summary */}
      {savedRefCount > 0 && (
        <div className="p-3 bg-novax-light border border-novax-border rounded-2xl space-y-2">
          <p className="text-xs font-semibold text-novax-muted">
            {savedRefCount} structural reference{savedRefCount > 1 ? 's' : ''} saved — switch to Single or Carousel to generate copy with these
          </p>
          <div className="space-y-1.5">
            {savedRefValues.map(ref => (
              <div key={ref.pinId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-novax text-white text-[10px] font-bold">
                    {ref.elementLabel}
                  </span>
                  <p className="text-[11px] text-slate-700 truncate">{ref.title || 'Untitled pin'}</p>
                </div>
                <button
                  onClick={() => removeBorrowRef(ref.pinId)}
                  className="shrink-0 p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pins.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
          <Search className="w-8 h-8" />
          <p className="text-sm">No pins met the scoring threshold.</p>
          <button onClick={() => setPhase('clusters')} className="text-xs text-novax hover:underline">
            Adjust feedback and try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pins.map(pin => {
            const saved = savedRefs[pin.id]
            const isOpen = borrowingPin === pin.id
            return (
              <div
                key={pin.id}
                className={cn(
                  'border rounded-2xl overflow-hidden transition-colors',
                  saved ? 'border-novax-border-active bg-novax-light/30' : 'border-slate-200 bg-white hover:border-novax-border',
                )}
              >
                <div className="flex gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    {pin.imageUrl ? (
                      <img
                        src={pin.imageUrl}
                        alt={pin.title || 'Pin'}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-1 flex-1">{pin.title || 'Untitled'}</p>
                      <span className={cn(
                        'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        scoreColor(pin.compositeScore),
                      )}>
                        {pin.compositeScore.toFixed(1)}
                      </span>
                    </div>
                    {pin.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-3 leading-snug">{pin.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400 line-clamp-1 flex-1 italic">{pin.scoreRationale}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {pin.saveCount > 0 && (
                          <p className="text-[10px] text-slate-400">{pin.saveCount.toLocaleString()} saves</p>
                        )}
                        {saved ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-novax-light text-novax-muted border border-novax-border">
                            <CheckCircle className="w-3 h-3" />
                            {saved.elementLabel}
                          </span>
                        ) : (
                          <button
                            onClick={() => setBorrowingPin(isOpen ? null : pin.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax transition-all bg-white"
                          >
                            <BookmarkPlus className="w-3 h-3" />
                            Borrow
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Element picker */}
                {isOpen && !saved && (
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">What are you borrowing?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BORROW_ELEMENTS.map(el => (
                        <button
                          key={el.value}
                          onClick={() => saveBorrowRef(pin, el.value)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-novax-border hover:text-novax hover:bg-novax-light transition-all"
                        >
                          {el.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setBorrowingPin(null)}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ContentType = 'single' | 'carousel' | 'bulk' | 'inspiration'
type PageState   = 'brief'  | 'loading'  | 'document'

let slotCounter = 0
function nextSlotId() { return `slot-${++slotCounter}` }

export default function CopyEnginePage() {
  const params      = useSearchParams()
  const { user }    = useAuth()
  const { clients } = useClients()

  // ── Core selectors ──────────────────────────────────────────
  const [clientId,  setClientId]  = useState<string>(params.get('client_id') ?? '')
  const [language,  setLanguage]  = useState<CopyLanguage>('ar')
  const [dialect,   setDialect]   = useState<CopyDialect>('saudi')
  const [platform,  setPlatform]  = useState('Instagram')
  const [framework, setFramework] = useState<CopyFramework>('auto')
  const [archetype, setArchetype] = useState('auto')

  // ── Caption preferences ─────────────────────────────────────
  const [captionLength,     setCaptionLength]     = useState<CopyLength>('medium')
  const [toneIntensity,     setToneIntensity]     = useState(3)
  const [emojiStyle,        setEmojiStyle]        = useState<EmojiStyle>('none')
  const [customEmojis,      setCustomEmojis]      = useState('')
  const [hashtagStyle,      setHashtagStyle]      = useState<HashtagStyle>('none')
  const [hashtagPlacement,  setHashtagPlacement]  = useState<'caption' | 'first_comment'>('caption')
  const [preferredHashtags, setPreferredHashtags] = useState('')
  const [bannedHashtags,    setBannedHashtags]    = useState('')
  const [ctaMode,    setCtaMode]    = useState<'auto' | 'custom' | 'none'>('auto')
  const [customCta,  setCustomCta]  = useState('')
  const [variantCount,  setVariantCount]  = useState<1|2|3>(1)
  const [brief,         setBrief]         = useState('')
  const [offerPromo,    setOfferPromo]    = useState('')
  const [postGoal,      setPostGoal]      = useState<'awareness'|'engagement'|'conversion'|'retention'>('engagement')
  const [disclosure,    setDisclosure]    = useState<'none'|'arabic'|'english'>('none')

  // ── Content type ────────────────────────────────────────────
  const [contentType, setContentType] = useState<ContentType>('single')

  // ── Inspiration Lab refs + session (lifted from InspirationLabSection) ─
  const [inspirationRefs,      setInspirationRefs]      = useState<InsLabRef[]>([])
  const [inspirationSessionId, setInspirationSessionId] = useState<string | null>(null)

  // ── Single image state ──────────────────────────────────────
  const [imageMode,    setImageMode]    = useState<'upload' | 'drive'>('upload')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64,  setImageBase64]  = useState<string | null>(null)
  const [imageMime,    setImageMime]    = useState('image/jpeg')
  const [driveUrl,     setDriveUrl]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Carousel state ──────────────────────────────────────────
  const [carouselSlots, setCarouselSlots] = useState<CarouselSlot[]>(() => [
    makeSlot(nextSlotId()),
    makeSlot(nextSlotId()),
  ])
  const [carouselImageMode, setCarouselImageMode] = useState<'upload' | 'drive'>('upload')
  const [carouselDriveText, setCarouselDriveText] = useState('')

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Page state ──────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('brief')
  const [doc,       setDoc]       = useState<CopyDocument | null>(null)
  const [steps,     setSteps]     = useState<LoadStep[]>([])
  const [elapsed,   setElapsed]   = useState(0)
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)

  // ── Single image handlers ───────────────────────────────────

  async function handleSingleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    try {
      const { base64, mimeType } = await resizeToBase64(file)
      setImagePreview(`data:${mimeType};base64,${base64}`)
      setImageBase64(base64); setImageMime(mimeType)
    } catch { toast.error('Could not read image file') }
  }

  function clearSingleImage() {
    setImagePreview(null); setImageBase64(null); setDriveUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDriveInput(raw: string) {
    setDriveUrl(raw)
    if (!raw.trim()) { setImagePreview(null); return }
    const { url } = convertGoogleDriveUrl(raw.trim())
    if (url) setImagePreview(url.startsWith('/') ? `${window.location.origin}${url}` : url)
  }

  // ── Carousel handlers ────────────────────────────────────────

  function handleCarouselFileSelect(slotId: string, file: File | null) {
    if (!file) {
      setCarouselSlots(prev => prev.map(s => s.id === slotId ? { ...s, base64: null, preview: null } : s))
      return
    }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    resizeToBase64(file).then(({ base64, mimeType }) => {
      setCarouselSlots(prev => prev.map(s =>
        s.id === slotId ? { ...s, base64, mimeType, preview: `data:${mimeType};base64,${base64}` } : s
      ))
    }).catch(() => toast.error('Could not read image file'))
  }

  function handleCarouselDriveInput(slotId: string, value: string) {
    const { url } = value.trim() ? convertGoogleDriveUrl(value.trim()) : { url: null }
    const preview = url ? (url.startsWith('/') ? `${window.location.origin}${url}` : url) : null
    setCarouselSlots(prev => prev.map(s => s.id === slotId ? { ...s, driveUrl: value, preview } : s))
  }

  function handleCarouselNoteChange(slotId: string, value: string) {
    setCarouselSlots(prev => prev.map(s => s.id === slotId ? { ...s, note: value } : s))
  }

  function addCarouselSlot() {
    if (carouselSlots.length >= 5) return
    setCarouselSlots(prev => [...prev, makeSlot(nextSlotId())])
  }

  function removeCarouselSlot(slotId: string) {
    setCarouselSlots(prev => prev.filter(s => s.id !== slotId))
  }

  function handleDndEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setCarouselSlots(prev => {
        const oi = prev.findIndex(s => s.id === active.id)
        const ni = prev.findIndex(s => s.id === over.id)
        return arrayMove(prev, oi, ni)
      })
    }
  }

  // ── Build images payload ─────────────────────────────────────

  function buildImagesPayload(): CopyImage[] {
    if (contentType === 'single') {
      if (imageBase64) return [{ type: 'upload', data: imageBase64, mime_type: imageMime, slide_index: 0 }]
      if (driveUrl.trim()) return [{ type: 'drive', data: driveUrl.trim(), mime_type: 'image/jpeg', slide_index: 0 }]
      return []
    }
    if (carouselImageMode === 'drive' && carouselDriveText.trim()) {
      return carouselDriveText.split(/[;\n]/).map(u => u.trim()).filter(Boolean).slice(0, 5)
        .map((u, i) => ({ type: 'drive', data: u, mime_type: 'image/jpeg', slide_index: i }))
    }
    return carouselSlots.filter(s => s.base64)
      .map((s, i) => ({ type: 'upload', data: s.base64!, mime_type: s.mimeType, slide_index: i }))
  }

  // ── Loading step ticker ──────────────────────────────────────

  const advanceSteps = useCallback((initialSteps: LoadStep[]) => {
    let current = 0
    setSteps(initialSteps.map((s, i) => i === 0 ? { ...s, status: 'active' } : s))
    const tick = setInterval(() => {
      current++
      if (current >= initialSteps.length) { clearInterval(tick); return }
      setSteps(s => s.map((st, i) => {
        if (i < current)  return { ...st, status: 'complete' }
        if (i === current) return { ...st, status: 'active' }
        return st
      }))
    }, 800)
    return tick
  }, [])

  // ── Test presets ─────────────────────────────────────────────

  function applyPreset(key: keyof typeof COPY_PRESETS) {
    const p = COPY_PRESETS[key]
    setClientId(p.clientId)
    setLanguage(p.language)
    setDialect(p.dialect)
    setPlatform(p.platform)
    setFramework(p.framework)
    setBrief(p.brief)
    setVariantCount(p.variants)
    setContentType('single')
    setPageState('brief')
    toast.success(`${key === 'lumara' ? 'Lumara' : 'Nike'} preset loaded`)
  }

  // ── Generate ─────────────────────────────────────────────────

  async function handleGenerate() {
    const images = buildImagesPayload()
    const isCarousel = contentType === 'carousel'
    const slideCount = isCarousel
      ? (carouselImageMode === 'drive'
          ? carouselDriveText.split(/[;\n]/).map(u => u.trim()).filter(Boolean).length
          : carouselSlots.filter(s => s.base64 || s.driveUrl).length)
      : 0

    const initialSteps: LoadStep[] = isCarousel
      ? [
          { label: `Analyzing ${slideCount || carouselSlots.length} slides`, status: 'pending' },
          { label: 'Loading client voice',          status: 'pending' },
          { label: 'Applying framework',            status: 'pending' },
          { label: 'Writing per-slide captions',    status: 'pending' },
          { label: 'Writing overall post caption',  status: 'pending' },
        ]
      : [
          { label: images.length ? 'Analyzing image' : 'Reading brief', status: 'pending' },
          { label: 'Loading client voice',  status: 'pending' },
          { label: 'Applying framework',    status: 'pending' },
          { label: 'Writing captions',      status: 'pending' },
        ]

    setPageState('loading')
    setElapsed(0)
    setSteps(initialSteps)
    elapsedRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
    const stepTick = advanceSteps(initialSteps)

    try {
      const res = await fetch('/api/studio/copy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:         clientId || undefined,
          language,
          dialect,
          platform:          platform.toLowerCase().replace(/\s+/g, '_').replace('(twitter)', '').replace('x_', 'x'),
          framework,
          caption_length:    captionLength,
          tone_intensity:    toneIntensity,
          emoji_style:       emojiStyle,
          custom_emojis:     customEmojis,
          hashtag_style:     hashtagStyle,
          hashtag_placement: hashtagPlacement,
          preferred_hashtags: preferredHashtags.split(',').map(h => h.trim()).filter(Boolean),
          banned_hashtags:    bannedHashtags.split(',').map(h => h.trim()).filter(Boolean),
          cta_mode:          ctaMode,
          custom_cta:        customCta,
          variant_count:     variantCount,
          brief:             brief.trim(),
          offer_promo:       offerPromo.trim(),
          post_goal:         postGoal,
          disclosure,
          tone_archetype:    archetype,
          images:            images.length > 0 ? images : undefined,
          inspiration_references: inspirationRefs.length > 0
            ? inspirationRefs.map(r => ({
                pin_id:          r.pinId,
                title:           r.title,
                description:     r.description,
                elementBorrowed: r.elementBorrowed,
                elementLabel:    r.elementLabel,
              }))
            : undefined,
          inspiration_session_id: inspirationSessionId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      clearInterval(stepTick)
      setSteps(s => s.map(st => ({ ...st, status: 'complete' })))
      await new Promise(r => setTimeout(r, 400))

      setDoc(data as CopyDocument)
      setPageState('document')
    } catch (err) {
      clearInterval(stepTick)
      toast.error(err instanceof Error ? err.message : 'Generation failed')
      setPageState('brief')
    } finally {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }

  // ── Save as approved example ─────────────────────────────────

  async function saveExample(variant: CopyDocument['variants'][number]) {
    if (!clientId || !doc) { toast.error('Select a client to save examples'); return }
    const res = await fetch(`/api/clients/${clientId}/copy-examples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform:       platform.toLowerCase(),
        language:       doc.language,
        content_type:   doc.content_type ?? 'single',
        caption:        variant.caption,
        slide_captions: doc.slide_captions?.map(sc => sc.caption),
        framework_used: variant.framework_used,
        hashtags:       doc.hashtags,
        dialect,
      }),
    })
    if (res.ok) toast.success('Saved as approved example')
    else toast.error('Could not save example')
  }

  // ── Render: loading ──────────────────────────────────────────

  if (pageState === 'loading' && contentType !== 'bulk') {
    return (
      <div className="max-w-2xl">
        <CopyLoading steps={steps} elapsed={elapsed} />
      </div>
    )
  }

  // ── Render: document ─────────────────────────────────────────

  if (pageState === 'document' && doc && contentType !== 'bulk') {
    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setPageState('brief')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-800">Copy Engine</span>
            {doc.content_type === 'carousel' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-novax-light text-novax-muted text-[10px] font-semibold rounded-full border border-novax-border">
                <Layers className="w-3 h-3" />
                Carousel
              </span>
            )}
          </div>
          <button onClick={() => { setDoc(null); setPageState('brief') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-novax-light text-novax rounded-lg hover:bg-novax-light-hover transition-colors border border-novax-border"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {doc.framework_rationale && (
          <div className="px-4 py-2.5 bg-novax-light border border-novax-border rounded-xl">
            <p className="text-xs text-novax-muted leading-snug">
              <span className="font-semibold">{doc.framework_used}</span> — {doc.framework_rationale}
            </p>
          </div>
        )}

        {doc.slide_captions && doc.slide_captions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Per-Slide Captions</p>
            {doc.slide_captions.map(sc => (
              <SlideCaptionCard key={sc.slide_index} sc={sc} language={doc.language} />
            ))}
          </div>
        )}

        {doc.slide_captions && doc.slide_captions.length > 0 && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Overall Post Caption{variantCount > 1 ? ` — ${variantCount} Variants` : ''}
          </p>
        )}

        <div className="space-y-4">
          {doc.variants.map(v => (
            <VariantCard
              key={v.variant_index}
              variant={v}
              hashtags={doc.hashtags}
              altText={doc.alt_text}
              showHashtags={hashtagStyle !== 'none'}
              language={doc.language}
              onSaveExample={() => saveExample(v)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Generated with {doc.provider === 'claude' ? 'Claude' : 'Gemini'}
          </p>
          {doc.copy_session_id && inspirationRefs.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-novax-light text-novax-muted border border-novax-border">
              <Search className="w-3 h-3" />
              {inspirationRefs.length} Pinterest ref{inspirationRefs.length > 1 ? 's' : ''} applied
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Render: brief form ────────────────────────────────────────

  const selectedClient = clients?.find(c => c.id === clientId)
  const canGenerate = !!(brief.trim() || imageBase64 || driveUrl ||
    (contentType === 'carousel' && carouselImageMode === 'drive' && carouselDriveText.trim()) ||
    (contentType === 'carousel' && carouselImageMode === 'upload' && carouselSlots.some(s => s.base64)))

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/studio" className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Copy Engine</h1>
          <p className="text-xs text-slate-500">Image-to-caption with client voice, framework, and dialect intelligence</p>
        </div>
      </div>

      {/* ── Content type tabs ── */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
        {([
          { value: 'single',      label: 'Single post',     icon: ImageIcon },
          { value: 'carousel',    label: 'Carousel',        icon: Layers },
          { value: 'bulk',        label: 'Bulk',            icon: FileSpreadsheet },
          ...(user?.role === 'admin' ? [{ value: 'inspiration', label: 'Inspiration Lab', icon: Search }] : []),
        ] as { value: ContentType; label: string; icon: React.ElementType }[]).map(tab => (
          <button
            key={tab.value}
            onClick={() => { setContentType(tab.value); setPageState('brief') }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              contentType === tab.value
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Bulk mode ── */}
      {contentType === 'bulk' && (
        <BulkSection clients={clients ?? []} />
      )}

      {/* ── Inspiration Lab ── */}
      {contentType === 'inspiration' && (
        <InspirationLabSection
          clientId={clientId}
          defaultPlatform={platform}
          language={language}
          contentType={contentType}
          onRefsChange={setInspirationRefs}
          onSessionReady={setInspirationSessionId}
        />
      )}

      {/* ── Single / Carousel form ── */}
      {contentType !== 'bulk' && contentType !== 'inspiration' && (
        <>
          {/* Test presets — admin only */}
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">Test:</span>
              <button
                type="button"
                onClick={() => applyPreset('lumara')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Lumara — AR
              </button>
              <button
                type="button"
                onClick={() => applyPreset('nike')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Nike — EN
              </button>
            </div>
          )}

          {/* Row 1: Client + Language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-novax-border-active"
              >
                <option value="">No client</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Language</label>
              <div className="flex gap-2">
                {(['en', 'ar', 'both'] as CopyLanguage[]).map(lang => (
                  <button key={lang} onClick={() => setLanguage(lang)}
                    className={cn('flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all',
                      language === lang ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                  >
                    {lang === 'en' ? 'EN' : lang === 'ar' ? 'AR' : 'Both'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dialect */}
          {(language === 'ar' || language === 'both') && (
            <div className="grid grid-cols-4 gap-2">
              {DIALECTS.map(d => (
                <button key={d.value} onClick={() => setDialect(d.value)}
                  className={cn('py-2 rounded-xl text-xs font-semibold border transition-all',
                    dialect === d.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Platform + Framework */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Platform</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-novax-border-active"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Framework</label>
              <select value={framework} onChange={e => setFramework(e.target.value as CopyFramework)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-novax-border-active"
              >
                {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Single image section */}
          {contentType === 'single' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Image (optional)</label>
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                  {(['upload', 'drive'] as const).map(mode => (
                    <button key={mode} onClick={() => { setImageMode(mode); clearSingleImage() }}
                      className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                        imageMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                    >
                      {mode === 'upload' ? <Upload className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {mode === 'upload' ? 'Upload' : 'Drive link'}
                    </button>
                  ))}
                </div>
              </div>

              {imageMode === 'upload' ? (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSingleFileSelect} />
                  {imagePreview ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Selected" className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                      <button onClick={clearSingleImage}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-novax-border hover:text-novax-muted transition-all"
                    >
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-xs font-medium">Click to select image</span>
                      <span className="text-xs">JPEG, PNG, WebP — resized to 1024px</span>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <input type="text" value={driveUrl} onChange={e => handleDriveInput(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
                  />
                  {imagePreview && driveUrl && (
                    <div className="relative mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Drive preview" onError={() => setImagePreview(null)}
                        className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50"
                      />
                      <button onClick={clearSingleImage}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Carousel section */}
          {contentType === 'carousel' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Slides ({carouselSlots.length}/5)
                </label>
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                  {(['upload', 'drive'] as const).map(mode => (
                    <button key={mode} onClick={() => setCarouselImageMode(mode)}
                      className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                        carouselImageMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                    >
                      {mode === 'upload' ? <Upload className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {mode === 'upload' ? 'Upload' : 'Drive links'}
                    </button>
                  ))}
                </div>
              </div>

              {carouselImageMode === 'drive' ? (
                <div className="space-y-2">
                  <textarea value={carouselDriveText} onChange={e => setCarouselDriveText(e.target.value)} rows={4}
                    placeholder={`One Drive URL per line or semicolon-separated:\nhttps://drive.google.com/file/d/SLIDE1/view\nhttps://drive.google.com/file/d/SLIDE2/view`}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:border-novax-border-active"
                  />
                  {carouselDriveText.trim() && (
                    <p className="text-xs text-slate-400">
                      {carouselDriveText.split(/[;\n]/).map(u => u.trim()).filter(Boolean).length} slides detected
                    </p>
                  )}
                </div>
              ) : (
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDndEnd}>
                  <SortableContext items={carouselSlots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {carouselSlots.map((slot, i) => (
                        <SortableSlot
                          key={slot.id}
                          slot={slot}
                          index={i}
                          imageMode={carouselImageMode}
                          onFileSelect={handleCarouselFileSelect}
                          onDriveInput={handleCarouselDriveInput}
                          onNoteChange={handleCarouselNoteChange}
                          onRemove={removeCarouselSlot}
                          canRemove={carouselSlots.length > 1}
                          fileInputRef={fileInputRef}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {carouselImageMode === 'upload' && carouselSlots.length < 5 && (
                <button onClick={addCarouselSlot}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-200 rounded-xl text-xs font-medium text-slate-500 hover:border-novax-border hover:text-novax transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add slide {carouselSlots.length + 1}
                </button>
              )}
            </div>
          )}

          {/* Brief */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Brief (optional)</label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={2}
              placeholder="What is this post about? What should it achieve?"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:border-novax-border-active"
            />
          </div>

          {/* Caption preferences (collapsible) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button onClick={() => setPrefsOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700">Caption preferences</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {captionLength} · tone {toneIntensity} · {emojiStyle} emoji · {hashtagStyle} hashtags
                </span>
                {prefsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {prefsOpen && (
              <div className="px-4 pb-5 pt-1 border-t border-slate-100 space-y-5 bg-white">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Length</p>
                  <div className="flex flex-wrap gap-2">
                    {LENGTH_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setCaptionLength(o.value)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          captionLength === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {o.label} <span className="opacity-60">{o.range}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tone intensity</p>
                    <span className="text-xs text-slate-400">
                      {['', 'Formal', 'Formal-warm', 'Balanced', 'Casual', 'Gen-Z'][toneIntensity]}
                    </span>
                  </div>
                  <input type="range" min={1} max={5} step={1} value={toneIntensity}
                    onChange={e => setToneIntensity(Number(e.target.value))}
                    className="w-full accent-[#1B3D38]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Formal</span><span>Gen-Z</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand archetype</p>
                  <select value={archetype} onChange={e => setArchetype(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-novax-border-active"
                  >
                    {ARCHETYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emojis</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setEmojiStyle(o.value)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          emojiStyle === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {emojiStyle !== 'none' && (
                    <input type="text" value={customEmojis} onChange={e => setCustomEmojis(e.target.value)}
                      placeholder="Preferred emojis (optional, e.g. ✨ 🌿 💎)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hashtags</p>
                  <div className="flex flex-wrap gap-2">
                    {HASHTAG_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setHashtagStyle(o.value)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          hashtagStyle === o.value ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {o.label}{o.range && <span className="opacity-60 ml-1">{o.range}</span>}
                      </button>
                    ))}
                  </div>
                  {hashtagStyle !== 'none' && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        {(['caption', 'first_comment'] as const).map(p => (
                          <button key={p} onClick={() => setHashtagPlacement(p)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              hashtagPlacement === p ? 'bg-novax-light text-novax border-novax-border' : 'bg-white text-slate-500 border-slate-200 hover:border-novax-border')}
                          >
                            {p === 'caption' ? 'In caption' : 'First comment'}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={preferredHashtags} onChange={e => setPreferredHashtags(e.target.value)}
                        placeholder="Preferred hashtags (comma-separated, e.g. #novax, #riyadh)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
                      />
                      <input type="text" value={bannedHashtags} onChange={e => setBannedHashtags(e.target.value)}
                        placeholder="Banned hashtags (comma-separated)"
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 bg-red-50/30 focus:outline-none focus:border-novax-border-active"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Call to action</p>
                  <div className="flex gap-2">
                    {([['auto', 'Auto'], ['custom', 'Custom'], ['none', 'None']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setCtaMode(v)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          ctaMode === v ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {ctaMode === 'custom' && (
                    <input type="text" value={customCta} onChange={e => setCustomCta(e.target.value)}
                      placeholder="e.g. اطلب الحين · Book now · اكتشف المزيد"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Post goal</p>
                    <select value={postGoal} onChange={e => setPostGoal(e.target.value as typeof postGoal)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-novax-border-active"
                    >
                      <option value="awareness">Awareness</option>
                      <option value="engagement">Engagement</option>
                      <option value="conversion">Conversion</option>
                      <option value="retention">Retention</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variants</p>
                    <div className="flex gap-2">
                      {([1, 2, 3] as const).map(n => (
                        <button key={n} onClick={() => setVariantCount(n)}
                          className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                            variantCount === n ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Offer / promotion (optional)</p>
                  <input type="text" value={offerPromo} onChange={e => setOfferPromo(e.target.value)}
                    placeholder="e.g. 20% off until Friday, free delivery on orders over 200 SAR"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-novax-border-active"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid content disclosure</p>
                  <div className="flex gap-2">
                    {([['none', 'None'], ['arabic', '#إعلان'], ['english', '#Ad']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setDisclosure(v)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          disclosure === v ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border')}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inspiration refs banner */}
          {inspirationRefs.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-novax-light border border-novax-border rounded-xl">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-novax-muted shrink-0" />
                <p className="text-xs text-novax-muted font-medium">
                  {inspirationRefs.length} inspiration reference{inspirationRefs.length > 1 ? 's' : ''} will be injected into the prompt
                </p>
              </div>
              <button
                onClick={() => setContentType('inspiration')}
                className="text-[10px] text-novax-muted hover:text-novax underline shrink-0"
              >
                View
              </button>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all',
              !canGenerate
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-novax text-white hover:bg-novax-hover active:scale-[0.99] shadow-sm hover:shadow-md',
            )}
          >
            <Zap className="w-4 h-4" />
            {contentType === 'carousel'
              ? `Generate Carousel Copy${variantCount > 1 ? ` (${variantCount} variants)` : ''}`
              : `Generate ${variantCount > 1 ? `${variantCount} Variants` : 'Caption'}`
            }
            {selectedClient && (
              <span className="text-white/60 text-xs font-normal">for {selectedClient.name}</span>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            {contentType === 'carousel'
              ? 'Add slide images and/or a brief to generate per-slide and overall captions'
              : 'Provide an image, a brief, or both to generate'
            }
          </p>
        </>
      )}
    </div>
  )
}
