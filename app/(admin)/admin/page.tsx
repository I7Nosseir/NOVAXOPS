'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Building2, Users, AlertTriangle, Zap, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  total_orgs: number
  active_orgs: number
  total_users: number
  unresolved_errors: number
  critical_errors: number
  ai_calls_today: number
}

function StatCard({ label, value, icon: Icon, href, color = 'text-novax-accent' }: {
  label: string
  value: number | string
  icon: React.ElementType
  href?: string
  color?: string
}) {
  const inner = (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: total_orgs },
          { count: active_orgs },
          { count: total_users },
          { count: unresolved_errors },
          { count: critical_errors },
          { count: ai_calls_today },
        ] = await Promise.all([
          supabase.from('organizations').select('*', { count: 'exact', head: true }),
          supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('error_events').select('*', { count: 'exact', head: true }).eq('resolved', false),
          supabase.from('error_events').select('*', { count: 'exact', head: true }).eq('resolved', false).eq('severity', 'critical'),
          supabase.from('api_usage').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        ])

        setStats({
          total_orgs: total_orgs ?? 0,
          active_orgs: active_orgs ?? 0,
          total_users: total_users ?? 0,
          unresolved_errors: unresolved_errors ?? 0,
          critical_errors: critical_errors ?? 0,
          ai_calls_today: ai_calls_today ?? 0,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-100">Admin Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Cross-organization metrics and system health.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-slate-800 rounded w-24 mb-4" />
              <div className="h-7 bg-slate-800 rounded w-12" />
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Orgs"     value={stats.total_orgs}        icon={Building2}     href="/admin/organizations" />
          <StatCard label="Active Orgs"    value={stats.active_orgs}       icon={TrendingUp}    color="text-green-400" />
          <StatCard label="Total Users"    value={stats.total_users}       icon={Users} />
          <StatCard
            label="Unresolved Errors"
            value={stats.unresolved_errors}
            icon={AlertTriangle}
            href="/admin/errors"
            color={stats.critical_errors > 0 ? 'text-red-400' : 'text-amber-400'}
          />
          <StatCard
            label="Critical Errors"
            value={stats.critical_errors}
            icon={AlertTriangle}
            href="/admin/errors"
            color="text-red-400"
          />
          <StatCard label="AI Calls Today" value={stats.ai_calls_today}    icon={Zap}           color="text-blue-400" />
        </div>
      )}
    </div>
  )
}
