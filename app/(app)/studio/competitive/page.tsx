'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  BarChart2, TrendingUp, AlertTriangle, Lightbulb, Target, Zap,
  Loader2, RefreshCw, ChevronDown, ChevronUp, ExternalLink, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { useClients } from '@/lib/hooks/use-clients'
import { cn, formatNumber } from '@/lib/utils'
import type { CompetitorAnalysis } from '@/lib/types'

const THREAT_COLORS: Record<string, string> = {
  high:   'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-slate-200 bg-slate-50',
}

const THREAT_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-slate-100 text-slate-600',
}

const SIGNAL_COLORS: Record<string, string> = {
  accelerating: 'text-emerald-600 bg-emerald-50',
  stable:       'text-blue-600 bg-blue-50',
  declining:    'text-red-500 bg-red-50',
  unknown:      'text-slate-400 bg-slate-50',
}

function CompetitiveContent() {
  const searchParams = useSearchParams()
  const { clients } = useClients()
  const [clientId, setClientId] = useState(searchParams.get('client') ?? '')
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  // Auto-run if client pre-selected and we have no analysis yet
  useEffect(() => {
    if (clientId && !analysis && !loading) runAnalysis(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function runAnalysis(forceRefresh = false) {
    if (!clientId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, force_refresh: forceRefresh }),
      })
      const d = await res.json() as { analysis?: CompetitorAnalysis; cached?: boolean; error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Analysis failed')
      setAnalysis(d.analysis ?? null)
      setCached(d.cached ?? false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-novax-accent"/>
          <h1 className="text-xl font-bold text-slate-900">Competitive Intelligence</h1>
        </div>
        <p className="text-sm text-slate-500">Discover what competitors are doing — and how to beat them.</p>
      </div>

      {/* Client selector + run */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
          <select
            value={clientId}
            onChange={e => { setClientId(e.target.value); setAnalysis(null) }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-800 cursor-pointer"
          >
            <option value="">Select a client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => runAnalysis(!!analysis)}
          disabled={!clientId || loading}
          className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Analyzing…</> : <><Zap className="w-4 h-4"/>{analysis ? 'Re-analyze' : 'Run Analysis'}</>}
        </button>
        {selectedClient && (
          <Link href={`/clients?open=${clientId}`} className="flex items-center gap-1 text-xs text-novax-muted hover:text-novax transition-colors">
            <ExternalLink className="w-3 h-3"/>Manage competitors
          </Link>
        )}
      </div>

      {cached && analysis && (
        <p className="text-xs text-slate-400 -mt-4">
          Showing cached analysis · <button onClick={() => runAnalysis(true)} className="underline hover:text-slate-600">Refresh</button>
        </p>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {!clientId && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <BarChart2 className="w-10 h-10 text-slate-200"/>
          <p className="text-sm font-medium text-slate-500">Select a client to begin</p>
          <p className="text-xs text-center max-w-xs">The analysis uses tracked competitors from the client profile. Add competitors in the Clients page first.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-novax-accent"/>
          <p className="text-sm text-slate-500 font-medium">Running competitive analysis…</p>
          <p className="text-xs text-slate-400">This takes 10–20 seconds</p>
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* Summary */}
          <div className="p-5 bg-gradient-to-r from-[#1B3D38] to-[#2A6B62] rounded-2xl text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">Intelligence Summary</p>
            <p className="text-sm leading-relaxed opacity-90">{analysis.summary}</p>
            <p className="text-[10px] opacity-50 mt-3">
              Generated {new Date(analysis.generated_at).toLocaleDateString()}
            </p>
          </div>

          {/* Section 1: Landscape */}
          {analysis.landscape.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-novax-muted"/>
                Competitive Landscape
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Competitor</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Followers</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg ER</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Posts/wk</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.landscape.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-semibold text-slate-800">{c.handle}</span>
                            <span className="ml-2 text-[10px] text-slate-400">{c.platform}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatNumber(c.followers)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{c.avg_er.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-slate-600">{c.posting_frequency}×</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', SIGNAL_COLORS[c.growth_signal])}>
                            {c.growth_signal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: Opportunities + Hooks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analysis.opportunities.length > 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-emerald-600"/>
                  <h3 className="font-semibold text-sm text-emerald-800">Content Opportunities</h3>
                </div>
                <ul className="space-y-2">
                  {analysis.opportunities.map((opp, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-emerald-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"/>
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {analysis.hooks_to_try.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Hooks to Try</p>
                  <ul className="space-y-1.5">
                    {analysis.hooks_to_try.map((h, i) => (
                      <li key={i} className="text-xs text-blue-600 flex items-start gap-1.5">
                        <span className="text-blue-400 shrink-0 mt-0.5">+</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.hooks_to_avoid.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Hooks to Avoid</p>
                  <ul className="space-y-1.5">
                    {analysis.hooks_to_avoid.map((h, i) => (
                      <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                        <span className="text-amber-400 shrink-0 mt-0.5">—</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Threat Assessment */}
          {analysis.threats.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500"/>
                Threat Assessment
              </h2>
              <div className="space-y-3">
                {analysis.threats.map((t, i) => (
                  <div key={i} className={cn('border rounded-xl overflow-hidden', THREAT_COLORS[t.threat_level])}>
                    <button
                      onClick={() => setExpandedThreat(expandedThreat === t.handle ? null : t.handle)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', THREAT_BADGE[t.threat_level])}>
                        {t.threat_level}
                      </span>
                      <span className="font-semibold text-sm text-slate-800 flex-1">{t.handle}</span>
                      <span className="text-[10px] text-slate-400">{t.platform}</span>
                      {expandedThreat === t.handle
                        ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0"/>
                        : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0"/>}
                    </button>
                    {expandedThreat === t.handle && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-200 pt-3">
                        <ul className="space-y-1.5">
                          {t.reasons.map((r, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-slate-700">
                              <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0"/>
                              {r}
                            </li>
                          ))}
                        </ul>
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Recommended Response</p>
                          <p className="text-xs text-slate-700">{t.recommended_response}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Monthly Actions */}
          {analysis.monthly_actions.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-novax-muted"/>
                This Month&apos;s Actions
              </h2>
              <div className="space-y-2">
                {analysis.monthly_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-novax-light border border-novax-border rounded-lg">
                    <div className="w-5 h-5 rounded-full bg-novax flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-700 flex-1">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inject into Studio tools */}
          <div>
            <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-novax-muted"/>
              Use This Intelligence
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: `/studio/hooks?client=${clientId}`,    label: 'Hook Lab',        desc: 'Hooks pre-differentiated from competitors' },
                { href: `/studio/campaign?client=${clientId}`, label: 'Campaign Igniter', desc: 'Briefs shaped by competitive gaps' },
                { href: `/studio/strategy?client=${clientId}`, label: 'Strategy Studio',  desc: 'Strategy that addresses each threat' },
              ].map(tool => (
                <Link key={tool.href} href={tool.href}
                  className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-novax-border hover:bg-novax-light/30 transition-all group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-novax transition-colors">{tool.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{tool.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-novax transition-colors shrink-0"/>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function CompetitivePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-300"/></div>}>
      <CompetitiveContent/>
    </Suspense>
  )
}
