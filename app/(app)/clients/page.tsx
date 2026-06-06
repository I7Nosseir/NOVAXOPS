'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { TrendingUp, CheckCircle, Globe, Search, X, Plus, TrendingDown, Lightbulb, AlertTriangle, BarChart2, Zap, Pause, RefreshCw, ImagePlus } from 'lucide-react'
import { useClients } from '@/lib/hooks/use-clients'
import { supabase } from '@/lib/supabase'
import { useTasks } from '@/lib/hooks/use-tasks'
import { usePosts } from '@/lib/hooks/use-posts'
import { useProjects } from '@/lib/hooks/use-projects'
import { formatDate, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import type { Client, UserRole } from '@/lib/types'
import { NewClientWizard } from '@/components/clients/new-client-wizard'
import { DesignBriefForm } from '@/components/clients/design-brief-form'
import { ContextBankPanel } from '@/components/clients/context-bank-panel'
import { StrategyTab } from '@/components/clients/strategy-tab'
import { useUpdateClient } from '@/lib/hooks/use-clients'
import type { DesignBrief } from '@/lib/types'

function ClientCard({ client, onSelect, isCrisis, onToggleCrisis, userRole }: {
  client: Client
  onSelect: (c: Client) => void
  isCrisis: boolean
  onToggleCrisis: (id: string) => void
  userRole?: UserRole
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
        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white text-base font-bold shrink-0" style={{ background: client.brand_identity?.logo_url ? '#f8fafc' : client.color }}>
          {client.brand_identity?.logo_url
            ? <img src={client.brand_identity.logo_url} alt={client.name} className="w-full h-full object-contain p-1"/>
            : client.initials}
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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{vendorName(userRole, 'Metricool')}</span>
        )}
        {client.respond_io_channel_id && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">{vendorName(userRole, 'Respond.io')}</span>
        )}
        <span className="ml-auto text-[10px] text-slate-400">Since {formatDate(client.created_at)}</span>
      </div>
    </div>
  )
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
  const updateClient = useUpdateClient()
  const [tab, setTab] = useState<'overview' | 'intelligence' | 'tasks' | 'brief' | 'context' | 'strategy'>('overview')
  const [briefSaving, setBriefSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [localIntel, setLocalIntel] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`client_${client.id}_intel`)
      if (cached) { try { return JSON.parse(cached) as typeof client.performance_intel } catch { /* ignore */ } }
    }
    return client.performance_intel ?? null
  })
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(client.performance_analyzed_at ?? null)
  const tasks = allTasks.filter(t => t.client_id === client.id)
  const posts = allPosts.filter(p => p.client_id === client.id && p.status === 'published')
  const intel = localIntel

  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024 || !supabase) return
    setLogoUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `clients/${client.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
        await supabase
          .from('clients')
          .update({ brand_identity_json: { ...client.brand_identity, logo_url: publicUrl } })
          .eq('id', client.id)
        updateClient.mutate({ id: client.id } as Parameters<typeof updateClient.mutate>[0])
      }
    } catch { /* non-critical */ }
    setLogoUploading(false)
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/clients/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          client_data: {
            name: client.name,
            competitor_context: client.competitor_context,
            ...client.brand_identity,
          },
        }),
      })
      const data = await res.json() as { intel?: typeof localIntel; analyzed_at?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      if (data.intel) {
        setLocalIntel(data.intel)
        setAnalyzedAt(data.analyzed_at ?? new Date().toISOString())
        if (typeof window !== 'undefined') {
          localStorage.setItem(`client_${client.id}_intel`, JSON.stringify(data.intel))
        }
        updateClient.mutate({ id: client.id, performance_intel: data.intel } as Parameters<typeof updateClient.mutate>[0])
      }
    } catch (err) {
      console.error('[analyze]', err)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          {/* Logo / avatar — click to upload */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
          />
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            title={client.brand_identity.logo_url ? 'Change logo' : 'Upload logo'}
            className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 group border-2 border-transparent hover:border-novax-border transition-colors"
            style={{ background: client.brand_identity.logo_url ? '#f8fafc' : client.color }}
          >
            {client.brand_identity.logo_url ? (
              <img
                src={client.brand_identity.logo_url}
                alt={`${client.name} logo`}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <span className="text-white text-xl font-bold">{client.initials}</span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
              {logoUploading
                ? <RefreshCw className="w-4 h-4 text-white animate-spin"/>
                : <ImagePlus className="w-4 h-4 text-white"/>}
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
            <p className="text-sm text-slate-500">{client.brand_identity.industry} · Since {formatDate(client.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 shrink-0"><X className="w-4 h-4"/></button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-100 shrink-0 overflow-x-auto">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'intelligence', label: 'Intelligence' },
            { key: 'context', label: 'Context Bank' },
            { key: 'strategy', label: 'Strategy' },
            { key: 'tasks', label: 'Tasks' },
            { key: 'brief', label: 'Design Brief' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                tab === key ? 'bg-novax-light text-novax' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {tab === 'overview' && <>
            {/* Brand Identity */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Brand Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {/* Analyze button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {analyzedAt
                  ? `Last analyzed: ${new Date(analyzedAt).toLocaleDateString()}`
                  : 'Not yet analyzed'}
              </p>
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {analyzing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                {analyzing ? 'Analyzing…' : intel ? 'Re-analyze' : 'Analyze with AI'}
              </button>
            </div>

            {!intel && !analyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Zap className="w-8 h-8 mb-2 text-novax-border"/>
                <p className="text-sm font-medium text-slate-600">No intelligence data yet</p>
                <p className="text-xs mt-1">Click &ldquo;Analyze with AI&rdquo; to generate SWOT, market position, and content recommendations.</p>
              </div>
            )}

            {intel && <>
            {/* Market Position */}
            <div className="p-4 bg-novax-light rounded-xl border border-novax-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-novax-muted uppercase font-bold tracking-wider mb-1">Market Position</p>
                  <p className="text-sm text-slate-700">{intel.market_position ?? '—'}</p>
                </div>
                {intel.growth_score != null && (
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-novax">{intel.growth_score}</p>
                    <p className="text-[10px] text-slate-400">Growth Score</p>
                  </div>
                )}
              </div>
              {intel.engagement_trend && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-novax-border">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500"/>
                    <span className="text-xs font-semibold text-emerald-600">{intel.engagement_trend}</span>
                    <span className="text-xs text-slate-500">engagement</span>
                  </div>
                </div>
              )}
            </div>

            {/* SWOT */}
            {intel.strengths && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">SWOT Analysis</h3>
              <div className="grid grid-cols-2 gap-3">
                <SwotQuadrant title="Strengths" items={intel.strengths ?? []} color="text-emerald-600" bg="bg-emerald-50 border-emerald-100" icon={CheckCircle}/>
                <SwotQuadrant title="Weaknesses" items={intel.weaknesses ?? []} color="text-red-500" bg="bg-red-50 border-red-100" icon={TrendingDown}/>
                <SwotQuadrant title="Opportunities" items={intel.opportunities ?? []} color="text-blue-600" bg="bg-blue-50 border-blue-100" icon={Lightbulb}/>
                <SwotQuadrant title="Threats" items={intel.threats ?? []} color="text-amber-600" bg="bg-amber-50 border-amber-100" icon={AlertTriangle}/>
              </div>
            </div>
            )}

            {/* Content Gaps */}
            {intel.content_gap && intel.content_gap.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Content Gaps</h3>
              <div className="flex flex-wrap gap-2">
                {intel.content_gap.map(g => (
                  <Link
                    key={g}
                    href={`/studio/content?brief=${encodeURIComponent(g)}&client=${client.id}`}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <Zap className="w-2.5 h-2.5"/>
                    {g}
                  </Link>
                ))}
              </div>
            </div>
            )}

            {/* Key Insights */}
            {intel.key_insights && intel.key_insights.length > 0 && (
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
            )}

            {/* 90-day strategy */}
            {intel.strategy_90_days && intel.strategy_90_days.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">90-Day Strategy</h3>
              <div className="space-y-2">
                {intel.strategy_90_days.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-novax-light rounded-lg border border-novax-border">
                    <div className="w-5 h-5 rounded-full bg-novax flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-700 flex-1">{action}</p>
                    <Link
                      href={`/studio/strategy?client=${client.id}`}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-novax-muted bg-white border border-novax-border rounded-md hover:bg-novax hover:text-white transition-colors shrink-0"
                    >
                      <Zap className="w-2.5 h-2.5"/>
                      Strategy
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            )}
            </>}
          </>}

          {tab === 'context' && (
            <ContextBankPanel clientId={client.id}/>
          )}

          {tab === 'strategy' && (
            <StrategyTab clientId={client.id} clientName={client.name}/>
          )}

          {tab === 'brief' && (
            <DesignBriefForm
              brief={client.design_brief_json ?? null}
              clientColor={client.color}
              onSave={async (brief: DesignBrief) => {
                setBriefSaving(true)
                try {
                  await updateClient.mutateAsync({ id: client.id, design_brief_json: brief } as Parameters<typeof updateClient.mutateAsync>[0])
                } finally {
                  setBriefSaving(false)
                }
              }}
              saving={briefSaving}
            />
          )}

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
  const updateClient = useUpdateClient()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [showWizard, setShowWizard] = useState(false)

  const toggleCrisis = (id: string) => {
    const c = clients.find(cl => cl.id === id)
    if (!c) return
    updateClient.mutate({ id, is_in_crisis: !(c.is_in_crisis ?? c.crisis_mode ?? false) } as Parameters<typeof updateClient.mutate>[0])
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.brand_identity.industry?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Crisis Mode global alert */}
      {clients.some(c => c.is_in_crisis ?? c.crisis_mode) && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>
          <p className="text-sm font-semibold text-red-700">
            Crisis Mode active for {clients.filter(c => c.is_in_crisis ?? c.crisis_mode).length} client{clients.filter(c => c.is_in_crisis ?? c.crisis_mode).length > 1 ? 's' : ''} — all scheduled publishing is paused.
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
      {showWizard && (
        <NewClientWizard
          onClose={() => setShowWizard(false)}
          onSave={() => setShowWizard(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            onSelect={setSelected}
            isCrisis={client.is_in_crisis ?? client.crisis_mode ?? false}
            onToggleCrisis={toggleCrisis}
            userRole={user?.role}
          />
        ))}
      </div>

      {selected && <ClientDetail client={selected} onClose={() => setSelected(null)}/>}
    </div>
  )
}
