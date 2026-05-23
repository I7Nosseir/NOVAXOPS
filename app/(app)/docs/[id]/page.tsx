'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Share2, Loader2, CheckCircle, LayoutTemplate, Download } from 'lucide-react'
import { DocEditor } from '@/components/docs/doc-editor'
import { SheetEditor } from '@/components/docs/sheet-editor'
import { DocShareDialog } from '@/components/docs/doc-share-dialog'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Document {
  id: string
  title: string
  client_id: string | null
  content: object
  share_token: string
  is_public: boolean
  is_template: boolean
  template_category: string | null
  doc_type: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export default function DocEditorPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clients } = useClients()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<object>({})
  const [showShare, setShowShare] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: doc, isLoading } = useQuery<Document>({
    queryKey: ['doc', id],
    queryFn: () => fetch(`/api/docs/${id}`).then(r => r.json()),
    enabled: !!id,
  })

  // Initialise local state from fetched doc
  useEffect(() => {
    if (doc?.id) {
      setTitle(doc.title)
      setContent(doc.content ?? {})
      const d = doc.updated_at ? new Date(doc.updated_at) : null
      setLastSaved(d && !isNaN(d.getTime()) ? d : null)
    }
  }, [doc])

  const patchDoc = useMutation({
    mutationFn: (updates: { title?: string; content?: object; is_public?: boolean; is_template?: boolean }) =>
      fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: (updated: Document) => {
      setLastSaved(new Date(updated.updated_at))
      setIsSaving(false)
      queryClient.setQueryData(['doc', id], updated)
      queryClient.invalidateQueries({ queryKey: ['docs'] })
    },
    onError: () => {
      setIsSaving(false)
    },
  })

  const scheduleSave = useCallback(
    (updates: { title?: string; content?: object }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setIsSaving(true)
      saveTimer.current = setTimeout(() => {
        patchDoc.mutate(updates)
      }, 1500)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    scheduleSave({ title: newTitle, content })
  }

  const handleContentChange = (newContent: object) => {
    setContent(newContent)
    scheduleSave({ title, content: newContent })
  }

  const togglePublic = useMutation({
    mutationFn: (is_public: boolean) =>
      fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public }),
      }).then(r => r.json()),
    onSuccess: (updated: Document) => {
      queryClient.setQueryData(['doc', id], updated)
      queryClient.invalidateQueries({ queryKey: ['docs'] })
    },
  })

  const client = clients.find(c => c.id === doc?.client_id) ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-sm text-slate-500">Document not found.</p>
        <button
          onClick={() => router.push('/docs')}
          className="text-sm text-novax-muted hover:underline"
        >
          Back to Documents
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/docs')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          {/* Client badge */}
          {client && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: client.color }}
              />
              <span className="text-xs text-slate-500">{client.name}</span>
            </div>
          )}

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-[11px]">
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                <span className="text-slate-400">Saving…</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span className="text-slate-400">
                  Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {isAdmin && doc.doc_type !== 'sheet' && (
          <button
            onClick={() => patchDoc.mutate({ is_template: !doc.is_template })}
            title={doc.is_template ? 'Remove from templates' : 'Save as template'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              doc.is_template
                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                : 'text-slate-600 border border-slate-200 hover:bg-slate-50',
            )}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            {doc.is_template ? 'Template' : 'Make Template'}
          </button>
        )}
        {doc.doc_type !== 'sheet' && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        )}
        <button
          onClick={() => setShowShare(true)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            doc.is_public
              ? 'bg-novax-light text-novax-muted hover:bg-novax-light-hover'
              : 'text-slate-600 border border-slate-200 hover:bg-slate-50',
          )}
        >
          <Share2 className="w-3.5 h-3.5" />
          {doc.is_public ? 'Shared' : 'Share'}
        </button>
      </div>

      {/* Title + editor — wrapped for print */}
      <div id={doc.doc_type !== 'sheet' ? 'printable-doc' : undefined} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder={doc.doc_type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Document'}
          className="w-full text-2xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none placeholder:text-slate-300"
        />

        {/* Editor — doc or sheet */}
        {doc.doc_type === 'sheet' ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ height: '70vh' }}>
            <SheetEditor content={content} onChange={handleContentChange} editable title={title} />
          </div>
        ) : (
          <DocEditor content={content} onChange={handleContentChange} editable />
        )}
      </div>

      {/* Share dialog */}
      {showShare && (
        <DocShareDialog
          docId={doc.id}
          title={title}
          isPublic={doc.is_public}
          shareToken={doc.share_token}
          onClose={() => setShowShare(false)}
          onTogglePublic={isPublic => togglePublic.mutate(isPublic)}
        />
      )}
    </div>
  )
}
