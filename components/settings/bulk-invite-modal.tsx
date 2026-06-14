'use client'

import { useState } from 'react'
import { X, Send, CheckCircle, AlertCircle, SkipForward, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'copywriter',        label: 'Copywriter' },
  { value: 'designer',          label: 'Designer' },
  { value: 'social_manager',    label: 'Social Manager' },
  { value: 'account_manager',   label: 'Account Manager' },
  { value: 'strategist',        label: 'Strategist' },
  { value: 'creative_director', label: 'Creative Director' },
  { value: 'ceo',               label: 'CEO' },
  { value: 'admin',             label: 'Admin' },
]

interface Member {
  name: string
  email: string
  role: UserRole
}

interface ItemResult {
  email: string
  name: string
  status: 'sent' | 'created_no_email' | 'skipped' | 'error'
  error?: string
  fallbackCredentials?: { email: string; tempPassword: string }
}

const DEFAULT_MEMBERS: Member[] = [
  { name: 'Mahmoud Ahmed',        email: 'mahmouddmooo19@gmail.com',  role: 'copywriter' },
  { name: 'Mohamed Hussien Elol', email: 'mh1970912@gmail.com',       role: 'copywriter' },
  { name: 'Mohamed Helmi',        email: 'mo7amedmedhat357@gmail.com', role: 'copywriter' },
  { name: 'Dina Elsharkawy',      email: 'dinaelsharkawy401@gmail.com',role: 'copywriter' },
  { name: 'Hager Eljiar',         email: 'hagereljiar@gmail.com',      role: 'copywriter' },
  { name: 'Noura Mostafa',        email: 'nouramostafa288@gmail.com',  role: 'copywriter' },
  { name: 'Rania Mohamed',        email: 'raniamraf@gmail.com',        role: 'copywriter' },
  { name: 'Habeba Amr',           email: 'habebaamr238@gmail.com',     role: 'copywriter' },
  { name: 'Youssef Soliman',      email: 'youssefnader02@gmail.com',   role: 'copywriter' },
  { name: 'Muhammad Elshershaby', email: 'elshershaby93@gmail.com',    role: 'copywriter' },
]

const inputCls = 'w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-1 focus:ring-novax-light transition-all bg-white text-slate-800 placeholder:text-slate-400'

interface Props { onClose: () => void }

export function BulkInviteModal({ onClose }: Props) {
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<ItemResult[] | null>(null)

  const updateMember = (i: number, field: keyof Member, value: string) => {
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  const removeMember = (i: number) => setMembers(prev => prev.filter((_, idx) => idx !== i))

  const addRow = () => setMembers(prev => [...prev, { name: '', email: '', role: 'copywriter' }])

  const send = async () => {
    const valid = members.filter(m => m.name.trim() && m.email.trim())
    if (!valid.length) return
    setSending(true)
    try {
      const res = await fetch('/api/auth/invite/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: valid }),
      })
      const data = await res.json() as { ok: boolean; results?: ItemResult[]; error?: string }
      if (data.results) setResults(data.results)
    } catch {
      // silent — results will be null and we show the form again
    } finally {
      setSending(false)
    }
  }

  const sentCount   = results?.filter(r => r.status === 'sent').length ?? 0
  const failedCount = results?.filter(r => r.status === 'error').length ?? 0
  const skippedCount = results?.filter(r => r.status === 'skipped').length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">Bulk Invite Team Members</h2>
            <p className="text-xs text-slate-500 mt-0.5">Each person receives an email with their login credentials.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {results ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Summary */}
            <div className="flex gap-3 mb-5">
              {sentCount > 0 && (
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-700">{sentCount}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Invites sent</p>
                </div>
              )}
              {skippedCount > 0 && (
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">{skippedCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Already existed</p>
                </div>
              )}
              {failedCount > 0 && (
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{failedCount}</p>
                  <p className="text-xs text-red-600 mt-0.5">Failed</p>
                </div>
              )}
            </div>

            {/* Per-item results */}
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border text-sm',
                  r.status === 'sent'             && 'bg-emerald-50 border-emerald-200',
                  r.status === 'created_no_email' && 'bg-amber-50 border-amber-200',
                  r.status === 'skipped'          && 'bg-slate-50 border-slate-200',
                  r.status === 'error'            && 'bg-red-50 border-red-200',
                )}>
                  {r.status === 'sent'             && <CheckCircle  className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                  {r.status === 'created_no_email' && <AlertCircle  className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                  {r.status === 'skipped'          && <SkipForward  className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                  {r.status === 'error'            && <AlertCircle  className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{r.name} <span className="font-normal text-slate-500">— {r.email}</span></p>
                    {r.status === 'sent'             && <p className="text-xs text-emerald-700 mt-0.5">Credentials emailed successfully</p>}
                    {r.status === 'skipped'          && <p className="text-xs text-slate-500 mt-0.5">Account already exists — use Resend from the team list</p>}
                    {r.status === 'error'            && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                    {r.status === 'created_no_email' && (
                      <>
                        <p className="text-xs text-amber-700 mt-0.5">Account created but email failed. Share manually:</p>
                        {r.fallbackCredentials && (
                          <p className="text-xs font-mono mt-1 text-slate-700">
                            Password: <strong>{r.fallbackCredentials.tempPassword}</strong>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={onClose} className="mt-5 w-full py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="pb-2 pr-3 w-1/3">Full Name</th>
                    <th className="pb-2 pr-3 w-1/3">Email</th>
                    <th className="pb-2 pr-3 w-1/4">Role</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map((m, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3">
                        <input
                          value={m.name}
                          onChange={e => updateMember(i, 'name', e.target.value)}
                          placeholder="Full name"
                          className={inputCls}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          value={m.email}
                          onChange={e => updateMember(i, 'email', e.target.value)}
                          type="email"
                          placeholder="email@example.com"
                          className={inputCls}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <select
                          value={m.role}
                          onChange={e => updateMember(i, 'role', e.target.value as UserRole)}
                          className={inputCls}
                        >
                          {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5">
                        <button
                          onClick={() => removeMember(i)}
                          className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={addRow}
                className="mt-3 text-xs text-novax-muted hover:text-novax font-medium transition-colors"
              >
                + Add row
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || members.filter(m => m.name && m.email).length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                  : <><Send className="w-3.5 h-3.5" /> Send {members.filter(m => m.name && m.email).length} Invites</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
