'use client'

import { useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'Twitter']

interface Props {
  clientId: string
  onClose: () => void
  onAdded: () => void
}

export function AddCompetitorDialog({ clientId, onClose, onAdded }: Props) {
  const [handle, setHandle]     = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSave() {
    const h = handle.trim().replace(/^@/, '')
    if (!h) { setError('Enter a handle'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/performance/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          competitor_handle: `@${h}`,
          platform: platform.toLowerCase(),
          followers: 0,
          avg_er: 0,
          posting_frequency: 0,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to add competitor')
      }
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all bg-white text-slate-800 placeholder:text-slate-400'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Add Competitor</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500"/>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Handle</label>
            <input value={handle} onChange={e => setHandle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="@competitor_handle" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              className={`${inputCls} cursor-pointer`}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Adding…</> : <><Plus className="w-3.5 h-3.5"/>Add</>}
          </button>
        </div>
      </div>
    </div>
  )
}
