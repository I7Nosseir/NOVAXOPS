'use client'

import { useState, useRef, useCallback, useId, useLayoutEffect } from 'react'
import {
  Wand2, Download, Plus, Trash2, Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, RefreshCw, Sparkles, ChevronDown, GripHorizontal,
  ImagePlus, X, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  bold: boolean
  italic: boolean
  shadow: boolean
  outline: boolean
  outlineColor: string
  align: 'left' | 'center' | 'right'
}

interface TOVItem {
  id: string
  text: string
  role: 'headline' | 'tagline' | 'body' | 'callout'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'gemini-2.5-flash-image',         label: 'Flash Image',         tag: 'Fast · $0.039',        badge: ''   },
  { id: 'gemini-3.1-flash-image-preview',  label: 'Flash Image Preview', tag: 'Preview · $0.045',     badge: '🍌' },
  { id: 'gemini-3-pro-image-preview',      label: 'Pro Image Preview',   tag: 'Preview · $0.134',     badge: '🍌' },
  { id: 'imagen-4.0-fast-generate-001',    label: 'Imagen 4 Fast',       tag: '$0.02 · AR support',   badge: ''   },
  { id: 'imagen-4.0-generate-001',         label: 'Imagen 4',            tag: '$0.04 · AR support',   badge: ''   },
  { id: 'imagen-4.0-ultra-generate-001',   label: 'Imagen 4 Ultra',      tag: '$0.06 · Best quality', badge: ''   },
]

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
  { id: '1:1',  label: '1:1',  desc: 'Square',    w: 1,  h: 1  },
  { id: '4:5',  label: '4:5',  desc: 'Portrait',  w: 4,  h: 5  },
  { id: '9:16', label: '9:16', desc: 'Story',      w: 9,  h: 16 },
  { id: '16:9', label: '16:9', desc: 'Landscape',  w: 16, h: 9  },
  { id: '3:4',  label: '3:4',  desc: 'Portrait',  w: 3,  h: 4  },
]

const FONTS = [
  { id: 'Arial, sans-serif',                    label: 'Arial'           },
  { id: 'Georgia, serif',                        label: 'Georgia'         },
  { id: 'Impact, Haettenschweiler, sans-serif',  label: 'Impact'          },
  { id: '"Times New Roman", serif',             label: 'Times New Roman' },
  { id: '"Courier New", monospace',             label: 'Courier New'     },
  { id: 'Verdana, sans-serif',                  label: 'Verdana'         },
]

const TOV_ROLES: { id: 'headline' | 'tagline' | 'body' | 'callout'; label: string }[] = [
  { id: 'headline', label: 'Headline' },
  { id: 'tagline',  label: 'Tagline'  },
  { id: 'body',     label: 'Body'     },
  { id: 'callout',  label: 'Callout'  },
]

function newLayer(id: string): TextLayer {
  return {
    id,
    text: 'Your Text Here',
    x: 10, y: 10,
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

// ── DraggableText ─────────────────────────────────────────────────────────────
// Text is always contentEditable (click to focus and type).
// Dragging happens only via the teal drag-handle bar that appears when selected.

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
  const textRef = useRef<HTMLSpanElement>(null)
  const focused = useRef(false)
  const dragging = useRef(false)
  const startPos = useRef({ mx: 0, my: 0, lx: 0, ly: 0 })

  // Sync external text changes to DOM only when the span is not being edited
  useLayoutEffect(() => {
    if (textRef.current && !focused.current) {
      if (textRef.current.innerText !== layer.text) {
        textRef.current.innerText = layer.text
      }
    }
  }, [layer.text])

  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    dragging.current = true
    startPos.current = { mx: e.clientX, my: e.clientY, lx: layer.x, ly: layer.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((e.clientX - startPos.current.mx) / rect.width) * 100
    const dy = ((e.clientY - startPos.current.my) / rect.height) * 100
    onUpdate({
      x: Math.max(0, Math.min(95, startPos.current.lx + dx)),
      y: Math.max(0, Math.min(95, startPos.current.ly + dy)),
    })
  }

  const handleDragPointerUp = () => { dragging.current = false }

  const fontStr = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.fontSize}px ${layer.fontFamily}`
  const textShadow = layer.shadow ? '2px 2px 8px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)' : undefined
  const webkitTextStroke = layer.outline ? `2px ${layer.outlineColor}` : undefined

  return (
    <div
      style={{ position: 'absolute', left: `${layer.x}%`, top: `${layer.y}%` }}
      onClick={e => { e.stopPropagation(); onSelect() }}
    >
      {/* Drag handle — visible when selected, used for repositioning */}
      {selected && (
        <div
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          style={{ touchAction: 'none' }}
          className="absolute -top-6 left-0 right-0 min-w-[80px] h-6 flex items-center justify-between px-1.5 bg-novax/90 rounded-t-md cursor-move select-none z-10"
        >
          <GripHorizontal className="w-3 h-3 text-white/70 shrink-0" />
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center justify-center w-4 h-4 text-white/70 hover:text-white text-sm leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Editable text — click to focus and type inline */}
      <span
        ref={textRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { focused.current = true; onSelect() }}
        onBlur={e => {
          focused.current = false
          const val = e.currentTarget.innerText
          if (val !== layer.text) onUpdate({ text: val })
        }}
        onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
        style={{
          font: fontStr,
          color: layer.color,
          textShadow,
          WebkitTextStroke: webkitTextStroke,
          textAlign: layer.align,
          display: 'block',
          whiteSpace: 'pre-wrap',
          minWidth: '3em',
          cursor: 'text',
          outline: selected ? '2px solid rgba(91,180,174,0.8)' : '2px solid transparent',
          outlineOffset: '3px',
          borderRadius: '2px',
        }}
      />
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
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>

      {/* Font size */}
      <div className="flex items-center gap-2">
        <Type className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="range" min={12} max={120} step={2}
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
          type="color" value={layer.color}
          onChange={e => onUpdate({ color: e.target.value })}
          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
        />
        <input
          type="text" value={layer.color}
          onChange={e => onUpdate({ color: e.target.value })}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-700 outline-none focus:border-novax-muted"
        />
      </div>

      {/* Bold / Italic / Align */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onUpdate({ bold: !layer.bold })}
          className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
            layer.bold ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ italic: !layer.italic })}
          className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
            layer.italic ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          {(['left', 'center', 'right'] as const).map(a => {
            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
            return (
              <button key={a} onClick={() => onUpdate({ align: a })}
                className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                  layer.align === a ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Effects */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={layer.shadow} onChange={e => onUpdate({ shadow: e.target.checked })} className="accent-novax rounded" />
          Shadow
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={layer.outline} onChange={e => onUpdate({ outline: e.target.checked })} className="accent-novax rounded" />
          Outline
        </label>
        {layer.outline && (
          <input
            type="color" value={layer.outlineColor}
            onChange={e => onUpdate({ outlineColor: e.target.value })}
            className="w-6 h-6 rounded border border-slate-200 cursor-pointer p-0.5"
          />
        )}
      </div>

      <p className="text-[10px] text-slate-400">Click text on canvas to edit. Use the teal handle to drag.</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIImagePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'tov'>('generate')
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
  // Reference image
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refMime, setRefMime] = useState('image/png')
  // Text on Visuals
  const [tovItems, setTovItems] = useState<TOVItem[]>([{ id: 'tov-1', text: '', role: 'headline' }])
  const [brandColors, setBrandColors] = useState<string[]>(['#FFFFFF', '#1B3D38'])
  const [applyingDesign, setApplyingDesign] = useState(false)
  const [tovError, setTovError] = useState<string | null>(null)

  const layerCounter = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  const selectedModel = MODELS.find(m => m.id === model) ?? MODELS[0]
  const nativeAR = SUPPORTS_NATIVE_AR.has(model)
  const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio) ?? ASPECT_RATIOS[0]

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      const [meta, data] = dataUrl.split(',')
      const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'image/png'
      setRefImage(data)
      setRefMime(mime)
    }
    reader.readAsDataURL(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

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
        body: JSON.stringify({
          prompt, style, aspectRatio, negativePrompt, model,
          ...(refImage ? { referenceImageData: refImage, referenceMime: refMime } : {}),
        }),
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

  const handleApplyDesign = async () => {
    if (!imageData) return
    const items = tovItems.filter(i => i.text.trim())
    if (!items.length) return
    setApplyingDesign(true)
    setTovError(null)
    try {
      const res = await fetch('/api/ai-image/text-placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          mimeType: imageMime,
          textItems: items.map(i => ({ text: i.text, role: i.role })),
          brandColors,
        }),
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
          bold: l.bold ?? false,
          italic: l.italic ?? false,
          shadow: l.shadow ?? true,
          outline: l.outline ?? false,
          outlineColor: l.outlineColor ?? '#000000',
          align: (['left', 'center', 'right'].includes(l.align ?? '') ? l.align : 'left') as 'left' | 'center' | 'right',
        }
      })
      setTextLayers(newLayers)
      if (newLayers.length > 0) setSelectedId(newLayers[0].id)
    } catch (e) {
      setTovError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setApplyingDesign(false)
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

      // Apply the same object-cover crop as the display container so the download
      // matches exactly what the user sees (same AR, same text positions).
      const imgAR = img.naturalWidth / img.naturalHeight
      const targetAR = ar.w / ar.h
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight

      if (imgAR > targetAR + 0.005) {
        // Image wider than target — crop sides symmetrically
        sw = Math.round(img.naturalHeight * targetAR)
        sx = Math.round((img.naturalWidth - sw) / 2)
      } else if (imgAR < targetAR - 0.005) {
        // Image taller than target — crop top/bottom symmetrically
        sh = Math.round(img.naturalWidth / targetAR)
        sy = Math.round((img.naturalHeight - sh) / 2)
      }

      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Both canvas and container share the same AR, so scaleX === scaleY
        const scale = sw / rect.width
        for (const layer of textLayers) {
          const x = (layer.x / 100) * sw
          const y = (layer.y / 100) * sh
          const scaledFont = Math.round(layer.fontSize * scale)
          ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${scaledFont}px ${layer.fontFamily}`
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
            for (const [i, line] of layer.text.split('\n').entries()) {
              ctx.strokeText(line, x, y + i * scaledFont * 1.2)
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

  const aspectStyle = {
    aspectRatio: `${ar.w} / ${ar.h}`,
    maxWidth: ar.w > ar.h ? '100%' : `${(ar.w / ar.h) * 100}%`,
    maxHeight: ar.h > ar.w ? 520 : 400,
  }

  return (
    <div className="flex gap-5 h-full min-h-[calc(100vh-8rem)]">

      {/* ── Left Panel ── */}
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto pb-4">

        {/* Tab bar */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('generate')}
            className={cn('flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
              activeTab === 'generate' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            Generate
          </button>
          <button
            onClick={() => setActiveTab('tov')}
            className={cn('flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
              activeTab === 'tov' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            Text on Visuals
          </button>
        </div>

        {/* ── Generate tab ── */}
        {activeTab === 'generate' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">AI Image Generation</p>
            </div>

            {/* Reference image */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reference Image <span className="font-normal text-slate-400">(optional)</span></label>
              {refImage ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${refMime};base64,${refImage}`}
                    alt="Reference"
                    className="w-full h-28 object-cover"
                  />
                  <button
                    onClick={() => setRefImage(null)}
                    className="absolute top-2 right-2 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1">
                    Reference active — AI will incorporate your image
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => refInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 hover:border-novax-border rounded-xl text-xs text-slate-500 hover:text-novax transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  Product · Logo · Character · Brand asset
                </button>
              )}
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleRefImageUpload}
              />
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
              <Plus className={cn('w-3 h-3 transition-transform', showNeg && 'rotate-45')} />
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
                <p className="text-[10px] text-slate-400 mt-1.5">Aspect ratio is included in the generation prompt</p>
              )}
            </div>

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
                    <div
                      className={cn('rounded-sm border-2', aspectRatio === a.id ? 'border-white/70' : 'border-slate-300')}
                      style={{ width: Math.round(20 * (a.w / Math.max(a.w, a.h))), height: Math.round(20 * (a.h / Math.max(a.w, a.h))) }}
                    />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate Image</>}
            </button>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>
            )}
          </div>
        )}

        {/* ── Text on Visuals tab ── */}
        {activeTab === 'tov' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-novax-accent" />
              <p className="text-sm font-semibold text-slate-800">AI Design Expert</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enter your text elements and brand colors. The AI analyzes the image&apos;s visual style, identifies safe zones, and places each element using world-class typographic design principles.
            </p>

            {/* Text elements */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Text Elements</label>
              <div className="space-y-3">
                {tovItems.map(item => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={item.text}
                        onChange={e => setTovItems(prev => prev.map(t => t.id === item.id ? { ...t, text: e.target.value } : t))}
                        placeholder={
                          item.role === 'headline' ? 'NOVAX SKINCARE' :
                          item.role === 'tagline'  ? 'Luxury Redefined' :
                          item.role === 'callout'  ? 'Shop Now' : 'Supporting text…'
                        }
                        className="flex-1 px-2.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted"
                      />
                      {tovItems.length > 1 && (
                        <button
                          onClick={() => setTovItems(prev => prev.filter(t => t.id !== item.id))}
                          className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {TOV_ROLES.map(r => (
                        <button
                          key={r.id}
                          onClick={() => setTovItems(prev => prev.map(t => t.id === item.id ? { ...t, role: r.id } : t))}
                          className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            item.role === r.id ? 'bg-novax text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {tovItems.length < 4 && (
                <button
                  onClick={() => setTovItems(prev => [...prev, { id: `tov-${Date.now()}`, text: '', role: 'tagline' }])}
                  className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-novax transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add text element
                </button>
              )}
            </div>

            {/* Brand colors */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Brand Colors</label>
              <div className="flex flex-wrap gap-3">
                {brandColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={c}
                      onChange={e => setBrandColors(prev => prev.map((pc, pi) => pi === i ? e.target.value : pc))}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={c}
                      onChange={e => setBrandColors(prev => prev.map((pc, pi) => pi === i ? e.target.value : pc))}
                      className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-700 outline-none focus:border-novax-muted"
                    />
                  </div>
                ))}
                {brandColors.length < 3 && (
                  <button
                    onClick={() => setBrandColors(prev => [...prev, '#000000'])}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-novax transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Color
                  </button>
                )}
              </div>
            </div>

            {/* Apply AI Design */}
            <button
              onClick={handleApplyDesign}
              disabled={!imageData || applyingDesign || tovItems.every(i => !i.text.trim())}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {applyingDesign
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing &amp; placing…</>
                : <><Sparkles className="w-4 h-4" /> Apply AI Design</>}
            </button>

            {!imageData && (
              <p className="text-[10px] text-center text-slate-400">Generate an image first to enable AI text placement</p>
            )}
            {tovError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{tovError}</p>
            )}

            <div className="border-t border-slate-100 pt-3">
              <button
                onClick={addTextLayer}
                disabled={!imageData}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border border-novax-border text-novax hover:bg-novax-light disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Text Layer Manually
              </button>
            </div>
          </div>
        )}

        {/* Text formatting controls — always shown when a layer is selected */}
        {selectedLayer && (
          <TextControls layer={selectedLayer} onUpdate={patch => updateLayer(selectedLayer.id, patch)} />
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
              <Wand2 className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Enter a prompt and generate an image</p>
              <p className="text-xs text-slate-400">{selectedModel.label} · {selectedModel.tag}</p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <div className="w-16 h-16 rounded-2xl border-4 border-novax-border border-t-novax-accent animate-spin" />
              <p className="text-sm font-medium">Generating with {selectedModel.label}…</p>
              <p className="text-xs text-slate-400">This takes about 10–20 seconds</p>
            </div>
          )}

          {imageData && !generating && (
            <div
              className="relative mx-auto"
              style={aspectStyle}
              ref={containerRef}
              onClick={e => {
                if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG')
                  setSelectedId(null)
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${imageMime};base64,${imageData}`}
                alt="AI generated"
                className="w-full h-full object-cover rounded-lg select-none"
                draggable={false}
              />
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
              onClick={() => setActiveTab('tov')}
              className="flex items-center gap-1.5 px-4 py-2 border border-novax-border text-novax hover:bg-novax-light rounded-lg text-sm font-medium transition-colors"
            >
              <Type className="w-3.5 h-3.5" />
              Add Text
            </button>
            {selectedId && (
              <button
                onClick={() => deleteLayer(selectedId)}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Layer
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
              <button
                onClick={handleDownload}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {exporting
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
                  : <><Download className="w-3.5 h-3.5" /> Download PNG</>}
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
