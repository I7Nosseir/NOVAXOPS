'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Paperclip, FileText, Sheet, X } from 'lucide-react'
import { useTaskComments, useCreateComment } from '@/lib/hooks/use-task-comments'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { formatDateTime, cn } from '@/lib/utils'
import type { User } from '@/lib/types'

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

// Render comment body with @mentions highlighted as teal chips
function CommentBody({ body, users }: { body: string; users: User[] }) {
  // Split on @word tokens
  const parts = body.split(/(@\S+)/g)
  return (
    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const handle = part.slice(1).toLowerCase()
          const matched = users.find(u => {
            const first = u.name.split(' ')[0].toLowerCase()
            const full = u.name.toLowerCase().replace(/\s+/g, '')
            return first === handle || full === handle
          })
          if (matched) {
            return (
              <span
                key={i}
                className="font-semibold text-novax bg-novax-light px-1 py-px rounded text-[11px]"
                title={matched.name}
              >
                {part}
              </span>
            )
          }
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export function TaskComments({ taskId, taskLinkedDocIds = [], onLinkDoc }: Props) {
  const [text, setText] = useState('')
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [docSearch, setDocSearch] = useState('')

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const [activeMentionIdx, setActiveMentionIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Reset active mention index when matches change
  useEffect(() => { setActiveMentionIdx(0) }, [mentionQuery])

  // Filtered users shown in the mention dropdown
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return users
      .filter(u => u.id !== user?.id && (q === '' || u.name.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [mentionQuery, users, user?.id])

  // Handle textarea value changes — detect active @mention
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    const cursor = e.target.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursor)
    // Match @ followed by word chars (or nothing) at end of the string before cursor
    const atMatch = beforeCursor.match(/@([\w]*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursor - atMatch[0].length)
      setActiveMentionIdx(0)
    } else {
      setMentionQuery(null)
    }
  }

  // Insert a user mention at the current @ position
  const insertMention = (selectedUser: User) => {
    const firstName = selectedUser.name.split(' ')[0]
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, mentionStart)
    const after = text.slice(cursor)
    const newText = `${before}@${firstName} ${after}`
    setText(newText)
    setMentionQuery(null)
    setActiveMentionIdx(0)

    // Restore focus and position cursor after the inserted mention
    const newPos = before.length + firstName.length + 2 // @ + name + space
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention dropdown keyboard navigation
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveMentionIdx(i => (i + 1) % mentionMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveMentionIdx(i => (i - 1 + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionMatches[activeMentionIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    // Submit on Enter (no shift, no active dropdown)
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if (!text.trim() || !user || createComment.isPending) return
    const body = text.trim()
    try {
      await createComment.mutateAsync({ task_id: taskId, user_id: user.id, body })
      setText('')
      setMentionQuery(null)

      // Send mention notifications only when comment contains @
      if (body.includes('@')) {
        fetch('/api/notifications/mention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, commentBody: body, commenterId: user.id }),
        }).catch(() => {})
      }
    } catch {
      // error is visible via createComment.isError — no silent swallow
    }
  }

  const handleAttachDoc = (docId: string) => {
    onLinkDoc?.(docId)
    setDocSearch('')
    setShowDocPicker(false)
  }

  return (
    <div className="p-5 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Comments</p>

      {/* Comment list */}
      <div className="space-y-3 mb-4">
        {isLoading && <p className="text-xs text-slate-400">Loading…</p>}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-slate-400">No comments yet.</p>
        )}
        {comments.map(comment => {
          const commentUser = users.find(u => u.id === comment.user_id)
          return (
            <div key={comment.id} className="flex gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
                style={{ background: commentUser?.color ?? '#94a3b8' }}
              >
                {commentUser?.initials ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-700">{commentUser?.name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-slate-400">{formatDateTime(comment.created_at)}</span>
                </div>
                <CommentBody body={comment.body} users={users} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Send error */}
      {createComment.isError && (
        <p className="text-xs text-red-500 mb-2">Failed to send comment. Please try again.</p>
      )}

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

      {/* Input area */}
      <div className="relative flex gap-2 items-end">

        {/* @mention dropdown — floats above the textarea */}
        {mentionQuery !== null && mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-slate-100">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Mention a teammate</p>
            </div>
            {mentionMatches.map((u, idx) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  idx === activeMentionIdx ? 'bg-novax-light' : 'hover:bg-slate-50',
                )}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ background: u.color }}
                >
                  {u.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{u.role.replace(/_/g, ' ')}</p>
                </div>
              </button>
            ))}
            <div className="px-3 py-1.5 border-t border-slate-100">
              <p className="text-[9px] text-slate-400">↑↓ navigate · Enter select · Esc dismiss</p>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… type @ to mention someone"
            rows={1}
            disabled={!user}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border outline-none transition-colors resize-none',
              'text-slate-700 placeholder:text-slate-400',
              'focus:border-novax-muted focus:ring-2 focus:ring-novax-light',
              mentionQuery !== null ? 'border-novax-muted ring-2 ring-novax-light' : 'border-slate-200',
            )}
            style={{ minHeight: '40px', maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              // Auto-grow
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          {/* Hint shown when @ is typed but no query yet */}
          {mentionQuery === '' && mentionMatches.length === 0 && (
            <p className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none">
              No users
            </p>
          )}
        </div>

        {/* Attach doc button */}
        {onLinkDoc && (
          <button
            type="button"
            onClick={() => setShowDocPicker(v => !v)}
            title="Attach a document"
            className={cn(
              'p-2 rounded-xl border transition-colors shrink-0',
              showDocPicker
                ? 'bg-novax-light border-novax-border text-novax-muted'
                : 'border-slate-200 text-slate-400 hover:text-novax hover:border-novax-border hover:bg-novax-light',
            )}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || createComment.isPending || !user}
          className="p-2 bg-novax hover:bg-novax-hover text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Shift+Enter hint */}
      {text.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-1 ml-1">Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  )
}
