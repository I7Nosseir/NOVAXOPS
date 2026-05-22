'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, Share2, Search, ChevronDown, Loader2 } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { DocShareDialog } from '@/components/docs/doc-share-dialog'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Document {
  id: string
  title: string
  client_id: string | null
  content: object
  share_token: string
  is_public: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export default function DocsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clients } = useClients()
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [shareDoc, setShareDoc] = useState<Document | null>(null)

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['docs'],
    queryFn: () => fetch('/api/docs').then(r => r.json()),
  })

  const createDoc = useMutation({
    mutationFn: () =>
      fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document' }),
      }).then(r => r.json()),
    onSuccess: (doc: Document) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      router.push(`/docs/${doc.id}`)
    },
  })

  const deleteDoc = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/docs/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
    },
  })

  const togglePublic = useMutation({
    mutationFn: ({ id, is_public }: { id: string; is_public: boolean }) =>
      fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public }),
      }).then(r => r.json()),
    onSuccess: (updated: Document) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      setShareDoc(prev => (prev?.id === updated.id ? updated : prev))
    },
  })

  const filtered = docs.filter(doc => {
    const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase())
    const matchClient = clientFilter ? doc.client_id === clientFilter : true
    return matchSearch && matchClient
  })

  const getClient = (id: string | null) => clients.find(c => c.id === id) ?? null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Collaborative docs linked to clients and projects
          </p>
        </div>
        <button
          onClick={() => createDoc.mutate()}
          disabled={createDoc.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {createDoc.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-novax-border-active transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="appearance-none w-full sm:w-44 pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300 outline-none focus:border-novax-border-active transition-colors cursor-pointer"
          >
            <option value="">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-novax-light flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-novax-muted" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            {docs.length === 0 ? 'No documents yet' : 'No documents match your filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {docs.length === 0 ? 'Create your first document to get started' : 'Try adjusting your search or filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const client = getClient(doc.client_id)
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-novax-border transition-colors cursor-pointer group"
                onClick={() => router.push(`/docs/${doc.id}`)}
              >
                <div className="w-9 h-9 rounded-lg bg-novax-light flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-novax-muted" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {client && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: client.color }}
                        />
                        <span className="text-[11px] text-slate-500">{client.name}</span>
                      </div>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Updated {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setShareDoc(doc)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      doc.is_public
                        ? 'text-novax-muted bg-novax-light'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
                    )}
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this document?')) deleteDoc.mutate(doc.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Share dialog */}
      {shareDoc && (
        <DocShareDialog
          docId={shareDoc.id}
          title={shareDoc.title}
          isPublic={shareDoc.is_public}
          shareToken={shareDoc.share_token}
          onClose={() => setShareDoc(null)}
          onTogglePublic={is_public => togglePublic.mutate({ id: shareDoc.id, is_public })}
        />
      )}
    </div>
  )
}
