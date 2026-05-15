'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, Send, Clock } from 'lucide-react'
import { usePosts } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatDate, cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'

const APPROVAL_DATA = {
  client_id: 'c1',
  title: 'Luxe Cosmetics — May 2026 Campaign',
  created_by: 'Sarah Al-Mansouri',
  expires_at: '2026-05-10T23:59:00',
  posts: ['sp1', 'sp2', 'sp7'],
}

type PostDecision = { status: 'approved' | 'changes_requested'; note: string }

function NovaxLogoSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
      <circle cx="12" cy="12" r="12" fill="#1B3D38"/>
      <path d="M5 17V7l4 7 4-7v10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 7l3.5 5-3.5 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function ApprovalPortalPage() {
  const { clients } = useClients()
  const { posts: allPosts } = usePosts()
  const client = clients.find(c => c.id === APPROVAL_DATA.client_id)
  const posts = allPosts.filter(p => APPROVAL_DATA.posts.includes(p.id))
  const [decisions, setDecisions] = useState<Record<string, PostDecision>>({})
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const decide = (postId: string, status: 'approved' | 'changes_requested') => {
    setDecisions(prev => ({ ...prev, [postId]: { status, note: prev[postId]?.note ?? '' } }))
  }

  const setNote = (postId: string, note: string) => {
    setDecisions(prev => ({ ...prev, [postId]: { ...prev[postId]!, note } }))
  }

  const allDecided = posts.every(p => decisions[p.id])

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500"/>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Review submitted</h2>
          <p className="text-sm text-slate-500">Your feedback has been sent to the NOVAX team. They will action your notes shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <NovaxLogoSmall/>
        <div>
          <p className="text-xs text-slate-500">Content Review powered by</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">NOVAX Ops</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Brief */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{APPROVAL_DATA.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Prepared by {APPROVAL_DATA.created_by}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: client?.color }}>
              {client?.initials}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5"/>
            <span>Review deadline: {formatDate(APPROVAL_DATA.expires_at)}</span>
          </div>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Please review each post below and either <span className="font-semibold text-emerald-600">approve</span> it or <span className="font-semibold text-red-500">request changes</span>. Leave notes for any revision requests.</p>
          </div>
        </div>

        {/* Posts */}
        {posts.map(post => {
          const decision = decisions[post.id]
          const isApproved = decision?.status === 'approved'
          const isChanges = decision?.status === 'changes_requested'

          return (
            <div key={post.id} className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
              isApproved ? 'border-emerald-200' : isChanges ? 'border-red-200' : 'border-slate-200')}>
              {/* Status banner */}
              {decision && (
                <div className={cn('px-5 py-2.5 flex items-center gap-2 text-xs font-semibold',
                  isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  {isApproved
                    ? <><CheckCircle className="w-3.5 h-3.5"/> Approved</>
                    : <><XCircle className="w-3.5 h-3.5"/> Changes Requested</>
                  }
                </div>
              )}

              <div className="p-5">
                {/* Platform + date */}
                <div className="flex items-center gap-2 mb-3">
                  {post.platforms.map(p => (
                    <div key={p} className="flex items-center gap-1 text-[11px] text-slate-500 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                      <PlatformIcon platform={p} size="xs"/>
                      <span className="capitalize">{p}</span>
                    </div>
                  ))}
                  <span className="text-[11px] text-slate-400 ml-auto">{formatDate(post.scheduled_at)}</span>
                </div>

                {/* Media */}
                {post.media_url && (
                  <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 max-h-64">
                    <img src={post.media_url} alt="" className="w-full object-cover"/>
                  </div>
                )}

                {/* Caption */}
                <p className="text-sm text-slate-700 leading-relaxed mb-4">{post.caption}</p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(post.id, 'approved')}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isApproved
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
                    <CheckCircle className="w-3.5 h-3.5"/>
                    Approve
                  </button>
                  <button
                    onClick={() => { decide(post.id, 'changes_requested'); setNoteOpen(post.id) }}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isChanges
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-red-200 text-red-500 hover:bg-red-50')}>
                    <XCircle className="w-3.5 h-3.5"/>
                    Request Changes
                  </button>
                  <button
                    onClick={() => setNoteOpen(noteOpen === post.id ? null : post.id)}
                    className={cn('px-3 py-2 rounded-lg border text-sm transition-colors',
                      noteOpen === post.id ? 'border-novax bg-novax-light text-novax' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                    <MessageSquare className="w-3.5 h-3.5"/>
                  </button>
                </div>

                {/* Note textarea */}
                {noteOpen === post.id && (
                  <textarea
                    value={decision?.note ?? ''}
                    onChange={e => setNote(post.id, e.target.value)}
                    rows={3}
                    placeholder="Describe the changes needed or add a comment…"
                    className="mt-3 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted resize-none transition-all"
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Submit */}
        <button
          onClick={() => allDecided && setSubmitted(true)}
          disabled={!allDecided}
          className="w-full flex items-center justify-center gap-2 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Send className="w-4 h-4"/>
          Submit Review ({Object.keys(decisions).length}/{posts.length} reviewed)
        </button>
      </div>
    </div>
  )
}
