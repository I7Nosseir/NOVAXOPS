'use client'

import { useState, useRef, useCallback, useId } from 'react'
import {
  Wand2, Download, Plus, Trash2, Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, RefreshCw, Sparkles, ChevronDown, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string
  text: string
  x: number        // % from left of canvas container
  y: number        // % from top of canvas container
  fontSize: number // px (in display space — scaled on export)
  fontFamily: string
  color: string
  bold: boolean
  italic: boolean
  shadow: boolean
  outline: boolean
  outlineColor: string
  align: 'left' | 'center' | 'right'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'gemini-2.5-flash-image',        label: 'Flash Image',         tag: 'Fast · $0.039',  badge: ''    },
  { id: 'gemini-3.1-flash-image-preview', label: 'Flash Image Preview', tag: 'Preview · $0.045', badge: '🍌' },
  { id: 'gemini-3-pro-image-preview',     label: 'Pro Image Preview',   tag: 'Preview · $0.134', badge: '🍌' },
  { id: 'imagen-4.0-fast-generate-001',   label: 'Imagen 4 Fast',       tag: '$0.02 · AR support', badge: '' },
  { id: 'imagen-4.0-generate-001',        label: 'Imagen 4',            tag: '$0.04 · AR support', badge: '' },
  { id: 'imagen-4.0-ultra-generate-001',  label: 'Imagen 4 Ultra',      tag: '$0.06 · Best quality', badge: '' },
]

// Models that natively support aspect ratio as a parameter (not baked into prompt)
const SUPPORTS_NATIVE_AR = new Set([
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
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
  { id: '1:1',  label: '1:1',  desc: 'Square',   w: 1,  h: 1  },
  { id: '4:5',  label: '4:5',  desc: 'Portrait',  w: 4,  h: 5  },
  { id: '9:16', label: '9:16', desc: 'Story',     w: 9,  h: 16 },
  { id: '16:9', label: '16:9', desc: 'Landscape', w: 16, h: 9  },
  { id: '3:4',  label: '3:4',  desc: 'Portrait',  w: 3,  h: 4  },
]

const FONTS = [
  { id: 'Arial, sans-serif',             label: 'Arial'         },
  { id: 'Georgia, serif',                label: 'Georgia'       },
  { id: 'Impact, Haettenschweiler, sans-serif', label: 'Impact' },
  { id: '"Times New Roman", serif',      label: 'Times New Roman' },
  { id: '"Courier New", monospace',      label: 'Courier New'   },
  { id: 'Verdana, sans-serif',           label: 'Verdana'       },
]

function newLayer(id: string): TextLayer {
  return {
    id,
    text: 'Your Text Here',
    x: 10,
    y: 10,
    fontSize: 36,
    fontFamily: 'Arial, sans-serif',
    color: '#FFFFFF',
    bold: true,
    italic: false,
    shadow: true,
    outline: false,
    outlineColor: '#000000',
    align: 'left',
  }
}

// ── Draggable Text Layer ──────────────────────────────────────────────────────

function DraggableText({
  layer, selected, onSelect, onUpdate, onDelete, containerRef,
}: {
  layer: TextLayer
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<TextLayer>) => void
  onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const dragging = useRef(false)
  const startPos = useRef({ mx: 0, my: 0, lx: 0, ly: 0 })
  const [editing, setEditing] = useState(false)

  const fontStyle = [
    layer.italic ? 'italic' : '',
    layer.bold ? 'bold' : '',
    `${layer.fontSize}px`,
    layer.fontFamily,
  ].filter(Boolean).join(' ')

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    dragging.current = true
    startPos.current = { mx: e.clientX, my: e.clientY, lx: layer.x, ly: layer.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((e.clientX - startPos.current.mx) / rect.width) * 100
    const dy = ((e.clientY - startPos.current.my) / rect.height) * 100
    onUpdate({
      x: Math.max(0, Math.min(95, startPos.current.lx + dx)),
      y: Math.max(0, Math.min(95, startPos.current.ly + dy)),
    })
  }

  const handlePointerUp = () => { dragging.current = false }

  const textShadow = layer.shadow ? '2px 2px 8px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)' : undefined
  const webkitTextStroke = layer.outline ? `2px ${layer.outlineColor}` : undefined

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => setEditing(true)}
      style={{
        position: 'absolute',
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        cursor: editing ? 'text' : 'move',
        userSelect: editing ? 'text' : 'none',
        touchAction: 'none',
      }}
      className={cn('group', selected && !editing && 'ring-2 ring-novax-accent ring-offset-1 rounded-sm')}
    >
      {editing ? (
        <textarea
          autoFocus
          defaultValue={layer.text}
          rows={2}
          onBlur={e => { onUpdate({ text: e.target.value }); setEditing(false) }}
          onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { onUpdate({ text: e.currentTarget.value }); setEditing(false) } }}
          style={{ font: fontStyle, color: layer.color, textShadow, WebkitTextStroke: webkitTextStroke, textAlign: layer.align, background: 'transparent', border: '1px dashed rgba(255,255,255,0.5)', outline: 'none', resize: 'none', minWidth: 120 }}
          className="p-0"
        />
      ) : (
        <span
          style={{ font: fontStyle, color: layer.color, textShadow, WebkitTextStroke: webkitTextStroke, textAlign: layer.align, display: 'block', whiteSpace: 'pre-wrap' }}
        >
          {layer.text}
        </span>
      )}
      {selected && !editing && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute -top-4 -right-4 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Text Controls Panel ───────────────────────────────────────────────────────

function TextControls({ layer, onUpdate }: { layer: TextLayer; onUpdate: (patch: Partial<TextLayer>) => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Text Formatting</p>

      {/* Font family */}
      <div className="relative">
        <select
          value={layer.fontFamily}
          onChange={e => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted appearance-none bg-white"
        >
          {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
      </div>

      {/* Font size */}
      <div className="flex items-center gap-2">
        <Type className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
        <input
          type="range"
          min={12} max={120} step={2}
          value={layer.fontSize}
          onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
          className="flex-1 accent-novax"
        />
        <span className="text-xs font-mono text-slate-600 w-8 text-right">{layer.fontSize}px</span>
      </div>

      {/* Color */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-14 shrink-0">Color</label>
        <input
          type="color"
          value={layer.color}
          onChange={e => onUpdate({ color: e.target.value })}
          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={layer.color}
          onChange={e => onUpdate({ color: e.target.value })}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-700 outline-none focus:border-novax-muted"
        />
      </div>

      {/* Bold / Italic / Align */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onUpdate({ bold: !layer.bold })}
          className={cn('flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold transition-colors',
            layer.bold ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          <Bold className="w-3.5 h-3.5"/>
        </button>
        <button
          onClick={() => onUpdate({ italic: !layer.italic })}
          className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
            layer.italic ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          <Italic className="w-3.5 h-3.5"/>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {(['left', 'center', 'right'] as const).map(a => {
            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
            return (
              <button key={a} onClick={() => onUpdate({ align: a })}
                className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                  layer.align === a ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
              >
                <Icon className="w-3.5 h-3.5"/>
              </button>
            )
          })}
        </div>
      </div>

      {/* Effects */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={layer.shadow} onChange={e => onUpdate({ shadow: e.target.checked })} className="accent-novax rounded"/>
          Shadow
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={layer.outline} onChange={e => onUpdate({ outline: e.target.checked })} className="accent-novax rounded"/>
          Outline
        </label>
        {layer.outline && (
          <input
            type="color"
            value={layer.outlineColor}
            onChange={e => onUpdate({ outlineColor: e.target.value })}
            className="w-6 h-6 rounded border border-slate-200 cursor-pointer p-0.5"
          />
        )}
      </div>

      <p className="text-[10px] text-slate-400">Double-click text on canvas to edit. Drag to reposition.</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIImagePage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [model, setModel] = useState('gemini-2.5-flash-image')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState('image/png')
  const [textLayers, setTextLayers] = useState<TextLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showNeg, setShowNeg] = useState(false)
  const layerCounter = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const selectedModel = MODELS.find(m => m.id === model) ?? MODELS[0]
  const nativeAR = SUPPORTS_NATIVE_AR.has(model)

  const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio) ?? ASPECT_RATIOS[0]

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setTextLayers([])
    setSelectedId(null)
    try {
      const res = await fetch('/api/ai-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, aspectRatio, negativePrompt, model }),
      })
      const data = await res.json() as { imageData?: string; mimeType?: string; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Generation failed'); return }
      setImageData(data.imageData!)
      setImageMime(data.mimeType ?? 'image/png')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setGenerating(false)
    }
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

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        for (const layer of textLayers) {
          const x = (layer.x / 100) * canvas.width
          const y = (layer.y / 100) * canvas.height
          // Scale font size proportionally to actual image
          const scale = canvas.width / rect.width
          const scaledFont = Math.round(layer.fontSize * scale)
          const fontStr = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${scaledFont}px ${layer.fontFamily}`

          ctx.font = fontStr
          ctx.textBaseline = 'top'
          ctx.textAlign = layer.align as CanvasTextAlign

          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.85)'
            ctx.shadowBlur = scaledFont * 0.2
            ctx.shadowOffsetX = scaledFont * 0.05
            ctx.shadowOffsetY = scaledFont * 0.05
          }

          if (layer.outline) {
            ctx.strokeStyle = layer.outlineColor
            ctx.lineWidth = scaledFont * 0.08
            ctx.lineJoin = 'round'
            for (const line of layer.text.split('\n')) {
              ctx.strokeText(line, x, y + layer.text.split('\n').indexOf(line) * scaledFont * 1.2)
            }
          }

          ctx.fillStyle = layer.color
          for (const [i, line] of layer.text.split('\n').entries()) {
            ctx.fillText(line, x, y + i * scaledFont * 1.2)
          }

          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
      }

      const link = document.createElement('a')
      link.download = 'novax-ai-image.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch { /* ignore export errors */ } finally {
      setExporting(false)
    }
  }

  const selectedLayer = textLayers.find(l => l.id === selectedId) ?? null

  // Aspect ratio display dimensions (constrained to container)
  const aspectStyle = {
    aspectRatio: `${ar.w} / ${ar.h}`,
    maxWidth: ar.w > ar.h ? '100%' : `${(ar.w / ar.h) * 100}%`,
    maxHeight: ar.h > ar.w ? 520 : 400,
  }

  return (
    <div className="flex gap-5 h-full min-h-[calc(100vh-8rem)]">

      {/* ── Left Panel ── */}
      <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-novax-accent"/>
            <p className="text-sm font-semibold text-slate-800">AI Image Generation</p>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="A luxury skincare product on a marble surface with soft morning light…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none"
            />
          </div>

          {/* Negative prompt toggle */}
          <button
            onClick={() => setShowNeg(p => !p)}
            className="text-xs text-slate-500 hover:text-novax transition-colors flex items-center gap-1"
          >
            <Plus className={cn('w-3 h-3 transition-transform', showNeg && 'rotate-45')}/>
            Negative prompt
          </button>
          {showNeg && (
            <textarea
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
              rows={2}
              placeholder="blurry, low quality, text, watermark…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-500 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none"
            />
          )}

          {/* Style */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    'px-2 py-2 rounded-lg text-xs font-medium transition-all border',
                    style === s.id
                      ? 'bg-novax text-white border-novax'
                      : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Model</label>
            <div className="space-y-1">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                    model === m.id
                      ? 'bg-novax text-white border-novax'
                      : 'border-slate-200 text-slate-600 hover:border-novax-border hover:text-novax',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {m.badge && <span>{m.badge}</span>}
                    {m.label}
                  </span>
                  <span className={cn('text-[10px] font-normal', model === m.id ? 'text-white/70' : 'text-slate-400')}>
                    {m.tag}
                  </span>
                </button>
              ))}
            </div>
            {!nativeAR && (
              <p className="text-[10px] text-slate-400 mt-1.5">Aspect ratio is baked into the prompt for Gemini models</p>
            )}
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Aspect Ratio</label>
            <div className="flex items-end gap-1.5">
              {ASPECT_RATIOS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setAspectRatio(a.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all',
                    aspectRatio === a.id
                      ? 'bg-novax text-white border-novax'
                      : 'border-slate-200 text-slate-500 hover:border-novax-border',
                  )}
                >
                  {/* Tiny visual ratio indicator */}
                  <div
                    className={cn('rounded-sm border-2', aspectRatio === a.id ? 'border-white/70' : 'border-slate-300')}
                    style={{ width: Math.round(20 * (a.w / Math.max(a.w, a.h))), height: Math.round(20 * (a.h / Math.max(a.w, a.h))) }}
                  />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin"/> Generating…</>
              : <><Sparkles className="w-4 h-4"/> Generate Image</>}
          </button>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>
          )}
        </div>

        {/* Text layer controls */}
        {selectedLayer && (
          <TextControls layer={selectedLayer} onUpdate={patch => updateLayer(selectedLayer.id, patch)}/>
        )}
      </div>

      {/* ── Canvas Area ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Canvas */}
        <div
          className="flex items-center justify-center flex-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden"
          onClick={() => setSelectedId(null)}
        >
          {!imageData && !generating && (
            <div className="flex flex-col items-center gap-3 text-slate-400 select-none">
              <Wand2 className="w-12 h-12 text-slate-300"/>
              <p className="text-sm font-medium text-slate-500">Enter a prompt and generate an image</p>
              <p className="text-xs text-slate-400">{selectedModel.label} · {selectedModel.tag}</p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <div className="w-16 h-16 rounded-2xl border-4 border-novax-border border-t-novax-accent animate-spin"/>
              <p className="text-sm font-medium">Generating with {selectedModel.label}…</p>
              <p className="text-xs text-slate-400">This takes about 10–20 seconds</p>
            </div>
          )}

          {imageData && !generating && (
            <div
              className="relative mx-auto"
              style={aspectStyle}
              ref={containerRef}
              onClick={e => { if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG') setSelectedId(null) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${imageMime};base64,${imageData}`}
                alt="AI generated"
                className="w-full h-full object-cover rounded-lg select-none"
                draggable={false}
              />
              {/* Text layers */}
              {textLayers.map(layer => (
                <DraggableText
                  key={layer.id}
                  layer={layer}
                  selected={selectedId === layer.id}
                  onSelect={() => setSelectedId(layer.id)}
                  onUpdate={patch => updateLayer(layer.id, patch)}
                  onDelete={() => deleteLayer(layer.id)}
                  containerRef={containerRef}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        {imageData && !generating && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={addTextLayer}
              className="flex items-center gap-1.5 px-4 py-2 border border-novax-border text-novax hover:bg-novax-light rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5"/>
              Add Text
            </button>
            {selectedId && (
              <button
                onClick={() => deleteLayer(selectedId)}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5"/>
                Remove Layer
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5"/>
                Regenerate
              </button>
              <button
                onClick={handleDownload}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {exporting
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Exporting…</>
                  : <><Download className="w-3.5 h-3.5"/> Download PNG</>}
              </button>
            </div>
          </div>
        )}

        {/* Layer list */}
        {textLayers.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Text Layers</p>
            <div className="flex flex-wrap gap-2">
              {textLayers.map((layer, i) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedId(layer.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                    selectedId === layer.id
                      ? 'bg-novax text-white border-novax'
                      : 'border-slate-200 text-slate-600 hover:border-novax-border',
                  )}
                >
                  <Type className="w-3 h-3"/>
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
