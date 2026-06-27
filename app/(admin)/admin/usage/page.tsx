'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Zap, TrendingUp, DollarSign } from 'lucide-react'

interface UsageRow {
  org_name: string
  calls_today: number
  calls_month: number
  cost_today: number
  cost_month: number
}

export default function AdminUsagePage() {
  const [byOrg, setByOrg] = useState<UsageRow[]>([])
  const [totalToday, setTotalToday] = useState(0)
  const [totalMonth, setTotalMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        // Fetch last 1000 api_usage rows with org info
        const { data: rows } = await supabase
          .from('api_usage')
          .select('organization_id, cost_usd, created_at, organizations(name)')
          .gte('created_at', monthStart.toISOString())
          .order('created_at', { ascending: false })
          .limit(2000)

        if (!rows) return

        const orgMap = new Map<string, UsageRow>()

        for (const row of rows) {
          const orgId   = row.organization_id ?? 'unknown'
          const orgName = (row as unknown as { organizations: { name: string } | null })?.organizations?.name ?? 'Unknown'
          const cost    = row.cost_usd ?? 0
          const isToday = new Date(row.created_at) >= todayStart

          if (!orgMap.has(orgId)) {
            orgMap.set(orgId, { org_name: orgName, calls_today: 0, calls_month: 0, cost_today: 0, cost_month: 0 })
          }
          const entry = orgMap.get(orgId)!
          entry.calls_month++
          entry.cost_month += cost
          if (isToday) {
            entry.calls_today++
            entry.cost_today += cost
          }
        }

        const sorted = Array.from(orgMap.values()).sort((a, b) => b.calls_month - a.calls_month)
        setByOrg(sorted)
        setTotalToday(sorted.reduce((s, r) => s + r.calls_today, 0))
        setTotalMonth(sorted.reduce((s, r) => s + r.calls_month, 0))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Usage Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">AI call volume and cost across all organizations this month.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'AI Calls Today',       value: totalToday.toLocaleString(), icon: Zap },
          { label: 'AI Calls This Month',  value: totalMonth.toLocaleString(), icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
              <Icon size={14} className="text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Organization</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Calls Today</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Calls This Month</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={3} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
              ))
            ) : (
              byOrg.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-3 text-sm text-slate-200 font-medium">{row.org_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 text-right">{row.calls_today.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 text-right">{row.calls_month.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && byOrg.length === 0 && (
          <div className="py-12 text-center text-slate-600 text-sm">No usage data for this month.</div>
        )}
      </div>
    </div>
  )
}
