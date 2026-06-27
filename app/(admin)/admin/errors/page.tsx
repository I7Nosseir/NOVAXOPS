'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Filter, RefreshCw, XCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

interface ErrorEvent {
  id: string
  organization_id: string | null
  user_id: string | null
  route: string
  error_message: string
  error_stack: string | null
  context_json: Record<string, unknown>
  severity: 'info' | 'warning' | 'error' | 'critical'
  resolved: boolean
  created_at: string
}

const SEVERITY_COLORS = {
  info:     { bg: 'bg-blue-900/20',   text: 'text-blue-400',   icon: Info },
  warning:  { bg: 'bg-amber-900/20',  text: 'text-amber-400',  icon: AlertTriangle },
  error:    { bg: 'bg-red-900/15',    text: 'text-red-400',    icon: XCircle },
  critical: { bg: 'bg-red-900/30',    text: 'text-red-300',    icon: XCircle },
}

export default function AdminErrorsPage() {
  const [events, setEvents] = useState<ErrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState<string>('all')
  const [resolved, setResolved] = useState<string>('unresolved')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('error_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (severity !== 'all') q = q.eq('severity', severity)
      if (resolved === 'unresolved') q = q.eq('resolved', false)
      if (resolved === 'resolved')   q = q.eq('resolved', true)

      const { data } = await q
      setEvents((data ?? []) as ErrorEvent[])
    } finally {
      setLoading(false)
    }
  }, [severity, resolved])

  useEffect(() => { load() }, [load])

  async function markResolved(id: string) {
    const { error } = await supabase
      .from('error_events')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e))
      toast.success('Marked as resolved')
    }
  }

  const counts = {
    critical: events.filter(e => e.severity === 'critical' && !e.resolved).length,
    error:    events.filter(e => e.severity === 'error' && !e.resolved).length,
    warning:  events.filter(e => e.severity === 'warning' && !e.resolved).length,
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Error Bank</h1>
          <p className="text-sm text-slate-500 mt-1">All server-side errors across all organizations.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5">
        {counts.critical > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-xs font-semibold">
            <XCircle size={12} /> {counts.critical} critical
          </div>
        )}
        {counts.error > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/15 border border-red-900/30 text-red-400 text-xs font-medium">
            <AlertTriangle size={12} /> {counts.error} errors
          </div>
        )}
        {counts.warning > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-800/30 text-amber-400 text-xs font-medium">
            <AlertTriangle size={12} /> {counts.warning} warnings
          </div>
        )}
        {counts.critical === 0 && counts.error === 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 border border-green-800/30 text-green-400 text-xs font-medium">
            <CheckCircle size={12} /> All clear
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter size={12} />
        </div>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical only</option>
          <option value="error">Error only</option>
          <option value="warning">Warning only</option>
          <option value="info">Info only</option>
        </select>
        <select
          value={resolved}
          onChange={e => setResolved(e.target.value)}
          className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none"
        >
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Error list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(evt => {
            const s = SEVERITY_COLORS[evt.severity]
            const Icon = s.icon
            const isOpen = expanded === evt.id
            return (
              <div key={evt.id} className={cn('border rounded-xl overflow-hidden transition-colors', evt.resolved ? 'border-slate-800/50 opacity-60' : 'border-slate-800')}>
                <button
                  onClick={() => setExpanded(isOpen ? null : evt.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-900/50 transition-colors"
                >
                  <Icon size={14} className={cn('mt-0.5 flex-shrink-0', s.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-bold uppercase tracking-wide', s.text)}>{evt.severity}</span>
                      <code className="text-xs text-slate-500 font-mono">{evt.route}</code>
                      <span className="text-xs text-slate-700">{new Date(evt.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {evt.resolved && <span className="text-xs text-green-600 font-medium">resolved</span>}
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5 truncate">{evt.error_message}</p>
                  </div>
                  {!evt.resolved && (
                    <button
                      onClick={e => { e.stopPropagation(); markResolved(evt.id) }}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                    >
                      <CheckCircle size={12} /> Resolve
                    </button>
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-800">
                    {evt.error_stack && (
                      <pre className="mt-3 p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 overflow-auto max-h-60 whitespace-pre-wrap">
                        {evt.error_stack}
                      </pre>
                    )}
                    {evt.context_json && Object.keys(evt.context_json).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-600 mb-1">Context</p>
                        <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 overflow-auto max-h-40">
                          {JSON.stringify(evt.context_json, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="mt-2 flex gap-4 text-xs text-slate-600">
                      {evt.organization_id && <span>Org: <code className="font-mono">{evt.organization_id}</code></span>}
                      {evt.user_id && <span>User: <code className="font-mono">{evt.user_id}</code></span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {events.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle size={32} className="text-green-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No errors found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
