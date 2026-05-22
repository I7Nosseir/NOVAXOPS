'use client'

import { useState } from 'react'
import { Plus, X, Loader2, Save, Palette, Type, Monitor, Image, Film, FileOutput, StickyNote, Link } from 'lucide-react'
import type { DesignBrief } from '@/lib/types'
import { cn } from '@/lib/utils'

const DEFAULT_BRIEF: DesignBrief = {
  canvas_sizes: [
    { name: 'Instagram Square', width: 1080, height: 1080, format: 'PNG' },
    { name: 'Instagram Story', width: 1080, height: 1920, format: 'PNG/MP4' },
    { name: 'Instagram Reel', width: 1080, height: 1920, format: 'MP4' },
  ],
  primary_font: '',
  secondary_font: '',
  brand_colors_extra: [],
  visual_style_notes: '',
  mood_references: [],
  motion_style: '',
  ai_video_notes: '',
  file_formats: ['PNG', 'MP4', 'PDF'],
  general_notes: '',
}

const ALL_FILE_FORMATS = ['PNG', 'JPG', 'MP4', 'PDF', 'SVG', 'AI', 'PSD', 'GIF']

interface Props {
  brief: DesignBrief | null
  clientColor: string
  onSave: (brief: DesignBrief) => void
  saving?: boolean
}

export function DesignBriefForm({ brief, clientColor, onSave, saving }: Props) {
  const [form, setForm] = useState<DesignBrief>(brief ?? DEFAULT_BRIEF)
  const [newMoodRef, setNewMoodRef] = useState('')

  // ── Canvas sizes ──────────────────────────────────────────────────────────

  const updateCanvasRow = (index: number, field: keyof DesignBrief['canvas_sizes'][number], value: string | number) => {
    setForm(prev => {
      const sizes = [...prev.canvas_sizes]
      sizes[index] = { ...sizes[index], [field]: value }
      return { ...prev, canvas_sizes: sizes }
    })
  }

  const addCanvasRow = () => {
    setForm(prev => ({
      ...prev,
      canvas_sizes: [...prev.canvas_sizes, { name: '', width: 1080, height: 1080, format: 'PNG' }],
    }))
  }

  const removeCanvasRow = (index: number) => {
    setForm(prev => ({ ...prev, canvas_sizes: prev.canvas_sizes.filter((_, i) => i !== index) }))
  }

  // ── Brand colors ──────────────────────────────────────────────────────────

  const addColor = () => {
    setForm(prev => ({ ...prev, brand_colors_extra: [...prev.brand_colors_extra, '#000000'] }))
  }

  const updateColor = (index: number, value: string) => {
    setForm(prev => {
      const colors = [...prev.brand_colors_extra]
      colors[index] = value
      return { ...prev, brand_colors_extra: colors }
    })
  }

  const removeColor = (index: number) => {
    setForm(prev => ({ ...prev, brand_colors_extra: prev.brand_colors_extra.filter((_, i) => i !== index) }))
  }

  // ── Mood references ───────────────────────────────────────────────────────

  const addMoodRef = () => {
    const val = newMoodRef.trim()
    if (!val) return
    setForm(prev => ({ ...prev, mood_references: [...prev.mood_references, val] }))
    setNewMoodRef('')
  }

  const removeMoodRef = (index: number) => {
    setForm(prev => ({ ...prev, mood_references: prev.mood_references.filter((_, i) => i !== index) }))
  }

  // ── File formats ──────────────────────────────────────────────────────────

  const toggleFormat = (fmt: string) => {
    setForm(prev => ({
      ...prev,
      file_formats: prev.file_formats.includes(fmt)
        ? prev.file_formats.filter(f => f !== fmt)
        : [...prev.file_formats, fmt],
    }))
  }

  // ── Section heading helper ────────────────────────────────────────────────

  const SectionHeading = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Canvas Sizes ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Monitor} label="Canvas Sizes" />
        <div className="space-y-2">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_72px_72px_80px_32px] gap-2 px-1">
            {['Name', 'W', 'H', 'Format', ''].map(h => (
              <p key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</p>
            ))}
          </div>
          {form.canvas_sizes.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_72px_80px_32px] gap-2 items-center">
              <input
                value={row.name}
                onChange={e => updateCanvasRow(i, 'name', e.target.value)}
                placeholder="e.g. Feed Post"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300"
              />
              <input
                type="number"
                value={row.width}
                onChange={e => updateCanvasRow(i, 'width', Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-novax-muted bg-white text-slate-700 text-center"
              />
              <input
                type="number"
                value={row.height}
                onChange={e => updateCanvasRow(i, 'height', Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-novax-muted bg-white text-slate-700 text-center"
              />
              <input
                value={row.format}
                onChange={e => updateCanvasRow(i, 'format', e.target.value)}
                placeholder="PNG"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-novax-muted bg-white text-slate-700"
              />
              <button
                onClick={() => removeCanvasRow(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addCanvasRow}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-novax transition-colors mt-1"
          >
            <Plus className="w-3 h-3" />
            Add canvas size
          </button>
        </div>
      </div>

      {/* ── Typography ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Type} label="Typography" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Primary Font</p>
            <input
              value={form.primary_font}
              onChange={e => setForm(prev => ({ ...prev, primary_font: e.target.value }))}
              placeholder="e.g. Helvetica Neue"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300"
            />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Secondary Font</p>
            <input
              value={form.secondary_font}
              onChange={e => setForm(prev => ({ ...prev, secondary_font: e.target.value }))}
              placeholder="e.g. Playfair Display"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>

      {/* ── Brand Colors ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Palette} label="Additional Brand Colors" />
        <div className="flex flex-wrap items-center gap-2">
          {form.brand_colors_extra.map((hex, i) => (
            <div key={i} className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="relative w-6 h-6 rounded-md overflow-hidden border border-slate-200 shrink-0">
                <input
                  type="color"
                  value={hex}
                  onChange={e => updateColor(i, e.target.value)}
                  className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-none outline-none"
                />
              </div>
              <span className="text-[11px] font-mono text-slate-600">{hex.toUpperCase()}</span>
              <button
                onClick={() => removeColor(i)}
                className="text-slate-300 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addColor}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-novax transition-colors px-2 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-novax-border"
          >
            <Plus className="w-3 h-3" />
            Add color
          </button>
        </div>
      </div>

      {/* ── Visual Style ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Image} label="Visual Style" />
        <textarea
          value={form.visual_style_notes}
          onChange={e => setForm(prev => ({ ...prev, visual_style_notes: e.target.value }))}
          placeholder="e.g. Minimal, airy, white space heavy. Pastel tones. No dark backgrounds."
          rows={3}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed"
        />
      </div>

      {/* ── Mood References ──────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Link} label="Mood References" />
        <div className="space-y-1.5 mb-2">
          {form.mood_references.map((ref, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-600 flex-1 min-w-0 break-all">{ref}</p>
              <button
                onClick={() => removeMoodRef(i)}
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newMoodRef}
            onChange={e => setNewMoodRef(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMoodRef() } }}
            placeholder="Paste URL or describe a reference…"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300"
          />
          <button
            onClick={addMoodRef}
            disabled={!newMoodRef.trim()}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax disabled:opacity-40 transition-colors text-xs"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* ── Motion & Video ───────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={Film} label="Motion and Video" />
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Motion Style</p>
            <textarea
              value={form.motion_style}
              onChange={e => setForm(prev => ({ ...prev, motion_style: e.target.value }))}
              placeholder="e.g. Smooth transitions, no bounce, max 15s. Subtle fade ins."
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed"
            />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1.5">AI Video Notes</p>
            <textarea
              value={form.ai_video_notes}
              onChange={e => setForm(prev => ({ ...prev, ai_video_notes: e.target.value }))}
              placeholder="e.g. Cinematic, product focus, no people. Golden hour lighting."
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* ── File Formats ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={FileOutput} label="Delivery File Formats" />
        <div className="flex flex-wrap gap-2">
          {ALL_FILE_FORMATS.map(fmt => {
            const active = form.file_formats.includes(fmt)
            return (
              <button
                key={fmt}
                onClick={() => toggleFormat(fmt)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  active
                    ? 'bg-novax-light border-novax-border text-novax'
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                )}
              >
                {fmt}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── General Notes ────────────────────────────────────────────────── */}
      <div>
        <SectionHeading icon={StickyNote} label="General Notes" />
        <textarea
          value={form.general_notes}
          onChange={e => setForm(prev => ({ ...prev, general_notes: e.target.value }))}
          placeholder="Any additional design instructions, dos and don'ts, or special requirements…"
          rows={4}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed"
        />
      </div>

      {/* ── Save Button ──────────────────────────────────────────────────── */}
      <div className="pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          style={{ backgroundColor: clientColor }}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity',
            saving ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Brief
            </>
          )}
        </button>
      </div>
    </div>
  )
}
