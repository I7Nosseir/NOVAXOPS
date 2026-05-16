'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { useTaskComments, useCreateComment } from '@/lib/hooks/use-task-comments'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { formatDateTime } from '@/lib/utils'

interface Props {
  taskId: string
}

export function TaskComments({ taskId }: Props) {
  const [text, setText] = useState('')
  const { comments, isLoading } = useTaskComments(taskId)
  const createComment = useCreateComment()
  const { users } = useUsers()
  const { user } = useAuth()

  const handleSend = async () => {
    if (!text.trim() || !user) return
    await createComment.mutateAsync({ task_id: taskId, user_id: user.id, body: text.trim() })
    setText('')
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

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Add a comment…"
          disabled={!user}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light text-slate-700 placeholder:text-slate-400"
        />
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
