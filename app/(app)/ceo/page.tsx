'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Crown, Shield, Activity, Brain, AlertTriangle, MessageSquare,
  ChevronDown, ChevronUp, Copy, Check, Loader2, TrendingUp,
  TrendingDown, Minus, Users, BarChart2, Zap, Scale,
  CheckCircle2, Target, Lightbulb, GitBranch, ShieldAlert,
  Calendar, FileText, AlertCircle, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { useTasks } from '@/lib/hooks/use-tasks'
import { usePosts } from '@/lib/hooks/use-posts'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { cn } from '@/lib/utils'
import type { Client } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'health' | 'strategy' | 'crisis' | 'second_opinion' | 'agent'

interface GeneratedResult {
  content: string
  loading: boolean
  error: string | null
  expanded: boolean
}

function emptyResult(): GeneratedResult {
  return { content: '', loading: false, error: null, expanded: false }
}

interface QuarterlyStrategy {
  id?: string
  goals: string
  themes: string
  kpis: string
  notes: string
}

interface MonthlyUpdate {
  id?: string
  content_summary: string
  what_worked: string
  what_didnt: string
  posts_published: number
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getCurrentQuarterInfo() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return { year, quarter: Math.ceil(month / 3) }
}

function getCurrentMonthInfo() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ id, active, icon: Icon, label, onClick }: {
  id: Tab; active: boolean; icon: React.ElementType; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-novax text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-novax transition-colors px-2 py-1 rounded hover:bg-novax-light"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ResultPanel({ result, onToggle }: {
  result: GeneratedResult
  onToggle: () => void
}) {
  if (result.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 py-4 px-4 bg-slate-50 rounded-lg border border-slate-200">
        <Loader2 className="w-4 h-4 animate-spin text-novax" />
        Generating analysis...
      </div>
    )
  }
  if (result.error) {
    return (
      <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {result.error}
      </div>
    )
  }
  if (!result.content) return null

  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-600">Analysis Result</span>
        <div className="flex items-center gap-2">
          <CopyButton text={result.content} />
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded"
          >
            {result.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {result.expanded && (
        <div className="px-4 py-4 bg-white">
          <MarkdownContent content={result.content} />
        </div>
      )}
    </div>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-novax-light flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-novax" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Context Form ──────────────────────────────────────────────────────────────

function ContextStatusBadge({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />Set
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" />Required
    </span>
  )
}

interface ClientContextCardProps {
  clientId: string
  strategyForm: QuarterlyStrategy
  monthlyForm: MonthlyUpdate
  hasStrategy: boolean
  hasMonthly: boolean
  saving: boolean
  savingMonthly: boolean
  loading: boolean
  quarterLabel: string
  monthLabel: string
  onStrategyChange: (f: QuarterlyStrategy) => void
  onMonthlyChange: (f: MonthlyUpdate) => void
  onSaveStrategy: () => void
  onSaveMonthly: () => void
}

function ClientContextCard({
  strategyForm, monthlyForm, hasStrategy, hasMonthly,
  saving, savingMonthly, loading, quarterLabel, monthLabel,
  onStrategyChange, onMonthlyChange, onSaveStrategy, onSaveMonthly,
}: ClientContextCardProps) {
  const [strategyOpen, setStrategyOpen] = useState(!hasStrategy)
  const [monthlyOpen, setMonthlyOpen] = useState(!hasMonthly)

  useEffect(() => {
    if (!hasStrategy) setStrategyOpen(true)
    if (!hasMonthly) setMonthlyOpen(true)
  }, [hasStrategy, hasMonthly])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />Loading client context...
      </div>
    )
  }

  const textareaClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax bg-white"

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-novax" />
          <p className="text-sm font-semibold text-slate-900">Client Strategy Context</p>
        </div>
        <p className="text-xs text-slate-400">Required before analysis runs</p>
      </div>

      {/* Quarterly Strategy */}
      <div className="border-b border-slate-100">
        <button
          onClick={() => setStrategyOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-800">{quarterLabel} Strategy</span>
            <ContextStatusBadge ok={hasStrategy} />
          </div>
          {strategyOpen
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {strategyOpen && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Goals <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={strategyForm.goals}
                onChange={e => onStrategyChange({ ...strategyForm, goals: e.target.value })}
                placeholder="What are we trying to achieve this quarter? Growth goals, brand objectives, campaign targets..."
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Content Themes <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={strategyForm.themes}
                onChange={e => onStrategyChange({ ...strategyForm, themes: e.target.value })}
                placeholder="Main content pillars and themes for this quarter (e.g. product launches, seasonal campaigns, brand storytelling)..."
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">KPIs / Success Metrics</label>
              <textarea
                rows={2}
                value={strategyForm.kpis}
                onChange={e => onStrategyChange({ ...strategyForm, kpis: e.target.value })}
                placeholder="How we will measure success — reach targets, engagement rates, follower growth, sales impact..."
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Additional Context</label>
              <textarea
                rows={2}
                value={strategyForm.notes}
                onChange={e => onStrategyChange({ ...strategyForm, notes: e.target.value })}
                placeholder="Budget constraints, key events, partnerships, anything the AI should know about this quarter..."
                className={textareaClass}
              />
            </div>
            <button
              onClick={onSaveStrategy}
              disabled={saving || !strategyForm.goals.trim() || !strategyForm.themes.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Strategy'}
            </button>
          </div>
        )}
      </div>

      {/* Monthly Update */}
      <div>
        <button
          onClick={() => setMonthlyOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-800">{monthLabel} Update</span>
            <ContextStatusBadge ok={hasMonthly} />
          </div>
          {monthlyOpen
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {monthlyOpen && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Content Published <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={monthlyForm.content_summary}
                onChange={e => onMonthlyChange({ ...monthlyForm, content_summary: e.target.value })}
                placeholder="What content did we publish this month? Campaigns, posts, formats used, platforms covered..."
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">What Worked</label>
              <textarea
                rows={2}
                value={monthlyForm.what_worked}
                onChange={e => onMonthlyChange({ ...monthlyForm, what_worked: e.target.value })}
                placeholder="Which posts or formats overperformed? Any surprises or standout moments?"
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">What Did Not Work</label>
              <textarea
                rows={2}
                value={monthlyForm.what_didnt}
                onChange={e => onMonthlyChange({ ...monthlyForm, what_didnt: e.target.value })}
                placeholder="What underperformed? Any failed experiments or audience misses?"
                className={textareaClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Posts Published</label>
              <input
                type="number"
                min={0}
                value={monthlyForm.posts_published}
                onChange={e => onMonthlyChange({ ...monthlyForm, posts_published: parseInt(e.target.value) || 0 })}
                className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Additional Observations</label>
              <textarea
                rows={2}
                value={monthlyForm.notes}
                onChange={e => onMonthlyChange({ ...monthlyForm, notes: e.target.value })}
                placeholder="Client feedback, competitor activity, platform changes, anything relevant..."
                className={textareaClass}
              />
            </div>
            <button
              onClick={onSaveMonthly}
              disabled={savingMonthly || !monthlyForm.content_summary.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {savingMonthly ? 'Saving...' : 'Save Update'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Context Status Banner ─────────────────────────────────────────────────────

function ContextBanner({
  hasStrategy, hasMonthly, quarterLabel, monthLabel,
}: {
  hasStrategy: boolean; hasMonthly: boolean; quarterLabel: string; monthLabel: string
}) {
  if (hasStrategy && hasMonthly) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700 font-medium">Strategy context complete — all analysis tools are active.</p>
      </div>
    )
  }
  const missing: string[] = []
  if (!hasStrategy) missing.push(`${quarterLabel} strategy`)
  if (!hasMonthly) missing.push(`${monthLabel} content update`)
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-700">
        <span className="font-semibold">Analysis locked.</span>{' '}
        Missing: {missing.join(' and ')}. Fill in the context above to enable generation.
      </p>
    </div>
  )
}

// ─── Agency Health Tab ─────────────────────────────────────────────────────────

function AgencyHealthTab({ clients, tasks, posts }: {
  clients: Client[]
  tasks: ReturnType<typeof useTasks>['tasks']
  posts: ReturnType<typeof usePosts>['posts']
}) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())

  const activeTasks = tasks.filter(t => t.status === 'active')
  const overdueTasks = tasks.filter(t => t.status === 'active' && t.due_date && new Date(t.due_date) < now)
  const crisisClients = clients.filter(c => c.is_in_crisis)
  const postsThisWeek = posts.filter(p => {
    const d = new Date(p.scheduled_at)
    return d >= weekStart && d <= now
  })

  const stats = [
    { label: 'Active Clients', value: clients.filter(c => c.status === 'active').length, icon: Users, color: 'text-novax', bg: 'bg-novax-light' },
    { label: 'Active Tasks', value: activeTasks.length, icon: Activity, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Clients in Crisis', value: crisisClients.length, icon: AlertTriangle, color: crisisClients.length > 0 ? 'text-red-600' : 'text-slate-400', bg: crisisClients.length > 0 ? 'bg-red-50' : 'bg-slate-50' },
    { label: 'Overdue Tasks', value: overdueTasks.length, icon: Shield, color: overdueTasks.length > 0 ? 'text-amber-600' : 'text-slate-400', bg: overdueTasks.length > 0 ? 'bg-amber-50' : 'bg-slate-50' },
    { label: 'Posts This Week', value: postsThisWeek.length, icon: BarChart2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon className={cn('w-4.5 h-4.5', color)} style={{ width: 18, height: 18 }} />
            </div>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Client Health Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {clients.map(client => {
            const clientTasks = tasks.filter(t => t.client_id === client.id && t.status === 'active')
            const clientOverdue = clientTasks.filter(t => t.due_date && new Date(t.due_date) < now)
            const inCrisis = client.is_in_crisis

            let healthLabel: string
            let healthColor: string
            let healthBg: string
            let HealthIcon: React.ElementType

            if (inCrisis) {
              healthLabel = 'In Crisis'; healthColor = 'text-red-700'; healthBg = 'bg-red-50'; HealthIcon = AlertTriangle
            } else if (clientOverdue.length > 0) {
              healthLabel = 'At Risk'; healthColor = 'text-amber-700'; healthBg = 'bg-amber-50'; HealthIcon = TrendingDown
            } else if (clientTasks.length > 0) {
              healthLabel = 'Healthy'; healthColor = 'text-emerald-700'; healthBg = 'bg-emerald-50'; HealthIcon = TrendingUp
            } else {
              healthLabel = 'Quiet'; healthColor = 'text-slate-500'; healthBg = 'bg-slate-50'; HealthIcon = Minus
            }

            return (
              <div
                key={client.id}
                className={cn('bg-white rounded-xl border p-4 flex items-center gap-4', inCrisis ? 'border-red-200' : 'border-slate-200')}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: client.color }}
                >
                  {client.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{client.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{client.brand_identity?.industry ?? 'No industry set'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-center">
                  <div>
                    <p className="text-base font-bold text-slate-900">{clientTasks.length}</p>
                    <p className="text-[10px] text-slate-400">Active</p>
                  </div>
                  {clientOverdue.length > 0 && (
                    <div>
                      <p className="text-base font-bold text-red-600">{clientOverdue.length}</p>
                      <p className="text-[10px] text-slate-400">Overdue</p>
                    </div>
                  )}
                  <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full', healthColor, healthBg)}>
                    <HealthIcon className="w-3 h-3" />
                    {healthLabel}
                  </span>
                </div>
              </div>
            )
          })}
          {clients.length === 0 && (
            <div className="col-span-2 text-center py-8 text-slate-400 text-sm">No clients found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Strategy Intelligence Tab ─────────────────────────────────────────────────

function StrategyIntelTab({ clients }: { clients: Client[] }) {
  const { year: ctxYear, quarter: ctxQuarter } = getCurrentQuarterInfo()
  const { year: mYear, month: mMonth } = getCurrentMonthInfo()
  const quarterLabel = `Q${ctxQuarter} ${ctxYear}`
  const monthLabel = `${MONTH_NAMES[mMonth - 1]} ${ctxYear}`

  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last quarter')
  const [brief, setBrief] = useState('')

  // Context state
  const [strategyData, setStrategyData] = useState<QuarterlyStrategy | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyUpdate | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [strategyForm, setStrategyForm] = useState<QuarterlyStrategy>({ goals: '', themes: '', kpis: '', notes: '' })
  const [monthlyForm, setMonthlyForm] = useState<MonthlyUpdate>({ content_summary: '', what_worked: '', what_didnt: '', posts_published: 0, notes: '' })
  const [savingStrategy, setSavingStrategy] = useState(false)
  const [savingMonthly, setSavingMonthly] = useState(false)

  const [results, setResults] = useState<Record<string, GeneratedResult>>({
    market_position: emptyResult(),
    campaign_concepts: emptyResult(),
    content_audit: emptyResult(),
    quarterly_narrative: emptyResult(),
  })

  const client = clients.find(c => c.id === selectedClient) ?? null

  // Derived context readiness
  const hasStrategy = (strategyData?.goals?.trim() ?? '') !== '' && (strategyData?.themes?.trim() ?? '') !== ''
  const hasMonthly = (monthlyData?.content_summary?.trim() ?? '') !== ''
  const contextReady = !!selectedClient && hasStrategy && hasMonthly

  // Fetch context when client changes
  useEffect(() => {
    if (!selectedClient) {
      setStrategyData(null)
      setMonthlyData(null)
      setStrategyForm({ goals: '', themes: '', kpis: '', notes: '' })
      setMonthlyForm({ content_summary: '', what_worked: '', what_didnt: '', posts_published: 0, notes: '' })
      return
    }
    setContextLoading(true)
    Promise.all([
      fetch(`/api/ceo/quarterly-strategy?client_id=${selectedClient}&year=${ctxYear}&quarter=${ctxQuarter}`).then(r => r.json()),
      fetch(`/api/ceo/monthly-update?client_id=${selectedClient}&year=${mYear}&month=${mMonth}`).then(r => r.json()),
    ])
      .then(([qRes, mRes]) => {
        const q: QuarterlyStrategy | null = qRes.data ?? null
        const m: MonthlyUpdate | null = mRes.data ?? null
        setStrategyData(q)
        setMonthlyData(m)
        if (q) setStrategyForm({ goals: q.goals, themes: q.themes, kpis: q.kpis, notes: q.notes })
        if (m) setMonthlyForm({ content_summary: m.content_summary, what_worked: m.what_worked, what_didnt: m.what_didnt, posts_published: m.posts_published, notes: m.notes })
      })
      .catch(console.error)
      .finally(() => setContextLoading(false))
  }, [selectedClient, ctxYear, ctxQuarter, mYear, mMonth])

  const saveStrategy = async () => {
    if (!selectedClient || !strategyForm.goals.trim() || !strategyForm.themes.trim()) return
    setSavingStrategy(true)
    try {
      const res = await fetch('/api/ceo/quarterly-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClient, year: ctxYear, quarter: ctxQuarter, ...strategyForm }),
      })
      const data = await res.json() as { data?: QuarterlyStrategy }
      if (data.data) setStrategyData(data.data)
    } catch (e) { console.error(e) }
    finally { setSavingStrategy(false) }
  }

  const saveMonthly = async () => {
    if (!selectedClient || !monthlyForm.content_summary.trim()) return
    setSavingMonthly(true)
    try {
      const res = await fetch('/api/ceo/monthly-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClient, year: mYear, month: mMonth, ...monthlyForm }),
      })
      const data = await res.json() as { data?: MonthlyUpdate }
      if (data.data) setMonthlyData(data.data)
    } catch (e) { console.error(e) }
    finally { setSavingMonthly(false) }
  }

  const run = useCallback(async (tool: string) => {
    if (!contextReady) return
    setResults(prev => ({ ...prev, [tool]: { content: '', loading: true, error: null, expanded: false } }))
    try {
      const res = await fetch('/api/ceo/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool,
          client_id: client?.id,
          client_name: client?.name,
          client_data: client ? {
            industry: client.brand_identity?.industry,
            brand_identity: client.brand_identity,
            competitor_context: client.competitor_context,
            performance_intel: client.performance_intel,
            is_in_crisis: client.is_in_crisis,
            status: client.status,
          } : undefined,
          brief,
          period: selectedPeriod,
          quarterly_strategy: strategyData ? { goals: strategyData.goals, themes: strategyData.themes, kpis: strategyData.kpis, notes: strategyData.notes } : undefined,
          monthly_update: monthlyData ? { content_summary: monthlyData.content_summary, what_worked: monthlyData.what_worked, what_didnt: monthlyData.what_didnt, posts_published: monthlyData.posts_published, notes: monthlyData.notes } : undefined,
          context_year: ctxYear,
          context_quarter: ctxQuarter,
          context_month: mMonth,
        }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed')
      setResults(prev => ({ ...prev, [tool]: { content: data.result ?? '', loading: false, error: null, expanded: true } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setResults(prev => ({ ...prev, [tool]: { content: '', loading: false, error: msg, expanded: false } }))
    }
  }, [client, brief, selectedPeriod, contextReady, strategyData, monthlyData, ctxYear, ctxQuarter, mMonth])

  const toggleExpand = (tool: string) => {
    setResults(prev => ({ ...prev, [tool]: { ...prev[tool], expanded: !prev[tool].expanded } }))
  }

  return (
    <div className="space-y-5">
      {/* Context selectors */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Context</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Active Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
            >
              <option value="">No client selected</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Period (for audit)</label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
            >
              <option value="last month">Last month</option>
              <option value="last quarter">Last quarter</option>
              <option value="last 6 months">Last 6 months</option>
              <option value="year to date">Year to date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client strategy context (shown when a client is selected) */}
      {selectedClient && (
        <ClientContextCard
          clientId={selectedClient}
          strategyForm={strategyForm}
          monthlyForm={monthlyForm}
          hasStrategy={hasStrategy}
          hasMonthly={hasMonthly}
          saving={savingStrategy}
          savingMonthly={savingMonthly}
          loading={contextLoading}
          quarterLabel={quarterLabel}
          monthLabel={monthLabel}
          onStrategyChange={setStrategyForm}
          onMonthlyChange={setMonthlyForm}
          onSaveStrategy={saveStrategy}
          onSaveMonthly={saveMonthly}
        />
      )}

      {/* Context status banner */}
      {selectedClient && !contextLoading && (
        <ContextBanner
          hasStrategy={hasStrategy}
          hasMonthly={hasMonthly}
          quarterLabel={quarterLabel}
          monthLabel={monthLabel}
        />
      )}

      {/* Market Position */}
      <ActionCard icon={Target} title="Market Position Analysis" description="Deep competitive position assessment with differentiation strategy and CEO-level positioning read.">
        <button
          onClick={() => run('market_position')}
          disabled={!contextReady || results['market_position'].loading}
          className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {results['market_position'].loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Target className="w-4 h-4" />}
          {results['market_position'].loading ? 'Analysing...' : 'Analyse Position'}
        </button>
        {!selectedClient && <p className="text-xs text-slate-400">Select a client above to run this analysis.</p>}
        {selectedClient && !contextReady && !contextLoading && (
          <p className="text-xs text-amber-600">Complete the strategy context above to enable this tool.</p>
        )}
        <ResultPanel result={results['market_position']} onToggle={() => toggleExpand('market_position')} />
      </ActionCard>

      {/* Campaign Concepts */}
      <ActionCard icon={Lightbulb} title="Campaign Concept Generator" description="Three strategically differentiated campaign concepts with narrative architecture and win probability.">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Campaign Brief</label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="Describe the campaign objective, target audience, timing, and any constraints..."
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
          />
        </div>
        <button
          onClick={() => run('campaign_concepts')}
          disabled={!brief.trim() || !contextReady || results['campaign_concepts'].loading}
          className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {results['campaign_concepts'].loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Lightbulb className="w-4 h-4" />}
          {results['campaign_concepts'].loading ? 'Generating...' : 'Generate Concepts'}
        </button>
        {!selectedClient && <p className="text-xs text-slate-400">Select a client and fill in context above, then enter a brief.</p>}
        {selectedClient && !contextReady && !contextLoading && (
          <p className="text-xs text-amber-600">Complete the strategy context above to enable this tool.</p>
        )}
        <ResultPanel result={results['campaign_concepts']} onToggle={() => toggleExpand('campaign_concepts')} />
      </ActionCard>

      {/* Content Strategy Audit */}
      <ActionCard icon={BarChart2} title="Content Strategy Audit" description="Evidence-based audit of current strategy alignment, content pillar performance, and 90-day recommendations.">
        <button
          onClick={() => run('content_audit')}
          disabled={!contextReady || results['content_audit'].loading}
          className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {results['content_audit'].loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <BarChart2 className="w-4 h-4" />}
          {results['content_audit'].loading ? 'Auditing...' : 'Run Audit'}
        </button>
        {!selectedClient && <p className="text-xs text-slate-400">Select a client above to run this analysis.</p>}
        {selectedClient && !contextReady && !contextLoading && (
          <p className="text-xs text-amber-600">Complete the strategy context above to enable this tool.</p>
        )}
        <ResultPanel result={results['content_audit']} onToggle={() => toggleExpand('content_audit')} />
      </ActionCard>

      {/* Quarterly Narrative */}
      <ActionCard icon={GitBranch} title="Quarterly Narrative" description="CEO-ready strategic narrative for client review, board-level summary, and 90-day commitment statement.">
        <button
          onClick={() => run('quarterly_narrative')}
          disabled={!contextReady || results['quarterly_narrative'].loading}
          className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {results['quarterly_narrative'].loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <GitBranch className="w-4 h-4" />}
          {results['quarterly_narrative'].loading ? 'Writing...' : 'Generate Narrative'}
        </button>
        {!selectedClient && <p className="text-xs text-slate-400">Select a client above to run this analysis.</p>}
        {selectedClient && !contextReady && !contextLoading && (
          <p className="text-xs text-amber-600">Complete the strategy context above to enable this tool.</p>
        )}
        <ResultPanel result={results['quarterly_narrative']} onToggle={() => toggleExpand('quarterly_narrative')} />
      </ActionCard>
    </div>
  )
}

// ─── Crisis Management Tab ─────────────────────────────────────────────────────

function CrisisTab({ clients }: { clients: Client[] }) {
  const crisisClients = clients.filter(c => c.is_in_crisis)

  const [results, setResults] = useState<Record<string, GeneratedResult>>({})

  const run = useCallback(async (tool: string, clientObj: Client) => {
    const key = `${clientObj.id}__${tool}`
    setResults(prev => ({ ...prev, [key]: { content: '', loading: true, error: null, expanded: false } }))
    try {
      const res = await fetch('/api/ceo/crisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool,
          client_id: clientObj.id,
          client_name: clientObj.name,
          client_data: {
            industry: clientObj.brand_identity?.industry,
            brand_identity: clientObj.brand_identity,
            competitor_context: clientObj.competitor_context,
            performance_intel: clientObj.performance_intel,
          },
        }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed')
      setResults(prev => ({ ...prev, [key]: { content: data.result ?? '', loading: false, error: null, expanded: true } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setResults(prev => ({ ...prev, [key]: { content: '', loading: false, error: msg, expanded: false } }))
    }
  }, [])

  const toggleExpand = (key: string) => {
    setResults(prev => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }))
  }

  const getResult = (clientId: string, tool: string): GeneratedResult => {
    return results[`${clientId}__${tool}`] ?? emptyResult()
  }

  if (crisisClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="font-semibold text-slate-700">No Active Crises</p>
        <p className="text-sm text-slate-400 text-center max-w-xs">
          All clients are operating normally. Crisis tools will appear here when a client is flagged in crisis mode.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
        <p className="text-sm font-medium text-red-700">
          {crisisClients.length} client{crisisClients.length > 1 ? 's' : ''} in active crisis mode
        </p>
      </div>

      {crisisClients.map(client => (
        <div key={client.id} className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-200">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: client.color }}
            >
              {client.initials}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">{client.name}</p>
              <p className="text-xs text-red-600 font-medium">Crisis Mode Active</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
              <ShieldAlert className="w-3 h-3" />
              CRISIS
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Situation Assessment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Situation Assessment</p>
                  <p className="text-xs text-slate-500">Full crisis analysis with severity classification and immediate actions.</p>
                </div>
                <button
                  onClick={() => run('situation_assessment', client)}
                  disabled={getResult(client.id, 'situation_assessment').loading}
                  className="flex items-center gap-2 px-3 py-2 bg-novax text-white text-xs font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 ml-4 shrink-0"
                >
                  {getResult(client.id, 'situation_assessment').loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Activity className="w-3.5 h-3.5" />}
                  {getResult(client.id, 'situation_assessment').loading ? 'Assessing...' : 'Assess'}
                </button>
              </div>
              <ResultPanel result={getResult(client.id, 'situation_assessment')} onToggle={() => toggleExpand(`${client.id}__situation_assessment`)} />
            </div>

            <div className="border-t border-slate-100" />

            {/* Holding Statement */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Holding Statement Generator</p>
                  <p className="text-xs text-slate-500">Three ready-to-publish statements — formal, conversational, and minimal.</p>
                </div>
                <button
                  onClick={() => run('holding_statement', client)}
                  disabled={getResult(client.id, 'holding_statement').loading}
                  className="flex items-center gap-2 px-3 py-2 bg-novax text-white text-xs font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 ml-4 shrink-0"
                >
                  {getResult(client.id, 'holding_statement').loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <MessageSquare className="w-3.5 h-3.5" />}
                  {getResult(client.id, 'holding_statement').loading ? 'Writing...' : 'Generate'}
                </button>
              </div>
              <ResultPanel result={getResult(client.id, 'holding_statement')} onToggle={() => toggleExpand(`${client.id}__holding_statement`)} />
            </div>

            <div className="border-t border-slate-100" />

            {/* Recovery Plan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Recovery Content Plan</p>
                  <p className="text-xs text-slate-500">2-week day-by-day content recovery calendar with execution briefs.</p>
                </div>
                <button
                  onClick={() => run('recovery_plan', client)}
                  disabled={getResult(client.id, 'recovery_plan').loading}
                  className="flex items-center gap-2 px-3 py-2 bg-novax text-white text-xs font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 ml-4 shrink-0"
                >
                  {getResult(client.id, 'recovery_plan').loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <TrendingUp className="w-3.5 h-3.5" />}
                  {getResult(client.id, 'recovery_plan').loading ? 'Planning...' : 'Build Plan'}
                </button>
              </div>
              <ResultPanel result={getResult(client.id, 'recovery_plan')} onToggle={() => toggleExpand(`${client.id}__recovery_plan`)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Second Opinion Tab ────────────────────────────────────────────────────────

type SOTool = 'conflict_resolution' | 'decision_validator' | 'pitch_reviewer' | 'conversation_preparer'

interface SOConfig {
  id: SOTool
  icon: React.ElementType
  title: string
  description: string
  placeholder: string
}

const SO_TOOLS: SOConfig[] = [
  {
    id: 'conflict_resolution',
    icon: Scale,
    title: 'Conflict Resolution',
    description: 'Describe the conflict — parties involved, what happened, what each side wants. Get a structured resolution path with exact scripts.',
    placeholder: 'Describe the conflict: who is involved, what the surface issue is, what each party actually wants, and what has already been tried...',
  },
  {
    id: 'decision_validator',
    icon: CheckCircle2,
    title: 'Decision Validator',
    description: 'Describe the decision you are about to make. Get a devil\'s advocate case, assumption audit, and an unhedged recommendation.',
    placeholder: 'Describe the decision: what you are choosing, what the alternatives are, and what your current reasoning is...',
  },
  {
    id: 'pitch_reviewer',
    icon: Zap,
    title: 'Pitch Reviewer',
    description: 'Paste your pitch content. Get a clarity score, gap analysis, objection forecast, and win probability estimate.',
    placeholder: 'Paste your pitch content here — as much detail as you have...',
  },
  {
    id: 'conversation_preparer',
    icon: MessageSquare,
    title: 'Difficult Conversation Preparer',
    description: 'Describe who you need to speak to and why. Get an exact opening line, navigation scripts, and a closing sequence.',
    placeholder: 'Describe the conversation: who, what the issue is, what outcome you need, and any history that matters...',
  },
]

function SecondOpinionTab() {
  const [inputs, setInputs] = useState<Record<SOTool, string>>({
    conflict_resolution: '',
    decision_validator: '',
    pitch_reviewer: '',
    conversation_preparer: '',
  })
  const [results, setResults] = useState<Record<SOTool, GeneratedResult>>({
    conflict_resolution: emptyResult(),
    decision_validator: emptyResult(),
    pitch_reviewer: emptyResult(),
    conversation_preparer: emptyResult(),
  })

  const run = useCallback(async (tool: SOTool) => {
    const input = inputs[tool]
    if (!input.trim()) return
    setResults(prev => ({ ...prev, [tool]: { content: '', loading: true, error: null, expanded: false } }))
    try {
      const res = await fetch('/api/ceo/second-opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, input }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed')
      setResults(prev => ({ ...prev, [tool]: { content: data.result ?? '', loading: false, error: null, expanded: true } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setResults(prev => ({ ...prev, [tool]: { content: '', loading: false, error: msg, expanded: false } }))
    }
  }, [inputs])

  const toggleExpand = (tool: SOTool) => {
    setResults(prev => ({ ...prev, [tool]: { ...prev[tool], expanded: !prev[tool].expanded } }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 px-4 py-3 bg-novax-light border border-novax-border rounded-xl">
        <Crown className="w-4 h-4 text-novax mt-0.5 shrink-0" />
        <p className="text-sm text-novax-muted">
          These tools are private to the CEO. All inputs and outputs are processed directly — nothing is logged or stored.
        </p>
      </div>

      {SO_TOOLS.map(({ id, icon: Icon, title, description, placeholder }) => (
        <ActionCard key={id} icon={Icon} title={title} description={description}>
          <textarea
            value={inputs[id]}
            onChange={e => setInputs(prev => ({ ...prev, [id]: e.target.value }))}
            placeholder={placeholder}
            rows={4}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-novax/30 focus:border-novax"
          />
          <button
            onClick={() => run(id)}
            disabled={!inputs[id].trim() || results[id].loading}
            className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {results[id].loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Icon className="w-4 h-4" />}
            {results[id].loading ? 'Thinking...' : 'Get Second Opinion'}
          </button>
          <ResultPanel result={results[id]} onToggle={() => toggleExpand(id)} />
        </ActionCard>
      ))}
    </div>
  )
}

// ─── CEO Agent Tab ─────────────────────────────────────────────────────────────

const CEO_QUICK_PROMPTS = [
  { label: 'Agency Brief', prompt: 'Brief me on the current state of the agency. Active clients, overdue work, anything that needs my attention today.' },
  { label: 'Risk Scan', prompt: 'Which clients are at risk? Give me a ranked list with the reason for each flag.' },
  { label: 'Team Workload', prompt: 'What does the current team workload look like? Is anyone overloaded? Any allocation recommendations?' },
  { label: 'Best & Worst', prompt: 'Which client had the best performance this month? Which had the worst? What patterns do you see?' },
  { label: 'Stale Clients', prompt: 'Which clients have had no context bank updates, no new strategy, or no tasks in the last 30 days?' },
]

interface AgentMessage { role: 'user' | 'assistant'; content: string }

function CeoAgentTab() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg: AgentMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)
    setError('')

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          context_items: [],
          is_ceo: true,
          user_role: 'ceo',
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string }
            if (parsed.text) {
              assistantText += parsed.text
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: assistantText }
                return copy
              })
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 bg-novax-light border border-novax-border rounded-xl">
        <Crown className="w-4 h-4 text-novax mt-0.5 shrink-0"/>
        <p className="text-sm text-novax-muted">
          CEO Agent has full visibility across all clients, tasks, strategy, and context banks. It knows the current state of your agency in real time.
        </p>
      </div>

      {/* Quick prompt chips */}
      <div className="flex flex-wrap gap-2">
        {CEO_QUICK_PROMPTS.map(({ label, prompt }) => (
          <button
            key={label}
            onClick={() => void send(prompt)}
            disabled={streaming}
            className="text-xs px-3 py-1.5 rounded-full border border-novax-border bg-novax-light text-novax font-medium hover:bg-novax hover:text-white transition-all disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'px-4 py-3 rounded-xl text-sm',
                msg.role === 'user'
                  ? 'bg-novax text-white ml-8'
                  : 'bg-white border border-slate-200 mr-8',
              )}
            >
              {msg.role === 'assistant'
                ? <MarkdownContent content={msg.content || (streaming && i === messages.length - 1 ? '…' : '')}/>
                : msg.content
              }
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Crown className="w-8 h-8 mb-2 text-novax-border"/>
          <p className="text-sm font-medium text-slate-600">CEO Agent ready</p>
          <p className="text-xs mt-1">Use a quick prompt above or type your own question below.</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
          placeholder="Ask anything about clients, team, performance, strategy..."
          disabled={streaming}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          onClick={() => void send(input)}
          disabled={!input.trim() || streaming}
          className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
          {streaming ? 'Thinking...' : 'Ask'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CeoPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('health')

  const { clients, isLoading: clientsLoading } = useClients()
  const { tasks, isLoading: tasksLoading } = useTasks()
  const { posts, isLoading: postsLoading } = usePosts()

  if (!loading && user && user.role !== 'ceo' && user.role !== 'admin') {
    router.replace('/dashboard')
    return null
  }

  if (loading || clientsLoading || tasksLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-novax" />
      </div>
    )
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'health', icon: Activity, label: 'Agency Health' },
    { id: 'agent', icon: Crown, label: 'CEO Agent' },
    { id: 'strategy', icon: Brain, label: 'Strategy' },
    { id: 'crisis', icon: AlertTriangle, label: 'Crisis' },
    { id: 'second_opinion', icon: MessageSquare, label: 'Second Opinion' },
  ]

  const crisisCount = clients.filter(c => c.is_in_crisis).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-novax flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">CEO Intelligence Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Agency health, strategic analysis, crisis tools, and private second opinions — for CEO and admin use only.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
        {tabs.map(({ id, icon, label }) => (
          <div key={id} className="relative">
            <TabButton id={id} active={activeTab === id} icon={icon} label={label} onClick={() => setActiveTab(id)} />
            {id === 'crisis' && crisisCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full">
                {crisisCount}
              </span>
            )}
          </div>
        ))}
      </div>

      {activeTab === 'health' && (
        <AgencyHealthTab clients={clients} tasks={tasks} posts={posts} />
      )}
      {activeTab === 'agent' && (
        <CeoAgentTab />
      )}
      {activeTab === 'strategy' && (
        <StrategyIntelTab clients={clients} />
      )}
      {activeTab === 'crisis' && (
        <CrisisTab clients={clients} />
      )}
      {activeTab === 'second_opinion' && (
        <SecondOpinionTab />
      )}
    </div>
  )
}
