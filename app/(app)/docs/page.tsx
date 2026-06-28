'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, Share2, Search, ChevronDown, Loader2, LayoutTemplate, Star, Sheet, Upload, Globe, Lock, Users } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { DocShareDialog } from '@/components/docs/doc-share-dialog'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import * as XLSX from 'xlsx'

// Convert plain text to minimal Tiptap JSON
function textToTiptap(text: string): object {
  const paragraphs = text.split(/\n/).map(line => ({
    type: 'paragraph',
    content: line.trim() ? [{ type: 'text', text: line }] : undefined,
  }))
  return { type: 'doc', content: paragraphs }
}

interface Document {
  id: string
  title: string
  client_id: string | null
  content: object
  share_token: string
  is_public: boolean
  is_personal: boolean
  is_template: boolean
  template_category: string | null
  doc_type: string
  created_by: string | null
  created_at: string
  updated_at: string
}

type DocVisibility = 'personal' | 'team' | 'public'

function getVisibility(doc: Document): DocVisibility {
  if (doc.is_personal) return 'personal'
  if (doc.is_public) return 'public'
  return 'team'
}

function nextVisibility(current: DocVisibility): DocVisibility {
  if (current === 'personal') return 'team'
  if (current === 'team') return 'public'
  return 'personal'
}

function visibilityPatch(v: DocVisibility): { is_personal: boolean; is_public: boolean } {
  return {
    is_personal: v === 'personal',
    is_public: v === 'public',
  }
}

export default function DocsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clients } = useClients()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [shareDoc, setShareDoc] = useState<Document | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['docs'],
    queryFn: () => fetch('/api/docs').then(r => r.json()),
  })

  const templates = docs.filter(d => d.is_template)
  const regularDocs = docs.filter(d => !d.is_template)

  const createDoc = useMutation({
    mutationFn: async (body: { from_template_id?: string; title?: string; doc_type?: string } = {}) => {
      const r = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? { title: 'Untitled Document' }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? 'Failed to create document')
      return json as Document
    },
    onSuccess: (doc: Document) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      router.push(`/docs/${doc.id}`)
    },
  })

  const deleteDoc = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/docs/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docs'] }),
  })

  const toggleVisibility = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: DocVisibility }) =>
      fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visibilityPatch(visibility)),
      }).then(r => r.json()),
    onSuccess: (updated: Document) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      setShareDoc(prev => (prev?.id === updated.id ? updated : prev))
    },
  })

  const removeTemplate = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: false }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docs'] }),
  })

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const name = file.name.replace(/\.[^.]+$/, '')
      const isSpreadsheet = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      const isCsv = file.name.endsWith('.csv')

      if (isSpreadsheet || isCsv) {
        const ab = await file.arrayBuffer()
        const wb = XLSX.read(ab, { type: 'array' })
        // Use first sheet only for now; convert to SheetContent rows
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
        const numCols = Math.max(...raw.map(r => r.length), 26)
        // Ensure every row has exactly numCols cells
        const rows = raw.map(r => {
          const padded = [...r.map(c => String(c ?? ''))]
          while (padded.length < numCols) padded.push('')
          return padded
        })
        const content = { rows, numCols }
        const r = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: name, content, doc_type: 'sheet' }),
        })
        const json = await r.json() as Document
        if (!r.ok) throw new Error()
        queryClient.invalidateQueries({ queryKey: ['docs'] })
        router.push(`/docs/${json.id}`)
        return
      }

      // .docx or .txt — basic text read
      let text = await file.text()
      if (file.name.endsWith('.docx')) {
        text = text.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
      }

      const content = textToTiptap(text)
      const r = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, content }),
      })
      const json = await r.json() as Document
      if (!r.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      router.push(`/docs/${json.id}`)
    } catch {
      // silent — user can retry
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const filtered = regularDocs.filter(doc => {
    const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase())
    const matchClient = clientFilter ? doc.client_id === clientFilter : true
    return matchSearch && matchClient
  })

  const getClient = (id: string | null) => clients.find(c => c.id === id) ?? null

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Collaborative docs linked to clients and projects</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">Import</span>
          </button>
          <input ref={importRef} type="file" accept=".txt,.xlsx,.xls,.csv,.docx" className="hidden"
            onChange={e => e.target.files?.[0] && void handleImport(e.target.files[0])}/>
          <button
            onClick={() => createDoc.mutate({ title: 'Untitled Spreadsheet', doc_type: 'sheet' })}
            disabled={createDoc.isPending}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <Sheet className="w-4 h-4" />
            <span className="hidden sm:inline">New Spreadsheet</span>
          </button>
          <button
            onClick={() => createDoc.mutate({})}
            disabled={createDoc.isPending}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {createDoc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">New Document</span>
            <span className="sm:hidden">Doc</span>
          </button>
        </div>
      </div>

      {/* Templates section */}
      {(templates.length > 0 || isAdmin) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <LayoutTemplate className="w-4 h-4 text-novax-muted" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Templates</h2>
            <span className="text-[11px] text-slate-400">· Click to start a doc from a template</span>
          </div>

          {templates.length === 0 && isAdmin && (
            <div className="flex items-center gap-3 px-4 py-3 bg-novax-light border border-novax-border rounded-xl">
              <Star className="w-4 h-4 text-novax-muted shrink-0" />
              <p className="text-xs text-novax-muted">
                Open any document and click <strong>Make Template</strong> in the editor to save it as a reusable template.
              </p>
            </div>
          )}

          {templates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className="group relative flex flex-col gap-2 p-4 bg-novax-light border border-novax-border rounded-xl hover:border-novax-border-active hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutTemplate className="w-3.5 h-3.5 text-novax-muted shrink-0" />
                      <p className="text-sm font-semibold text-slate-800 truncate">{tmpl.title}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); removeTemplate.mutate(tmpl.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                        title="Remove template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {tmpl.template_category && (
                    <span className="text-[10px] font-semibold text-novax-muted uppercase tracking-wider">{tmpl.template_category}</span>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button
                      onClick={() => createDoc.mutate({ from_template_id: tmpl.id })}
                      disabled={createDoc.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Plus className="w-3 h-3" /> Use Template
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => router.push(`/docs/${tmpl.id}`)}
                        className="px-2.5 py-1.5 border border-novax-border text-xs text-novax-muted rounded-lg hover:bg-novax-light-hover transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {templates.length > 0 && <div className="border-t border-slate-100 dark:border-slate-800" />}

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
              <option key={c.id} value={c.id}>{c.name}</option>
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
            {regularDocs.length === 0 ? 'No documents yet' : 'No documents match your filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {regularDocs.length === 0 ? 'Create your first document to get started' : 'Try adjusting your search or filter'}
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
                  {doc.doc_type === 'sheet'
                    ? <Sheet className="w-4 h-4 text-novax-muted" />
                    : <FileText className="w-4 h-4 text-novax-muted" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{doc.title}</p>
                    {doc.doc_type === 'sheet' && (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">XLSX</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {client && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: client.color }} />
                        <span className="text-[11px] text-slate-500">{client.name}</span>
                      </div>
                    )}
                    {doc.updated_at && !isNaN(new Date(doc.updated_at).getTime()) && (
                      <span className="text-[11px] text-slate-400">
                        Updated {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                      </span>
                    )}
                    {/* Visibility badge — cycles Personal → Team → Public on click */}
                    {(() => {
                      const v = getVisibility(doc)
                      const next = nextVisibility(v)
                      const labels: Record<DocVisibility, string> = { personal: 'Only me', team: 'Team', public: 'Public' }
                      const nextLabels: Record<DocVisibility, string> = { personal: 'Team', team: 'Public', public: 'Only me' }
                      const styles: Record<DocVisibility, string> = {
                        personal: 'text-novax bg-novax-light hover:bg-novax-light-hover',
                        team: 'text-slate-500 bg-slate-100 hover:bg-slate-200',
                        public: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
                      }
                      const Icon = v === 'personal' ? Lock : v === 'public' ? Globe : Users
                      return (
                        <button
                          onClick={e => { e.stopPropagation(); toggleVisibility.mutate({ id: doc.id, visibility: next }) }}
                          title={`${labels[v]} — click to set ${nextLabels[v]}`}
                          className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors', styles[v])}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          {labels[v]}
                        </button>
                      )
                    })()}
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  {doc.is_public && (
                    <button
                      onClick={() => setShareDoc(doc)}
                      className="p-1.5 rounded-lg text-novax-muted bg-novax-light hover:bg-novax-light-hover transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy share link"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm('Delete this document?')) deleteDoc.mutate(doc.id) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
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

      {shareDoc && (
        <DocShareDialog
          docId={shareDoc.id}
          title={shareDoc.title}
          isPublic={shareDoc.is_public}
          shareToken={shareDoc.share_token}
          onClose={() => setShareDoc(null)}
          onTogglePublic={is_public => toggleVisibility.mutate({ id: shareDoc.id, visibility: is_public ? 'public' : 'team' })}
        />
      )}
    </div>
  )
}
