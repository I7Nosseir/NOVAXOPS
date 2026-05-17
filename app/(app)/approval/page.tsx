'use client'

import { useState } from 'react'
import { CheckCircle, Clock, XCircle, Plus, Copy, ChevronDown, X, Send, Loader2 } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { usePosts } from '@/lib/hooks/use-posts'
import { useApprovalRequests, useCreateApproval } from '@/lib/hooks/use-approvals'
import { formatDate, cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'

const STATUS_CONFIG = {
  pending:           { label: 'Awaiting Review', color: 'text-amber-600',   bg: 'bg-amber-50',   icon: Clock },
  approved:          { label: 'Approved',         color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
  changes_requested: { label: 'Changes Requested', color: 'text-red-600',   bg: 'bg-red-50',     icon: XCircle },
}

function CreateApprovalDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const { posts } = usePosts()
  const createApproval = useCreateApproval()
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [expiry, setExpiry] = useState('7')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const clientPosts = posts.filter(p => p.client_id === clientId && p.status !== 'published')

  const toggle = (id: string) =>
    setSelectedPosts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleCreate = () => {
    createApproval.mutate(
      { client_id: clientId, title, post_ids: selectedPosts, expiry_days: parseInt(expiry) },
      {
        onSuccess: (data) => setCreatedToken(data.token),
      }
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
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">New Approval Request</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {createdToken ? (
          <div className="px-6 py-10 text-center">
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
          <div className="px-6 py-5 space-y-4">
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Request Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. May 2026 Campaign Content"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Select Posts ({selectedPosts.length} selected)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clientPosts.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No scheduled posts for this client</p>
                )}
                {clientPosts.map(post => (
                  <label
                    key={post.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedPosts.includes(post.id) ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPosts.includes(post.id)}
                      onChange={() => toggle(post.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {post.platforms.map(p => <PlatformIcon key={p} platform={p} size="xs"/>)}
                        <span className="text-[10px] text-slate-400">{formatDate(post.scheduled_at)}</span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2">{post.caption}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
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
                disabled={!title || selectedPosts.length === 0 || createApproval.isPending}
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
                      {posts.length} posts · {approvedCount} approved · Expires {formatDate(req.expires_at)}
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

                {/* Expanded: posts */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-3">
                    {req.client_note && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Client note</p>
                        <p className="text-xs text-amber-800">{req.client_note}</p>
                      </div>
                    )}
                    {posts.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Post data unavailable</p>
                    )}
                    {posts.map(post => {
                      const postStatus = req.post_statuses[post.id] ?? 'pending'
                      const dotColors: Record<string, string> = {
                        pending: 'bg-amber-400', approved: 'bg-emerald-400', changes_requested: 'bg-red-400',
                      }
                      return (
                        <div key={post.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          {post.media_url && (
                            <img src={post.media_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0"/>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {post.platforms.map(p => <PlatformIcon key={p} platform={p} size="xs"/>)}
                              <span className="text-[10px] text-slate-400">{formatDate(post.scheduled_at)}</span>
                            </div>
                            <p className="text-xs text-slate-700 line-clamp-2">{post.caption}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className={cn('w-2 h-2 rounded-full', dotColors[postStatus])}/>
                            <span className="text-[11px] text-slate-600 capitalize">{postStatus.replace('_', ' ')}</span>
                          </div>
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
