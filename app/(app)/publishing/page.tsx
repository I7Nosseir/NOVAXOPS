'use client'

import { useState, useEffect } from 'react'
import { Send, Calendar, Plus, Eye, Clock, CheckCircle, X, Sparkles, ChevronLeft, ChevronRight, LayoutGrid, Download, Search, ExternalLink, Loader2, AlertTriangle, FileText, CheckCircle2, TriangleAlert, Image as ImageIcon, Layers, Link2, Upload, TableProperties, Trash2, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useQueryClient } from '@tanstack/react-query'
import { usePosts, useSchedulePost, useSaveDraft } from '@/lib/hooks/use-posts'
import type { SchedulePostInput } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { PLATFORM_CONFIG, formatDateTime, formatDate, formatNumber, cn } from '@/lib/utils'
import type { ScheduledPost, SocialPlatform } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { supabase } from '@/lib/supabase'
import { convertGoogleDriveUrl, isGoogleDriveUrl } from '@/lib/google-drive'
interface PinterestPin { id: string; title: string; description: string; imageUrl: string; link: string; dominantColor: string }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: 'text-slate-600',   bg: 'bg-slate-100' },
  scheduled:  { label: 'Scheduled',  color: 'text-novax',  bg: 'bg-novax-light' },
  published:  { label: 'Published',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed:     { label: 'Failed',     color: 'text-red-600',     bg: 'bg-red-50' },
}

function PostCard({ post }: { post: ScheduledPost }) {
  const { clients } = useClients()
  const queryClient = useQueryClient()
  const client = clients.find(c => c.id === post.client_id)
  const status = STATUS_CONFIG[post.status]
  const perf = post.performance
  const isCrisis = client?.crisis_mode ?? false
  const [actionLoading, setActionLoading] = useState<'delete' | 'schedule' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm('Delete this post? If scheduled in Metricool it will be cancelled.')) return
    setActionLoading('delete')
    setActionError(null)
    try {
      const res = await fetch('/api/metricool/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      if (res.status === 404) {
        // Post no longer exists — just refresh the list so it disappears
        queryClient.invalidateQueries({ queryKey: ['posts'] })
        return
      }
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Delete failed')
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReschedule() {
    setActionLoading('schedule')
    setActionError(null)
    try {
      const res = await fetch('/api/metricool/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Scheduling failed')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Scheduling failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className={cn('bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow', isCrisis ? 'border-red-200' : 'border-slate-200')}>
      {/* Crisis indicator */}
      {isCrisis && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-red-500 shrink-0"/>
          <p className="text-[10px] font-semibold text-red-600">Publishing Paused — Crisis Mode</p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold" style={{ background: client?.color }}>
            {client?.initials}
          </div>
          <span className="text-xs font-medium text-slate-700">{client?.name}</span>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="relative mb-3 rounded-lg overflow-hidden bg-slate-100 aspect-video">
          <img src={post.media_url} alt="" className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
        </div>
      )}

      {/* Caption */}
      <p className="text-xs text-slate-600 line-clamp-3 mb-3 leading-relaxed">{post.caption}</p>

      {/* Platforms */}
      <div className="flex items-center gap-1.5 mb-3">
        {post.platforms.map(platform => {
          const cfg = PLATFORM_CONFIG[platform]
          return (
            <div key={platform} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200">
              <PlatformIcon platform={platform} size="xs"/>
              <span className="text-slate-600">{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Time */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3"/>
          {post.status === 'published' ? `Published ${formatDate(post.published_at!)}` : formatDateTime(post.scheduled_at)}
        </div>
      </div>

      {/* Performance (if published) */}
      {perf && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Reach',   value: formatNumber(perf.reach) },
            { label: 'Likes',   value: formatNumber(perf.likes) },
            { label: 'Cmnts',   value: perf.comments },
            { label: 'ER',      value: `${perf.engagement_rate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xs font-bold text-slate-900">{value}</p>
              <p className="text-[9px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions — hidden for published posts */}
      {post.status !== 'published' && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          {post.status === 'draft' && (
            <button
              onClick={handleReschedule}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-novax-light text-novax hover:bg-novax hover:text-white rounded-lg transition-colors disabled:opacity-40"
            >
              {actionLoading === 'schedule'
                ? <Loader2 className="w-3 h-3 animate-spin"/>
                : <RefreshCw className="w-3 h-3"/>}
              Push to Metricool
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 ml-auto"
          >
            {actionLoading === 'delete'
              ? <Loader2 className="w-3 h-3 animate-spin"/>
              : <Trash2 className="w-3 h-3"/>}
            Delete
          </button>
        </div>
      )}
      {actionError && (
        <p className="mt-1.5 text-[10px] text-red-500 leading-tight">{actionError}</p>
      )}
    </div>
  )
}

// ── Aspect ratio validation ───────────────────────────────────────────────────
// Each platform lists its accepted ratios (w:h) in preference order.
// Tolerance is ±6% — handles minor encoding differences.
const ASPECT_RULES: Record<string, Array<{ w: number; h: number; label: string }>> = {
  instagram: [{ w: 4, h: 5, label: '4:5 Portrait' }, { w: 1, h: 1, label: '1:1 Square' }, { w: 1.91, h: 1, label: '1.91:1 Landscape' }],
  facebook:  [{ w: 1, h: 1, label: '1:1 Square' }, { w: 1.91, h: 1, label: '1.91:1 Landscape' }, { w: 4, h: 5, label: '4:5 Portrait' }],
  tiktok:    [{ w: 9, h: 16, label: '9:16 Vertical' }],
  linkedin:  [{ w: 1.91, h: 1, label: '1.91:1 Landscape' }, { w: 1, h: 1, label: '1:1 Square' }],
  twitter:   [{ w: 16, h: 9, label: '16:9 Landscape' }, { w: 1, h: 1, label: '1:1 Square' }],
  youtube:   [{ w: 16, h: 9, label: '16:9 Landscape' }],
}

const RATIO_TOLERANCE = 0.06

function checkRatio(w: number, h: number, platform: string): { ok: boolean; best: string } {
  const rules = ASPECT_RULES[platform]
  if (!rules?.length) return { ok: true, best: 'Any' }
  const actual = w / h
  const match = rules.find(r => Math.abs(actual - r.w / r.h) / (r.w / r.h) <= RATIO_TOLERANCE)
  return { ok: !!match, best: rules[0].label }
}

interface MediaDims { width: number; height: number }

function useMediaDimensions(url: string): MediaDims | null {
  const [dims, setDims] = useState<MediaDims | null>(null)
  useEffect(() => {
    if (!url.trim()) { setDims(null); return }
    const isVideo = /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
    if (isVideo) {
      const v = document.createElement('video')
      v.onloadedmetadata = () => setDims({ width: v.videoWidth, height: v.videoHeight })
      v.onerror = () => setDims(null)
      v.src = url
    } else {
      const img = new Image()
      img.onload = () => setDims({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => setDims(null)
      img.src = url
    }
  }, [url])
  return dims
}

function AspectBadge({ platform, dims }: { platform: SocialPlatform; dims: MediaDims }) {
  const { ok, best } = checkRatio(dims.width, dims.height, platform)
  const cfg = PLATFORM_CONFIG[platform]
  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border',
      ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
    )}>
      {ok
        ? <CheckCircle2 className="w-3 h-3 shrink-0" />
        : <TriangleAlert className="w-3 h-3 shrink-0" />
      }
      <span>{cfg.label}</span>
      {!ok && <span className="opacity-70">→ {best}</span>}
    </div>
  )
}

function PlatformMediaRow({
  platform, url, fallbackUrl, onChange,
}: {
  platform: SocialPlatform
  url: string
  fallbackUrl: string
  onChange: (url: string) => void
}) {
  const dims = useMediaDimensions(url || fallbackUrl)
  const cfg = PLATFORM_CONFIG[platform]
  const isOverride = !!url
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex items-center gap-1.5 w-[88px] pt-2 shrink-0">
        <PlatformIcon platform={platform} size="xs"/>
        <span className="text-[11px] font-medium text-slate-600 truncate">{cfg.label}</span>
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            value={url}
            onChange={e => onChange(e.target.value)}
            placeholder={fallbackUrl ? 'Uses default — paste to override' : 'Paste URL…'}
            className={cn(
              'flex-1 min-w-0 px-2.5 py-1.5 text-xs border rounded-lg outline-none transition-all',
              isOverride
                ? 'border-novax-border bg-white text-slate-700 focus:border-novax-border-active focus:ring-2 focus:ring-novax-light'
                : 'border-slate-200 bg-slate-50 text-slate-400 placeholder:text-slate-300 focus:border-slate-300 focus:bg-white'
            )}
          />
          {url && (
            <button onClick={() => onChange('')} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
        {dims && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400 shrink-0">{dims.width}×{dims.height}</span>
            <AspectBadge platform={platform} dims={dims}/>
          </div>
        )}
      </div>
    </div>
  )
}

interface CaptionVariant {
  id: string
  label: string
  tone: string
  framework: string
  hook: string
  text: string
}

function ComposeDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const schedulePost = useSchedulePost()
  const saveDraft = useSaveDraft()

  const [brief, setBrief] = useState('')
  const [caption, setCaption] = useState('')
  const [captionAr, setCaptionAr] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram'])
  const [selectedClient, setSelectedClient] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [lang, setLang] = useState<'en' | 'ar' | 'both'>('en')

  // Media
  const [mediaMode, setMediaMode] = useState<'single' | 'carousel'>('single')
  const [singleUrl, setSingleUrl] = useState('')
  const [driveConverted, setDriveConverted] = useState(false)
  const [carouselUrls, setCarouselUrls] = useState<string[]>(['', ''])
  const [customPerPlatform, setCustomPerPlatform] = useState(false)
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0) // 0-100
  const [dragOver, setDragOver] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftSuccess, setDraftSuccess] = useState(false)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiVariants, setAiVariants] = useState<CaptionVariant[] | null>(null)
  const [aiArLoading, setAiArLoading] = useState(false)
  const [aiArVariants, setAiArVariants] = useState<CaptionVariant[] | null>(null)
  const [humanizing, setHumanizing] = useState(false)
  const [humanizingAr, setHumanizingAr] = useState(false)

  const mediaDims = useMediaDimensions(singleUrl)
  const isVideoMedia = /\.(mp4|mov|webm|avi)(\?|$)/i.test(singleUrl)
  const showThumbnailField = singleUrl.trim() !== '' && (isVideoMedia || driveConverted)

  async function humanizeCaption(targetLang: 'en' | 'ar') {
    const isAr = targetLang === 'ar'
    const text = isAr ? captionAr : caption
    if (!text.trim()) return
    if (isAr) setHumanizingAr(true); else setHumanizing(true)
    setSubmitError(null)
    const clientObj = clients.find(c => c.id === selectedClient)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'humanizer',
          client: clientObj
            ? { id: clientObj.id, name: clientObj.name, brand_identity: clientObj.brand_identity }
            : undefined,
          brief: text,
          language: targetLang,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Humanization failed')
      if (isAr) setCaptionAr(data.text?.trim() ?? captionAr)
      else setCaption(data.text?.trim() ?? caption)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Humanization failed.')
    } finally {
      if (isAr) setHumanizingAr(false); else setHumanizing(false)
    }
  }

  async function generateCaption(targetLang: 'en' | 'ar') {
    const isAr = targetLang === 'ar'
    if (isAr) setAiArLoading(true); else setAiLoading(true)
    setSubmitError(null)

    const clientObj = clients.find(c => c.id === selectedClient)
    // Prefer explicit brief; fall back to existing caption text; last resort generic
    const effectiveBrief = brief.trim()
      || (isAr ? captionAr.trim() : caption.trim())
      || 'Create an engaging social media post for this brand.'

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'post_caption',
          client: clientObj
            ? { id: clientObj.id, name: clientObj.name, brand_identity: clientObj.brand_identity }
            : undefined,
          brief: effectiveBrief,
          media_url: singleUrl || undefined,
          language: targetLang,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed')
      const raw = (data.text as string).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const variants: CaptionVariant[] = JSON.parse(raw)
      if (isAr) setAiArVariants(variants); else setAiVariants(variants)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Caption generation failed. Check your AI API key.')
    } finally {
      if (isAr) setAiArLoading(false); else setAiLoading(false)
    }
  }

  function handleSingleUrlChange(raw: string) {
    const { url, wasDrive } = convertGoogleDriveUrl(raw.trim())
    // Proxy returns a relative URL — make it absolute so Metricool can fetch it
    const finalUrl = wasDrive && url.startsWith('/') ? `${window.location.origin}${url}` : url
    setSingleUrl(finalUrl)
    setDriveConverted(wasDrive)
    if (wasDrive) setCustomPerPlatform(false)
  }

  async function handleFileUpload(file: File) {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    setSubmitError(null)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `posts/${selectedClient || 'unknown'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      // Get a pre-signed upload URL so we can use XHR for progress events.
      // supabase.storage.upload() uses fetch internally and has no onProgress hook.
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('assets')
        .createSignedUploadUrl(path)
      if (signedErr || !signedData) throw new Error(signedErr?.message ?? 'Could not get upload URL')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signedData.signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
      setSingleUrl(publicUrl)
      setDriveConverted(false)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message :
        'Upload failed. Run sql/006_storage_assets_bucket.sql in Supabase to create the assets bucket.'
      )
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function handleDropZone(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  // Sync selectedClient once clients finish loading (useState initial value runs before data arrives)
  useEffect(() => {
    if (!selectedClient && clients.length > 0) {
      setSelectedClient(clients[0].id)
    }
  }, [clients, selectedClient])

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const platforms: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter']

  const isSubmitting = schedulePost.isPending || saveDraft.isPending

  function buildInput(overrides?: { platforms?: SocialPlatform[]; media_url?: string }): SchedulePostInput {
    const baseMediaUrl = mediaMode === 'single' ? singleUrl || undefined : undefined
    const baseMediaUrls = mediaMode === 'carousel' ? carouselUrls.filter(Boolean) : undefined
    return {
      client_id: selectedClient,
      platforms: overrides?.platforms ?? selectedPlatforms,
      caption,
      caption_ar: captionAr || undefined,
      media_url: overrides ? (overrides.media_url ?? undefined) : baseMediaUrl,
      media_urls: overrides ? undefined : baseMediaUrls,
      thumbnail_url: thumbnailUrl.trim() || undefined,
      scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : '',
    }
  }

  async function handleSchedule() {
    setSubmitError(null)
    if (!selectedClient) return setSubmitError('Select a client first.')
    if (!selectedPlatforms.length) return setSubmitError('Select at least one platform.')
    if (!caption.trim() && !captionAr.trim()) return setSubmitError('Caption cannot be empty.')
    if (!scheduleDate) return setSubmitError('Set a schedule date and time.')

    try {
      if (customPerPlatform && selectedPlatforms.length > 1) {
        // Group platforms by their assigned URL, one Metricool call per group
        const groups = new Map<string, SocialPlatform[]>()
        for (const p of selectedPlatforms) {
          const url = platformUrls[p] || singleUrl
          if (!groups.has(url)) groups.set(url, [])
          groups.get(url)!.push(p)
        }
        let anyDraft = false
        for (const [url, platforms] of groups) {
          const res = await schedulePost.mutateAsync(buildInput({ platforms, media_url: url || undefined }))
          if (res.saved_as_draft) { anyDraft = true; setSubmitError(res.error ? `Saved as draft — ${res.error}` : 'Partially saved as draft.') }
        }
        if (!anyDraft) onClose()
      } else {
        const result = await schedulePost.mutateAsync(buildInput())
        if (result.saved_as_draft) {
          setSubmitError(result.error ? `Saved as draft — ${result.error}` : 'Saved as draft (no Metricool blog ID for this client).')
          return
        }
        onClose()
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Scheduling failed.')
    }
  }

  async function handleDraft() {
    setSubmitError(null)
    if (!selectedClient) return setSubmitError('Select a client first.')
    if (!caption.trim() && !captionAr.trim()) return setSubmitError('Caption cannot be empty.')
    try {
      await saveDraft.mutateAsync(buildInput())
      setDraftSuccess(true)
      setTimeout(onClose, 800)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save draft.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-semibold text-slate-900">Compose Post</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500"/>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
            >
              {clients.length === 0
                ? <option value="">Loading clients…</option>
                : <>
                    <option value="" disabled>Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </>
              }
            </select>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => {
                const cfg = PLATFORM_CONFIG[p]
                const active = selectedPlatforms.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                      active
                        ? 'border-novax-border-active bg-novax-light text-novax'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <PlatformIcon platform={p} size="xs"/>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Media ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Mode tabs */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Media</span>
              <div className="flex gap-0.5 bg-slate-200 rounded-lg p-0.5">
                {([
                  { id: 'single',   label: 'Single',   Icon: ImageIcon },
                  { id: 'carousel', label: 'Carousel', Icon: Layers },
                ] as const).map(({ id, label, Icon }) => (
                  <button key={id}
                    onClick={() => { setMediaMode(id); setCustomPerPlatform(false) }}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                      mediaMode === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    )}>
                    <Icon className="w-3 h-3"/>{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* ── Single mode ── */}
              {mediaMode === 'single' && (
                <>
                  {/* URL input */}
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Link2 className="w-3.5 h-3.5"/>
                    </div>
                    <input
                      type="url"
                      value={singleUrl}
                      onChange={e => handleSingleUrlChange(e.target.value)}
                      placeholder="Paste image/video URL or Google Drive link"
                      className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
                    />
                    {singleUrl && (
                      <button onClick={() => { setSingleUrl(''); setDriveConverted(false); setCustomPerPlatform(false) }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </div>

                  {/* Drive converted notice */}
                  {driveConverted && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                      <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0"/>
                      <p className="text-[10px] text-blue-700">Drive URL routed via proxy — file must be shared as "Anyone with the link can view".</p>
                    </div>
                  )}

                  {/* Thumbnail — shown for videos or Drive links (content type unknown until fetch) */}
                  {showThumbnailField && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">
                        Custom Thumbnail <span className="font-normal text-slate-400">(optional — for reels & videos)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <ImageIcon className="w-3.5 h-3.5"/>
                        </div>
                        <input
                          type="url"
                          value={thumbnailUrl}
                          onChange={e => setThumbnailUrl(e.target.value)}
                          placeholder="Paste cover image URL…"
                          className="w-full pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
                        />
                        {thumbnailUrl && (
                          <button onClick={() => setThumbnailUrl('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-3.5 h-3.5"/>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ratio check row */}
                  {mediaDims && selectedPlatforms.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">{mediaDims.width}×{mediaDims.height}</span>
                      {selectedPlatforms.map(p => <AspectBadge key={p} platform={p} dims={mediaDims}/>)}
                    </div>
                  )}

                  {/* Upload dropzone */}
                  <label
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer',
                      dragOver ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-slate-300 bg-slate-50',
                      uploading && 'pointer-events-none'
                    )}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDropZone}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }}
                    />
                    {uploading
                      ? <Loader2 className="w-5 h-5 text-novax animate-spin"/>
                      : <Upload className="w-5 h-5 text-slate-400"/>
                    }
                    <p className="text-[11px] font-medium text-slate-500">
                      {uploading
                        ? `Uploading… ${uploadProgress}%`
                        : dragOver ? 'Drop to upload'
                        : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, WebP, GIF, MP4, MOV, WebM — max 500 MB</p>
                  </label>

                  {/* Upload progress bar */}
                  {uploading && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-novax transition-all duration-200 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  {/* Per-platform toggle — only when 2+ platforms selected and a URL is set */}
                  {singleUrl && selectedPlatforms.length > 1 && (
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => setCustomPerPlatform(v => !v)}
                        className="flex items-center gap-2.5 w-full py-1 group"
                      >
                        <div className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', customPerPlatform ? 'bg-novax' : 'bg-slate-200 group-hover:bg-slate-300')}>
                          <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform', customPerPlatform ? 'translate-x-4' : 'translate-x-0.5')}/>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                          Different creative per platform
                        </span>
                      </button>

                      {customPerPlatform && (
                        <div className="mt-2.5 space-y-3 pl-2 border-l-2 border-novax-light">
                          <p className="text-[10px] text-slate-400 pl-2.5">Override the default URL for specific platforms. Leave blank to use the default above.</p>
                          {selectedPlatforms.map(p => (
                            <PlatformMediaRow
                              key={p}
                              platform={p}
                              url={platformUrls[p] ?? ''}
                              fallbackUrl={singleUrl}
                              onChange={url => setPlatformUrls(prev => ({ ...prev, [p]: url }))}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Carousel mode ── */}
              {mediaMode === 'carousel' && (
                <div className="space-y-2">
                  {carouselUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                        {i + 1}
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={e => {
                          const next = [...carouselUrls]
                          next[i] = e.target.value
                          setCarouselUrls(next)
                        }}
                        placeholder={`Slide ${i + 1} — paste image URL`}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
                      />
                      {carouselUrls.length > 2 && (
                        <button
                          onClick={() => setCarouselUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="shrink-0 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      )}
                    </div>
                  ))}
                  {carouselUrls.length < 10 && (
                    <button
                      onClick={() => setCarouselUrls(prev => [...prev, ''])}
                      className="flex items-center gap-1.5 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors mt-1"
                    >
                      <Plus className="w-3 h-3"/> Add slide ({carouselUrls.length}/10)
                    </button>
                  )}
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">Carousels supported on Instagram, Facebook, and LinkedIn.</p>
                </div>
              )}
            </div>
          </div>

          {/* Content brief — feeds the AI generator */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Content Brief <span className="font-normal text-slate-400">(what is this post about?)</span>
            </label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={2}
              placeholder="Describe the content — product launch, promotion detail, what the image/video shows, campaign angle… The AI uses this + the uploaded media to write relevant captions."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all"
            />
          </div>

          {/* Language toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Language</label>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
              {(['en', 'ar', 'both'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    lang === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {l === 'en' ? 'English' : l === 'ar' ? 'Arabic' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          {/* Caption EN */}
          {(lang === 'en' || lang === 'both') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Caption{lang === 'both' ? ' (English)' : ''}
              </label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={4}
                placeholder="Write your caption…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all"
              />
              <div className="flex items-center justify-between mt-1 gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setAiVariants(null); generateCaption('en') }}
                    disabled={aiLoading || humanizing || !selectedClient}
                    className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors disabled:opacity-40"
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                    {aiLoading ? 'Generating…' : 'Generate with AI'}
                  </button>
                  {caption.trim() && (
                    <button
                      onClick={() => humanizeCaption('en')}
                      disabled={humanizing || aiLoading}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-40"
                      title="Rewrite to pass AI detectors — undetectable, natural, human-sounding"
                    >
                      {humanizing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Eye className="w-3 h-3"/>}
                      {humanizing ? 'Humanizing…' : 'Make Human'}
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{caption.length} / 2200</span>
              </div>
              {aiVariants && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Select a variant to use:</p>
                  {aiVariants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setCaption(v.text); setAiVariants(null) }}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-novax-border-active hover:bg-novax-light transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-novax">{v.label}</span>
                        <span className="text-[9px] text-slate-400 italic">{v.tone}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{v.hook}</p>
                    </button>
                  ))}
                  <button onClick={() => setAiVariants(null)} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">Dismiss</button>
                </div>
              )}
            </div>
          )}

          {/* Caption AR */}
          {(lang === 'ar' || lang === 'both') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Caption{lang === 'both' ? ' (Arabic)' : ''}
              </label>
              <textarea
                value={captionAr}
                onChange={e => setCaptionAr(e.target.value)}
                rows={4}
                dir="rtl"
                placeholder="اكتب التعليق هنا…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all text-right"
              />
              <div className="flex items-center justify-between mt-1 gap-2">
                <div className="flex items-center gap-3 flex-row-reverse w-full">
                  <span className="text-[11px] text-slate-400">{captionAr.length} / 2200</span>
                  <div className="flex items-center gap-3 mr-auto">
                    <button
                      onClick={() => { setAiArVariants(null); generateCaption('ar') }}
                      disabled={aiArLoading || humanizingAr || !selectedClient}
                      className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors disabled:opacity-40"
                    >
                      {aiArLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                      {aiArLoading ? 'جارٍ التوليد…' : 'Generate in Arabic'}
                    </button>
                    {captionAr.trim() && (
                      <button
                        onClick={() => humanizeCaption('ar')}
                        disabled={humanizingAr || aiArLoading}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-40"
                        title="إعادة الكتابة لتجاوز كواشف الذكاء الاصطناعي"
                      >
                        {humanizingAr ? <Loader2 className="w-3 h-3 animate-spin"/> : <Eye className="w-3 h-3"/>}
                        {humanizingAr ? 'جارٍ المعالجة…' : 'Make Human'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {aiArVariants && (
                <div className="mt-2 space-y-1.5" dir="rtl">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">اختر نسخة:</p>
                  {aiArVariants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setCaptionAr(v.text); setAiArVariants(null) }}
                      className="w-full text-right px-3 py-2 rounded-lg border border-slate-200 hover:border-novax-border-active hover:bg-novax-light transition-all"
                    >
                      <div className="flex items-center justify-between mb-1 flex-row-reverse">
                        <span className="text-[10px] font-semibold text-novax">{v.label}</span>
                        <span className="text-[9px] text-slate-400 italic">{v.tone}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{v.hook}</p>
                    </button>
                  ))}
                  <button onClick={() => setAiArVariants(null)} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">إغلاق</button>
                </div>
              )}
            </div>
          )}

          {/* Schedule */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Schedule Date & Time</label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
            />
          </div>
        </div>

        {/* Error / draft-saved feedback */}
        {submitError && (
          <div className="mx-5 mb-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5"/>
            <p className="text-xs text-red-700">{submitError}</p>
          </div>
        )}
        {draftSuccess && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0"/>
            <p className="text-xs text-emerald-700 font-medium">Draft saved</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors text-center sm:text-left disabled:opacity-40">Cancel</button>
          <div className="flex gap-2">
            <button
              onClick={handleDraft}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              {saveDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <FileText className="w-3.5 h-3.5"/>}
              Save Draft
            </button>
            <button
              onClick={handleSchedule}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {schedulePost.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0"/> : <Send className="w-3.5 h-3.5 shrink-0"/>}
              <span>{schedulePost.isPending ? 'Scheduling…' : 'Schedule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type CalendarPost = { day: number; time: string; platform: string; type: string; title: string; anchor: string | null }

function exportCalendarToExcel(posts: CalendarPost[], clientName: string, monthLabel: string, language: 'en' | 'ar') {
  const isAr = language === 'ar'
  const headers = isAr
    ? ['اليوم', 'الوقت', 'المنصة', 'نوع المحتوى', 'عنوان المنشور', 'مرتكز']
    : ['Day', 'Time', 'Platform', 'Content Type', 'Post Title', 'Anchor Event']

  const rows = posts.map(p => [
    p.day,
    p.time,
    p.platform,
    p.type,
    p.title,
    p.anchor ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Column widths
  ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 52 }, { wch: 22 }]

  // RTL worksheet for Arabic
  if (isAr) {
    ws['!sheetView'] = [{ rightToLeft: true }]
  }

  // Color anchor rows: Islamic = green, global event = blue
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = 1; r <= range.e.r; r++) {
    const post = posts[r - 1]
    if (!post?.anchor) continue
    const isIslamic = post.type.toLowerCase().match(/eid|ramadan|arafah|arafa|mawlid|muharram|ashura|isra|sha.ban|laylat|hijri/)
    const fill = isIslamic ? 'C6EFCE' : 'BDD7EE'
    for (let c = 0; c <= 5; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' }
      ws[cellAddr].s = { fill: { patternType: 'solid', fgColor: { rgb: fill } } }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, monthLabel.replace(/[/:?*[\]\\]/g, '-'))
  XLSX.writeFile(wb, `${clientName}_${monthLabel.replace(/ /g, '_')}_Calendar.xlsx`)
}

function PinterestPanel({ query }: { query: string }) {
  const [pins, setPins] = useState<PinterestPin[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchQuery, setSearchQuery] = useState(query)
  const [error, setError] = useState<string | null>(null)

  const search = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setSearched(false)
    try {
      const res = await fetch(`/api/pinterest?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Pinterest search failed')
        setPins([])
      } else {
        setPins(data.pins ?? [])
        setSearched(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-novax-muted focus-within:ring-2 focus-within:ring-novax-light transition-all bg-white">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(searchQuery)}
            placeholder="Search Pinterest for visual references…"
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
          />
        </div>
        <button
          onClick={() => search(searchQuery)}
          disabled={loading || !searchQuery.trim()}
          className="px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Search className="w-3.5 h-3.5"/>}
          Search
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {!searched && !loading && !error && (
        <div className="py-8 text-center">
          <Search className="w-8 h-8 text-slate-200 mx-auto mb-2"/>
          <p className="text-sm text-slate-400">Search Pinterest for visual inspiration</p>
          <p className="text-xs text-slate-300 mt-1">Images open on Pinterest in a new tab</p>
        </div>
      )}

      {loading && (
        <div className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-novax-muted animate-spin"/>
          <span className="text-sm text-slate-500">Fetching references…</span>
        </div>
      )}

      {searched && pins.length === 0 && !loading && !error && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400">No results found. Try a different query.</p>
        </div>
      )}

      {pins.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {pins.map(pin => (
            <a
              key={pin.id}
              href={pin.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-novax-border-active transition-all block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.imageUrl}
                alt={pin.title}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"/>
              </div>
              {pin.title && (
                <div className="p-1.5">
                  <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">{pin.title}</p>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bulk Schedule ────────────────────────────────────────────────────────────

interface BulkRow {
  id: string
  scheduled_at: string
  platforms: SocialPlatform[]
  caption: string
  media_url: string
  status: 'pending' | 'scheduling' | 'scheduled' | 'draft' | 'failed'
  error?: string
}

function newRow(): BulkRow {
  return { id: Math.random().toString(36).slice(2), scheduled_at: '', platforms: ['instagram'], caption: '', media_url: '', status: 'pending' }
}

const BULK_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter']

function BulkScheduleDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const [selectedClient, setSelectedClient] = useState('')
  const [rows, setRows] = useState<BulkRow[]>([newRow(), newRow(), newRow()])
  const [scheduling, setScheduling] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!selectedClient && clients.length > 0) setSelectedClient(clients[0].id)
  }, [clients, selectedClient])

  function updateRow(id: string, patch: Partial<BulkRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function togglePlatform(rowId: string, p: SocialPlatform) {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const has = r.platforms.includes(p)
      const next = has ? r.platforms.filter(x => x !== p) : [...r.platforms, p]
      return { ...r, platforms: next.length ? next : [p] }
    }))
  }

  function handleUrlChange(rowId: string, raw: string) {
    const { url, wasDrive } = convertGoogleDriveUrl(raw.trim())
    const finalUrl = wasDrive && url.startsWith('/') ? `${window.location.origin}${url}` : url
    updateRow(rowId, { media_url: finalUrl })
  }

  async function scheduleAll() {
    if (!selectedClient) return
    setScheduling(true)
    for (const row of rows) {
      if (!row.caption.trim() || !row.scheduled_at || !row.platforms.length) continue
      updateRow(row.id, { status: 'scheduling' })
      try {
        const res = await fetch('/api/metricool/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: selectedClient,
            platforms: row.platforms,
            caption: row.caption,
            media_url: row.media_url || undefined,
            scheduled_at: new Date(row.scheduled_at).toISOString(),
          }),
        })
        const data = await res.json()
        if (!res.ok && !data.saved_as_draft) throw new Error(data.error ?? 'Failed')
        updateRow(row.id, { status: data.saved_as_draft ? 'draft' : 'scheduled', error: data.saved_as_draft ? data.error : undefined })
      } catch (err) {
        updateRow(row.id, { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }
    setScheduling(false)
    setDone(true)
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    // ── Instructions sheet ────────────────────────────────────────────────────
    const info = [
      ['NOVAX Ops — Bulk Schedule Template'],
      [''],
      ['Column', 'Format', 'Valid Values', 'Required'],
      ['Date', 'YYYY-MM-DD', 'e.g. 2026-06-01', 'Yes'],
      ['Time', 'HH:MM (24-hour)', 'e.g. 09:00 or 14:30', 'Yes'],
      ['Platforms', 'Comma-separated', 'instagram · facebook · tiktok · linkedin · twitter', 'Yes'],
      ['Caption', 'Plain text', 'Your post caption (max 2 200 chars)', 'Yes'],
      ['Media URL', 'URL', 'Google Drive share link, Supabase URL, or any public image/video URL', 'No'],
      ['Language', 'Code', 'en / ar / both', 'No (default: en)'],
      [''],
      ['Tips'],
      ['• Google Drive links are auto-converted — just paste the share URL.'],
      ['• File must be shared as "Anyone with the link can view" in Google Drive.'],
      ['• Platforms: separate multiple with a comma — e.g.  instagram,facebook'],
      ['• Date + Time are separate columns so Excel date-pickers work correctly.'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(info)
    wsInfo['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 58 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions')

    // ── Schedule sheet ────────────────────────────────────────────────────────
    const headers = ['Date', 'Time', 'Platforms', 'Caption', 'Media URL', 'Language']
    const example = [
      '2026-06-01',
      '09:00',
      'instagram,facebook',
      'Your caption goes here.',
      'https://drive.google.com/file/d/YOUR_FILE_ID/view',
      'en',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 32 }, { wch: 52 }, { wch: 52 }, { wch: 10 }]

    // Freeze the header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    // Drop-down validation for Language column (F2:F10000)
    // SheetJS CE writes the dataValidations node to the XLSX XML.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ws as any)['!dataValidations'] = [
      {
        sqref: 'F2:F10000',
        type: 'list',
        formula1: '"en,ar,both"',
        showDropDown: false,
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid language',
        error: 'Enter:  en  /  ar  /  both',
      },
      {
        sqref: 'C2:C10000',
        type: 'list',
        formula1: '"instagram,facebook,tiktok,linkedin,twitter,instagram\\,facebook,instagram\\,tiktok,instagram\\,linkedin"',
        showDropDown: false,
        allowBlank: false,
        showErrorMessage: false,
      },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
    XLSX.writeFile(wb, 'NOVAX_Bulk_Schedule_Template.xlsx')
  }

  async function handleImportFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      // Prefer a sheet named 'Schedule', fall back to the first sheet
      const sheetName =
        wb.SheetNames.find(n => n.toLowerCase().includes('schedule')) ?? wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      // raw:false keeps dates as formatted strings; header:1 gives array-of-arrays
      const rows2d = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

      // Find the header row (first row that contains 'Date')
      const headerIdx = rows2d.findIndex(r =>
        r.some(c => String(c).toLowerCase() === 'date')
      )
      if (headerIdx === -1) return

      const headers = rows2d[headerIdx].map(h => String(h).toLowerCase().trim())
      const col = (name: string) => headers.findIndex(h => h.includes(name))
      const iDate = col('date')
      const iTime = col('time')
      const iPlat = col('platform')
      const iCapt = col('caption')
      const iUrl  = col('media')
      const iLang = col('lang')

      const importedRows: BulkRow[] = []

      for (let i = headerIdx + 1; i < rows2d.length; i++) {
        const r = rows2d[i]
        const caption = iCapt >= 0 ? String(r[iCapt] ?? '').trim() : ''
        if (!caption) continue

        // Normalise date: Excel serial dates come as "MM/DD/YYYY" or "YYYY-MM-DD"
        let rawDate = iDate >= 0 ? String(r[iDate] ?? '').trim() : ''
        // If format is M/D/YYYY convert to YYYY-MM-DD
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
          const [m, d, y] = rawDate.split('/')
          rawDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }
        const time = iTime >= 0 ? String(r[iTime] ?? '09:00').trim() : '09:00'
        const scheduledAt = rawDate ? `${rawDate}T${time}` : ''

        const platformsRaw = iPlat >= 0 ? String(r[iPlat] ?? 'instagram').toLowerCase() : 'instagram'
        const platforms = platformsRaw
          .split(/[,;|]/)
          .map(p => p.trim())
          .filter(p => (BULK_PLATFORMS as string[]).includes(p)) as SocialPlatform[]

        const rawUrl = iUrl >= 0 ? String(r[iUrl] ?? '').trim() : ''
        const { url: convertedUrl, wasDrive } = convertGoogleDriveUrl(rawUrl)
        const mediaUrl = wasDrive && convertedUrl.startsWith('/')
          ? `${window.location.origin}${convertedUrl}`
          : convertedUrl

        importedRows.push({
          id: Math.random().toString(36).slice(2),
          scheduled_at: scheduledAt,
          platforms: platforms.length ? platforms : ['instagram'],
          caption,
          media_url: mediaUrl,
          status: 'pending',
        })
      }

      if (importedRows.length > 0) setRows(importedRows)
    } catch {
      // silently ignore parse errors — rows remain unchanged
    }
  }

  const readyCount = rows.filter(r => r.caption.trim() && r.scheduled_at && r.platforms.length).length

  const statusIcon = (status: BulkRow['status']) => {
    if (status === 'scheduling') return <Loader2 className="w-3.5 h-3.5 text-novax animate-spin"/>
    if (status === 'scheduled') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/>
    if (status === 'draft') return <FileText className="w-3.5 h-3.5 text-amber-500"/>
    if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-500"/>
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Bulk Schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">Add rows, fill content, schedule all at once. Google Drive URLs auto-convert.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted bg-white">
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* Download template */}
              <button
                onClick={downloadTemplate}
                title="Download Excel template"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5"/>
                Template
              </button>
              {/* Import CSV / Excel */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-novax-border rounded-lg text-novax cursor-pointer hover:bg-novax-light transition-colors font-medium" title="Import filled template">
                <Upload className="w-3.5 h-3.5"/>
                Import
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = '' }}
                />
              </label>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-1">
              <X className="w-4 h-4 text-slate-500"/>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-44">Date & Time</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-48">Platforms</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Caption</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-52">Media URL</th>
                <th className="px-3 py-2.5 w-10"></th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className={cn('align-top', row.status === 'scheduled' && 'bg-emerald-50/50', row.status === 'failed' && 'bg-red-50/50')}>
                  <td className="px-3 py-2">
                    <input
                      type="datetime-local"
                      value={row.scheduled_at}
                      onChange={e => updateRow(row.id, { scheduled_at: e.target.value })}
                      disabled={scheduling || row.status === 'scheduled'}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {BULK_PLATFORMS.map(p => (
                        <button
                          key={p}
                          onClick={() => togglePlatform(row.id, p)}
                          disabled={scheduling || row.status === 'scheduled'}
                          className={cn(
                            'p-1 rounded-md border transition-colors disabled:opacity-50',
                            row.platforms.includes(p) ? 'border-novax-border-active bg-novax-light' : 'border-slate-200 hover:border-slate-300'
                          )}
                          title={PLATFORM_CONFIG[p].label}
                        >
                          <PlatformIcon platform={p} size="xs"/>
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={row.caption}
                      onChange={e => updateRow(row.id, { caption: e.target.value })}
                      disabled={scheduling || row.status === 'scheduled'}
                      rows={3}
                      placeholder="Write caption…"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted resize-none bg-white disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="url"
                      value={row.media_url}
                      onChange={e => handleUrlChange(row.id, e.target.value)}
                      disabled={scheduling || row.status === 'scheduled'}
                      placeholder="Image/video URL or Drive link"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                    />
                    {row.error && <p className="text-[10px] text-red-500 mt-1 leading-tight">{row.error}</p>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {statusIcon(row.status)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                      disabled={scheduling || rows.length <= 1}
                      className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-0"
                    >
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => setRows(prev => [...prev, newRow()])}
            disabled={scheduling}
            className="flex items-center gap-1.5 text-sm text-novax-muted hover:text-novax font-medium transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4"/> Add Row
          </button>
          <div className="flex items-center gap-3">
            {done && <p className="text-xs text-emerald-600 font-medium">Done — check statuses above</p>}
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
              {done ? 'Close' : 'Cancel'}
            </button>
            <button
              onClick={scheduleAll}
              disabled={scheduling || !selectedClient || readyCount === 0}
              className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              {scheduling ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              {scheduling ? 'Scheduling…' : `Schedule All (${readyCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BriefToCalendarDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const [brief, setBrief] = useState('')
  const [client, setClient] = useState('')
  const [month, setMonth] = useState('2026-05')
  const [freq, setFreq] = useState('3')
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<CalendarPost[] | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'pinterest'>('calendar')

  const generate = async () => {
    if (!brief) return
    setGenerating(true)
    setGenError(null)
    const selectedClient = clients.find(c => c.id === client)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'content_calendar',
          client: selectedClient ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity } : undefined,
          brief,
          month,
          frequency: freq,
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenError(data.error ?? 'Generation failed. Please try again.')
        return
      }
      const raw = data.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed: CalendarPost[] = JSON.parse(raw)
      setResult(parsed)
    } catch {
      setGenError('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const selectedClient = clients.find(c => c.id === client)
  const [yr, mo] = month.split('-').map(Number)
  const monthLabel = `${MONTHS[mo - 1]} ${yr}`
  const isAr = language === 'ar'

  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-50 border-pink-200 text-pink-700',
    facebook: 'bg-blue-50 border-blue-200 text-blue-700',
    tiktok: 'bg-slate-100 border-slate-200 text-slate-700',
    linkedin: 'bg-sky-50 border-sky-200 text-sky-700',
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Generate Content Calendar</h2>
            <p className="text-xs text-slate-500 mt-0.5">Input a campaign brief — AI maps it to a posting schedule.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Result tabs (only shown after generation) */}
        {result && (
          <div className="flex border-b border-slate-100 px-6 shrink-0">
            {(['calendar', 'pinterest'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'py-3 px-1 mr-5 text-xs font-semibold border-b-2 -mb-px transition-colors capitalize',
                  activeTab === tab ? 'border-novax text-novax' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}>
                {tab === 'calendar' ? 'Calendar' : 'Pinterest References'}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-6 space-y-4" dir={isAr && !result ? 'rtl' : 'ltr'}>
          {!result ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
                  <select value={client} onChange={e => setClient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all">
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Month</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Posts per week</label>
                  <div className="flex gap-2">
                    {['2', '3', '4', '5', '7'].map(n => (
                      <button key={n} onClick={() => setFreq(n)}
                        className={cn('w-10 h-9 rounded-lg border text-sm font-medium transition-colors',
                          freq === n ? 'bg-novax border-novax text-white' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Calendar Language</label>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                    {(['en', 'ar'] as const).map(l => (
                      <button key={l} onClick={() => setLanguage(l)}
                        className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                          language === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        {l === 'en' ? 'English' : 'Arabic'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" style={{ textAlign: isAr ? 'right' : 'left' }}>Campaign Brief</label>
                <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={5}
                  dir={isAr ? 'rtl' : 'ltr'}
                  placeholder={isAr ? 'اكتب موجز الحملة، الرسائل الرئيسية، الأهداف…' : 'Describe the campaign, key messages, goals, any specific dates or events to work around, content themes…'}
                  className={cn('w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all', isAr && 'text-right')}/>
              </div>
              {genError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600">{genError}</p>
                </div>
              )}
            </>
          ) : activeTab === 'calendar' ? (
            <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{selectedClient?.name} — {monthLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{result.length} posts planned · {freq}x per week cadence</p>
                </div>
                <button onClick={() => setResult(null)} className="text-xs text-novax-muted hover:text-novax font-medium">Edit brief</button>
              </div>
              <div className="space-y-2">
                {result.map((item, i) => {
                  const isIslamic = item.anchor && item.type.toLowerCase().match(/eid|ramadan|arafah|arafa|mawlid|muharram|ashura|isra|sha.ban|laylat|hijri/)
                  const isGlobal = item.anchor && !isIslamic
                  return (
                    <div key={i} className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      isAr && 'flex-row-reverse',
                      isIslamic ? 'bg-emerald-50 border-emerald-200' :
                      isGlobal  ? 'bg-sky-50 border-sky-200' :
                      'bg-slate-50 border-slate-100 hover:border-slate-200'
                    )}>
                      <div className="w-12 shrink-0 text-center">
                        <p className={cn('text-lg font-bold', isIslamic ? 'text-emerald-700' : isGlobal ? 'text-sky-700' : 'text-slate-900')}>{item.day}</p>
                        <p className="text-[10px] text-slate-400">{item.time}</p>
                      </div>
                      <div className={cn('flex-1 min-w-0', isAr && 'text-right')}>
                        {item.anchor && (
                          <span className={cn('inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1',
                            isIslamic ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
                            {isIslamic ? 'Islamic' : 'Event'} — {item.anchor}
                          </span>
                        )}
                        <p className={cn('text-sm font-medium leading-tight', isIslamic ? 'text-emerald-900' : isGlobal ? 'text-sky-900' : 'text-slate-900')}>{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.type}</p>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0', platformColors[item.platform] ?? 'bg-slate-100 border-slate-200 text-slate-600')}>
                        {item.platform}
                      </span>
                    </div>
                  )
                })}
              </div>
              {result.some(p => p.anchor) && (
                <div className="flex items-center gap-4 pt-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                    <span className="text-[10px] text-slate-500">Islamic date</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400"/>
                    <span className="text-[10px] text-slate-500">Global event</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"/>
                    <span className="text-[10px] text-slate-500">Regular post</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <PinterestPanel query={`${selectedClient?.name ?? ''} ${brief.split(' ').slice(0, 5).join(' ')}`}/>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
          {!result ? (
            <button onClick={generate} disabled={!brief || generating}
              className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <Sparkles className="w-3.5 h-3.5"/>
              {generating ? 'Generating…' : 'Generate Calendar'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCalendarToExcel(result, selectedClient?.name ?? 'Client', monthLabel, language)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-novax-border rounded-lg text-sm font-medium text-slate-600 hover:text-novax transition-colors">
                <Download className="w-3.5 h-3.5"/>
                Export Excel
              </button>
              <button onClick={onClose} className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
                <Calendar className="w-3.5 h-3.5"/>
                Save to Calendar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({ onCompose }: { onCompose: () => void }) {
  const { posts: SCHEDULED_POSTS } = usePosts()
  const { clients: CLIENTS } = useClients()
  const today = new Date(2026, 4, 1) // May 2026 (matches current date context)
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay = new Date(current.year, current.month, 1)
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  // Monday-first: 0=Mon…6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const getPostsForDay = (day: number) => {
    const prefix = `${current.year}-${String(current.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return SCHEDULED_POSTS.filter(p => p.scheduled_at.startsWith(prefix))
  }

  const isToday = (day: number) =>
    day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden overflow-x-auto">
      <div className="min-w-[640px]">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrent(c => {
            const d = new Date(c.year, c.month - 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500"/>
          </button>
          <h3 className="font-semibold text-slate-900 text-sm w-36 text-center">
            {MONTHS[current.month]} {current.year}
          </h3>
          <button onClick={() => setCurrent(c => {
            const d = new Date(c.year, c.month + 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500"/>
          </button>
        </div>
        <button onClick={() => setCurrent({ year: today.getFullYear(), month: today.getMonth() })}
          className="text-xs text-novax-muted hover:text-novax font-medium transition-colors">
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const posts = day ? getPostsForDay(day) : []
          const isLastRow = idx >= cells.length - 7
          return (
            <div key={idx} className={cn(
              'min-h-[110px] p-2 border-b border-r border-slate-100 relative group',
              !isLastRow ? '' : 'border-b-0',
              (idx + 1) % 7 === 0 ? 'border-r-0' : '',
              !day ? 'bg-slate-50/50' : 'hover:bg-slate-50/50 transition-colors',
            )}>
              {day && (
                <>
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                    isToday(day) ? 'bg-novax text-white' : 'text-slate-600'
                  )}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {posts.slice(0, 3).map(post => {
                      const client = CLIENTS.find(c => c.id === post.client_id)
                      const statusDot = post.status === 'published' ? 'bg-emerald-400' : post.status === 'scheduled' ? 'bg-novax' : 'bg-slate-300'
                      return (
                        <div key={post.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 cursor-pointer hover:border-novax-border transition-colors group/post" title={post.caption}>
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot)}/>
                          <div className="w-3 h-3 rounded-sm flex items-center justify-center text-white text-[7px] font-bold shrink-0" style={{ background: client?.color }}>
                            {client?.initials?.[0]}
                          </div>
                          <span className="text-[10px] text-slate-600 truncate leading-tight">
                            {post.caption.slice(0, 22)}…
                          </span>
                        </div>
                      )
                    })}
                    {posts.length > 3 && (
                      <p className="text-[10px] text-slate-400 font-medium pl-1">+{posts.length - 3} more</p>
                    )}
                  </div>
                  {/* Add post button on hover */}
                  <button onClick={onCompose} className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-novax-light text-novax items-center justify-center text-[10px] hidden group-hover:flex transition-colors hover:bg-novax hover:text-white">
                    +
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
      </div>{/* min-w wrapper */}
    </div>
  )
}

export default function PublishingPage() {
  const { posts: allPosts } = usePosts()
  const { clients } = useClients()
  const [compose, setCompose] = useState(false)
  const [briefDialog, setBriefDialog] = useState(false)
  const [bulkDialog, setBulkDialog] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'draft'>('all')
  const [view, setView] = useState<'grid' | 'calendar'>('grid')

  const crisisClients = clients.filter(c => c.crisis_mode)

  const filtered = allPosts.filter(p => filter === 'all' || p.status === filter)
  const counts = {
    scheduled: allPosts.filter(p => p.status === 'scheduled').length,
    published: allPosts.filter(p => p.status === 'published').length,
    draft: allPosts.filter(p => p.status === 'draft').length,
  }

  return (
    <div className="space-y-5">
      {/* Crisis Mode Banner */}
      {crisisClients.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-red-700">
              Crisis Mode — Publishing Paused for {crisisClients.map(c => c.name).join(', ')}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Scheduled posts for these clients will not be sent. Deactivate Crisis Mode from the Clients page to resume.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'scheduled', 'published', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === f ? 'bg-novax text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {f === 'scheduled' && <Clock className="w-3.5 h-3.5"/>}
              {f === 'published' && <CheckCircle className="w-3.5 h-3.5"/>}
              {f === 'all' ? 'All Posts' : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f as keyof typeof counts]})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600')} title="Grid view">
              <LayoutGrid className="w-3.5 h-3.5"/>
            </button>
            <button onClick={() => setView('calendar')} className={cn('p-1.5 rounded-md transition-colors', view === 'calendar' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600')} title="Calendar view">
              <Calendar className="w-3.5 h-3.5"/>
            </button>
          </div>
          <button
            onClick={() => setBulkDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
          >
            <TableProperties className="w-3.5 h-3.5"/>
            Bulk Schedule
          </button>
          <button
            onClick={() => setBriefDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5"/>
            Generate Calendar
          </button>
          <button
            onClick={() => setCompose(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4"/>
            Compose Post
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: allPosts.length, icon: Send },
          { label: 'Scheduled', value: counts.scheduled, icon: Calendar },
          { label: 'Published', value: counts.published, icon: CheckCircle },
          { label: 'Drafts', value: counts.draft, icon: Eye },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="p-2 bg-novax-light rounded-lg">
              <Icon className="w-4 h-4 text-novax-muted"/>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Posts grid or Calendar */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(post => <PostCard key={post.id} post={post}/>)}
        </div>
      ) : (
        <CalendarView onCompose={() => setCompose(true)}/>
      )}

      {compose && <ComposeDialog onClose={() => setCompose(false)}/>}
      {briefDialog && <BriefToCalendarDialog onClose={() => setBriefDialog(false)}/>}
      {bulkDialog && <BulkScheduleDialog onClose={() => setBulkDialog(false)}/>}
    </div>
  )
}
