'use client'

import React, { useState } from 'react'
import { TrendingUp, CheckCircle, Globe, Search, X, Plus, TrendingDown, Lightbulb, AlertTriangle, BarChart2, Zap, Pause, Play } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { useTasks } from '@/lib/hooks/use-tasks'
import { usePosts } from '@/lib/hooks/use-posts'
import { useProjects } from '@/lib/hooks/use-projects'
import { formatDate, cn } from '@/lib/utils'
import type { Client } from '@/lib/types'
import { NewClientWizard } from '@/components/clients/new-client-wizard'

function ClientCard({ client, onSelect, isCrisis, onToggleCrisis }: {
  client: Client
  onSelect: (c: Client) => void
  isCrisis: boolean
  onToggleCrisis: (id: string) => void
}) {
  const { tasks: allTasks } = useTasks()
  const { posts: allPosts } = usePosts()
  const { projects: allProjects } = useProjects()
  const tasks = allTasks.filter(t => t.client_id === client.id)
  const posts = allPosts.filter(p => p.client_id === client.id)
  const projects = allProjects.filter(p => p.client_id === client.id)
  const published = posts.filter(p => p.status === 'published')
  const avgEngagement = published.length
    ? (published.reduce((a, p) => a + (p.performance?.engagement_rate ?? 0), 0) / published.length).toFixed(1)
    : '—'

  return (
    <div onClick={() => onSelect(client)} className={cn('bg-white rounded-2xl border p-5 hover:shadow-md transition-all cursor-pointer group', isCrisis ? 'border-red-200 bg-red-50/30' : 'border-slate-200 hover:border-slate-300')}>
      {/* Crisis banner */}
      {isCrisis && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0"/>
          <p className="text-xs font-semibold text-red-700 flex-1">Crisis Mode — Publishing Paused</p>
          <button
            onClick={e => { e.stopPropagation(); onToggleCrisis(client.id) }}
            className="text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors underline"
          >
            Deactivate
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0" style={{ background: client.color }}>
          {client.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 group-hover:text-novax transition-colors">{client.name}</h3>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                client.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                {client.status}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onToggleCrisis(client.id) }}
                title={isCrisis ? 'Deactivate Crisis Mode' : 'Activate Crisis Mode'}
                className={cn('p-1 rounded-md transition-colors', isCrisis ? 'bg-red-100 text-red-500' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100')}
              >
                {isCrisis ? <Pause className="w-3 h-3"/> : <Pause className="w-3 h-3"/>}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">{client.brand_identity.industry}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Active Tasks', value: tasks.filter(t => t.status === 'active').length, icon: CheckCircle },
          { label: 'Projects', value: projects.length, icon: Globe },
          { label: 'Avg ER', value: `${avgEngagement}%`, icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center p-2 bg-slate-50 rounded-lg">
            <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1"/>
            <p className="text-sm font-bold text-slate-900">{value}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Brand voice */}
      <div className="mb-4">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Brand Voice</p>
        <p className="text-xs text-slate-600 italic">&ldquo;{client.brand_identity.tone_of_voice}&rdquo;</p>
      </div>

      {/* Key messages */}
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Key Messages</p>
        <div className="space-y-1">
          {client.brand_identity.key_messages.slice(0, 2).map((msg, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: client.color }}/>
              <p className="text-[11px] text-slate-600">{msg}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
        {client.metricool_blog_id && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Metricool</span>
        )}
        {client.respond_io_channel_id && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">Respond.io</span>
        )}
        <span className="ml-auto text-[10px] text-slate-400">Since {formatDate(client.created_at)}</span>
      </div>
    </div>
  )
}

const MOCK_INTEL: Record<string, {
  strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[]
  market_position: string; growth_score: number; engagement_trend: string; content_gap: string[]
  key_insights: string[]
}> = {
  'client-1': {
    strengths: ['Strong local brand recognition in coastal communities', 'Authentic food photography performs 3.4x above industry avg', 'High repeat customer engagement on Instagram Stories'],
    weaknesses: ['Limited presence on TikTok — missing Gen Z segment', 'Inconsistent posting schedule reduces algorithm reach', 'No video content strategy — reels underutilized'],
    opportunities: ['Summer season 2026 — food tourism content demand spike', 'Influencer collab untapped — micro foodie accounts in region', 'UGC campaign potential — customers already tagging organically'],
    threats: ['3 competitor restaurants launched social campaigns this quarter', 'Rising ad costs on Meta reducing organic reach viability', 'Negative reviews on Google surfacing in competitor comparison searches'],
    market_position: 'Mid-tier local brand with strong loyalty base. Positioned as authentic and accessible vs. premium competitors.',
    growth_score: 72,
    engagement_trend: '+18% MoM',
    content_gap: ['Behind-the-scenes kitchen content', 'Seasonal menu reveals', 'Staff spotlight series'],
    key_insights: ['Best performing day: Saturday 11am–1pm', 'Audience 68% female, 25–44', 'Stories convert 2.1x better than feed posts for reservations'],
  },
  'client-2': {
    strengths: ['Premium brand perception well-established', 'Beauty tutorial content drives 5x saves vs industry norm', 'Strong email list synergy — social drives newsletter signups'],
    weaknesses: ['Copywriting tone inconsistent across platforms', 'Sensitive skin niche not differentiated clearly in content', 'Respond time on DMs averaging 4.2 hours — losing warm leads'],
    opportunities: ['Clean beauty trend accelerating — strong keyword alignment', 'Dermatologist endorsement content untapped', 'TikTok before/after format highly viral in skincare niche'],
    threats: ['Large competitor launched near-identical sensitive skin line', 'Price-sensitive market segment shifting to drugstore alternatives', 'Algorithm deprioritising beauty content without paid boost'],
    market_position: 'Premium cosmetics with sensitive skin positioning. Differentiated by formulation transparency and dermatological backing.',
    growth_score: 81,
    engagement_trend: '+27% MoM',
    content_gap: ['Ingredient transparency series', 'Real customer skin journeys', 'Side-by-side competitor product comparisons'],
    key_insights: ['Reels with "sensitive skin" in caption get 3.8x more reach', 'Top converting content: tutorial + product tag combo', 'Audience skews 30–45 female, high purchase intent signals'],
  },
}

const DEFAULT_INTEL = {
  strengths: ['Established brand identity with consistent visual language', 'Engaged core audience with above-average retention', 'Clear unique value proposition across platforms'],
  weaknesses: ['Content volume below competitor average', 'Limited use of short-form video formats', 'Audience growth plateaued in past 60 days'],
  opportunities: ['Seasonal campaign window approaching — Q2 trending topics align', 'Platform algorithm changes favour consistent posting cadence', 'Collab opportunities with complementary brands identified'],
  threats: ['Competitor increased ad spend this quarter', 'Market saturation in primary content category', 'Platform policy changes affecting organic reach'],
  market_position: 'Established mid-market brand with loyal core audience. Growth potential in underserved content formats.',
  growth_score: 65,
  engagement_trend: '+9% MoM',
  content_gap: ['Educational how-to content', 'Behind-the-scenes brand story', 'Community spotlight content'],
  key_insights: ['Peak engagement window: weekday evenings 6–9pm', 'Video content outperforms static by 2.4x in this vertical', 'Hashtag strategy needs refresh — current tags over-saturated'],
}

function SwotQuadrant({ title, items, color, bg, icon: Icon }: {
  title: string; items: string[]; color: string; bg: string; icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={cn('p-4 rounded-xl border', bg)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('w-3.5 h-3.5', color)} />
        <p className={cn('text-xs font-bold uppercase tracking-wider', color)}>{title}</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <div className={cn('w-1 h-1 rounded-full mt-1.5 shrink-0', color.replace('text-', 'bg-'))} />
            <p className="text-xs text-slate-700 leading-relaxed">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { tasks: allTasks } = useTasks()
  const { posts: allPosts } = usePosts()
  const [tab, setTab] = useState<'overview' | 'intelligence' | 'tasks'>('overview')
  const tasks = allTasks.filter(t => t.client_id === client.id)
  const posts = allPosts.filter(p => p.client_id === client.id && p.status === 'published')
  const intel = MOCK_INTEL[client.id] ?? DEFAULT_INTEL

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ background: client.color }}>
            {client.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
            <p className="text-sm text-slate-500">{client.brand_identity.industry} · Since {formatDate(client.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 shrink-0"><X className="w-4 h-4"/></button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-100 shrink-0">
          {(['overview', 'intelligence', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-novax-light text-novax' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {tab === 'overview' && <>
            {/* Brand Identity */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Brand Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Tone of Voice</p>
                  <p className="text-sm text-slate-700 italic">&ldquo;{client.brand_identity.tone_of_voice}&rdquo;</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Target Audience</p>
                  <p className="text-sm text-slate-700">{client.brand_identity.target_audience}</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Key Messages</p>
                <div className="space-y-1.5">
                  {client.brand_identity.key_messages.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: client.color }}/>
                      <p className="text-sm text-slate-600">{msg}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Competitors */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Competitor Context</h3>
              <div className="flex flex-wrap gap-2">
                {client.competitor_context.map(c => (
                  <span key={c} className="text-xs px-3 py-1 rounded-full border border-slate-200 text-slate-600">{c}</span>
                ))}
              </div>
            </div>
          </>}

          {tab === 'intelligence' && <>
            {/* Market Position */}
            <div className="p-4 bg-novax-light rounded-xl border border-novax-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-novax-muted uppercase font-bold tracking-wider mb-1">Market Position</p>
                  <p className="text-sm text-slate-700">{intel.market_position}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-novax">{intel.growth_score}</p>
                  <p className="text-[10px] text-slate-400">Growth Score</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-novax-border">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500"/>
                  <span className="text-xs font-semibold text-emerald-600">{intel.engagement_trend}</span>
                  <span className="text-xs text-slate-500">engagement</span>
                </div>
              </div>
            </div>

            {/* SWOT */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">SWOT Analysis</h3>
              <div className="grid grid-cols-2 gap-3">
                <SwotQuadrant title="Strengths" items={intel.strengths} color="text-emerald-600" bg="bg-emerald-50 border-emerald-100" icon={CheckCircle}/>
                <SwotQuadrant title="Weaknesses" items={intel.weaknesses} color="text-red-500" bg="bg-red-50 border-red-100" icon={TrendingDown}/>
                <SwotQuadrant title="Opportunities" items={intel.opportunities} color="text-blue-600" bg="bg-blue-50 border-blue-100" icon={Lightbulb}/>
                <SwotQuadrant title="Threats" items={intel.threats} color="text-amber-600" bg="bg-amber-50 border-amber-100" icon={AlertTriangle}/>
              </div>
            </div>

            {/* Content Gaps */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Content Gaps</h3>
              <div className="flex flex-wrap gap-2">
                {intel.content_gap.map(g => (
                  <span key={g} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                    <Zap className="w-2.5 h-2.5"/>
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Key Insights */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Key Insights</h3>
              <div className="space-y-2">
                {intel.key_insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-5 h-5 rounded-full bg-novax-light flex items-center justify-center shrink-0 mt-0.5">
                      <BarChart2 className="w-2.5 h-2.5 text-novax"/>
                    </div>
                    <p className="text-sm text-slate-700">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {tab === 'tasks' && <>
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Active Tasks ({tasks.filter(t => t.status === 'active').length})</h3>
              <div className="space-y-2">
                {tasks.filter(t => t.status === 'active').length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No active tasks</p>
                )}
                {tasks.filter(t => t.status === 'active').map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm text-slate-700 font-medium">{task.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{task.pipeline_stage?.replace(/_/g, ' ')}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatDate(task.due_date)}</span>
                  </div>
                ))}
              </div>
            </div>
            {posts.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Published Posts ({posts.length})</h3>
                <div className="space-y-2">
                  {posts.slice(0, 5).map(post => (
                    <div key={post.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700 font-medium">{post.caption?.slice(0, 60)}…</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{formatDate(post.scheduled_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const { clients } = useClients()
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [crisisClients, setCrisisClients] = useState<Set<string>>(new Set())

  const toggleCrisis = (id: string) => {
    setCrisisClients(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.brand_identity.industry?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Crisis Mode global alert */}
      {crisisClients.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>
          <p className="text-sm font-semibold text-red-700">
            Crisis Mode active for {crisisClients.size} client{crisisClients.size > 1 ? 's' : ''} — all scheduled publishing is paused.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
          />
        </div>
        <p className="text-sm text-slate-500">{filtered.length} clients</p>
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors ml-auto">
          <Plus className="w-3.5 h-3.5" />New Client
        </button>
      </div>
      {showWizard && <NewClientWizard onClose={() => setShowWizard(false)} onSave={(data) => { console.log('New client:', data); setShowWizard(false) }} />}

      <div className="grid grid-cols-2 gap-4">
        {filtered.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            onSelect={setSelected}
            isCrisis={crisisClients.has(client.id)}
            onToggleCrisis={toggleCrisis}
          />
        ))}
      </div>

      {selected && <ClientDetail client={selected} onClose={() => setSelected(null)}/>}
    </div>
  )
}
