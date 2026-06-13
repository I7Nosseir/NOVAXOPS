'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, XCircle, Plus, Copy, ChevronDown, X, Send, Loader2, Upload, ImageIcon, Mail, Trash2, FileImage, Link2, Download, TableProperties, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useClients } from '@/lib/hooks/use-clients'
import { usePosts } from '@/lib/hooks/use-posts'
import { useApprovalRequests, useCreateApproval } from '@/lib/hooks/use-approvals'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { formatDate, cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { supabase } from '@/lib/supabase'
import { convertGoogleDriveUrl } from '@/lib/google-drive'

const STATUS_CONFIG = {
  pending:           { label: 'Awaiting Review', color: 'text-amber-600',   bg: 'bg-amber-50',   icon: Clock },
  approved:          { label: 'Approved',         color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
  changes_requested: { label: 'Changes Requested', color: 'text-red-600',   bg: 'bg-red-50',     icon: XCircle },
}

const POST_STATUS_BADGE = {
  pending:           { label: 'Pending',           color: 'text-amber-600',   bg: 'bg-amber-50'   },
  approved:          { label: 'Approved',           color: 'text-emerald-600', bg: 'bg-emerald-50' },
  changes_requested: { label: 'Changes Requested',  color: 'text-red-600',    bg: 'bg-red-50'     },
}

type AdhocDraft = {
  id: string
  mediaUrls: string[]
  driveInput: string
  caption: string
  uploading: boolean
}

// ─── Thumbnail strip for multi-slide preview ─────────────────────────────────
function MediaStrip({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0)
  if (urls.length === 0) return null
  const url = urls[idx]
  const isVideo = /\.(mp4|mov|webm)/i.test(url)

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-lg overflow-hidden bg-slate-100 aspect-square w-20 flex items-center justify-center">
        {isVideo
          // eslint-disable-next-line jsx-a11y/media-has-caption
          ? <video src={url} className="w-full h-full object-cover"/>
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt="" className="w-full h-full object-cover"/>
        }
        {urls.length > 1 && (
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
            {idx + 1}/{urls.length}
          </span>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-0.5 rounded border border-slate-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-3 h-3 text-slate-500"/>
          </button>
          <button
            type="button"
            onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
            disabled={idx === urls.length - 1}
            className="p-0.5 rounded border border-slate-200 disabled:opacity-30"
          >
            <ChevronRight className="w-3 h-3 text-slate-500"/>
          </button>
        </div>
      )}
    </div>
  )
}

function CreateApprovalDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const { posts } = usePosts()
  const createApproval = useCreateApproval()
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [expiry, setExpiry] = useState('7')
  const [contactEmail, setContactEmail] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Scheduled post media: postId → { uploading, urls }
  const [postMedia, setPostMedia] = useState<Record<string, { uploading: boolean; urls: string[] }>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Ad-hoc items
  const [adhocItems, setAdhocItems] = useState<AdhocDraft[]>([])
  const adhocRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const clientPosts = posts.filter(p => p.client_id === clientId && p.status !== 'published')

  const toggle = (id: string) =>
    setSelectedPosts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // ── Scheduled post: multi-file carousel upload ────────────────────────────
  const handleMediaUpload = async (postId: string, files: FileList) => {
    setPostMedia(prev => ({ ...prev, [postId]: { uploading: true, urls: prev[postId]?.urls ?? [] } }))
    const uploaded: string[] = []
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `approval-media/${Date.now()}-${postId}-${uploaded.length}.${ext}`
        const { data, error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (error || !data) continue
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(data.path)
        uploaded.push(publicUrl)
      }
      const existing = postMedia[postId]?.urls ?? []
      const allUrls = [...existing, ...uploaded]
      await supabase.from('scheduled_posts').update({ media_urls: allUrls }).eq('id', postId)
      setPostMedia(prev => ({ ...prev, [postId]: { uploading: false, urls: allUrls } }))
    } catch {
      setPostMedia(prev => ({ ...prev, [postId]: { uploading: false, urls: postMedia[postId]?.urls ?? [] } }))
    }
  }

  // ── Adhoc: multi-file upload ──────────────────────────────────────────────
  const handleAdhocUpload = async (id: string, files: FileList) => {
    setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, uploading: true } : x))
    const uploaded: string[] = []
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `approval-media/adhoc-${Date.now()}-${id.slice(0, 8)}-${uploaded.length}.${ext}`
        const { data, error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (error || !data) continue
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(data.path)
        uploaded.push(publicUrl)
      }
      setAdhocItems(prev => prev.map(x => x.id === id
        ? { ...x, uploading: false, mediaUrls: [...x.mediaUrls, ...uploaded] }
        : x
      ))
    } catch {
      setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, uploading: false } : x))
    }
  }

  // ── Adhoc: Drive URL resolve ──────────────────────────────────────────────
  const handleDriveInput = (id: string, raw: string) => {
    setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, driveInput: raw } : x))
    if (!raw.trim()) return
    const { url, wasDrive } = convertGoogleDriveUrl(raw.trim())
    if (!wasDrive) return
    const resolved = url.startsWith('/') ? `${window.location.origin}${url}` : url
    setAdhocItems(prev => prev.map(x =>
      x.id === id ? { ...x, mediaUrls: [...x.mediaUrls, resolved], driveInput: '' } : x
    ))
  }

  const removeAdhocMedia = (id: string, urlIdx: number) => {
    setAdhocItems(prev => prev.map(x =>
      x.id === id ? { ...x, mediaUrls: x.mediaUrls.filter((_, i) => i !== urlIdx) } : x
    ))
  }

  const addAdhocItem = () => {
    setAdhocItems(prev => [...prev, { id: crypto.randomUUID(), mediaUrls: [], driveInput: '', caption: '', uploading: false }])
  }

  const removeAdhocItem = (id: string) => {
    setAdhocItems(prev => prev.filter(x => x.id !== id))
  }

  // ── Bulk CSV: download template ──────────────────────────────────────────
  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const headers = ['Caption', 'Media URL', 'Carousel URLs']
    const example = [
      'Your post caption goes here.',
      'https://drive.google.com/file/d/SLIDE1_ID/view',
      'https://drive.google.com/file/d/SLIDE2_ID/view|https://drive.google.com/file/d/SLIDE3_ID/view',
    ]
    const info = [
      ['NOVAX Ops — Approval Bulk Import Template'],
      [''],
      ['Column', 'Description'],
      ['Caption', 'The post caption or description (required)'],
      ['Media URL', 'Google Drive share link or public URL for the main image/video (optional)'],
      ['Carousel URLs', 'Additional slides — URLs separated by a pipe |  (optional)'],
      [''],
      ['Tips'],
      ['• Google Drive links are auto-converted — paste the share URL directly.'],
      ['• File must be shared as "Anyone with the link can view" in Google Drive.'],
      ['• Carousel: put the first image in "Media URL", then extra slides in "Carousel URLs" separated by |'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(info)
    wsInfo['!cols'] = [{ wch: 16 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions')

    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = [{ wch: 60 }, { wch: 60 }, { wch: 80 }]
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, 'Approval')
    XLSX.writeFile(wb, 'NOVAX_Approval_Bulk_Template.xlsx')
  }

  // ── Bulk CSV: import ─────────────────────────────────────────────────────
  async function handleImportFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheetName =
        wb.SheetNames.find(n => n.toLowerCase().includes('approval')) ?? wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows2d = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
      const headerIdx = rows2d.findIndex(r => r.some(c => String(c).toLowerCase().includes('caption')))
      if (headerIdx === -1) return
      const headers = rows2d[headerIdx].map(h => String(h).toLowerCase().trim())
      const col = (name: string) => headers.findIndex(h => h.includes(name))
      const iCapt = col('caption')
      const iUrl = col('media')
      const iCarousel = col('carousel')

      const imported: AdhocDraft[] = []
      for (let i = headerIdx + 1; i < rows2d.length; i++) {
        const r = rows2d[i]
        const caption = iCapt >= 0 ? String(r[iCapt] ?? '').trim() : ''
        if (!caption) continue

        const rawUrl = iUrl >= 0 ? String(r[iUrl] ?? '').trim() : ''
        const { url: mainUrl, wasDrive } = convertGoogleDriveUrl(rawUrl)
        const resolvedMain = wasDrive && mainUrl.startsWith('/') ? `${window.location.origin}${mainUrl}` : mainUrl

        const rawCarousel = iCarousel >= 0 ? String(r[iCarousel] ?? '').trim() : ''
        const extraUrls = rawCarousel
          .split('|')
          .map(u => u.trim())
          .filter(Boolean)
          .map(u => {
            const { url: cu, wasDrive: wd } = convertGoogleDriveUrl(u)
            return wd && cu.startsWith('/') ? `${window.location.origin}${cu}` : cu
          })

        const mediaUrls = [resolvedMain, ...extraUrls].filter(Boolean)

        imported.push({
          id: crypto.randomUUID(),
          caption,
          mediaUrls,
          driveInput: '',
          uploading: false,
        })
      }
      if (imported.length > 0) setAdhocItems(prev => [...prev, ...imported])
    } catch {
      // silently ignore parse errors
    }
  }

  const hasContent = selectedPosts.length > 0 || adhocItems.some(x => x.caption.trim())

  const handleCreate = () => {
    const selectedClient = clients.find(c => c.id === clientId)
    createApproval.mutate(
      {
        client_id: clientId,
        title,
        post_ids: selectedPosts,
        expiry_days: parseInt(expiry),
        ad_hoc_items: adhocItems.filter(x => x.caption.trim()).map(x => ({
          caption: x.caption,
          media_urls: x.mediaUrls.length > 0 ? x.mediaUrls : undefined,
          media_url: x.mediaUrls[0] ?? undefined,
        })),
        ...(contactEmail ? { client_email: contactEmail, client_name: selectedClient?.name } : {}),
      },
      { onSuccess: (data) => setCreatedToken(data.token) }
    )
  }

  const approvalUrl = createdToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/approval/${createdToken}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(approvalUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const bulkImportRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-900">New Approval Request</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {createdToken ? (
          <div className="px-6 py-10 text-center overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-500"/>
            </div>
            <p className="font-semibold text-slate-900 mb-1">Approval link created</p>
            <p className="text-sm text-slate-500 mb-4">Share this link with your client. Expires in {expiry} days.</p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-6">
              <code className="flex-1 text-xs text-slate-700 font-mono truncate">{approvalUrl}</code>
              <button onClick={copyLink} className="text-novax-muted hover:text-novax transition-colors shrink-0" title="Copy link">
                <Copy className="w-3.5 h-3.5"/>
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 mb-4">Copied to clipboard</p>}
            <button onClick={onClose} className="px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={e => { setClientId(e.target.value); setSelectedPosts([]) }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Request Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. May 2026 Campaign Content"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
              />
            </div>

            {/* ── Scheduled posts picker ── */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Select Scheduled Posts
                {selectedPosts.length > 0 && (
                  <span className="ml-1.5 text-novax-muted font-normal">({selectedPosts.length} selected)</span>
                )}
              </label>
              {clientPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-400">No scheduled posts for this client.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add custom posts below instead.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {clientPosts.map(post => {
                    const media = postMedia[post.id]
                    const existingUrls: string[] = (post as { media_urls?: string[] }).media_urls ?? ((post as { media_url?: string }).media_url ? [(post as { media_url?: string }).media_url!] : [])
                    const previewUrls = media?.urls.length ? media.urls : existingUrls
                    const isSelected = selectedPosts.includes(post.id)
                    return (
                      <div
                        key={post.id}
                        className={cn(
                          'rounded-xl border transition-all overflow-hidden',
                          isSelected ? 'border-novax shadow-sm' : 'border-slate-200 hover:border-slate-300',
                        )}
                      >
                        <label className="flex items-start gap-0 cursor-pointer">
                          <div
                            className={cn(
                              'relative w-[72px] shrink-0 self-stretch bg-slate-100 flex items-center justify-center transition-colors',
                              isSelected && 'bg-novax-light',
                            )}
                            onClick={() => toggle(post.id)}
                          >
                            {previewUrls.length > 0 ? (
                              /\.(mp4|mov|webm)/i.test(previewUrls[0])
                                // eslint-disable-next-line jsx-a11y/media-has-caption
                                ? <video src={previewUrls[0]} className="w-full h-full object-cover min-h-[72px]"/>
                                // eslint-disable-next-line @next/next/no-img-element
                                : <img src={previewUrls[0]} alt="" className="w-full h-full object-cover min-h-[72px]"/>
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-300"/>
                            )}
                            {previewUrls.length > 1 && (
                              <span className="absolute top-1 right-1 bg-black/60 text-white text-[8px] px-1 rounded">
                                +{previewUrls.length - 1}
                              </span>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-novax/10 flex items-end justify-end p-1">
                                <CheckCircle className="w-4 h-4 text-novax"/>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              {post.platforms.map(p => <PlatformIcon key={p} platform={p} size="xs"/>)}
                              <span className="text-[10px] text-slate-400 ml-auto">{formatDate(post.scheduled_at)}</span>
                            </div>
                            <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">{post.caption}</p>
                          </div>

                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(post.id)}
                            className="sr-only"
                          />
                        </label>

                        {isSelected && (
                          <div className="border-t border-novax-light px-3 pb-3 pt-2 bg-novax-light/30">
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              className="hidden"
                              ref={el => { fileInputRefs.current[post.id] = el }}
                              onChange={e => {
                                const files = e.target.files
                                if (files?.length) handleMediaUpload(post.id, files)
                                e.target.value = ''
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[post.id]?.click()}
                                disabled={media?.uploading}
                                className="flex items-center gap-1.5 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                              >
                                {media?.uploading ? (
                                  <><Loader2 className="w-3 h-3 animate-spin"/> Uploading…</>
                                ) : previewUrls.length > 0 ? (
                                  <><Upload className="w-3 h-3"/> Add more slides ({previewUrls.length})</>
                                ) : (
                                  <><Upload className="w-3 h-3"/> Add media for client preview</>
                                )}
                              </button>
                              {previewUrls.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPostMedia(prev => ({ ...prev, [post.id]: { uploading: false, urls: [] } }))}
                                  className="text-[11px] text-red-400 hover:text-red-600 font-medium transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Custom posts (ad-hoc) ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  Custom Posts
                  <span className="font-normal text-slate-400 ml-1">(unscheduled content)</span>
                </label>
                <div className="flex items-center gap-2">
                  {/* Bulk import */}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    ref={bulkImportRef}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = '' }}
                  />
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
                    title="Download bulk import template"
                  >
                    <Download className="w-3 h-3"/>
                    Template
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkImportRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                    title="Import from Excel/CSV"
                  >
                    <TableProperties className="w-3 h-3"/>
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={addAdhocItem}
                    className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3"/>
                    Add post
                  </button>
                </div>
              </div>
              {adhocItems.length === 0 ? (
                <p className="text-xs text-slate-400">No custom posts added. Use this for content not yet scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {adhocItems.map((item, idx) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500">Custom Post {idx + 1}</span>
                        <button type="button" onClick={() => removeAdhocItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {/* Media section */}
                        <div className="flex gap-3">
                          {/* Thumbnail strip */}
                          {item.mediaUrls.length > 0 && (
                            <div className="relative">
                              <MediaStrip urls={item.mediaUrls}/>
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            {/* Upload files */}
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              className="hidden"
                              ref={el => { adhocRefs.current[item.id] = el }}
                              onChange={e => {
                                const files = e.target.files
                                if (files?.length) handleAdhocUpload(item.id, files)
                                e.target.value = ''
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => adhocRefs.current[item.id]?.click()}
                              disabled={item.uploading}
                              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-novax px-3 py-1.5 border border-dashed border-slate-300 hover:border-novax-border rounded-lg transition-colors w-full justify-center"
                            >
                              {item.uploading
                                ? <><Loader2 className="w-3 h-3 animate-spin"/> Uploading…</>
                                : <><FileImage className="w-3 h-3"/> {item.mediaUrls.length > 0 ? 'Add more slides' : 'Upload files'}</>
                              }
                            </button>

                            {/* Drive URL input */}
                            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                              <Link2 className="w-3 h-3 text-slate-400 shrink-0"/>
                              <input
                                type="text"
                                value={item.driveInput}
                                onChange={e => handleDriveInput(item.id, e.target.value)}
                                placeholder="Paste Google Drive URL…"
                                className="text-[11px] text-slate-700 flex-1 outline-none bg-transparent placeholder:text-slate-400"
                              />
                            </div>

                            {/* Remove individual slides */}
                            {item.mediaUrls.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.mediaUrls.map((_, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => removeAdhocMedia(item.id, i)}
                                    className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 border border-red-100 rounded transition-colors"
                                  >
                                    Remove slide {i + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Caption */}
                        <textarea
                          value={item.caption}
                          onChange={e => setAdhocItems(prev => prev.map(x => x.id === item.id ? { ...x, caption: e.target.value } : x))}
                          rows={2}
                          placeholder="Caption or description for this post…"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expiry */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expires in</label>
              <div className="flex gap-2">
                {['3', '5', '7', '14'].map(d => (
                  <button
                    key={d}
                    onClick={() => setExpiry(d)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      expiry === d ? 'bg-novax border-novax text-white' : 'border-slate-200 text-slate-600 hover:border-novax-border',
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client contact email
                <span className="font-normal text-slate-400 ml-1">(optional — sends an email with the review link)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
                />
              </div>
            </div>

            {createApproval.error && (
              <p className="text-xs text-red-600">{(createApproval.error as Error).message}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!title || !hasContent || createApproval.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {createApproval.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                ) : (
                  <Send className="w-3.5 h-3.5"/>
                )}
                {createApproval.isPending ? 'Creating…' : 'Create & Share Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApprovalPage() {
  useRealtime('approval_requests', ['approvals'])
  useRealtime('approval_post_statuses', ['approvals'])

  const router = useRouter()
  const { clients } = useClients()
  const { posts: allPosts } = usePosts()
  const { requests, isLoading } = useApprovalRequests()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/approval/${token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const scheduleItem = (caption: string, mediaUrls: string[]) => {
    const params = new URLSearchParams()
    params.set('caption', encodeURIComponent(caption))
    if (mediaUrls.length > 0) params.set('media_urls', encodeURIComponent(mediaUrls.join('|')))
    router.push(`/publishing?${params.toString()}`)
  }

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    changes_requested: requests.filter(r => r.status === 'changes_requested').length,
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Share content with clients for review. Track approvals and revision requests in one place.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5"/>
          New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Awaiting Review', value: stats.pending,            color: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Approved',        value: stats.approved,           color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Changes Needed',  value: stats.changes_requested,  color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold', bg, color)}>{value}</div>
            <p className="text-sm font-medium text-slate-700">{label}</p>
          </div>
        ))}
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-novax-muted animate-spin"/>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-400">No approval requests yet. Create one to share content with a client.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const client = clients.find(c => c.id === req.client_id)
            const cfg = STATUS_CONFIG[req.status]
            const StatusIcon = cfg.icon
            const isOpen = expanded === req.id
            const posts = allPosts.filter(p => req.post_ids.includes(p.id))
            const totalItems = posts.length + (req.items?.length ?? 0)
            const approvedCount = Object.values(req.post_statuses).filter(s => s === 'approved').length

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : req.id)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: client?.color }}>
                    {client?.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{req.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {totalItems} post{totalItems !== 1 ? 's' : ''} · {approvedCount} approved · Expires {formatDate(req.expires_at)}
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.color)}>
                    <StatusIcon className="w-3 h-3"/>
                    {cfg.label}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); copyLink(req.token) }}
                      className="flex items-center gap-1.5 text-xs text-novax-muted hover:text-novax font-medium transition-colors"
                      title="Copy client link"
                    >
                      <Copy className="w-3.5 h-3.5"/>
                      {copied === req.token ? 'Copied!' : 'Copy Link'}
                    </button>
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')}/>
                  </div>
                </div>

                {/* Expanded: posts + ad-hoc items */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-3">
                    {req.client_note && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Client note</p>
                        <p className="text-xs text-amber-800">{req.client_note}</p>
                      </div>
                    )}

                    {totalItems === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Post data unavailable</p>
                    )}

                    {/* ── Scheduled posts ── */}
                    {posts.map(post => {
                      const postStatus = req.post_statuses[post.id] ?? 'pending'
                      const postNote = req.post_notes[post.id]
                      const badge = POST_STATUS_BADGE[postStatus as keyof typeof POST_STATUS_BADGE] ?? POST_STATUS_BADGE.pending

                      return (
                        <div key={post.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                          <div className="grid grid-cols-[112px_1fr]">
                            <div className="bg-slate-200 flex items-center justify-center min-h-[100px]">
                              {post.media_url ? (
                                /\.(mp4|mov|webm)/i.test(post.media_url)
                                  // eslint-disable-next-line jsx-a11y/media-has-caption
                                  ? <video src={post.media_url} className="w-full h-full object-cover"/>
                                  // eslint-disable-next-line @next/next/no-img-element
                                  : <img src={post.media_url} alt="" className="w-full h-full object-cover"/>
                              ) : (
                                <ImageIcon className="w-6 h-6 text-slate-400"/>
                              )}
                            </div>
                            <div className="p-3 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                  {post.platforms.map(p => <PlatformIcon key={p} platform={p} size="xs"/>)}
                                  <span className="text-[10px] text-slate-400 ml-auto">{formatDate(post.scheduled_at)}</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{post.caption}</p>
                              </div>
                              <span className={cn(
                                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-2 self-start',
                                badge.bg, badge.color,
                              )}>
                                {badge.label}
                              </span>
                            </div>
                          </div>

                          {postNote && (
                            <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                              <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg mt-2">
                                <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Client note</p>
                                <p className="text-xs text-amber-800">{postNote}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* ── Ad-hoc items ── */}
                    {(req.items ?? []).map(item => {
                      const itemStatus = req.post_statuses[item.id] ?? 'pending'
                      const itemNote = req.post_notes[item.id]
                      const badge = POST_STATUS_BADGE[itemStatus as keyof typeof POST_STATUS_BADGE] ?? POST_STATUS_BADGE.pending
                      const isApproved = itemStatus === 'approved'
                      const itemMediaUrls: string[] = (item as { media_urls?: string[] }).media_urls
                        ?? (item.media_url ? [item.media_url] : [])
                      const isVideo = (url: string) => /\.(mp4|mov|webm)/i.test(url)

                      return (
                        <div key={item.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                          <div className="grid grid-cols-[112px_1fr]">
                            <div className="bg-slate-200 flex items-center justify-center min-h-[100px] relative">
                              {itemMediaUrls.length > 0 ? (
                                isVideo(itemMediaUrls[0]) ? (
                                  // eslint-disable-next-line jsx-a11y/media-has-caption
                                  <video src={itemMediaUrls[0]} className="w-full h-full object-cover"/>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={itemMediaUrls[0]} alt="" className="w-full h-full object-cover"/>
                                )
                              ) : (
                                <FileImage className="w-6 h-6 text-slate-400"/>
                              )}
                              {itemMediaUrls.length > 1 && (
                                <span className="absolute top-1 right-1 bg-black/60 text-white text-[8px] px-1 rounded">
                                  {itemMediaUrls.length} slides
                                </span>
                              )}
                            </div>
                            <div className="p-3 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="mb-1.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Custom Post</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{item.caption}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className={cn(
                                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                                  badge.bg, badge.color,
                                )}>
                                  {badge.label}
                                </span>
                                {isApproved && (
                                  <button
                                    type="button"
                                    onClick={() => scheduleItem(item.caption, itemMediaUrls)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-novax text-white hover:bg-novax-hover transition-colors"
                                  >
                                    <CalendarPlus className="w-3 h-3"/>
                                    Schedule
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {itemNote && (
                            <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                              <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg mt-2">
                                <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Client note</p>
                                <p className="text-xs text-amber-800">{itemNote}</p>
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
          })}
        </div>
      )}

      {showCreate && <CreateApprovalDialog onClose={() => setShowCreate(false)}/>}
    </div>
  )
}
