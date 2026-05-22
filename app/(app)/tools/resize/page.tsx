'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, Loader2, Sparkles, Download, RefreshCw, AlertCircle,
  ImageIcon, CheckCircle, Info, Crosshair,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LayoutSchema } from '@/app/api/tools/resize/analyze/route'

type Step = 'upload' | 'analyzing' | 'ready' | 'generating' | 'done'

interface OutputResult {
  url9x16: string | null
  url1x1:  string | null
  base64_9x16?: string
  base64_1x1?: string
}

const FORMAT_INFO = [
  {
    key: '9x16' as const,
    label: '9:16 — Stories & Reels',
    dims: '1080 × 1920 px',
    note: 'Instagram Stories, Reels cover, TikTok',
    safeNote: 'Full image preserved — background extended above & below',
    aspect: 'aspect-[9/16]',
    width: 'w-28',
  },
  {
    key: '1x1' as const,
    label: '1:1 — Square Feed',
    dims: '1080 × 1080 px',
    note: 'Instagram feed, Facebook post',
    safeNote: 'Full image preserved — background extended on sides',
    aspect: 'aspect-square',
    width: 'w-36',
  },
]

const ELEMENT_TYPE_COLORS: Record<string, string> = {
  headline:       'bg-blue-500',
  secondary_text: 'bg-blue-300',
  cta:            'bg-emerald-500',
  logo:           'bg-purple-500',
  subject:        'bg-orange-500',
  product:        'bg-amber-500',
}

export default function ResizePage() {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('image/jpeg')
  const [schema, setSchema] = useState<LayoutSchema | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [result, setResult] = useState<OutputResult | null>(null)
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File handling ──────────────────────────────────────────────────────────
  const readFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setAnalyzeError('Please upload an image file (JPEG, PNG, or WebP).')
      return
    }
    setFile(f)
    setMimeType(f.type)
    setPreviewUrl(URL.createObjectURL(f))
    setSchema(null)
    setResult(null)
    setAnalyzeError(null)
    setGenerateError(null)
    setStep('upload')

    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      // Strip data:image/...;base64, prefix
      setImageBase64(dataUrl.split(',')[1] ?? null)
    }
    reader.readAsDataURL(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) readFile(f)
  }, [readFile])

  // ── Analyze ────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!imageBase64) return
    setStep('analyzing')
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/tools/resize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAnalyzeError(data.error ?? 'Analysis failed.')
        setStep('upload')
        return
      }
      setSchema(data.schema as LayoutSchema)
      setStep('ready')
    } catch {
      setAnalyzeError('Network error. Please try again.')
      setStep('upload')
    }
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!imageBase64 || !schema) return
    setStep('generating')
    setGenerateError(null)
    try {
      const res = await fetch('/api/tools/resize/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, schema }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenerateError(data.error ?? 'Generation failed.')
        setStep('ready')
        return
      }
      setResult(data as OutputResult)
      if (data.orig_dimensions) setOrigDims(data.orig_dimensions)
      setStep('done')
    } catch {
      setGenerateError('Network error. Please try again.')
      setStep('ready')
    }
  }

  // ── Download helper ────────────────────────────────────────────────────────
  // Uses Blob URL — reliable for large files, no cross-origin issues, works in
  // all modern browsers without the size limits of data: URLs.
  const download = (formatKey: '9x16' | '1x1') => {
    const b64 = formatKey === '9x16' ? result?.base64_9x16 : result?.base64_1x1
    if (!b64) return
    const fname = `novax-${formatKey}-${Date.now()}.jpg`
    const byteStr = atob(b64)
    const bytes = new Uint8Array(byteStr.length)
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'image/jpeg' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fname
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }

  const reset = () => {
    setStep('upload')
    setFile(null)
    setPreviewUrl(null)
    setImageBase64(null)
    setSchema(null)
    setResult(null)
    setAnalyzeError(null)
    setGenerateError(null)
    setOrigDims(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isWorking = step === 'analyzing' || step === 'generating'

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload any image — AI detects elements and adapts the layout to each format without cropping.
          </p>
        </div>
        {file && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5"/>
            New image
          </button>
        )}
      </div>

      {/* How it works — shown only before first upload */}
      {step === 'upload' && !file && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: '1', title: 'Upload', desc: 'Any JPEG, PNG, or WebP — landscape, portrait, or square' },
            { n: '2', title: 'AI Analyzes', desc: 'AI maps focal point, background color, text, logos, and subject' },
            { n: '3', title: 'Smart Adapt', desc: 'Solid backgrounds are extended with matched color. Photo backgrounds are cropped on the focal point. Full quality — no blur.' },
          ].map(s => (
            <div key={s.n} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
              <div className="w-7 h-7 rounded-full bg-novax text-white text-xs font-bold flex items-center justify-center shrink-0">
                {s.n}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Upload / Original */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Original</p>

          {!file ? (
            // Drop zone
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-64',
                dragging
                  ? 'border-novax-border-active bg-novax-light scale-[1.01]'
                  : 'border-slate-300 bg-slate-50 hover:border-novax-border hover:bg-novax-light',
              )}
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <ImageIcon className="w-6 h-6 text-slate-400"/>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Drop image here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse · JPEG, PNG, WebP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }}
              />
            </div>
          ) : (
            // Original preview
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl!}
                alt="Original"
                className="w-full object-contain max-h-80"
              />

              {/* Focal point crosshair overlay */}
              {schema && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${schema.focal_point.x}%`,
                    top: `${schema.focal_point.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center shadow-lg">
                    <Crosshair className="w-4 h-4 text-white"/>
                  </div>
                  <div className="absolute inset-0 rounded-full animate-ping border border-white/40"/>
                </div>
              )}

              {/* File info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
                <p className="text-white text-xs font-medium truncate">{file.name}</p>
                {origDims && (
                  <p className="text-white/60 text-[10px]">{origDims.w} × {origDims.h} px original</p>
                )}
              </div>
            </div>
          )}

          {/* Analysis error */}
          {analyzeError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
              {analyzeError}
            </div>
          )}

          {/* Analyze button */}
          {file && step === 'upload' && (
            <button
              onClick={handleAnalyze}
              disabled={!imageBase64}
              className="w-full flex items-center justify-center gap-2 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4"/>
              Analyze with AI
            </button>
          )}

          {step === 'analyzing' && (
            <div className="w-full flex items-center justify-center gap-2 py-3 bg-novax/80 text-white text-sm font-semibold rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin"/>
              Analyzing image layout…
            </div>
          )}

          {/* Analysis results */}
          {schema && (step === 'ready' || step === 'generating' || step === 'done') && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500"/>
                <p className="text-sm font-semibold text-slate-800">Analysis complete</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Focal point</p>
                  <p className="text-slate-700 font-semibold">{Math.round(schema.focal_point.x)}% · {Math.round(schema.focal_point.y)}%</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Background</p>
                  <p className="text-slate-700 font-semibold capitalize">{schema.background_type.replace('_', ' ')}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Visual weight</p>
                  <p className="text-slate-700 font-semibold capitalize">{schema.visual_weight.replace('_', ' ')}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                  <p className="text-slate-400">Dominant color</p>
                  <div
                    className="w-4 h-4 rounded border border-slate-200 shrink-0"
                    style={{ background: schema.dominant_color }}
                    title={schema.dominant_color}
                  />
                </div>
              </div>

              {/* Detected elements */}
              {schema.elements.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Detected elements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {schema.elements.map((el, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                        <div className={cn('w-2 h-2 rounded-full', ELEMENT_TYPE_COLORS[el.type] ?? 'bg-slate-400')}/>
                        <span className="capitalize">{el.type.replace('_', ' ')}</span>
                        {el.importance === 'primary' && <span className="text-novax-muted font-semibold">★</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!schema.safe_to_extend_edges && (
                <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                  Content detected near edges — blurred background may be visible at margins.
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          {step === 'ready' && schema && (
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-3 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4"/>
              Generate Both Formats
            </button>
          )}

          {step === 'generating' && (
            <div className="w-full flex items-center justify-center gap-2 py-3 bg-novax/80 text-white text-sm font-semibold rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin"/>
              Adapting layout with Sharp…
            </div>
          )}

          {generateError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
              {generateError}
            </div>
          )}

          {step === 'done' && (
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5"/>
              Regenerate
            </button>
          )}
        </div>

        {/* Right: Outputs */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Outputs</p>

          {step !== 'done' && (
            <div className="flex gap-4 items-start">
              {FORMAT_INFO.map(fmt => (
                <div key={fmt.key} className="flex-1 space-y-2">
                  <div className={cn(
                    'bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 transition-colors',
                    fmt.aspect,
                    isWorking && 'border-novax-border animate-pulse',
                  )}>
                    {isWorking
                      ? <Loader2 className="w-6 h-6 text-novax-muted animate-spin"/>
                      : <ImageIcon className="w-8 h-8 text-slate-300"/>
                    }
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-slate-700">{fmt.label}</p>
                    <p className="text-[10px] text-slate-400">{fmt.dims}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-5">
              {FORMAT_INFO.map(fmt => {
                const url  = fmt.key === '9x16' ? result.url9x16  : result.url1x1
                const b64  = fmt.key === '9x16' ? result.base64_9x16 : result.base64_1x1
                const src  = url ?? (b64 ? `data:image/jpeg;base64,${b64}` : null)

                return (
                  <div key={fmt.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Preview */}
                    <div className="bg-slate-900 flex items-center justify-center p-4">
                      <div className={cn('relative overflow-hidden rounded-xl shadow-lg', fmt.width, fmt.aspect)}>
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={fmt.label} className="w-full h-full object-contain bg-slate-800"/>
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-slate-500"/>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta + download */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{fmt.label}</p>
                        <p className="text-[11px] text-slate-400">{fmt.dims} · {fmt.note}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmt.safeNote}</p>
                      </div>
                      <button
                        onClick={() => download(fmt.key)}
                        disabled={!src}
                        className="flex items-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5"/>
                        Download
                      </button>
                    </div>
                  </div>
                )
              })}

              <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400"/>
                <span>
                  Solid backgrounds are extended with the exact matched color — seamless, no blur.
                  Photo and gradient backgrounds are smart-cropped centered on the detected focal point.
                  All content (logo, text, subject) is preserved at full resolution.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
