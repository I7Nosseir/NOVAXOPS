'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Send, Calendar, Plus, Eye, Clock, CheckCircle, X, Sparkles, ChevronLeft, ChevronRight, LayoutGrid, Download, Search, ExternalLink, Loader2, AlertTriangle, FileText, CheckCircle2, TriangleAlert, Image as ImageIcon, Layers, Link2, Upload, TableProperties, Trash2, RefreshCw, Pencil } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useQueryClient } from '@tanstack/react-query'
import { usePosts, useSchedulePost, useSaveDraft } from '@/lib/hooks/use-posts'
import type { SchedulePostInput } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { PLATFORM_CONFIG, formatDateTime, formatDate, formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import type { ScheduledPost, SocialPlatform } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { supabase } from '@/lib/supabase'
import { convertGoogleDriveUrl, isGoogleDriveUrl, isProxyDriveUrl, importDriveFileToStorage } from '@/lib/google-drive'
interface PinterestPin { id: string; title: string; description: string; imageUrl: string; link: string; dominantColor: string }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: 'text-slate-600',   bg: 'bg-slate-100' },
  scheduled:  { label: 'Scheduled',  color: 'text-novax',  bg: 'bg-novax-light' },
  published:  { label: 'Published',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed:     { label: 'Failed',     color: 'text-red-600',     bg: 'bg-red-50' },
}

function EditPostDialog({ post, onClose }: { post: ScheduledPost; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [caption, setCaption] = useState(post.caption)
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ''
  )
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(post.platforms)
  const [saving, setSaving] = useState(false)

  function togglePlatform(p: SocialPlatform) {
    setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p])
  }

  async function handleSave() {
    if (!caption.trim() || !scheduledAt || !platforms.length) return
    setSaving(true)
    try {
      const res = await fetch('/api/metricool/schedule/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, caption, scheduled_at: new Date(scheduledAt).toISOString(), platforms }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Save failed')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast.success('Post updated and rescheduled')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Edit Post</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Caption</label>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={5}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Scheduled time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  platforms.includes(p)
                    ? 'bg-novax-light border-novax-border text-novax'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                )}
              >
                <PlatformIcon platform={p} size="xs"/>
                {PLATFORM_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !caption.trim() || !scheduledAt}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-novax hover:bg-novax-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
            Save & Reschedule
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewDialog({ post, onClose }: { post: ScheduledPost; onClose: () => void }) {
  const { clients } = useClients()
  const client = clients.find(c => c.id === post.client_id)
  const status = STATUS_CONFIG[post.status]
  const slides = post.media_urls ?? (post.media_url ? [post.media_url] : [])
  const isCarousel = slides.length > 1
  const [slideIndex, setSlideIndex] = useState(0)
  const currentSlide = slides[slideIndex] ?? ''
  const isVideo = /\.(mp4|mov|webm|avi|m4v|mkv|wmv|flv)(\?|$)/i.test(currentSlide)

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    setSlideIndex(i => (i - 1 + slides.length) % slides.length)
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation()
    setSlideIndex(i => (i + 1) % slides.length)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ background: client?.color }}
            >
              {client?.initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">{client?.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isCarousel ? `Carousel · ${slides.length} slides` : 'Post Preview'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Media */}
        {slides.length > 0 && (
          <div className="relative bg-slate-900 aspect-square overflow-hidden">
            {isVideo ? (
              <video
                key={currentSlide}
                src={currentSlide}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                key={currentSlide}
                src={currentSlide}
                alt={isCarousel ? `Slide ${slideIndex + 1}` : ''}
                className="w-full h-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

            {/* Carousel navigation */}
            {isCarousel && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-4 h-4"/>
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4"/>
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setSlideIndex(i) }}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-colors',
                        i === slideIndex ? 'bg-white' : 'bg-white/40'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-72">
          {/* Status + time */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3"/>
              {post.status === 'published'
                ? formatDate(post.published_at!)
                : formatDateTime(post.scheduled_at)}
            </span>
          </div>

          {/* Caption */}
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
            {post.caption}
          </p>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            {post.platforms.map(platform => (
              <div
                key={platform}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-slate-50 border border-slate-200"
              >
                <PlatformIcon platform={platform} size="xs"/>
                <span className="text-slate-600">{PLATFORM_CONFIG[platform].label}</span>
              </div>
            ))}
          </div>

          {post.metricool_post_id && (
            <p className="text-[9px] text-slate-300 font-mono">ID: {post.metricool_post_id}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function PostCard({ post }: { post: ScheduledPost }) {
  const { clients } = useClients()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const client = clients.find(c => c.id === post.client_id)
  const status = STATUS_CONFIG[post.status]
  const perf = post.performance
  const isCrisis = client?.crisis_mode ?? false
  const [actionLoading, setActionLoading] = useState<'delete' | 'schedule' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [syncingStats, setSyncingStats] = useState(false)

  async function doDelete() {
    setConfirmDelete(false)
    setActionLoading('delete')

    const snapshots = queryClient.getQueriesData<ScheduledPost[]>({ queryKey: ['posts'] })
    queryClient.setQueriesData<ScheduledPost[]>({ queryKey: ['posts'] }, (old) =>
      old ? old.filter(p => p.id !== post.id) : old
    )

    try {
      const res = await fetch('/api/metricool/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      if (!res.ok && res.status !== 404) {
        const d = await res.json()
        throw new Error(d.error ?? 'Delete failed')
      }
      const d = await res.json()
      if (d.metricool_warning) {
        toast.warning('Deleted from app — remove it manually from the scheduling platform (could not reach API)')
      } else {
        toast.success('Post deleted')
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    } catch (err) {
      for (const [key, data] of snapshots) queryClient.setQueryData(key, data)
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReschedule() {
    if (isCrisis) {
      toast.error('Publishing is paused — this client is in Crisis Mode')
      return
    }
    setActionLoading('schedule')
    try {
      const res = await fetch('/api/metricool/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Scheduling failed')
      toast.success('Post pushed to Metricool')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scheduling failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSyncStats() {
    setSyncingStats(true)
    try {
      const res = await fetch(`/api/metricool/post-stats?post_id=${post.id}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Sync failed')
      toast.success('Performance stats updated')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stats sync failed')
    } finally {
      setSyncingStats(false)
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPreviewing(true)}
            className="p-1 text-slate-400 hover:text-novax-muted hover:bg-novax-light rounded-md transition-colors"
            title="Preview post"
          >
            <Eye className="w-3.5 h-3.5"/>
          </button>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.bg, status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="relative mb-3 rounded-lg overflow-hidden bg-slate-100 aspect-video">
          <img
            src={post.media_url}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"/>
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

      {/* Actions */}
      {(post.status !== 'published' || post.metricool_post_id) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          {post.status === 'published' ? (
            <button
              onClick={handleSyncStats}
              disabled={syncingStats}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-novax-light text-novax hover:bg-novax hover:text-white rounded-lg transition-colors disabled:opacity-40"
            >
              {syncingStats ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
              Sync Stats
            </button>
          ) : (
            <>
              {post.status === 'draft' && (
                <button
                  onClick={handleReschedule}
                  disabled={!!actionLoading || isCrisis}
                  title={isCrisis ? 'Publishing paused — Crisis Mode active' : undefined}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-novax-light text-novax hover:bg-novax hover:text-white rounded-lg transition-colors disabled:opacity-40"
                >
                  {actionLoading === 'schedule'
                    ? <Loader2 className="w-3 h-3 animate-spin"/>
                    : <RefreshCw className="w-3 h-3"/>}
                  Push to {vendorName(user?.role, 'Metricool')}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-novax hover:bg-novax-light rounded-lg transition-colors disabled:opacity-40"
              >
                <Pencil className="w-3 h-3"/>
                Edit
              </button>
              {confirmDelete ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Delete this post?</span>
                  <button onClick={doDelete} className="px-2 py-1 text-[11px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Yes, delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 ml-auto"
                >
                  {actionLoading === 'delete' ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>}
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
      {editing && <EditPostDialog post={post} onClose={() => setEditing(false)}/>}
      {previewing && <PreviewDialog post={post} onClose={() => setPreviewing(false)}/>}
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

function ComposeDialog({ onClose, initialCaption = '' }: { onClose: () => void; initialCaption?: string }) {
  const { clients } = useClients()
  const schedulePost = useSchedulePost()
  const saveDraft = useSaveDraft()

  const [brief, setBrief] = useState('')
  const [caption, setCaption] = useState(initialCaption)
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
  const [isVideoUpload, setIsVideoUpload] = useState(false)
  const [carouselUploading, setCarouselUploading] = useState<Record<number, boolean>>({})
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [driveImporting, setDriveImporting] = useState(false)
  const [instagramPostType, setInstagramPostType] = useState<'POST' | 'REEL' | 'STORY'>('POST')
  const [facebookPostType, setFacebookPostType] = useState<'POST' | 'REEL' | 'STORY'>('POST')

  const [aiLoading, setAiLoading] = useState(false)
  const [aiVariants, setAiVariants] = useState<CaptionVariant[] | null>(null)
  const [aiArLoading, setAiArLoading] = useState(false)
  const [aiArVariants, setAiArVariants] = useState<CaptionVariant[] | null>(null)
  const [humanizing, setHumanizing] = useState(false)
  const [humanizingAr, setHumanizingAr] = useState(false)

  const mediaDims = useMediaDimensions(singleUrl)
  const urlIsVideoDetected = /\.(mp4|mov|webm|avi|m4v|mkv|wmv|flv)(\?|$)/i.test(singleUrl)
  const isReel = isVideoUpload || urlIsVideoDetected
  const showThumbnailField = singleUrl.trim() !== '' && (isReel || driveConverted)
  const storySelected = (selectedPlatforms.includes('instagram') && instagramPostType === 'STORY')
    || (selectedPlatforms.includes('facebook') && facebookPostType === 'STORY')

  async function humanizeCaption(targetLang: 'en' | 'ar') {
    const isAr = targetLang === 'ar'
    const text = isAr ? captionAr : caption
    if (!text.trim()) return
    if (isAr) setHumanizingAr(true); else setHumanizing(true)
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
      toast.error(err instanceof Error ? err.message : 'Humanization failed.')
    } finally {
      if (isAr) setHumanizingAr(false); else setHumanizing(false)
    }
  }

  async function generateCaption(targetLang: 'en' | 'ar') {
    const isAr = targetLang === 'ar'
    if (isAr) setAiArLoading(true); else setAiLoading(true)

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
      toast.error(err instanceof Error ? err.message : 'Caption generation failed. Check your AI API key.')
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
    setIsVideoUpload(file.type.startsWith('video/'))
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
      toast.error(err instanceof Error ? err.message : 'Upload failed. Contact your administrator to configure file storage.')
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

  async function handleCarouselSlideUpload(index: number, file: File) {
    setCarouselUploading(prev => ({ ...prev, [index]: true }))
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `posts/${selectedClient || 'unknown'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('assets')
        .createSignedUploadUrl(path)
      if (signedErr || !signedData) throw new Error(signedErr?.message ?? 'Could not get upload URL')
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signedData.signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
      setCarouselUrls(prev => { const next = [...prev]; next[index] = publicUrl; return next })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Slide upload failed')
    } finally {
      setCarouselUploading(prev => ({ ...prev, [index]: false }))
    }
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

  const isSubmitting = schedulePost.isPending || saveDraft.isPending || driveImporting

  function buildInput(overrides?: { platforms?: SocialPlatform[]; media_url?: string }): SchedulePostInput {
    const baseMediaUrl = mediaMode === 'single' ? singleUrl || undefined : undefined
    const baseMediaUrls = mediaMode === 'carousel' ? carouselUrls.filter(Boolean) : undefined
    const effectiveUrl = overrides?.media_url ?? baseMediaUrl
    const effectiveUrlIsVideo = /\.(mp4|mov|webm|avi|m4v|mkv|wmv|flv)(\?|$)/i.test(effectiveUrl ?? '')
    const effectivePlatforms = overrides?.platforms ?? selectedPlatforms
    return {
      client_id: selectedClient,
      platforms: effectivePlatforms,
      caption,
      caption_ar: captionAr || undefined,
      media_url: overrides ? (overrides.media_url ?? undefined) : baseMediaUrl,
      media_urls: overrides ? undefined : baseMediaUrls,
      thumbnail_url: thumbnailUrl.trim() || undefined,
      is_video: isVideoUpload || effectiveUrlIsVideo || undefined,
      scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : '',
      instagram_post_type: effectivePlatforms.includes('instagram') ? instagramPostType : undefined,
      facebook_post_type:  effectivePlatforms.includes('facebook')  ? facebookPostType  : undefined,
    }
  }

  async function resolveUrl(url: string): Promise<string> {
    if (!isProxyDriveUrl(url)) return url
    return importDriveFileToStorage(url)
  }

  async function handleSchedule() {
    if (!selectedClient) return toast.error('Select a client first.')
    const selectedClientData = clients.find(c => c.id === selectedClient)
    if (selectedClientData?.crisis_mode) {
      toast.error('Publishing is paused — this client is in Crisis Mode')
      return
    }
    if (!selectedPlatforms.length) return toast.error('Select at least one platform.')
    if (!caption.trim() && !captionAr.trim()) return toast.error('Caption cannot be empty.')
    if (!scheduleDate) return toast.error('Set a schedule date and time.')

    // Import any Drive proxy URLs to Supabase Storage before scheduling
    let resolvedSingleUrl = singleUrl
    const resolvedPlatformUrls = { ...platformUrls }
    if (driveConverted || isProxyDriveUrl(singleUrl)) {
      setDriveImporting(true)
      try {
        if (singleUrl) resolvedSingleUrl = await resolveUrl(singleUrl)
        for (const p of selectedPlatforms) {
          if (platformUrls[p] && isProxyDriveUrl(platformUrls[p])) {
            resolvedPlatformUrls[p] = await resolveUrl(platformUrls[p])
          }
        }
        setSingleUrl(resolvedSingleUrl)
        setDriveConverted(false)
      } catch (err) {
        setDriveImporting(false)
        return toast.error(err instanceof Error ? err.message : 'Drive import failed.')
      }
      setDriveImporting(false)
    }

    try {
      if (customPerPlatform && selectedPlatforms.length > 1) {
        const groups = new Map<string, SocialPlatform[]>()
        for (const p of selectedPlatforms) {
          const url = resolvedPlatformUrls[p] || resolvedSingleUrl
          if (!groups.has(url)) groups.set(url, [])
          groups.get(url)!.push(p)
        }
        let anyDraft = false
        for (const [url, plats] of groups) {
          const res = await schedulePost.mutateAsync(buildInput({ platforms: plats, media_url: url || undefined }))
          if (res.saved_as_draft) { anyDraft = true; toast.warning(res.error ? `Saved as draft — ${res.error}` : 'Partially saved as draft.') }
        }
        if (!anyDraft) { toast.success('Post scheduled'); onClose() }
      } else {
        const result = await schedulePost.mutateAsync(
          mediaMode === 'single' ? buildInput({ media_url: resolvedSingleUrl || undefined }) : buildInput()
        )
        if (result.saved_as_draft) {
          toast.warning(result.error ? `Saved as draft — ${result.error}` : 'Saved as draft — this client is not connected to the scheduling platform.')
          onClose()
          return
        }
        toast.success('Post scheduled')
        onClose()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scheduling failed.')
    }
  }

  async function handleDraft() {
    if (!selectedClient) return toast.error('Select a client first.')
    if (!caption.trim() && !captionAr.trim()) return toast.error('Caption cannot be empty.')

    let draftSingleUrl = singleUrl
    if (mediaMode === 'single' && isProxyDriveUrl(singleUrl)) {
      setDriveImporting(true)
      try {
        draftSingleUrl = await resolveUrl(singleUrl)
        setSingleUrl(draftSingleUrl)
        setDriveConverted(false)
      } catch (err) {
        setDriveImporting(false)
        return toast.error(err instanceof Error ? err.message : 'Drive import failed.')
      }
      setDriveImporting(false)
    }

    try {
      await saveDraft.mutateAsync(
        mediaMode === 'single' ? buildInput({ media_url: draftSingleUrl || undefined }) : buildInput()
      )
      toast.success('Draft saved')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft.')
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

          {/* ── Post Type (Instagram + Facebook only) ──────────────── */}
          {(selectedPlatforms.includes('instagram') || selectedPlatforms.includes('facebook')) && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Post Type</label>
              {selectedPlatforms.includes('instagram') && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                    <PlatformIcon platform="instagram" size="xs"/> Instagram
                  </p>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                    {(['POST', 'REEL', 'STORY'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setInstagramPostType(t)}
                        className={cn(
                          'px-3 py-1 rounded-md text-[11px] font-semibold transition-colors',
                          instagramPostType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        {t === 'POST' ? 'Post' : t === 'REEL' ? 'Reel' : 'Story'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedPlatforms.includes('facebook') && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                    <PlatformIcon platform="facebook" size="xs"/> Facebook
                  </p>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                    {(['POST', 'REEL', 'STORY'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFacebookPostType(t)}
                        className={cn(
                          'px-3 py-1 rounded-md text-[11px] font-semibold transition-colors',
                          facebookPostType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        {t === 'POST' ? 'Post' : t === 'REEL' ? 'Reel' : 'Story'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {storySelected && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <TriangleAlert className="w-3 h-3 shrink-0"/>
                  Stories require 9:16 vertical media. Carousel is disabled for story posts.
                </p>
              )}
            </div>
          )}

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
                    disabled={id === 'carousel' && storySelected}
                    title={id === 'carousel' && storySelected ? 'Carousel not supported for Stories' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
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
                      <button onClick={() => { setSingleUrl(''); setDriveConverted(false); setCustomPerPlatform(false); setIsVideoUpload(false) }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </div>

                  {/* Drive import notice */}
                  {driveConverted && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                      <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0"/>
                      <p className="text-[10px] text-blue-700">
                        {driveImporting
                          ? 'Importing from Google Drive to secure storage…'
                          : 'Drive link detected — will be uploaded to secure storage on schedule. File must be shared as "Anyone with the link".'}
                      </p>
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
                        placeholder={`Slide ${i + 1} — paste URL or upload`}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
                      />
                      <label className="shrink-0 cursor-pointer text-slate-400 hover:text-novax-muted transition-colors">
                        {carouselUploading[i]
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                          : <Upload className="w-3.5 h-3.5"/>
                        }
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,video/mp4"
                          className="hidden"
                          disabled={carouselUploading[i]}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleCarouselSlideUpload(i, f) }}
                        />
                      </label>
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
              {(schedulePost.isPending || driveImporting) ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0"/> : <Send className="w-3.5 h-3.5 shrink-0"/>}
              <span>{driveImporting ? 'Importing…' : schedulePost.isPending ? 'Scheduling…' : 'Schedule'}</span>
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
  media_urls_extra: string
  instagram_post_type: 'POST' | 'REEL' | 'STORY'
  facebook_post_type: 'POST' | 'REEL' | 'STORY'
  platform_media: Partial<Record<SocialPlatform, string>>
  expanded: boolean
  status: 'pending' | 'scheduling' | 'scheduled' | 'draft' | 'failed'
  error?: string
}

function newRow(): BulkRow {
  return {
    id: Math.random().toString(36).slice(2),
    scheduled_at: '', platforms: ['instagram'], caption: '',
    media_url: '', media_urls_extra: '',
    instagram_post_type: 'POST', facebook_post_type: 'POST',
    platform_media: {}, expanded: false,
    status: 'pending',
  }
}

function resolveMediaUrls(row: BulkRow): string[] | undefined {
  const extra = row.media_urls_extra.split('|').map(u => u.trim()).filter(Boolean)
  if (row.media_url && extra.length) return [row.media_url, ...extra]
  if (extra.length) return extra
  if (row.media_url) return [row.media_url]
  return undefined
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
        // Group platforms by their effective media URL (per-platform override or row default)
        const urlGroups = new Map<string, SocialPlatform[]>()
        for (const p of row.platforms) {
          const url = row.platform_media[p] || row.media_url
          if (!urlGroups.has(url)) urlGroups.set(url, [])
          urlGroups.get(url)!.push(p)
        }

        let anyDraft = false
        for (const [groupUrl, plats] of urlGroups) {
          const extra = row.media_urls_extra.split('|').map(u => u.trim()).filter(Boolean)
          let mediaUrls: string[] | undefined = groupUrl
            ? [groupUrl, ...extra]
            : extra.length ? extra : undefined

          // Resolve Drive proxy URLs sequentially to preserve order
          if (mediaUrls?.length) {
            const resolved: string[] = []
            for (const u of mediaUrls) {
              resolved.push(isProxyDriveUrl(u) ? await importDriveFileToStorage(u) : u)
            }
            mediaUrls = resolved
          }

          const res = await fetch('/api/metricool/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: selectedClient,
              platforms: plats,
              caption: row.caption,
              media_urls: mediaUrls,
              scheduled_at: new Date(row.scheduled_at).toISOString(),
              instagram_post_type: plats.includes('instagram') ? row.instagram_post_type : undefined,
              facebook_post_type:  plats.includes('facebook')  ? row.facebook_post_type  : undefined,
            }),
          })
          const data = await res.json()
          if (!res.ok && !data.saved_as_draft) throw new Error(data.error ?? 'Failed')
          if (data.saved_as_draft) anyDraft = true
        }
        updateRow(row.id, { status: anyDraft ? 'draft' : 'scheduled' })
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
      ['Media URL', 'URL', 'Google Drive share link or any public image/video URL', 'No'],
      ['Carousel URLs', 'URLs separated by |', 'Additional slides — up to 9 extra URLs separated by a pipe |', 'No'],
      ['Language', 'Code', 'en / ar / both', 'No (default: en)'],
      ['IG Post Type', 'Code', 'POST · REEL · STORY', 'No (default: POST)'],
      ['FB Post Type', 'Code', 'POST · REEL · STORY', 'No (default: POST)'],
      ['Instagram Media', 'URL', 'Override Media URL for Instagram only — leave blank to use default', 'No'],
      ['Facebook Media', 'URL', 'Override Media URL for Facebook only — leave blank to use default', 'No'],
      ['TikTok Media', 'URL', 'Override Media URL for TikTok only — leave blank to use default', 'No'],
      ['LinkedIn Media', 'URL', 'Override Media URL for LinkedIn only — leave blank to use default', 'No'],
      ['Twitter Media', 'URL', 'Override Media URL for Twitter only — leave blank to use default', 'No'],
      [''],
      ['Tips'],
      ['• Google Drive links are auto-converted — just paste the share URL.'],
      ['• File must be shared as "Anyone with the link can view" in Google Drive.'],
      ['• Platforms: separate multiple with a comma — e.g.  instagram,facebook'],
      ['• Date + Time are separate columns so Excel date-pickers work correctly.'],
      ['• Carousel: put the first image in "Media URL", then extra slides in "Carousel URLs" separated by |'],
      ['• Per-platform media: if Instagram and Facebook need different images, fill columns J–N; blank = use default.'],
      ['• Story posts: use 9:16 vertical media. Carousel not supported for stories.'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(info)
    wsInfo['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 58 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions')

    // ── Schedule sheet ────────────────────────────────────────────────────────
    const headers = ['Date', 'Time', 'Platforms', 'Caption', 'Media URL', 'Carousel URLs', 'Language', 'IG Post Type', 'FB Post Type', 'Instagram Media', 'Facebook Media', 'TikTok Media', 'LinkedIn Media', 'Twitter Media']
    const example = [
      '2026-06-01',
      '09:00',
      'instagram,facebook',
      'Your caption goes here.',
      'https://drive.google.com/file/d/SLIDE1_ID/view',
      'https://drive.google.com/file/d/SLIDE2_ID/view|https://drive.google.com/file/d/SLIDE3_ID/view',
      'en',
      'POST',
      'POST',
      '',
      '',
      '',
      '',
      '',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = [
      { wch: 14 }, { wch: 8 }, { wch: 32 }, { wch: 52 },
      { wch: 52 }, { wch: 72 }, { wch: 10 },
      { wch: 14 }, { wch: 12 },
      { wch: 48 }, { wch: 48 }, { wch: 48 }, { wch: 48 }, { wch: 48 },
    ]

    // Freeze the header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    // Drop-down validation for Language column (F2:F10000)
    // SheetJS CE writes the dataValidations node to the XLSX XML.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ws as any)['!dataValidations'] = [
      {
        sqref: 'G2:G10000',
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
      {
        sqref: 'H2:H10000',
        type: 'list',
        formula1: '"POST,REEL,STORY"',
        showDropDown: false,
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid IG type',
        error: 'Enter: POST / REEL / STORY',
      },
      {
        sqref: 'I2:I10000',
        type: 'list',
        formula1: '"POST,REEL,STORY"',
        showDropDown: false,
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid FB type',
        error: 'Enter: POST / REEL / STORY',
      },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
    XLSX.writeFile(wb, 'NOVA_Bulk_Schedule_Template.xlsx')
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
      const PLAT_NAMES = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter']
      const iDate     = col('date')
      const iTime     = col('time')
      const iPlat     = col('platform')
      const iCapt     = col('caption')
      // Main media URL — must not match per-platform override columns or carousel
      const iUrl      = headers.findIndex(h =>
        h.includes('media') && !h.includes('carousel') && !PLAT_NAMES.some(p => h.includes(p))
      )
      const iCarousel = col('carousel')
      const iLang     = col('lang')
      const iIgType   = headers.findIndex(h => (h.includes('ig') || h.includes('instagram')) && h.includes('type'))
      const iFbType   = headers.findIndex(h => (h.includes('fb') || h.includes('facebook')) && h.includes('type'))
      const iIgMedia  = headers.findIndex(h => h.includes('instagram') && h.includes('media'))
      const iFbMedia  = headers.findIndex(h => h.includes('facebook') && h.includes('media'))
      const iTkMedia  = headers.findIndex(h => h.includes('tiktok') && h.includes('media'))
      const iLiMedia  = headers.findIndex(h => h.includes('linkedin') && h.includes('media'))
      const iTwMedia  = headers.findIndex(h => h.includes('twitter') && h.includes('media'))

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

        // Post types — uppercase + validate; default to POST
        const VALID_TYPES = ['POST', 'REEL', 'STORY'] as const
        const igTypeRaw = iIgType >= 0 ? String(r[iIgType] ?? '').toUpperCase().trim() : ''
        const fbTypeRaw = iFbType >= 0 ? String(r[iFbType] ?? '').toUpperCase().trim() : ''
        const instagram_post_type: 'POST' | 'REEL' | 'STORY' = (VALID_TYPES as readonly string[]).includes(igTypeRaw) ? igTypeRaw as 'POST' | 'REEL' | 'STORY' : 'POST'
        const facebook_post_type: 'POST' | 'REEL' | 'STORY' = (VALID_TYPES as readonly string[]).includes(fbTypeRaw) ? fbTypeRaw as 'POST' | 'REEL' | 'STORY' : 'POST'

        // Per-platform media URL overrides
        const platform_media: Partial<Record<SocialPlatform, string>> = {}
        const pmMap: [number, SocialPlatform][] = [
          [iIgMedia, 'instagram'], [iFbMedia, 'facebook'],
          [iTkMedia, 'tiktok'], [iLiMedia, 'linkedin'], [iTwMedia, 'twitter'],
        ]
        for (const [pCol, plat] of pmMap) {
          if (pCol >= 0) {
            const rawPm = String(r[pCol] ?? '').trim()
            if (rawPm) {
              const { url: convPm, wasDrive: wasDrivePm } = convertGoogleDriveUrl(rawPm)
              platform_media[plat] = wasDrivePm && convPm.startsWith('/') ? `${window.location.origin}${convPm}` : convPm
            }
          }
        }

        importedRows.push({
          id: Math.random().toString(36).slice(2),
          scheduled_at: scheduledAt,
          platforms: platforms.length ? platforms : ['instagram'],
          caption,
          media_url: mediaUrl,
          media_urls_extra: iCarousel >= 0 ? String(r[iCarousel] ?? '').trim() : '',
          instagram_post_type,
          facebook_post_type,
          platform_media,
          expanded: Object.values(platform_media).some(Boolean),
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
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-44">Platforms</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-32">Post Type</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Caption</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500 w-56">Media</th>
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
                  {/* Post Type — IG + FB independent selectors */}
                  <td className="px-3 py-2 align-top">
                    {row.platforms.includes('instagram') && (
                      <div className="mb-1.5">
                        <p className="text-[9px] font-semibold text-slate-400 mb-1 flex items-center gap-0.5">
                          <PlatformIcon platform="instagram" size="xs"/> IG
                        </p>
                        <div className="flex flex-wrap gap-0.5">
                          {(['POST', 'REEL', 'STORY'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => updateRow(row.id, { instagram_post_type: t })}
                              disabled={scheduling || row.status === 'scheduled'}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors disabled:opacity-50',
                                row.instagram_post_type === t
                                  ? 'bg-novax-light border-novax-border text-novax'
                                  : 'border-slate-200 text-slate-400 hover:border-slate-300'
                              )}
                            >{t[0] + t.slice(1).toLowerCase()}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {row.platforms.includes('facebook') && (
                      <div>
                        <p className="text-[9px] font-semibold text-slate-400 mb-1 flex items-center gap-0.5">
                          <PlatformIcon platform="facebook" size="xs"/> FB
                        </p>
                        <div className="flex flex-wrap gap-0.5">
                          {(['POST', 'REEL', 'STORY'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => updateRow(row.id, { facebook_post_type: t })}
                              disabled={scheduling || row.status === 'scheduled'}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors disabled:opacity-50',
                                row.facebook_post_type === t
                                  ? 'bg-novax-light border-novax-border text-novax'
                                  : 'border-slate-200 text-slate-400 hover:border-slate-300'
                              )}
                            >{t[0] + t.slice(1).toLowerCase()}</button>
                          ))}
                        </div>
                      </div>
                    )}
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
                      placeholder="Slide 1 URL (or single image/video)"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={row.media_urls_extra}
                      onChange={e => updateRow(row.id, { media_urls_extra: e.target.value })}
                      disabled={scheduling || row.status === 'scheduled'}
                      placeholder="Slides 2–10 separated by |  (carousel)"
                      className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                    />
                    {row.platforms.length > 1 && (
                      <button
                        onClick={() => updateRow(row.id, { expanded: !row.expanded })}
                        disabled={scheduling || row.status === 'scheduled'}
                        className="mt-1.5 text-[10px] text-novax-muted hover:text-novax font-medium flex items-center gap-1 disabled:opacity-40"
                      >
                        <Layers className="w-3 h-3"/>
                        {row.expanded ? 'Hide per-platform' : 'Per-platform media'}
                      </button>
                    )}
                    {row.expanded && (
                      <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-novax-light">
                        {BULK_PLATFORMS.filter(p => row.platforms.includes(p)).map(p => (
                          <div key={p} className="flex items-center gap-1.5">
                            <PlatformIcon platform={p} size="xs"/>
                            <input
                              type="url"
                              value={row.platform_media[p] ?? ''}
                              onChange={e => updateRow(row.id, { platform_media: { ...row.platform_media, [p]: e.target.value } })}
                              disabled={scheduling || row.status === 'scheduled'}
                              placeholder={`${PLATFORM_CONFIG[p].label} — uses default`}
                              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>
                    )}
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

function PublishingPageContent() {
  const { posts: allPosts } = usePosts()
  const { clients } = useClients()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  useRealtime('scheduled_posts', ['posts'])
  const searchParams = useSearchParams()
  const [compose, setCompose] = useState(false)
  const [templateCaption, setTemplateCaption] = useState('')
  const [briefDialog, setBriefDialog] = useState(false)
  const [bulkDialog, setBulkDialog] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'draft'>('all')
  const [view, setView] = useState<'grid' | 'calendar'>('grid')
  const [syncing, setSyncing] = useState(false)

  // Auto-open compose when arriving from library "Use as template"
  const templateHandled = useRef(false)
  useEffect(() => {
    if (templateHandled.current) return
    const cap = searchParams.get('caption')
    if (cap) {
      templateHandled.current = true
      setTemplateCaption(decodeURIComponent(cap))
      setCompose(true)
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  async function handleSync(silent = false) {
    setSyncing(true)
    try {
      const res = await fetch('/api/metricool/sync', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Sync failed')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      if (!silent && d.updated > 0) {
        toast.success(`${d.updated} post${d.updated > 1 ? 's' : ''} updated from Metricool`)
      }
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync on mount and every 3 minutes so statuses stay current without manual refresh
  useEffect(() => {
    handleSync(true)
    const interval = setInterval(() => handleSync(true), 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            onClick={() => handleSync()}
            disabled={syncing}
            title={`Pull latest post statuses from ${vendorName(user?.role, 'Metricool')}`}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
            {syncing ? 'Syncing…' : 'Sync Status'}
          </button>
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

      {compose && <ComposeDialog onClose={() => { setCompose(false); setTemplateCaption('') }} initialCaption={templateCaption}/>}
      {briefDialog && <BriefToCalendarDialog onClose={() => setBriefDialog(false)}/>}
      {bulkDialog && <BulkScheduleDialog onClose={() => setBulkDialog(false)}/>}
    </div>
  )
}

export default function PublishingPage() {
  return (
    <Suspense>
      <PublishingPageContent />
    </Suspense>
  )
}
