'use client'

import { useState, useRef } from 'react'
import { Plus, Archive, Trash2, BookOpen, ChevronDown, ChevronUp, Loader2, Upload, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'

interface ContextEntry {
  id: string
  client_id: string
  category: string
  summary: string
  full_text: string
  source_type: string
  is_active: boolean
  created_at: string
}

const CATEGORIES = [
  'Client Instructions',
  'Brand Update',
  'Campaign Feedback',
  'Market Intel',
  'Meeting Notes',
  'Competitor Intel',
] as const

const CATEGORY_COLORS: Record<string, string> = {
  'Client Instructions': 'bg-novax-light text-novax border-novax-border',
  'Brand Update':        'bg-blue-50 text-blue-700 border-blue-200',
  'Campaign Feedback':   'bg-amber-50 text-amber-700 border-amber-200',
  'Market Intel':        'bg-purple-50 text-purple-700 border-purple-200',
  'Meeting Notes':       'bg-slate-100 text-slate-600 border-slate-200',
  'Competitor Intel':    'bg-red-50 text-red-700 border-red-200',
}

const SOURCE_LABELS: Record<string, string> = {
  manual:   'Manual',
  document: 'File upload',
  studio:   'Studio',
  feedback: 'AI feedback',
}

function EntryCard({
  entry,
  onArchive,
  onDelete,
}: {
  entry: ContextEntry
  onArchive: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS['Meeting Notes']

  return (
    <div className={cn('rounded-xl border p-4 transition-all', entry.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', colorClass)}>
              {entry.category}
            </span>
            <span className="text-[10px] text-slate-400">{SOURCE_LABELS[entry.source_type] ?? entry.source_type}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{new Date(entry.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{entry.summary}</p>
          {entry.full_text && entry.full_text !== entry.summary && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 mt-1.5 text-[11px] text-novax-muted hover:text-novax transition-colors font-medium"
            >
              {expanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
              {expanded ? 'Hide full text' : 'Show full text'}
            </button>
          )}
          {expanded && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{entry.full_text}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onArchive(entry.id, !entry.is_active)}
            title={entry.is_active ? 'Archive' : 'Restore'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Archive className="w-3.5 h-3.5"/>
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>
    </div>
  )
}

export function ContextBankPanel({ clientId }: { clientId: string }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState<ContextEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Add form state
  const [addText, setAddText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [addError, setAddError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/context-bank`)
      const data = await res.json() as { entries: ContextEntry[] }
      setEntries(data.entries ?? [])
      setFetched(true)
    } catch {
      /* non-critical */
    } finally {
      setLoading(false)
    }
  }

  // Lazy load on first render
  if (!fetched && !loading) {
    void fetchEntries()
  }

  const handleFileUpload = async (file: File) => {
    const text = await readFileText(file)
    if (text) setAddText(text)
  }

  const handleAdd = async () => {
    if (!addText.trim()) return
    setProcessing(true)
    setAddError('')
    try {
      // AI processing to get category + summary
      const processRes = await fetch(`/api/clients/${clientId}/context-bank/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: addText.trim(), source_type: 'manual' }),
      })
      if (!processRes.ok) throw new Error('Processing failed')
      const processed = await processRes.json() as { category: string; summary: string; full_text: string }

      // Save to DB
      const saveRes = await fetch(`/api/clients/${clientId}/context-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: processed.category,
          summary: processed.summary,
          full_text: processed.full_text,
          source_type: 'manual',
          created_by: user?.id,
        }),
      })
      if (!saveRes.ok) throw new Error('Save failed')
      const { entry } = await saveRes.json() as { entry: ContextEntry }
      setEntries(prev => [entry, ...prev])
      setAddText('')
      setShowAdd(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setProcessing(false)
    }
  }

  const handleArchive = async (entryId: string, newActive: boolean) => {
    await fetch(`/api/clients/${clientId}/context-bank`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, is_active: newActive }),
    })
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, is_active: newActive } : e))
  }

  const handleDelete = async (entryId: string) => {
    await fetch(`/api/clients/${clientId}/context-bank?entry_id=${entryId}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const active = entries.filter(e => e.is_active)
  const archived = entries.filter(e => !e.is_active)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {active.length} active {active.length === 1 ? 'entry' : 'entries'} — injected into every AI call for this client
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchEntries()}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5"/>
            Add Update
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-4 bg-novax-light border border-novax-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-novax">New Context Entry</p>
          <p className="text-[11px] text-slate-500">Paste meeting notes, a brief, client feedback, or market research. AI will categorize and summarize it.</p>

          <textarea
            value={addText}
            onChange={e => setAddText(e.target.value)}
            placeholder="Paste any text here — meeting notes, client email, article, feedback..."
            rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
          />

          {addError && (
            <p className="text-xs text-red-600">{addError}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={processing || !addText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Processing...</> : <><BookOpen className="w-3.5 h-3.5"/>Save to Memory</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx,.md"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f) }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5"/>
              Upload file
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddText(''); setAddError('') }}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !entries.length && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-novax-muted animate-spin"/>
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <BookOpen className="w-8 h-8 mb-2 text-novax-border"/>
          <p className="text-sm font-medium text-slate-600">No context entries yet</p>
          <p className="text-xs mt-1 text-center max-w-xs">Add meeting notes, client briefs, or feedback. The AI reads all active entries before every generation for this client.</p>
        </div>
      )}

      {/* Active entries */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(entry => (
            <EntryCard key={entry.id} entry={entry} onArchive={handleArchive} onDelete={handleDelete}/>
          ))}
        </div>
      )}

      {/* Archived entries toggle */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            {showArchived ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
            {archived.length} archived {archived.length === 1 ? 'entry' : 'entries'}
          </button>
          {showArchived && (
            <div className="space-y-2 mt-2">
              {archived.map(entry => (
                <EntryCard key={entry.id} entry={entry} onArchive={handleArchive} onDelete={handleDelete}/>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Read a text file's contents as a string
async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string ?? '')
    reader.onerror = reject
    reader.readAsText(file)
  })
}
