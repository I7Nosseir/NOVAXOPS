'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Organization } from '@/lib/types'
import { Building2, Users, CreditCard, AlertTriangle, CheckCircle, XCircle, Clock, Search } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  trial:       'Trial',
  starter:     'Starter',
  growth:      'Growth',
  agency:      'Agency',
  white_label: 'White Label',
}

const PLAN_COLORS: Record<string, string> = {
  trial:       'bg-slate-800 text-slate-300',
  starter:     'bg-amber-900/40 text-amber-300',
  growth:      'bg-blue-900/40 text-blue-300',
  agency:      'bg-novax/20 text-novax-accent',
  white_label: 'bg-purple-900/40 text-purple-300',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  active:    CheckCircle,
  suspended: AlertTriangle,
  cancelled: XCircle,
}
const STATUS_COLORS: Record<string, string> = {
  active:    'text-green-400',
  suspended: 'text-amber-400',
  cancelled: 'text-red-400',
}

interface OrgRow extends Organization {
  user_count?: number
  client_count?: number
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setOrgs(data as OrgRow[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  )

  async function updateStatus(orgId: string, status: string) {
    const { error } = await supabase
      .from('organizations')
      .update({ status })
      .eq('id', orgId)
    if (!error) {
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, status: status as Organization['status'] } : o))
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Organizations</h1>
          <p className="text-sm text-slate-500 mt-1">{orgs.length} total workspaces</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orgs..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 rounded-xl border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Credits</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((org, i) => {
                const StatusIcon = STATUS_ICONS[org.status] ?? CheckCircle
                const pct = org.credits_monthly > 0 ? Math.round((org.credits_used / org.credits_monthly) * 100) : 0
                return (
                  <tr key={org.id} className={cn('border-b border-slate-800/50 last:border-0', i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{org.name}</p>
                          <p className="text-xs text-slate-600">{org.slug}.novaxops.com</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', PLAN_COLORS[org.plan])}>
                        {PLAN_LABELS[org.plan] ?? org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1.5 text-xs', STATUS_COLORS[org.status])}>
                        <StatusIcon size={12} />
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs text-slate-400">
                        <span className={pct >= 90 ? 'text-red-400 font-semibold' : ''}>{org.credits_used.toLocaleString()}</span>
                        <span className="text-slate-600"> / {org.credits_monthly.toLocaleString()}</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full mt-1 w-20 ml-auto">
                        <div
                          className={cn('h-full rounded-full', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-500')}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={org.status}
                        onChange={e => updateStatus(org.id, e.target.value)}
                        className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspend</option>
                        <option value="cancelled">Cancel</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-600 text-sm">No organizations found</div>
          )}
        </div>
      )}
    </div>
  )
}
