'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { usePosts } from '@/lib/hooks/use-posts'
import { PLATFORM_CONFIG, formatNumber, cn } from '@/lib/utils'
import { FileText, TrendingUp, Users, Eye, Download, Send } from 'lucide-react'
import type { SocialPlatform } from '@/lib/types'

const MONTHLY_DATA = [
  { month: 'Jan', reach: 82000,  impressions: 124000, engagement: 4.1 },
  { month: 'Feb', reach: 95000,  impressions: 143000, engagement: 4.8 },
  { month: 'Mar', reach: 118000, impressions: 178000, engagement: 5.2 },
  { month: 'Apr', reach: 142000, impressions: 215000, engagement: 6.1 },
  { month: 'May', reach: 164000, impressions: 247000, engagement: 5.9 },
]

const PLATFORM_DATA: { platform: SocialPlatform; posts: number; reach: number; engagement: number }[] = [
  { platform: 'instagram', posts: 24, reach: 98000,  engagement: 6.8 },
  { platform: 'facebook',  posts: 18, reach: 34000,  engagement: 3.2 },
  { platform: 'linkedin',  posts: 12, reach: 22000,  engagement: 4.5 },
  { platform: 'tiktok',    posts: 8,  reach: 71000,  engagement: 9.1 },
]

export default function ReportsPage() {
  const { clients } = useClients()
  const { posts } = usePosts()
  const [selectedClient, setSelectedClient] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const publishedPosts = posts.filter(p => p.status === 'published')
  const totalReach = publishedPosts.reduce((a, p) => a + (p.performance?.reach ?? 0), 0)
  const totalImpressions = publishedPosts.reduce((a, p) => a + (p.performance?.impressions ?? 0), 0)
  const avgEngagement = publishedPosts.length
    ? publishedPosts.reduce((a, p) => a + (p.performance?.engagement_rate ?? 0), 0) / publishedPosts.length
    : 0
  const totalLikes = publishedPosts.reduce((a, p) => a + (p.performance?.likes ?? 0), 0)

  const handleGenerate = async () => {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    setGenerating(false)
    setGenerated(true)
  }

  return (
    <div className="space-y-5">
      {/* Report builder */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Report Builder</h3>
            <p className="text-xs text-slate-500">Generate client-ready performance reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted bg-white transition-all"
            >
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted bg-white transition-all">
              <option>May 2025</option>
              <option>April 2025</option>
              <option>Q1 2025</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5"/>
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>

        {generated && (
          <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-600"/>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800">May_2025_Performance_Report.pptx</p>
                <p className="text-xs text-emerald-600">12 slides · Generated just now</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                <Download className="w-3 h-3"/> Download
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-medium text-white transition-colors">
                <Send className="w-3 h-3"/> Send to Client
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Reach',     value: formatNumber(totalReach),      icon: Eye,        color: 'bg-blue-50 text-blue-600',    delta: '+18% vs Apr' },
          { label: 'Total Impressions', value: formatNumber(totalImpressions), icon: TrendingUp, color: 'bg-purple-50 text-purple-600', delta: '+22% vs Apr' },
          { label: 'Avg Eng. Rate',   value: `${avgEngagement.toFixed(1)}%`, icon: Users,      color: 'bg-amber-50 text-amber-600',  delta: '+0.8% vs Apr' },
          { label: 'Total Likes',     value: formatNumber(totalLikes),       icon: TrendingUp, color: 'bg-rose-50 text-rose-600',    delta: '+31% vs Apr' },
        ].map(({ label, value, icon: Icon, color, delta }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4"/></div>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">{delta}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Reach Growth</h3>
          <p className="text-xs text-slate-500 mb-4">Monthly reach across all clients</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MONTHLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)}/>
              <Tooltip formatter={(v) => formatNumber(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
              <Line type="monotone" dataKey="reach" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Engagement Rate by Month</h3>
          <p className="text-xs text-slate-500 mb-4">Average ER across all platforms</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
              <Bar dataKey="engagement" fill="#10b981" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Platform Breakdown</h3>
        <div className="space-y-3">
          {PLATFORM_DATA.map(({ platform, posts, reach, engagement }) => {
            const cfg = PLATFORM_CONFIG[platform]
            const maxReach = Math.max(...PLATFORM_DATA.map(p => p.reach))
            return (
              <div key={platform} className="flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <span className="text-xs font-semibold text-slate-700">{cfg.label}</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(reach / maxReach) * 100}%`, background: cfg.color }}/>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-xs">
                  <span className="text-slate-500 w-16 text-right">{formatNumber(reach)} reach</span>
                  <span className="text-slate-500 w-10 text-right">{posts} posts</span>
                  <span className="font-semibold text-slate-700 w-12 text-right">{engagement}% ER</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-client performance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Client Performance</h3>
        <div className="grid grid-cols-2 gap-4">
          {clients.map(client => {
            const clientPosts = posts.filter(p => p.client_id === client.id && p.performance)
            const reach = clientPosts.reduce((a, p) => a + (p.performance?.reach ?? 0), 0)
            const er = clientPosts.length ? (clientPosts.reduce((a, p) => a + (p.performance?.engagement_rate ?? 0), 0) / clientPosts.length).toFixed(1) : '—'
            return (
              <div key={client.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: client.color }}>
                  {client.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                  <p className="text-[11px] text-slate-400">{posts.length} published posts</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">{formatNumber(reach)}</p>
                  <p className="text-[10px] text-slate-400">reach · {er}% ER</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
