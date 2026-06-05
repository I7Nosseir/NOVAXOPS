'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { DocEditor } from '@/components/docs/doc-editor'

interface PublicDoc {
  id: string
  title: string
  content: object
  updated_at: string
}

function NovaLogoSmall() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="NOVA" className="w-7 h-7 rounded" />
}

export default function PublicDocPage() {
  const { token } = useParams<{ token: string }>()
  const [doc, setDoc] = useState<PublicDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/docs/public/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setDoc(data as PublicDoc)
      })
      .catch(() => setError('Failed to load document.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-novax-muted animate-spin"/>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4"/>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Document not found</h2>
          <p className="text-sm text-slate-500">{error ?? 'This document link is invalid or no longer shared.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <NovaLogoSmall/>
        <div>
          <p className="text-xs text-slate-500">Shared document via</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">NOVA Ops</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
        <DocEditor content={doc.content} onChange={() => undefined} editable={false}/>
      </div>
    </div>
  )
}
