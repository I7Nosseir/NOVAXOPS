'use client'

import { useState, useCallback } from 'react'
import { Plus, Sparkles, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { CompetitorCard } from './competitor-card'
import { AddCompetitorDialog } from './add-competitor-dialog'
import type { CompetitorSnapshot } from '@/lib/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

interface DiscoverSuggestion {
  handle: string
  platform: string
  reason: string
}

interface Props {
  clientId: string
  clientName: string
  industry?: string
}

export function CompetitorsPanel({ clientId, clientName, industry }: Props) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([])
  const [addingIdx, setAddingIdx] = useState<number | null>(null)

  const { data, isLoading } = useQuery<{ competitors: CompetitorSnapshot[] }>({
    queryKey: ['competitors', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/performance/competitors?client_id=${clientId}`)
      if (!res.ok) throw new Error('Failed to fetch competitors')
      return res.json() as Promise<{ competitors: CompetitorSnapshot[] }>
    },
  })

  const competitors = data?.competitors ?? []

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['competitors', clientId] })
  }, [queryClient, clientId])

  const handleDelete = async (id: string) => {
    await fetch(`/api/performance/competitors?id=${id}`, { method: 'DELETE' })
    refetch()
  }

  const handleSync = async (_id: string, handle: string, platform: string) => {
    await fetch('/api/competitors/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, handle, platform }),
    })
    refetch()
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    setSuggestions([])
    try {
      const res = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, industry, client_name: clientName }),
      })
      const d = await res.json() as { suggestions?: DiscoverSuggestion[] }
      setSuggestions(d.suggestions ?? [])
    } catch { /* ignore */ }
    finally { setDiscovering(false) }
  }

  const addSuggestion = async (s: DiscoverSuggestion, idx: number) => {
    setAddingIdx(idx)
    try {
      await fetch('/api/performance/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          competitor_handle: s.handle,
          platform: s.platform.toLowerCase(),
          followers: 0, avg_er: 0, posting_frequency: 0,
        }),
      })
      refetch()
      setSuggestions(prev => prev.filter((_, i) => i !== idx))
    } finally { setAddingIdx(null) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
        </p>
        <div className="flex items-center gap-2">
          <button onClick={handleDiscover} disabled={discovering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-novax-muted bg-novax-light border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors disabled:opacity-50">
            {discovering ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
            {discovering ? 'Discovering…' : 'Discover with AI'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors">
            <Plus className="w-3 h-3"/>Add
          </button>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-4 bg-novax-light border border-novax-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-novax-muted uppercase tracking-wider">AI Suggestions</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-novax-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{s.handle}</p>
                <p className="text-[10px] text-novax-muted font-medium">{s.platform}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{s.reason}</p>
              </div>
              <button onClick={() => addSuggestion(s, i)} disabled={addingIdx === i}
                className="flex items-center gap-1 px-2.5 py-1 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0">
                {addingIdx === i ? <Loader2 className="w-3 h-3 animate-spin"/> : <Plus className="w-3 h-3"/>}
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Competitor list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-300"/>
        </div>
      ) : competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <p className="text-sm font-medium text-slate-500">No competitors tracked yet</p>
          <p className="text-xs text-center">Add competitors manually or use &ldquo;Discover with AI&rdquo; to find them.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {competitors.map(c => (
            <CompetitorCard key={c.id} snapshot={c} onDelete={handleDelete} onSync={handleSync}/>
          ))}
        </div>
      )}

      {/* Deep analysis link */}
      {competitors.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <Link
            href={`/studio/competitive?client=${clientId}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors w-full">
            <ExternalLink className="w-4 h-4"/>
            Run Competitive Intelligence Analysis
          </Link>
        </div>
      )}

      {showAdd && (
        <AddCompetitorDialog
          clientId={clientId}
          onClose={() => setShowAdd(false)}
          onAdded={refetch}
        />
      )}
    </div>
  )
}
