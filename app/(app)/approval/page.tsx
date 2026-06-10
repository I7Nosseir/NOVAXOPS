'use client'

import { useState, useRef } from 'react'
import { CheckCircle, Clock, XCircle, Plus, Copy, ChevronDown, X, Send, Loader2, Upload, ImageIcon, Mail, Trash2, FileImage } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { usePosts } from '@/lib/hooks/use-posts'
import { useApprovalRequests, useCreateApproval } from '@/lib/hooks/use-approvals'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { formatDate, cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { supabase } from '@/lib/supabase'

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

type AdhocDraft = { id: string; mediaUrl: string | null; caption: string; uploading: boolean }

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
  // Per-post media upload state: postId → { uploading, url }
  const [postMedia, setPostMedia] = useState<Record<string, { uploading: boolean; url: string | null }>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // Ad-hoc items (custom posts not from scheduled_posts)
  const [adhocItems, setAdhocItems] = useState<AdhocDraft[]>([])
  const adhocRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const clientPosts = posts.filter(p => p.client_id === clientId && p.status !== 'published')

  const toggle = (id: string) =>
    setSelectedPosts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleMediaUpload = async (postId: string, file: File) => {
    setPostMedia(prev => ({ ...prev, [postId]: { uploading: true, url: null } }))
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `approval-media/${Date.now()}-${postId}.${ext}`
      const { data, error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (error || !data) throw error ?? new Error('Upload failed')
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(data.path)
      await supabase.from('scheduled_posts').update({ media_urls: [publicUrl] }).eq('id', postId)
      setPostMedia(prev => ({ ...prev, [postId]: { uploading: false, url: publicUrl } }))
    } catch {
      setPostMedia(prev => ({ ...prev, [postId]: { uploading: false, url: null } }))
    }
  }

  const addAdhocItem = () => {
    setAdhocItems(prev => [...prev, { id: crypto.randomUUID(), mediaUrl: null, caption: '', uploading: false }])
  }

  const removeAdhocItem = (id: string) => {
    setAdhocItems(prev => prev.filter(x => x.id !== id))
  }

  const handleAdhocUpload = async (id: string, file: File) => {
    setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, uploading: true } : x))
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `approval-media/adhoc-${Date.now()}-${id.slice(0, 8)}.${ext}`
      const { data, error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (error || !data) throw error ?? new Error('Upload failed')
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(data.path)
      setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, uploading: false, mediaUrl: publicUrl } : x))
    } catch {
      setAdhocItems(prev => prev.map(x => x.id === id ? { ...x, uploading: false } : x))
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
          ...(x.mediaUrl ? { media_url: x.mediaUrl } : {}),
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
                    const existingUrl = (post as { media_url?: string }).media_url
                    const previewUrl = media?.url ?? existingUrl ?? null
                    const isSelected = selectedPosts.includes(post.id)
                    return (
                      <div
                        key={post.id}
                        className={cn(
                          'rounded-xl border transition-all overflow-hidden',
                          isSelected ? 'border-novax shadow-sm' : 'border-slate-200 hover:border-slate-300',
                        )}
                      >
                        {/* Card row */}
                        <label className="flex items-start gap-0 cursor-pointer">
                          {/* Thumbnail */}
                          <div
                            className={cn(
                              'relative w-[72px] shrink-0 self-stretch bg-slate-100 flex items-center justify-center transition-colors',
                              isSelected && 'bg-novax-light',
                            )}
                            onClick={() => toggle(post.id)}
                          >
                            {previewUrl ? (
                              /\.(mp4|mov|webm)/i.test(previewUrl)
                                // eslint-disable-next-line jsx-a11y/media-has-caption
                                ? <video src={previewUrl} className="w-full h-full object-cover min-h-[72px]"/>
                                // eslint-disable-next-line @next/next/no-img-element
                                : <img src={previewUrl} alt="" className="w-full h-full object-cover min-h-[72px]"/>
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-300"/>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-novax/10 flex items-end justify-end p-1">
                                <CheckCircle className="w-4 h-4 text-novax"/>
                              </div>
                            )}
                          </div>

                          {/* Meta */}
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

                        {/* Media upload — shown when selected */}
                        {isSelected && (
                          <div className="border-t border-novax-light px-3 pb-3 pt-2 bg-novax-light/30">
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              ref={el => { fileInputRefs.current[post.id] = el }}
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) handleMediaUpload(post.id, file)
                                e.target.value = ''
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[post.id]?.click()}
                              disabled={media?.uploading}
                              className="flex items-center gap-1.5 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                            >
                              {media?.uploading ? (
                                <><Loader2 className="w-3 h-3 animate-spin"/> Uploading…</>
                              ) : previewUrl ? (
                                <><Upload className="w-3 h-3"/> Replace media</>
                              ) : (
                                <><Upload className="w-3 h-3"/> Add media for client preview</>
                              )}
                            </button>
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
                <button
                  type="button"
                  onClick={addAdhocItem}
                  className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                >
                  <Plus className="w-3 h-3"/>
                  Add post
                </button>
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
                        {/* Media upload */}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          ref={el => { adhocRefs.current[item.id] = el }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleAdhocUpload(item.id, file)
                            e.target.value = ''
                          }}
                        />
                        {item.mediaUrl ? (
                          <div className="flex items-center gap-2">
                            {/\.(mp4|mov|webm)/i.test(item.mediaUrl)
                              // eslint-disable-next-line jsx-a11y/media-has-caption
                              ? <video src={item.mediaUrl} className="w-16 h-16 rounded-lg object-cover bg-slate-100"/>
                              // eslint-disable-next-line @next/next/no-img-element
                              : <img src={item.mediaUrl} alt="" className="w-16 h-16 rounded-lg object-cover"/>
                            }
                            <button
                              type="button"
                              onClick={() => adhocRefs.current[item.id]?.click()}
                              className="text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
                            >
                              Replace media
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => adhocRefs.current[item.id]?.click()}
                            disabled={item.uploading}
                            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-novax px-3 py-2 border border-dashed border-slate-300 hover:border-novax-border rounded-lg transition-colors w-full justify-center"
                          >
                            {item.uploading
                              ? <><Loader2 className="w-3 h-3 animate-spin"/> Uploading…</>
                              : <><FileImage className="w-3 h-3"/> Upload media (optional)</>
                            }
                          </button>
                        )}
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

                    {/* ── Scheduled posts — two-column layout ── */}
                    {posts.map(post => {
                      const postStatus = req.post_statuses[post.id] ?? 'pending'
                      const postNote = req.post_notes[post.id]
                      const badge = POST_STATUS_BADGE[postStatus as keyof typeof POST_STATUS_BADGE] ?? POST_STATUS_BADGE.pending

                      return (
                        <div key={post.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                          <div className="grid grid-cols-[112px_1fr]">
                            {/* Media column */}
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

                            {/* Content column */}
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

                    {/* ── Ad-hoc items — same two-column layout ── */}
                    {(req.items ?? []).map(item => {
                      const itemStatus = req.post_statuses[item.id] ?? 'pending'
                      const itemNote = req.post_notes[item.id]
                      const badge = POST_STATUS_BADGE[itemStatus as keyof typeof POST_STATUS_BADGE] ?? POST_STATUS_BADGE.pending

                      return (
                        <div key={item.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                          <div className="grid grid-cols-[112px_1fr]">
                            {/* Media column */}
                            <div className="bg-slate-200 flex items-center justify-center min-h-[100px]">
                              {item.media_url ? (
                                /\.(mp4|mov|webm)/i.test(item.media_url)
                                  // eslint-disable-next-line jsx-a11y/media-has-caption
                                  ? <video src={item.media_url} className="w-full h-full object-cover"/>
                                  // eslint-disable-next-line @next/next/no-img-element
                                  : <img src={item.media_url} alt="" className="w-full h-full object-cover"/>
                              ) : (
                                <FileImage className="w-6 h-6 text-slate-400"/>
                              )}
                            </div>

                            {/* Content column */}
                            <div className="p-3 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="mb-1.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Custom Post</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{item.caption}</p>
                              </div>
                              <span className={cn(
                                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-2 self-start',
                                badge.bg, badge.color,
                              )}>
                                {badge.label}
                              </span>
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
