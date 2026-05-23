'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Paperclip, FileText, Sheet, X } from 'lucide-react'
import { useTaskComments, useCreateComment } from '@/lib/hooks/use-task-comments'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { formatDateTime } from '@/lib/utils'

interface DocOption {
  id: string
  title: string
  is_template: boolean
  doc_type: string
}

interface Props {
  taskId: string
  taskLinkedDocIds?: string[]
  onLinkDoc?: (docId: string) => void
}

export function TaskComments({ taskId, taskLinkedDocIds = [], onLinkDoc }: Props) {
  const [text, setText] = useState('')
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [docSearch, setDocSearch] = useState('')

  const { comments, isLoading } = useTaskComments(taskId)
  const createComment = useCreateComment()
  const { users } = useUsers()
  const { user } = useAuth()

  const { data: allDocs = [] } = useQuery<DocOption[]>({
    queryKey: ['docs'],
    queryFn: () => fetch('/api/docs').then(r => r.json()),
    staleTime: 60_000,
    enabled: showDocPicker,
  })

  const availableDocs = allDocs.filter(d => !d.is_template && !taskLinkedDocIds.includes(d.id))
  const searchResults = docSearch.trim()
    ? availableDocs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase())).slice(0, 6)
    : availableDocs.slice(0, 5)

  const handleSend = async () => {
    if (!text.trim() || !user) return
    await createComment.mutateAsync({ task_id: taskId, user_id: user.id, body: text.trim() })
    fetch('/api/notifications/mention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, commentBody: text.trim(), commenterId: user.id }),
    }).catch(() => {})
    setText('')
  }

  const handleAttachDoc = (docId: string) => {
    onLinkDoc?.(docId)
    setDocSearch('')
    setShowDocPicker(false)
  }

  return (
    <div className="p-5 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Comments</p>

      <div className="space-y-3 mb-4">
        {isLoading && (
          <p className="text-xs text-slate-400">Loading…</p>
        )}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-slate-400">No comments yet.</p>
        )}
        {comments.map(comment => {
          const commentUser = users.find(u => u.id === comment.user_id)
          return (
            <div key={comment.id} className="flex gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ background: commentUser?.color ?? '#94a3b8' }}
              >
                {commentUser?.initials ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-700">{commentUser?.name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-slate-400">{formatDateTime(comment.created_at)}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{comment.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Doc picker — shown above the input when active */}
      {showDocPicker && onLinkDoc && (
        <div className="mb-2 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              placeholder="Search documents to attach…"
              className="flex-1 text-xs outline-none text-slate-700 placeholder:text-slate-400 bg-transparent"
            />
            <button
              onClick={() => { setShowDocPicker(false); setDocSearch('') }}
              className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="max-h-40 overflow-y-auto">
              {searchResults.map(doc => (
                <button
                  key={doc.id}
                  onMouseDown={e => { e.preventDefault(); handleAttachDoc(doc.id) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-novax-light transition-colors border-b border-slate-100 last:border-0"
                >
                  {doc.doc_type === 'sheet'
                    ? <Sheet className="w-3 h-3 text-slate-400 shrink-0" />
                    : <FileText className="w-3 h-3 text-slate-400 shrink-0" />}
                  <span className="truncate">{doc.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2.5 text-[11px] text-slate-400">
              {docSearch.trim() ? 'No matching documents' : 'No documents available to attach'}
            </p>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Add a comment…"
          disabled={!user}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light text-slate-700 placeholder:text-slate-400"
        />
        {onLinkDoc && (
          <button
            onClick={() => setShowDocPicker(v => !v)}
            title="Attach a document"
            className={`p-2 rounded-lg border transition-colors ${
              showDocPicker
                ? 'bg-novax-light border-novax-border text-novax-muted'
                : 'border-slate-200 text-slate-400 hover:text-novax hover:border-novax-border hover:bg-novax-light'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!text.trim() || createComment.isPending || !user}
          className="p-2 bg-novax hover:bg-novax-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
