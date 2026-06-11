'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Sparkles, Loader2, RefreshCw, Globe, MapPin,
  TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  ChevronRight, BarChart2, Target, Zap, Shield, CheckCircle,
} from 'lucide-react'
import { CompetitorCard } from './competitor-card'
import { AddCompetitorDialog } from './add-competitor-dialog'
import type { CompetitorSnapshot, CompetitorAnalysis } from '@/lib/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  clientId:  string
  clientName: string
  industry?: string
}

function ThreatBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   'bg-red-50   text-red-700   border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low:    'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide', map[level])}>
      {level}
    </span>
  )
}

function SectionHeader({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', color)}>
      {icon}
      <span className="text-xs font-semibold">{label}</span>
      <span className="ml-auto text-[10px] font-bold opacity-70">{count}/3</span>
    </div>
  )
}

export function CompetitorsPanel({ clientId, clientName, industry }: Props) {
  const queryClient = useQueryClient()
  const [showAdd,       setShowAdd]       = useState(false)
  const [discovering,   setDiscovering]   = useState(false)
  const [syncingId,     setSyncingId]     = useState<string | null>(null)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [showAnalysis,  setShowAnalysis]  = useState(false)
  const [analysisOpen,  setAnalysisOpen]  = useState<Record<string, boolean>>({
    opportunities: true,
    threats:       false,
    hooks:         false,
    actions:       false,
  })

  // ── Fetch competitors ────────────────────────────────────────────────────
  const { data: compData, isLoading: compLoading } = useQuery<{ competitors: CompetitorSnapshot[] }>({
    queryKey: ['competitors', clientId],
    queryFn:  async () => {
      const res = await fetch(`/api/performance/competitors?client_id=${clientId}`)
      if (!res.ok) throw new Error('Failed to load competitors')
      return res.json() as Promise<{ competitors: CompetitorSnapshot[] }>
    },
  })

  // ── Fetch cached analysis ────────────────────────────────────────────────
  const { data: analysisData, isLoading: analysisLoading } = useQuery<{
    analysis:     CompetitorAnalysis | null
    generated_at?: string
  }>({
    queryKey: ['competitor-analysis', clientId],
    queryFn:  async () => {
      const res = await fetch(`/api/competitors/analyze?client_id=${clientId}`)
      if (!res.ok) return { analysis: null }
      return res.json() as Promise<{ analysis: CompetitorAnalysis | null; generated_at?: string }>
    },
    staleTime: 60 * 60 * 1000,
  })

  const competitors  = compData?.competitors ?? []
  const localComps   = competitors.filter(c => c.scope === 'local')
  const globalComps  = competitors.filter(c => c.scope !== 'local')
  const analysis     = analysisData?.analysis ?? null

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['competitors', clientId] })
  }, [queryClient, clientId])

  const refetchAnalysis = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['competitor-analysis', clientId] })
  }, [queryClient, clientId])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await fetch(`/api/performance/competitors?id=${id}`, { method: 'DELETE' })
    refetch()
  }

  const handleSync = async (id: string, handle: string, platform: string) => {
    setSyncingId(id)
    try {
      await fetch('/api/competitors/scrape', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, handle, platform }),
      })
      refetch()
      toast.success(`Metrics synced for ${handle}`)
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const res = await fetch('/api/competitors/discover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, industry, client_name: clientName }),
      })
      const d = await res.json() as { total?: number; error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Discovery failed')
      refetch()
      toast.success(`Discovered ${d.total ?? 6} competitors`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const handleSyncAll = async () => {
    for (const c of competitors) {
      await handleSync(c.id, c.competitor_handle, c.platform)
    }
  }

  const handleRunAnalysis = async (forceRefresh = false) => {
    setAnalyzing(true)
    setShowAnalysis(true)
    try {
      const res = await fetch('/api/competitors/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, force_refresh: forceRefresh }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Analysis failed')
      refetchAnalysis()
      toast.success('Intelligence report generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleSection = (key: string) =>
    setAnalysisOpen(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!compLoading && competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-novax-light border border-novax-border flex items-center justify-center">
          <Globe className="w-5 h-5 text-novax-muted"/>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">No competitors tracked yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Discover 3 local + 3 global competitors automatically, or add them manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDiscover} disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
            {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5"/>}
            {discovering ? 'Discovering…' : 'Discover with AI'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">
            <Plus className="w-3.5 h-3.5"/>Add Manually
          </button>
        </div>
        {showAdd && (
          <AddCompetitorDialog clientId={clientId} onClose={() => setShowAdd(false)} onAdded={refetch}/>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {competitors.length > 0 && (
            <button onClick={handleSyncAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw className="w-3 h-3"/>Sync All
            </button>
          )}
          <button onClick={handleDiscover} disabled={discovering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-novax-muted bg-novax-light border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors disabled:opacity-50">
            {discovering ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
            {discovering ? 'Discovering…' : 'Re-discover'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors">
            <Plus className="w-3 h-3"/>Add
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {compLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300"/>
        </div>
      )}

      {/* ── Local competitors ─────────────────────────────────────────────── */}
      {!compLoading && (
        <div className="space-y-2">
          <SectionHeader
            icon={<MapPin className="w-3.5 h-3.5 text-blue-600"/>}
            label="Local Competitors"
            count={localComps.length}
            color="bg-blue-50 text-blue-700 border-blue-200"
          />
          {localComps.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">
              No local competitors — click Re-discover or Add manually
            </p>
          ) : (
            localComps.map(c => (
              <CompetitorCard
                key={c.id}
                snapshot={c}
                syncing={syncingId === c.id}
                onDelete={handleDelete}
                onSync={handleSync}
              />
            ))
          )}
        </div>
      )}

      {/* ── Global competitors ────────────────────────────────────────────── */}
      {!compLoading && (
        <div className="space-y-2">
          <SectionHeader
            icon={<Globe className="w-3.5 h-3.5 text-purple-600"/>}
            label="Global Players"
            count={globalComps.length}
            color="bg-purple-50 text-purple-700 border-purple-200"
          />
          {globalComps.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">
              No global players — click Re-discover or Add manually
            </p>
          ) : (
            globalComps.map(c => (
              <CompetitorCard
                key={c.id}
                snapshot={c}
                syncing={syncingId === c.id}
                onDelete={handleDelete}
                onSync={handleSync}
              />
            ))
          )}
        </div>
      )}

      {/* ── Intelligence report CTA / panel ──────────────────────────────── */}
      {competitors.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-3">

          {/* Run analysis button */}
          {!showAnalysis && !analysis && (
            <button
              onClick={() => handleRunAnalysis(false)}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {analyzing
                ? <><Loader2 className="w-4 h-4 animate-spin"/>Generating intelligence report…</>
                : <><BarChart2 className="w-4 h-4"/>Run Competitive Intelligence Analysis</>}
            </button>
          )}

          {/* Show analysis toggle if cached */}
          {analysis && !showAnalysis && (
            <button
              onClick={() => setShowAnalysis(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-novax-light hover:bg-novax-light-hover border border-novax-border text-novax text-xs font-semibold rounded-xl transition-colors">
              <BarChart2 className="w-3.5 h-3.5"/>View Intelligence Report
              <ChevronRight className="w-3.5 h-3.5 ml-auto"/>
            </button>
          )}

          {/* ── Inline analysis panel ─────────────────────────────────── */}
          {(showAnalysis || analysis) && showAnalysis && (
            <div className="space-y-3">

              {/* Analysis header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-novax"/>
                  <span className="text-sm font-semibold text-slate-800">Intelligence Report</span>
                  {analysisData?.generated_at && (
                    <span className="text-[10px] text-slate-400">
                      {new Date(analysisData.generated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunAnalysis(true)}
                    disabled={analyzing}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-novax transition-colors disabled:opacity-40">
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                    Refresh
                  </button>
                  <button onClick={() => setShowAnalysis(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                    Hide
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {(analyzing || analysisLoading) && !analysis && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-novax-muted"/>
                  <p className="text-xs text-slate-400">Building competitive intelligence…</p>
                </div>
              )}

              {analysis && (
                <div className="space-y-2">

                  {/* Summary card */}
                  <div className="p-4 bg-novax-light border border-novax-border rounded-xl">
                    <p className="text-xs leading-relaxed text-slate-700">{analysis.summary}</p>
                  </div>

                  {/* Opportunities ─────────────────────────────────── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('opportunities')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                      <Target className="w-3.5 h-3.5 text-green-600"/>
                      <span className="text-xs font-semibold text-slate-800 flex-1 text-left">Blue Ocean Opportunities</span>
                      <span className="text-[10px] text-slate-400">{analysis.opportunities.length}</span>
                      {analysisOpen.opportunities
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                    </button>
                    {analysisOpen.opportunities && (
                      <div className="px-4 pb-3 space-y-2 bg-white border-t border-slate-100">
                        {analysis.opportunities.map((opp, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0"/>
                            <p className="text-xs text-slate-600 leading-snug">{opp}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Threats ────────────────────────────────────────── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('threats')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500"/>
                      <span className="text-xs font-semibold text-slate-800 flex-1 text-left">Threat Matrix</span>
                      <span className="text-[10px] text-slate-400">{analysis.threats.length} competitors</span>
                      {analysisOpen.threats
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                    </button>
                    {analysisOpen.threats && (
                      <div className="px-4 pb-3 space-y-3 bg-white border-t border-slate-100">
                        {analysis.threats.map((threat, i) => (
                          <div key={i} className="space-y-1.5 pt-3 border-t border-slate-50 first:border-0 first:pt-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">{threat.handle}</span>
                              <ThreatBadge level={threat.threat_level}/>
                            </div>
                            {threat.reasons.map((r, j) => (
                              <div key={j} className="flex items-start gap-2">
                                <TrendingUp className="w-3 h-3 text-red-400 mt-0.5 shrink-0"/>
                                <p className="text-xs text-slate-500 leading-snug">{r}</p>
                              </div>
                            ))}
                            <div className="flex items-start gap-2 mt-2 p-2 bg-green-50 rounded-lg border border-green-100">
                              <Shield className="w-3 h-3 text-green-600 mt-0.5 shrink-0"/>
                              <p className="text-xs text-green-700 leading-snug font-medium">{threat.recommended_response}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hooks ──────────────────────────────────────────── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('hooks')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                      <Zap className="w-3.5 h-3.5 text-amber-500"/>
                      <span className="text-xs font-semibold text-slate-800 flex-1 text-left">Hook Intelligence</span>
                      {analysisOpen.hooks
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                    </button>
                    {analysisOpen.hooks && (
                      <div className="px-4 pb-3 bg-white border-t border-slate-100 space-y-3 pt-3">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Avoid — Saturated</p>
                          {analysis.hooks_to_avoid.map((h, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 shrink-0"/>
                              <p className="text-xs text-slate-600 leading-snug">{h}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Try — High Potential</p>
                          {analysis.hooks_to_try.map((h, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <TrendingUp className="w-3 h-3 text-green-500 mt-0.5 shrink-0"/>
                              <p className="text-xs text-slate-600 leading-snug">{h}</p>
                            </div>
                          ))}
                        </div>
                        {analysis.recommended_formats.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Format Gaps</p>
                            {analysis.recommended_formats.map((f, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <CheckCircle className="w-3 h-3 text-blue-500 mt-0.5 shrink-0"/>
                                <p className="text-xs text-slate-600 leading-snug">{f}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 30-day actions ─────────────────────────────────── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('actions')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                      <BarChart2 className="w-3.5 h-3.5 text-novax-muted"/>
                      <span className="text-xs font-semibold text-slate-800 flex-1 text-left">30-Day Action Plan</span>
                      <span className="text-[10px] text-slate-400">{analysis.monthly_actions.length} actions</span>
                      {analysisOpen.actions
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                    </button>
                    {analysisOpen.actions && (
                      <div className="px-4 pb-3 space-y-2 bg-white border-t border-slate-100">
                        {analysis.monthly_actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-3 pt-2 first:pt-2">
                            <span className="w-5 h-5 rounded-full bg-novax-light border border-novax-border text-[10px] font-bold text-novax-muted flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-xs text-slate-600 leading-snug">{action.replace(/^\d+\.\s*/, '')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddCompetitorDialog
          clientId={clientId}
          onClose={() => setShowAdd(false)}
          onAdded={refetch}
        />
      )}
    </div>
  )
}
