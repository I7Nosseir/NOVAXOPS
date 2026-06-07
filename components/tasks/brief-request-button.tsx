'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Copy, Check, Clock, Loader2, ExternalLink, FileCheck } from 'lucide-react'
import type { ContentBriefRequest } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  taskId: string
  clientId: string
}

export function BriefRequestButton({ taskId, clientId }: Props) {
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const { data: briefRequest, isPending } = useQuery<ContentBriefRequest | null>({
    queryKey: ['brief-request', taskId],
    queryFn: () =>
      fetch(`/api/brief-requests?task_id=${taskId}`)
        .then(r => r.json()),
    staleTime: 30_000,
  })

  const copyLink = () => {
    if (!briefRequest?.token) return
    const link = `${window.location.origin}/brief/${briefRequest.token}`
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const createRequest = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/brief-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, client_id: clientId }),
      })
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ['brief-request', taskId] })
      }
    } finally {
      setCreating(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading…</span>
      </div>
    )
  }

  // No brief request yet
  if (!briefRequest) {
    return (
      <button
        onClick={createRequest}
        disabled={creating}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors',
          'text-novax-muted bg-novax-light border border-novax-border hover:bg-novax-light-hover',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {creating
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Link2 className="w-3 h-3" />
        }
        {creating ? 'Generating link…' : 'Request Brief from Client'}
      </button>
    )
  }

  // Already submitted
  if (briefRequest.status === 'submitted') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          <FileCheck className="w-3 h-3" />
          Brief received
        </div>
        <a
          href={`/brief/${briefRequest.token}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View submitted brief"
          className="p-1.5 text-slate-400 hover:text-novax transition-colors rounded-lg hover:bg-slate-100"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    )
  }

  // Expired
  if (briefRequest.status === 'expired') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 italic">Link expired</span>
        <button
          onClick={createRequest}
          disabled={creating}
          className="text-xs font-semibold text-novax-muted hover:text-novax transition-colors disabled:opacity-50"
        >
          {creating ? 'Generating…' : 'Generate new link'}
        </button>
      </div>
    )
  }

  // Pending — show status + copy link
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
        <Clock className="w-3 h-3" />
        Awaiting client
      </div>
      <button
        onClick={copyLink}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
          'text-novax-muted bg-novax-light border border-novax-border hover:bg-novax-light-hover',
        )}
      >
        {copied
          ? <Check className="w-3 h-3 text-emerald-500" />
          : <Copy className="w-3 h-3" />
        }
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  )
}
