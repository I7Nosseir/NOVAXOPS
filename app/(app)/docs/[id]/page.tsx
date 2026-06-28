'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Share2, Loader2, CheckCircle, LayoutTemplate, Download, Globe, Lock, Users } from 'lucide-react'
import { DocEditor, type DocEditorRef } from '@/components/docs/doc-editor'
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

  const saveTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef        = useRef<DocEditorRef>(null)
  const pendingAiUpdate  = useRef(false)
  const [aiEditVersion, setAiEditVersion] = useState(0)

  // Listen for AI assistant "Apply to document" events (Tiptap editor)
  useEffect(() => {
    const handler = (e: Event) => {
      const { docId, text } = (e as CustomEvent<{ docId: string; text: string }>).detail
      if (docId !== id) return
      editorRef.current?.applyContent(text)
    }
    window.addEventListener('novax:apply-to-doc', handler)
    return () => window.removeEventListener('novax:apply-to-doc', handler)
  }, [id])

  // Listen for AI save events — invalidate query so SheetEditor gets fresh data
  useEffect(() => {
    const handler = (e: Event) => {
      const { docId } = (e as CustomEvent<{ docId: string }>).detail
      if (docId !== id) return
      pendingAiUpdate.current = true
      queryClient.invalidateQueries({ queryKey: ['doc', id] })
    }
    window.addEventListener('novax:doc-ai-saved', handler)
    return () => window.removeEventListener('novax:doc-ai-saved', handler)
  }, [id, queryClient])

  const { data: doc, isLoading } = useQuery<Document>({
    queryKey: ['doc', id],
    queryFn: () => fetch(`/api/docs/${id}`).then(r => r.json()),
    enabled: !!id,
  })

  // Initialise local state from fetched doc (also handles AI-edit refetches)
  useEffect(() => {
    if (doc?.id) {
      setTitle(doc.title)
      setContent(doc.content ?? {})
      const d = doc.updated_at ? new Date(doc.updated_at) : null
      setLastSaved(d && !isNaN(d.getTime()) ? d : null)
      // AI edit: cancel any queued save, then remount the editor with fresh DB content
      if (pendingAiUpdate.current) {
        pendingAiUpdate.current = false
        if (saveTimer.current) { clearTimeout(saveTimer.current); setIsSaving(false) }
        setAiEditVersion(v => v + 1)
      }
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
    if (newTitle.trim()) {
      scheduleSave({ title: newTitle.trim(), content })
    } else {
      // Cancel the pending save so a cleared title never persists
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setIsSaving(false)
    }
  }

  const handleTitleBlur = () => {
    if (!title.trim()) {
      // Revert to the last successfully saved title
      setTitle(doc?.title || (doc?.doc_type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Document'))
    }
  }

  const handleContentChange = (newContent: object) => {
    setContent(newContent)
    scheduleSave({ title, content: newContent })
  }

  const setVisibility = useMutation({
    mutationFn: (visibility: DocVisibility) => {
      const patch = {
        is_personal: visibility === 'personal',
        is_public: visibility === 'public',
      }
      return fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(r => r.json())
    },
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
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          onClick={() => router.push('/docs')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
          {/* Client badge */}
          {client && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: client.color }}
              />
              <span className="text-xs text-slate-500 truncate max-w-[80px] sm:max-w-none">{client.name}</span>
            </div>
          )}

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-[11px] min-w-0">
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 text-slate-400 animate-spin shrink-0" />
                <span className="text-slate-400 hidden sm:inline">Saving…</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="text-slate-400 hidden sm:inline truncate">
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
              'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0',
              doc.is_template
                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                : 'text-slate-600 border border-slate-200 hover:bg-slate-50',
            )}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{doc.is_template ? 'Template' : 'Make Template'}</span>
          </button>
        )}
        {doc.doc_type !== 'sheet' && (
          <button
            onClick={() => {
              const el = document.getElementById('printable-doc')
              if (!el) return
              const win = window.open('', '_blank', 'width=960,height=760')
              if (!win) return
              const styles = Array.from(
                document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
              ).map(s => s.outerHTML).join('\n')
              win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:0;padding:24px 40px;background:#fff;font-family:system-ui,sans-serif;font-size:14px;color:#0f172a}
  button,[data-no-print]{display:none!important}
  input{border:none!important;outline:none!important;font-size:24px;font-weight:700;width:100%;display:block;margin-bottom:16px}
  *{overflow-wrap:break-word!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box}
  img{max-width:100%}
  @page{size:A4 portrait;margin:16mm 18mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
${styles}
</head><body>${el.outerHTML}</body></html>`)
              win.document.close()
              win.focus()
              setTimeout(() => { win.print(); win.close() }, 800)
            }}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        )}
        {/* Visibility — cycles Personal → Team → Public */}
        {(() => {
          const v = getVisibility(doc)
          const next = nextVisibility(v)
          const labels: Record<DocVisibility, string> = { personal: 'Only me', team: 'Team', public: 'Public' }
          const nextLabels: Record<DocVisibility, string> = { personal: 'Team', team: 'Public', public: 'Only me' }
          const styles: Record<DocVisibility, string> = {
            personal: 'bg-novax-light text-novax-muted border border-novax-border hover:bg-novax-light-hover',
            team: 'text-slate-600 border border-slate-200 hover:bg-slate-50',
            public: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
          }
          const Icon = v === 'personal' ? Lock : v === 'public' ? Globe : Users
          return (
            <button
              onClick={() => setVisibility.mutate(next)}
              title={`${labels[v]} — click to set ${nextLabels[v]}`}
              className={cn('flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0', styles[v])}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{labels[v]}</span>
            </button>
          )
        })()}
        {/* Share link — only when public */}
        {doc.is_public && (
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copy Link</span>
          </button>
        )}
      </div>

      {/* Title + editor — wrapped for print */}
      <div id={doc.doc_type !== 'sheet' ? 'printable-doc' : undefined} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder={doc.doc_type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Document'}
          className={`w-full text-2xl font-bold bg-transparent border-none outline-none transition-colors ${
            title.trim()
              ? 'text-slate-900 dark:text-slate-100 placeholder:text-slate-300'
              : 'text-red-400 placeholder:text-red-300'
          }`}
        />

        {/* Editor — doc or sheet */}
        {doc.doc_type === 'sheet' ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ height: '70vh' }}>
            <SheetEditor key={aiEditVersion} content={content} onChange={handleContentChange} editable title={title} />
          </div>
        ) : (
          <DocEditor key={aiEditVersion} ref={editorRef} content={content} onChange={handleContentChange} editable />
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
          onTogglePublic={isPublic => setVisibility.mutate(isPublic ? 'public' : 'team')}
        />
      )}
    </div>
  )
}
