'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, MessageSquare, Send, Clock, Loader2, ChevronLeft, ChevronRight, FileImage } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { PlatformIcon } from '@/components/ui/platform-icon'
import type { ScheduledPost, SocialPlatform } from '@/lib/types'
import { useParams } from 'next/navigation'

interface ApprovalPost extends ScheduledPost {
  media_urls?: string[]
}

interface AdHocItem {
  id: string
  media_url?: string | null
  media_urls?: string[] | null
  caption: string
}

interface ApprovalData {
  request: {
    id: string
    client_id: string
    title: string
    token: string
    post_ids: string[]
    status: string
    client_note: string
    created_by: string
    expires_at: string
    items?: AdHocItem[]
    approval_post_statuses: { post_id: string; status: string }[]
  }
  posts: ApprovalPost[]
}

type PostDecision = { status: 'approved' | 'changes_requested'; note: string }

function CarouselMedia({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0)
  const isVideo = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url)
  const url = urls[idx]

  return (
    <div className="mb-4 relative">
      {/* Main media */}
      <div className="rounded-xl overflow-hidden bg-slate-100 aspect-square flex items-center justify-center">
        {isVideo(url)
          // eslint-disable-next-line jsx-a11y/media-has-caption
          ? <video src={url} controls className="w-full h-full object-contain"/>
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt={`Slide ${idx + 1}`} className="w-full h-full object-contain"/>
        }
      </div>

      {/* Navigation arrows */}
      {urls.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-30 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4 text-slate-700"/>
          </button>
          <button
            onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
            disabled={idx === urls.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-30 transition-opacity hover:bg-white"
          >
            <ChevronRight className="w-4 h-4 text-slate-700"/>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {urls.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all',
                i === idx ? 'bg-novax w-4' : 'bg-slate-300',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NovaLogoSmall() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="NOVAX" className="h-7 w-7 rounded" />
}

export default function ApprovalPortalPage() {
  const params = useParams()
  const token = params?.token as string | undefined

  const [data, setData] = useState<ApprovalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, PostDecision>>({})
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/approval?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) { setFetchError(json.error); return }
        setData(json as ApprovalData)
      })
      .catch(() => setFetchError('Failed to load approval request.'))
      .finally(() => setLoading(false))
  }, [token])

  const decide = (postId: string, status: 'approved' | 'changes_requested') => {
    setDecisions(prev => ({ ...prev, [postId]: { status, note: prev[postId]?.note ?? '' } }))
  }

  const setNote = (postId: string, note: string) => {
    setDecisions(prev => ({ ...prev, [postId]: { ...prev[postId]!, note } }))
  }

  const handleSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decisions, client_note: '' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setSubmitError(json.error ?? 'Submission failed.'); return }
      setSubmitted(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-novax-muted animate-spin"/>
      </div>
    )
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4"/>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Link not found</h2>
          <p className="text-sm text-slate-500">{fetchError ?? 'This approval link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

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

  const { request, posts } = data
  const adhocItems: AdHocItem[] = request.items ?? []
  const allReviewable = [...posts, ...adhocItems]
  const allDecided = allReviewable.length > 0 && allReviewable.every(x => decisions[x.id])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <NovaLogoSmall/>
        <div className="w-px h-6 bg-slate-200 mx-1"/>
        <p className="text-xs text-slate-400">Content Review</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Brief */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{request.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5"/>
            <span>Review deadline: {formatDate(request.expires_at)}</span>
          </div>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">
              Please review each post below and either{' '}
              <span className="font-semibold text-emerald-600">approve</span> it or{' '}
              <span className="font-semibold text-red-500">request changes</span>. Leave notes for any revision requests.
            </p>
          </div>
        </div>

        {/* Posts */}
        {posts.map(post => {
          const decision = decisions[post.id]
          const isApproved = decision?.status === 'approved'
          const isChanges = decision?.status === 'changes_requested'

          return (
            <div
              key={post.id}
              className={cn(
                'bg-white rounded-2xl border overflow-hidden transition-all',
                isApproved ? 'border-emerald-200' : isChanges ? 'border-red-200' : 'border-slate-200',
              )}
            >
              {/* Status banner */}
              {decision && (
                <div className={cn(
                  'px-5 py-2.5 flex items-center gap-2 text-xs font-semibold',
                  isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                )}>
                  {isApproved
                    ? <><CheckCircle className="w-3.5 h-3.5"/> Approved</>
                    : <><XCircle className="w-3.5 h-3.5"/> Changes Requested</>
                  }
                </div>
              )}

              <div className="p-5">
                {/* Platform + date */}
                <div className="flex items-center gap-2 mb-3">
                  {(post.platforms as SocialPlatform[]).map(p => (
                    <div key={p} className="flex items-center gap-1 text-[11px] text-slate-500 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                      <PlatformIcon platform={p} size="xs"/>
                      <span className="capitalize">{p}</span>
                    </div>
                  ))}
                  <span className="text-[11px] text-slate-400 ml-auto">{formatDate(post.scheduled_at)}</span>
                </div>

                {/* Media — supports single image, carousel, and video */}
                {(() => {
                  const allUrls = post.media_urls?.filter(Boolean) ?? (post.media_url ? [post.media_url] : [])
                  if (allUrls.length === 0) return null
                  const isVideo = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url)

                  if (allUrls.length === 1) {
                    return isVideo(allUrls[0]) ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video
                        src={allUrls[0]}
                        controls
                        className="mb-4 w-full rounded-xl bg-slate-100 max-h-64 object-contain"
                      />
                    ) : (
                      <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={allUrls[0]} alt="" className="w-full object-contain max-h-72"/>
                      </div>
                    )
                  }

                  // Carousel — one image at a time with prev/next navigation
                  return <CarouselMedia urls={allUrls}/>
                })()}

                {/* Caption */}
                <p className="text-sm text-slate-700 leading-relaxed mb-4">{post.caption}</p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(post.id, 'approved')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isApproved
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                    )}
                  >
                    <CheckCircle className="w-3.5 h-3.5"/>
                    Approve
                  </button>
                  <button
                    onClick={() => { decide(post.id, 'changes_requested'); setNoteOpen(post.id) }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isChanges
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-red-200 text-red-500 hover:bg-red-50',
                    )}
                  >
                    <XCircle className="w-3.5 h-3.5"/>
                    Request Changes
                  </button>
                  <button
                    onClick={() => setNoteOpen(noteOpen === post.id ? null : post.id)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm transition-colors',
                      noteOpen === post.id
                        ? 'border-novax bg-novax-light text-novax'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                    )}
                  >
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

        {/* Ad-hoc items (custom posts added by the team) */}
        {adhocItems.map(item => {
          const decision = decisions[item.id]
          const isApproved = decision?.status === 'approved'
          const isChanges = decision?.status === 'changes_requested'
          const isVideo = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url)

          return (
            <div
              key={item.id}
              className={cn(
                'bg-white rounded-2xl border overflow-hidden transition-all',
                isApproved ? 'border-emerald-200' : isChanges ? 'border-red-200' : 'border-slate-200',
              )}
            >
              {decision && (
                <div className={cn(
                  'px-5 py-2.5 flex items-center gap-2 text-xs font-semibold',
                  isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                )}>
                  {isApproved
                    ? <><CheckCircle className="w-3.5 h-3.5"/> Approved</>
                    : <><XCircle className="w-3.5 h-3.5"/> Changes Requested</>
                  }
                </div>
              )}

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                    <FileImage className="w-3 h-3 text-slate-400"/>
                    <span className="text-[11px] text-slate-500">Custom post</span>
                  </div>
                </div>

                {(() => {
                  const allUrls = item.media_urls?.filter(Boolean) ?? (item.media_url ? [item.media_url] : [])
                  if (allUrls.length === 0) return null
                  if (allUrls.length > 1) return <CarouselMedia urls={allUrls as string[]}/>
                  const url = allUrls[0] as string
                  return isVideo(url) ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={url} controls className="mb-4 w-full rounded-xl bg-slate-100 max-h-64 object-contain"/>
                  ) : (
                    <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full object-contain max-h-72"/>
                    </div>
                  )
                })()}

                <p className="text-sm text-slate-700 leading-relaxed mb-4">{item.caption}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => decide(item.id, 'approved')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isApproved
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                    )}
                  >
                    <CheckCircle className="w-3.5 h-3.5"/>
                    Approve
                  </button>
                  <button
                    onClick={() => { decide(item.id, 'changes_requested'); setNoteOpen(item.id) }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                      isChanges
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-red-200 text-red-500 hover:bg-red-50',
                    )}
                  >
                    <XCircle className="w-3.5 h-3.5"/>
                    Request Changes
                  </button>
                  <button
                    onClick={() => setNoteOpen(noteOpen === item.id ? null : item.id)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm transition-colors',
                      noteOpen === item.id
                        ? 'border-novax bg-novax-light text-novax'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5"/>
                  </button>
                </div>

                {noteOpen === item.id && (
                  <textarea
                    value={decision?.note ?? ''}
                    onChange={e => setNote(item.id, e.target.value)}
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
        {submitError && (
          <p className="text-xs text-red-600 text-center">{submitError}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!allDecided || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          {submitting ? 'Submitting…' : `Submit Review (${Object.keys(decisions).length}/${allReviewable.length} reviewed)`}
        </button>
      </div>
    </div>
  )
}
