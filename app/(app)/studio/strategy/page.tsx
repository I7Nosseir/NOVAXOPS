'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Brain, ArrowLeft, ChevronDown, ChevronUp,
  Loader2, CheckCircle, RefreshCw, Zap, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────
type MetaPhase = 'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize'

interface MetaConfig {
  key: MetaPhase
  label: string
  subtitle: string
  phases: string
  icon: React.ElementType
}

const META_PHASES: MetaConfig[] = [
  { key: 'intelligence', label: 'Intelligence',     subtitle: 'Market + Audience Analysis',            phases: 'Phases 1–3',   icon: Brain    },
  { key: 'positioning',  label: 'Positioning',      subtitle: 'Brand Archetype + UVP + Messaging',     phases: 'Phases 4–6',   icon: Zap      },
  { key: 'execution',    label: 'Execution System', subtitle: 'Content Pillars + Platform Strategy',   phases: 'Phases 7–11',  icon: CheckCircle },
  { key: 'scale',        label: 'Scale & Retain',   subtitle: 'Community + Paid + Retargeting',        phases: 'Phases 12–13', icon: ArrowRight },
  { key: 'optimize',     label: 'Optimize',         subtitle: 'A/B Testing + Category Ownership',      phases: 'Phases 14–17', icon: RefreshCw },
]

function DataSection({ title, data }: { title: string; data: unknown }) {
  if (!data) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {title.replace(/_/g, ' ')}
      </p>
      {Array.isArray(data) ? (
        <ul className="space-y-0.5">
          {(data as string[]).map((item, i) => (
            <li key={i} className="text-xs text-slate-700 flex gap-1.5">
              <span className="text-novax-accent shrink-0 mt-0.5">·</span>
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </li>
          ))}
        </ul>
      ) : typeof data === 'object' && data !== null ? (
        <div className="space-y-1.5 pl-2 border-l-2 border-novax-light">
          {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
            <DataSection key={k} title={k} data={v} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-700">{String(data)}</p>
      )}
    </div>
  )
}

function MetaCard({
  config,
  data,
  loading,
  onGenerate,
}: {
  config: MetaConfig
  data: Record<string, unknown> | null
  loading: boolean
  onGenerate: () => void
}) {
  const [open, setOpen] = useState(!!data)
  const done = !!data

  return (
    <div className={cn(
      'bg-white border rounded-2xl overflow-hidden transition-all',
      done ? 'border-novax-border' : 'border-slate-200',
    )}>
      <div
        className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          done ? 'bg-novax text-white' : 'bg-slate-100 text-slate-400',
        )}>
          {done
            ? <CheckCircle className="w-5 h-5" />
            : <config.icon className="w-5 h-5" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{config.label}</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{config.phases}</span>
          </div>
          <p className="text-xs text-slate-500">{config.subtitle}</p>
        </div>
        {done && (
          <button
            onClick={e => { e.stopPropagation(); onGenerate() }}
            className="p-1.5 text-slate-400 hover:text-novax-muted hover:bg-novax-light rounded-lg transition-colors"
            title="Regenerate"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-slate-100 p-5">
          {data ? (
            <div className="space-y-4">
              {Object.entries(data).map(([key, value]) => (
                <DataSection key={key} title={key} data={value} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <config.icon className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm text-slate-500 mb-4">Generate AI analysis for this strategy phase</p>
              <button
                onClick={onGenerate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                  : <><Zap className="w-4 h-4" />Generate {config.label}</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const params      = useSearchParams()
  const { clients } = useClients()

  const [clientId,   setClientId]  = useState(params?.get('client') ?? '')
  const [loadingMeta, setLoading]  = useState<MetaPhase | null>(null)
  const [error,      setError]     = useState<string | null>(null)
  const [metaData,   setMetaData]  = useState<Partial<Record<MetaPhase, Record<string, unknown>>>>({})

  const selectedClient = clients.find(c => c.id === clientId)

  const handleGenerate = async (meta: MetaPhase) => {
    if (!selectedClient) return
    setLoading(meta)
    setError(null)

    try {
      const res = await fetch('/api/studio/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    selectedClient.id,
          client_name:  selectedClient.name,
          industry:     selectedClient.brand_identity?.industry,
          brand_voice:  selectedClient.brand_identity?.tone_of_voice,
          key_messages: selectedClient.brand_identity?.key_messages,
          platforms:    selectedClient.brand_identity?.platforms,
          competitors:  selectedClient.brand_identity?.competitors,
          meta,
          existing_data: metaData,
        }),
      })
      const result = await res.json() as { data?: Record<string, unknown>; error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Generation failed')
      setMetaData(prev => ({ ...prev, [meta]: result.data }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(null)
    }
  }

  const completedCount = Object.keys(metaData).length

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-novax-accent" />
            Strategy Command Center
          </h1>
          <p className="text-xs text-slate-500">17-phase marketing strategy as a living document</p>
        </div>
        {completedCount > 0 && (
          <div className="text-xs text-novax-muted bg-novax-light border border-novax-border px-2.5 py-1 rounded-full font-medium">
            {completedCount}/5 phases complete
          </div>
        )}
      </div>

      {/* Client selector */}
      <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl">
        <label className="block text-xs font-semibold text-slate-700 mb-2">Select Client</label>
        <select
          value={clientId}
          onChange={e => { setClientId(e.target.value); setMetaData({}) }}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
        >
          <option value="">Choose a client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClient && (
          <p className="text-xs text-slate-400 mt-1.5">
            {selectedClient.brand_identity?.industry} · {selectedClient.brand_identity?.tone_of_voice}
          </p>
        )}
      </div>

      {!clientId && (
        <div className="flex flex-col items-center py-12 text-center">
          <Brain className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Select a client to start building their strategy</p>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {clientId && (
        <>
          {/* Generate All button */}
          {completedCount === 0 && (
            <div className="mb-5 p-4 bg-novax-light border border-novax-border rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-novax">Start with Intelligence Analysis</p>
                <p className="text-xs text-novax-muted mt-0.5">Generate all 5 meta-phases sequentially, or run them individually</p>
              </div>
              <button
                onClick={() => handleGenerate('intelligence')}
                disabled={!!loadingMeta}
                className="flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
              >
                {loadingMeta === 'intelligence'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Zap className="w-4 h-4" />
                }
                Start
              </button>
            </div>
          )}

          <div className="space-y-4">
            {META_PHASES.map(config => (
              <MetaCard
                key={config.key}
                config={config}
                data={metaData[config.key] ?? null}
                loading={loadingMeta === config.key}
                onGenerate={() => handleGenerate(config.key)}
              />
            ))}
          </div>

          {/* Export to docs */}
          {completedCount >= 2 && (
            <div className="mt-6 flex gap-3">
              <Link
                href="/studio/content"
                className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Create Content from Strategy
              </Link>
              <Link
                href={`/docs`}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                Save as Document
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
