'use client'

import { useState } from 'react'
import { MessageSquare, Send, EyeOff, AlertOctagon, CheckCircle, Sparkles, RefreshCw } from 'lucide-react'
import { useModerationItems, useUpdateModerationItem } from '@/lib/hooks/use-moderation'
import { useMyAssignedClientIds } from '@/lib/hooks/use-client-assignments'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useClients } from '@/lib/hooks/use-clients'
import { PLATFORM_CONFIG, formatDateTime, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import type { ModerationItem } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50',   icon: MessageSquare },
  replied:   { label: 'Replied',   color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle },
  ignored:   { label: 'Ignored',   color: 'text-slate-600',   bg: 'bg-slate-100',  icon: EyeOff },
  escalated: { label: 'Escalated', color: 'text-red-700',     bg: 'bg-red-50',     icon: AlertOctagon },
}

function ModerationCard({ item }: { item: ModerationItem }) {
  const [reply, setReply] = useState(item.ai_suggested_reply ?? '')
  const [status, setStatus] = useState(item.status)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const { clients } = useClients()
  const updateItem = useUpdateModerationItem()
  const client = clients.find(c => c.id === item.client_id)

  const handleSend = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await fetch('/api/chatwoot/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderation_item_id: item.id, reply_text: reply }),
      })
    } catch { /* DB update below is authoritative */ } finally {
      setSending(false)
    }
    setStatus('replied')
    updateItem.mutate({ id: item.id, status: 'replied', finalReply: reply })
  }
  const platformCfg = PLATFORM_CONFIG[item.platform]
  const statusCfg = STATUS_CONFIG[status]

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'moderation_reply',
          client: client ? { id: client.id, name: client.name, brand_identity: client.brand_identity } : undefined,
          commentText: item.comment_text,
          commenterName: item.commenter_name,
          postCaption: item.post_caption,
          platform: item.platform,
        }),
      })
      const data = await res.json()
      if (res.ok && data.text) {
        setReply(data.text.trim())
      }
    } catch {
      // keep existing reply on failure
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={cn('bg-white rounded-2xl border p-5 transition-all',
      status === 'pending' ? 'border-amber-200' :
      status === 'replied' ? 'border-emerald-200' :
      status === 'escalated' ? 'border-red-200' :
      'border-slate-200')}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Client */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: client?.color }}>
            {client?.initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-900">{item.commenter_name}</span>
              <span className="text-xs text-slate-400">{item.commenter_handle}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PlatformIcon platform={item.platform} size="xs"/>
              <span className="text-[11px] text-slate-400">{platformCfg.label} · {client?.name}</span>
            </div>
          </div>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', statusCfg.bg, statusCfg.color)}>
          <statusCfg.icon className="w-2.5 h-2.5"/>
          {statusCfg.label}
        </span>
      </div>

      {/* Original comment */}
      <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Comment on post</p>
        <p className="text-[11px] text-slate-500 italic mb-1.5">&ldquo;{item.post_caption.slice(0, 80)}…&rdquo;</p>
        <p className="text-sm text-slate-800">&ldquo;{item.comment_text}&rdquo;</p>
        <p className="text-[10px] text-slate-400 mt-1.5">{formatDateTime(item.created_at)}</p>
      </div>

      {/* Reply area */}
      {status === 'pending' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Reply</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"
            >
              {generating
                ? <RefreshCw className="w-3 h-3 animate-spin"/>
                : <Sparkles className="w-3 h-3"/>
              }
              {generating ? 'Generating…' : 'Regenerate with AI'}
            </button>
          </div>

          {reply && (
            <div className="p-2 bg-novax-light rounded-lg border border-novax-border">
              <p className="text-[10px] text-novax-muted font-semibold mb-1">AI Suggested</p>
            </div>
          )}

          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            placeholder="Write a reply…"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!reply.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex-1 justify-center"
            >
              {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>}
              {sending ? 'Sending…' : 'Send Reply'}
            </button>
            <button
              onClick={() => { setStatus('escalated'); updateItem.mutate({ id: item.id, status: 'escalated' }) }}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium rounded-lg transition-colors"
            >
              <AlertOctagon className="w-3.5 h-3.5"/>
              Escalate
            </button>
            <button
              onClick={() => { setStatus('ignored'); updateItem.mutate({ id: item.id, status: 'ignored' }) }}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5"/>
              Ignore
            </button>
          </div>
        </div>
      )}

      {status === 'replied' && item.final_reply && (
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Reply Sent</p>
          <p className="text-sm text-slate-700">&ldquo;{item.final_reply}&rdquo;</p>
        </div>
      )}

      {status === 'replied' && !item.final_reply && reply && (
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Reply Sent</p>
          <p className="text-sm text-slate-700">&ldquo;{reply}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

export default function ModerationPage() {
  useRealtime('moderation_items', ['moderation'])

  const assignedClientIds = useMyAssignedClientIds()
  // Pass assigned clientIds to query; null = no restriction (bypass roles)
  const { items: allItems } = useModerationItems(
    undefined,
    assignedClientIds !== null ? assignedClientIds : undefined
  )
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied' | 'escalated'>('all')

  const filtered = allItems.filter(m => filter === 'all' || m.status === filter)
  const counts = {
    pending: allItems.filter(m => m.status === 'pending').length,
    replied: allItems.filter(m => m.status === 'replied').length,
    escalated: allItems.filter(m => m.status === 'escalated').length,
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: allItems.length, color: 'bg-slate-50 text-slate-600' },
          { label: 'Pending', value: counts.pending, color: 'bg-amber-50 text-amber-600' },
          { label: 'Replied', value: counts.replied, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Escalated', value: counts.escalated, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'replied', 'escalated'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === f ? 'bg-novax text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${counts[f] ?? 0})`}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
          Synced via {vendorName(user?.role, 'Chatwoot')}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(item => <ModerationCard key={item.id} item={item}/>)}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="w-8 h-8 mb-3 text-emerald-400"/>
          <p className="font-medium text-slate-600 mb-1">
            {filter === 'all' ? 'No items in queue' : `No ${filter} items`}
          </p>
          {allItems.length === 0 ? (
            <div className="max-w-sm space-y-1">
              <p className="text-sm text-slate-400">
                Comments and DMs appear here once the messaging platform webhook is active.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Configure the webhook URL in Settings to start receiving items.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              All {filter} items have been handled.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
