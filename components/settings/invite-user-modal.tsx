'use client'

import { useState } from 'react'
import { X, Mail, Send, AlertCircle, Copy, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'
import { PAGE_DEFS, ALL_PAGE_KEYS, PAGE_GROUPS, type PageKey } from '@/lib/page-permissions'
import { useInviteUser, type InviteResult } from '@/lib/hooks/use-users'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin',            label: 'Admin',            desc: 'Full access including integrations and billing' },
  { value: 'ceo',              label: 'CEO',              desc: 'Full read access, reports, no integrations tab' },
  { value: 'creative_director',label: 'Creative Director',desc: 'Full task and client access, manages creative team' },
  { value: 'account_manager',  label: 'Account Manager',  desc: 'Client-facing, manages approvals and reporting' },
  { value: 'strategist',       label: 'Strategist',       desc: 'Strategy tasks and project management' },
  { value: 'copywriter',       label: 'Copywriter',       desc: 'Assigned copy tasks, AI agent access' },
  { value: 'designer',         label: 'Designer',         desc: 'Assigned design tasks, asset library' },
  { value: 'social_manager',   label: 'Social Manager',   desc: 'Publishing, scheduling, and moderation' },
]

// Roles that always get full access (admin can still restrict, but default is all-on)
const FULL_ACCESS_ROLES: UserRole[] = ['admin', 'ceo', 'creative_director']

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all bg-white text-slate-800 placeholder:text-slate-400'

interface Props { onClose: () => void }

export function InviteUserModal({ onClose }: Props) {
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [role, setRole]     = useState<UserRole>('copywriter')
  const [pages, setPages]   = useState<PageKey[]>([...ALL_PAGE_KEYS])
  const [result, setResult] = useState<InviteResult | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null)

  const inviteUser = useInviteUser()

  const allSelected = pages.length === ALL_PAGE_KEYS.length

  const togglePage = (key: PageKey) => {
    setPages(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole)
    // Reset to all-on for senior roles as a sensible default
    if (FULL_ACCESS_ROLES.includes(newRole)) {
      setPages([...ALL_PAGE_KEYS])
    }
  }

  const submit = async () => {
    if (!email.trim() || !name.trim()) return
    setError(null)
    // null means "all pages" — only send an array if something is actually restricted
    const page_permissions: string[] | null = allSelected ? null : pages
    try {
      const res = await inviteUser.mutateAsync({ email: email.trim(), name: name.trim(), role, page_permissions })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account')
    }
  }

  function copyField(value: string, field: 'email' | 'password') {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">Invite Team Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">They will receive an email with login credentials.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {result ? (
          <div className="px-6 py-8">
            {result.emailSent ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-novax-light flex items-center justify-center mx-auto mb-4">
                  <Send className="w-5 h-5 text-novax" />
                </div>
                <p className="font-semibold text-slate-900">Credentials sent</p>
                <p className="text-sm text-slate-500 mt-1">
                  Login credentials were emailed to <span className="font-medium text-slate-700">{email}</span>.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Account created — email failed to send</p>
                    <p className="text-xs text-amber-700 mt-0.5">{result.emailError}</p>
                    <p className="text-xs text-amber-700 mt-1">Share these credentials with <strong>{name}</strong> manually.</p>
                  </div>
                </div>
                {result.fallbackCredentials && (
                  <div className="bg-[#EBF4F3] border-2 border-[#9DCCC8] rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A6B62] mb-3">Login Credentials</p>
                    {([
                      { label: 'Email',    value: result.fallbackCredentials.email,       field: 'email' as const },
                      { label: 'Password', value: result.fallbackCredentials.tempPassword, field: 'password' as const },
                    ] as const).map(({ label, value, field }) => (
                      <div key={field} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#9DCCC8]">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
                          <p className="text-sm font-mono text-slate-900 truncate">{value}</p>
                        </div>
                        <button onClick={() => copyField(value, field)} className="shrink-0 p-1 text-slate-400 hover:text-novax transition-colors">
                          {copiedField === field ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="mt-6 w-full py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">

            {/* Name + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jane@agency.com" className={`${inputCls} pl-9`} />
                </div>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => handleRoleChange(r.value)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      role === r.value ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-novax-border',
                    )}
                  >
                    <p className={cn('text-xs font-semibold', role === r.value ? 'text-novax' : 'text-slate-800')}>{r.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Access */}
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Page Access</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dashboard, Pipeline, Tasks and Settings are always visible.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPages([...ALL_PAGE_KEYS])}
                    className="text-[11px] font-semibold text-novax-muted hover:text-novax"
                  >
                    All
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={() => setPages([])}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {PAGE_GROUPS.map(group => {
                  const groupPages = PAGE_DEFS.filter(p => p.group === group)
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{group}</p>
                      <div className="flex flex-wrap gap-2">
                        {groupPages.map(({ key, label }) => {
                          const checked = pages.includes(key)
                          return (
                            <button
                              key={key}
                              onClick={() => togglePage(key)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                                checked
                                  ? 'bg-novax-light border-novax-border text-novax'
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                              )}
                            >
                              <span className={cn('w-3 h-3 rounded flex items-center justify-center border transition-all shrink-0', checked ? 'bg-novax border-novax' : 'border-slate-300')}>
                                {checked && (
                                  <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none">
                                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-slate-400 mt-3">
                {allSelected
                  ? 'Full access — all optional pages are enabled'
                  : pages.length === 0
                    ? 'Restricted — only required pages will be visible'
                    : `${pages.length} of ${ALL_PAGE_KEYS.length} optional pages enabled`}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!email.trim() || !name.trim() || inviteUser.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {inviteUser.isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
