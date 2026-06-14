'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO, isToday, subDays, addDays } from 'date-fns'
import {
  BookOpen, Plus, Trash2, ChevronLeft, ChevronRight,
  Clock, Zap, AlertTriangle, Trophy, Bot, FileText,
  Save, User, ChevronDown, Check, X, Loader2, Calendar,
  TrendingUp, Star, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import type { WorkDiary, DiaryTask, DiaryAiFeedback, User as AppUser } from '@/lib/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const BLOCKER_OPTIONS = [
  'Waiting for client feedback',
  'Missing asset',
  'Unclear brief',
  'Tool issue',
  'Waiting for approval',
  'Dependency on teammate',
  'Scope creep',
  'Technical blocker',
  'Bandwidth issue',
]

const AI_TOOLS = [
  'Content Studio',
  'Hook Lab',
  'Strategy',
  'Campaign Igniter',
  'Visual Engine',
  'Task AI',
  'AI Assistant',
  'Moderation AI',
  'Peak Formats',
  'Copy Engine',
  'Other',
]

const AI_ISSUE_TYPES = [
  'Tone too formal',
  'Tone too casual',
  'Too long',
  'Too short',
  'Wrong language',
  'Language mismatch',
  'Off-brand',
  'Missing context',
  'Wrong format',
  'Repetitive',
  'Generic / not specific',
  'Wrong dialect',
  'Emojis when not needed',
  'Missing call to action',
  'Other',
]

const ENERGY_LABELS: Record<number, string> = {
  1: 'Drained',
  2: 'Low',
  3: 'Moderate',
  4: 'Good',
  5: 'Peak',
}

const ENERGY_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#5BB4AE',
}

const EFFICIENCY_LABELS: Record<number, string> = {
  1: 'Very slow',
  2: 'Slow',
  3: 'Average',
  4: 'Efficient',
  5: 'Peak efficiency',
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below average',
  3: 'OK',
  4: 'Good',
  5: 'Excellent',
}

const SCORE_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#5BB4AE',
}

const PULSE_RISK_SIGNALS: string[] = [
  'overloaded',
  'unclear_direction',
  'undervalued',
  'no_growth',
  'team_friction',
  'skill_mismatch',
  'poor_tools',
  'burnout_risk',
]

const PULSE_POSITIVE_SIGNALS: string[] = [
  'in_the_zone',
  'proud_of_output',
  'great_teamwork',
  'learned_something',
  'made_impact',
  'excited',
]

const PULSE_LABEL: Record<string, string> = {
  overloaded:       'Overloaded',
  unclear_direction:'Unclear direction',
  undervalued:      'Undervalued',
  no_growth:        'No growth',
  team_friction:    'Team friction',
  skill_mismatch:   'Skill mismatch',
  poor_tools:       'Poor tools',
  burnout_risk:     'Burnout risk',
  in_the_zone:      'In the zone',
  proud_of_output:  'Proud of output',
  great_teamwork:   'Great teamwork',
  learned_something:'Learned something',
  made_impact:      'Made an impact',
  excited:          'Excited',
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

function emptyForm() {
  return {
    tasks_worked:          [] as DiaryTask[],
    blockers:              [] as string[],
    blockers_notes:        '',
    highlights:            '',
    energy_score:          null as number | null,
    efficiency_score:      null as number | null,
    content_quality_score: null as number | null,
    pulse_signals:         [] as string[],
    ai_feedback_notes:     [] as DiaryAiFeedback[],
    free_notes:            '',
  }
}

type FormState = ReturnType<typeof emptyForm>

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children, accent = false }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-card p-5',
      accent ? 'border-novax-border' : 'border-border',
    )}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          accent ? 'bg-novax text-white' : 'bg-muted text-muted-foreground',
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function TagChip({ label, selected, onClick }: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
        selected
          ? 'bg-novax text-white border-novax'
          : 'bg-muted/50 text-muted-foreground border-border hover:border-novax-border hover:text-foreground',
      )}
    >
      {selected && <Check className="w-3 h-3" />}
      {label}
    </button>
  )
}

// ─── Entry List (left panel) ─────────────────────────────────────────────────

function EntryList({
  entries,
  selectedDate,
  onSelect,
}: {
  entries: WorkDiary[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const grouped = entries.reduce<Record<string, WorkDiary>>((acc, e) => {
    acc[e.date] = e
    return acc
  }, {})

  // Build a 14-day window including today
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), i)
    return format(d, 'yyyy-MM-dd')
  })

  return (
    <div className="space-y-1">
      {days.map(date => {
        const entry = grouped[date]
        const active = date === selectedDate
        const today  = isToday(parseISO(date))

        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm',
              active
                ? 'bg-novax text-white'
                : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {/* Date label */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('font-medium', active ? 'text-white' : 'text-foreground')}>
                  {today ? 'Today' : format(parseISO(date), 'EEE d MMM')}
                </span>
                {!entry && (
                  <span className={cn('text-[10px]', active ? 'text-white/60' : 'text-muted-foreground')}>
                    — no entry
                  </span>
                )}
              </div>
              {entry && (
                <p className={cn('text-[11px] truncate mt-0.5', active ? 'text-white/70' : 'text-muted-foreground')}>
                  {entry.tasks_worked.length} task{entry.tasks_worked.length !== 1 ? 's' : ''}
                  {entry.energy_score ? ` · ${ENERGY_LABELS[entry.energy_score]}` : ''}
                  {(entry.pulse_signals ?? []).some(s => PULSE_RISK_SIGNALS.includes(s)) ? ' · risk' : ''}
                </p>
              )}
            </div>

            {/* Score dots */}
            <div className="flex items-center gap-1 shrink-0">
              {entry?.energy_score && (
                <div
                  className="w-2 h-2 rounded-full"
                  title={`Energy: ${ENERGY_LABELS[entry.energy_score]}`}
                  style={{ background: ENERGY_COLORS[entry.energy_score] }}
                />
              )}
              {(entry?.pulse_signals ?? []).some(s => PULSE_RISK_SIGNALS.includes(s)) && (
                <div className="w-2 h-2 rounded-full bg-amber-500" title="Has risk signals" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DiaryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // ── State
  const [selectedDate, setSelectedDate]   = useState(todayStr())
  const [entries, setEntries]             = useState<WorkDiary[]>([])
  const [currentId, setCurrentId]         = useState<string | null>(null)
  const [form, setForm]                   = useState<FormState>(emptyForm())
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [dirty, setDirty]                 = useState(false)

  // Admin: team member selector
  const [allUsers, setAllUsers]           = useState<AppUser[]>([])
  const [viewingUserId, setViewingUserId] = useState<string>('')
  const [userDropOpen, setUserDropOpen]   = useState(false)
  const dropRef                           = useRef<HTMLDivElement>(null)

  const effectiveUserId = isAdmin && viewingUserId ? viewingUserId : (user?.id ?? '')

  // ── Helpers
  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-id':   user?.id   ?? '',
      'x-user-role': user?.role ?? '',
    }
  }

  // ── Load all team members (admin only)
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((data: AppUser[]) => setAllUsers(data))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // ── Load entries for the active user
  const loadEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const qs = effectiveUserId !== user.id
        ? `?userId=${effectiveUserId}`
        : ''
      const res = await fetch(`/api/diary${qs}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(await res.text())
      const data: WorkDiary[] = await res.json()
      setEntries(data)
    } catch {
      toast.error('Failed to load diary entries')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Populate form whenever selected date changes
  useEffect(() => {
    const entry = entries.find(e => e.date === selectedDate)
    if (entry) {
      setCurrentId(entry.id)
      setForm({
        tasks_worked:          entry.tasks_worked           ?? [],
        blockers:              entry.blockers                ?? [],
        blockers_notes:        entry.blockers_notes          ?? '',
        highlights:            entry.highlights              ?? '',
        energy_score:          entry.energy_score            ?? null,
        efficiency_score:      entry.efficiency_score        ?? null,
        content_quality_score: entry.content_quality_score   ?? null,
        pulse_signals:         entry.pulse_signals           ?? [],
        ai_feedback_notes:     entry.ai_feedback_notes       ?? [],
        free_notes:            entry.free_notes              ?? '',
      })
    } else {
      setCurrentId(null)
      setForm(emptyForm())
    }
    setDirty(false)
  }, [selectedDate, entries])

  // ── Close user dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Form helpers
  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // Work tasks
  function addTask() {
    patch('tasks_worked', [...form.tasks_worked, { client_name: '', description: '', time_minutes: 0 }])
  }
  function updateTask(i: number, field: keyof DiaryTask, value: string | number) {
    const next = form.tasks_worked.map((t, idx) =>
      idx === i ? { ...t, [field]: value } : t
    )
    patch('tasks_worked', next)
  }
  function removeTask(i: number) {
    patch('tasks_worked', form.tasks_worked.filter((_, idx) => idx !== i))
  }

  // Blockers
  function toggleBlocker(label: string) {
    const next = form.blockers.includes(label)
      ? form.blockers.filter(b => b !== label)
      : [...form.blockers, label]
    patch('blockers', next)
  }

  // Pulse signals
  function togglePulseSignal(signal: string) {
    const next = form.pulse_signals.includes(signal)
      ? form.pulse_signals.filter(s => s !== signal)
      : [...form.pulse_signals, signal]
    patch('pulse_signals', next)
  }

  // AI feedback rows
  function addAiFeedback() {
    patch('ai_feedback_notes', [
      ...form.ai_feedback_notes,
      { tool: '', issue_types: [], notes: '' },
    ])
  }
  function updateAiFeedback(i: number, field: keyof DiaryAiFeedback, value: string | string[]) {
    const next = form.ai_feedback_notes.map((f, idx) =>
      idx === i ? { ...f, [field]: value } : f
    )
    patch('ai_feedback_notes', next)
  }
  function toggleAiIssueType(i: number, type: string) {
    const current = form.ai_feedback_notes[i]?.issue_types ?? []
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    updateAiFeedback(i, 'issue_types', next)
  }
  function removeAiFeedback(i: number) {
    patch('ai_feedback_notes', form.ai_feedback_notes.filter((_, idx) => idx !== i))
  }

  // ── Save
  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const body = {
        date:                  selectedDate,
        userId:                effectiveUserId !== user.id ? effectiveUserId : undefined,
        tasks_worked:          form.tasks_worked,
        blockers:              form.blockers,
        blockers_notes:        form.blockers_notes        || null,
        highlights:            form.highlights            || null,
        energy_score:          form.energy_score,
        efficiency_score:      form.efficiency_score,
        content_quality_score: form.content_quality_score,
        pulse_signals:         form.pulse_signals,
        ai_feedback_notes:     form.ai_feedback_notes,
        free_notes:            form.free_notes            || null,
      }

      if (currentId) {
        // Update existing
        const res = await fetch(`/api/diary/${currentId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        // Create new (upsert)
        const res = await fetch('/api/diary', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(await res.text())
        const created: WorkDiary = await res.json()
        setCurrentId(created.id)
      }

      toast.success('Diary entry saved')
      setDirty(false)
      await loadEntries()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Date navigation
  const selectedParsed = parseISO(selectedDate)
  function prevDay() { setSelectedDate(format(subDays(selectedParsed, 1), 'yyyy-MM-dd')) }
  function nextDay() {
    const next = addDays(selectedParsed, 1)
    if (next > new Date()) return
    setSelectedDate(format(next, 'yyyy-MM-dd'))
  }
  const isSelectedToday = isToday(selectedParsed)

  const viewingUser = isAdmin
    ? (viewingUserId
        ? allUsers.find(u => u.id === viewingUserId)
        : user)
    : user

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-novax flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Work Diary</h1>
            <p className="text-xs text-muted-foreground">Daily log — only you and the admin can see this</p>
          </div>
        </div>

        {/* Admin: view as any team member */}
        {isAdmin && (
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              onClick={() => setUserDropOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:border-novax-border transition-colors"
            >
              {viewingUser && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: viewingUser.color }}
                >
                  {viewingUser.initials}
                </div>
              )}
              <span className="font-medium">{viewingUser?.name ?? 'Select member'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {userDropOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                {/* Own diary */}
                <button
                  type="button"
                  onClick={() => { setViewingUserId(''); setUserDropOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors',
                    !viewingUserId ? 'text-novax-accent font-medium' : '',
                  )}
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  My diary
                </button>
                <div className="my-1 border-t border-border" />
                {allUsers
                  .filter(u => u.id !== user?.id)
                  .map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setViewingUserId(u.id); setUserDropOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors',
                        viewingUserId === u.id ? 'text-novax-accent font-medium' : '',
                      )}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: u.color }}
                      >
                        {u.initials}
                      </div>
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Body: two-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: entry list */}
        <aside className="w-56 shrink-0 border-r border-border overflow-y-auto p-3">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Last 14 days
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr())}
              className="text-[11px] text-novax-accent hover:underline"
            >
              Today
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center pt-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EntryList
              entries={entries}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          )}
        </aside>

        {/* ── Right: entry form */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

            {/* Date header + nav */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={prevDay}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-novax-border transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div>
                  <h2 className="text-base font-semibold">
                    {isSelectedToday ? 'Today' : format(selectedParsed, 'EEEE')}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {format(selectedParsed, 'MMMM d, yyyy')}
                    {isAdmin && viewingUser && viewingUser.id !== user?.id && (
                      <span className="ml-1.5 text-novax-accent">· {viewingUser.name}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={nextDay}
                  disabled={isSelectedToday}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-novax-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  dirty
                    ? 'bg-novax text-white hover:bg-novax-hover'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {saving
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : dirty
                    ? <Save className="w-3.5 h-3.5" />
                    : <Check className="w-3.5 h-3.5" />
                }
                {saving ? 'Saving…' : dirty ? 'Save entry' : 'Saved'}
              </button>
            </div>

            {/* ── Score rows */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
              {/* Energy */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Energy</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch('energy_score', form.energy_score === n ? null : n)}
                      title={ENERGY_LABELS[n]}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-bold border transition-all',
                        form.energy_score === n
                          ? 'text-white border-transparent'
                          : 'border-border text-muted-foreground hover:border-novax-border',
                      )}
                      style={form.energy_score === n ? { background: ENERGY_COLORS[n] } : {}}
                    >
                      {n}
                    </button>
                  ))}
                  {form.energy_score && (
                    <span className="text-xs font-medium self-center ml-1" style={{ color: ENERGY_COLORS[form.energy_score] }}>
                      {ENERGY_LABELS[form.energy_score]}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Efficiency */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Efficiency</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch('efficiency_score', form.efficiency_score === n ? null : n)}
                      title={EFFICIENCY_LABELS[n]}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-bold border transition-all',
                        form.efficiency_score === n
                          ? 'text-white border-transparent'
                          : 'border-border text-muted-foreground hover:border-novax-border',
                      )}
                      style={form.efficiency_score === n ? { background: SCORE_COLORS[n] } : {}}
                    >
                      {n}
                    </button>
                  ))}
                  {form.efficiency_score && (
                    <span className="text-xs font-medium self-center ml-1" style={{ color: SCORE_COLORS[form.efficiency_score] }}>
                      {EFFICIENCY_LABELS[form.efficiency_score]}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Content quality */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <Star className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Content quality</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch('content_quality_score', form.content_quality_score === n ? null : n)}
                      title={QUALITY_LABELS[n]}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-bold border transition-all',
                        form.content_quality_score === n
                          ? 'text-white border-transparent'
                          : 'border-border text-muted-foreground hover:border-novax-border',
                      )}
                      style={form.content_quality_score === n ? { background: SCORE_COLORS[n] } : {}}
                    >
                      {n}
                    </button>
                  ))}
                  {form.content_quality_score && (
                    <span className="text-xs font-medium self-center ml-1" style={{ color: SCORE_COLORS[form.content_quality_score] }}>
                      {QUALITY_LABELS[form.content_quality_score]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 1: Work Log */}
            <SectionCard icon={Clock} title="Work Log">
              <div className="space-y-2">
                {form.tasks_worked.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    No tasks logged yet — add what you worked on today.
                  </p>
                )}
                {form.tasks_worked.map((task, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      placeholder="Client"
                      value={task.client_name}
                      onChange={e => updateTask(i, 'client_name', e.target.value)}
                      className="h-8 px-2.5 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="What you worked on"
                      value={task.description}
                      onChange={e => updateTask(i, 'description', e.target.value)}
                      className="h-8 px-2.5 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        placeholder="mins"
                        value={task.time_minutes || ''}
                        onChange={e => updateTask(i, 'time_minutes', parseInt(e.target.value) || 0)}
                        className="h-8 w-full pl-2.5 pr-8 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                        min
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTask(i)}
                      className="w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {form.tasks_worked.length > 0 && (
                  <div className="text-xs text-muted-foreground pt-1">
                    Total:{' '}
                    <span className="font-medium text-foreground">
                      {Math.floor(form.tasks_worked.reduce((s, t) => s + t.time_minutes, 0) / 60)}h{' '}
                      {form.tasks_worked.reduce((s, t) => s + t.time_minutes, 0) % 60}m
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addTask}
                  className="flex items-center gap-1.5 text-xs text-novax-accent hover:text-novax transition-colors mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add task
                </button>
              </div>
            </SectionCard>

            {/* ── Section 2: Blockers */}
            <SectionCard icon={AlertTriangle} title="Blockers & Friction">
              <div className="flex flex-wrap gap-2 mb-3">
                {BLOCKER_OPTIONS.map(opt => (
                  <TagChip
                    key={opt}
                    label={opt}
                    selected={form.blockers.includes(opt)}
                    onClick={() => toggleBlocker(opt)}
                  />
                ))}
              </div>
              {form.blockers.length > 0 && (
                <textarea
                  rows={2}
                  placeholder="Any extra context on the blockers above…"
                  value={form.blockers_notes}
                  onChange={e => patch('blockers_notes', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
                />
              )}
            </SectionCard>

            {/* ── Section 3: Highlights */}
            <SectionCard icon={Trophy} title="Highlights & Wins">
              <textarea
                rows={3}
                placeholder="What went well today? Any wins, good decisions, or moments worth repeating?"
                value={form.highlights}
                onChange={e => patch('highlights', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
              />
            </SectionCard>

            {/* ── Section 4: Team Pulse */}
            <SectionCard icon={Activity} title="Team Pulse">
              <p className="text-xs text-muted-foreground mb-4">
                How are you feeling today as part of the team? Select all that apply — this helps identify patterns before they become problems.
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 dark:text-amber-400 mb-2">
                    Risk signals
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PULSE_RISK_SIGNALS.map(signal => {
                      const selected = form.pulse_signals.includes(signal)
                      return (
                        <button
                          key={signal}
                          type="button"
                          onClick={() => togglePulseSignal(signal)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            selected
                              ? 'bg-amber-500/15 text-amber-600 border-amber-400/50 dark:text-amber-400'
                              : 'bg-muted/50 text-muted-foreground border-border hover:border-amber-400/40 hover:text-foreground',
                          )}
                        >
                          {selected && <Check className="w-3 h-3" />}
                          {PULSE_LABEL[signal]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-novax-accent mb-2">
                    Positive signals
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PULSE_POSITIVE_SIGNALS.map(signal => {
                      const selected = form.pulse_signals.includes(signal)
                      return (
                        <button
                          key={signal}
                          type="button"
                          onClick={() => togglePulseSignal(signal)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            selected
                              ? 'bg-novax text-white border-novax'
                              : 'bg-muted/50 text-muted-foreground border-border hover:border-novax-border hover:text-foreground',
                          )}
                        >
                          {selected && <Check className="w-3 h-3" />}
                          {PULSE_LABEL[signal]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── Section 5: AI Output Feedback */}
            <SectionCard icon={Bot} title="AI Output Feedback" accent>
              <p className="text-xs text-muted-foreground mb-4">
                Note any time the AI output was not what you needed — language, tone, length, format, or anything else.
                This gets reviewed to improve future prompts.
              </p>

              <div className="space-y-5">
                {form.ai_feedback_notes.map((fb, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => removeAiFeedback(i)}
                      className="absolute top-3 right-3 w-6 h-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Tool selector */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                        Tool
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {AI_TOOLS.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateAiFeedback(i, 'tool', t)}
                            className={cn(
                              'px-2.5 py-1 rounded-md text-xs border transition-all',
                              fb.tool === t
                                ? 'bg-novax text-white border-novax'
                                : 'border-border text-muted-foreground hover:border-novax-border hover:text-foreground',
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Issue type tags */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                        Issue type (pick all that apply)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {AI_ISSUE_TYPES.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleAiIssueType(i, t)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-all',
                              fb.issue_types.includes(t)
                                ? 'bg-amber-500/15 text-amber-600 border-amber-400/40 dark:text-amber-400'
                                : 'border-border text-muted-foreground hover:border-novax-border hover:text-foreground',
                            )}
                          >
                            {fb.issue_types.includes(t) && <Check className="w-3 h-3" />}
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                        Describe the issue
                      </label>
                      <textarea
                        rows={3}
                        placeholder="e.g. The hook lab output kept using formal Arabic (فصحى) for an Egyptian audience. We need dialect-aware outputs for this client."
                        value={fb.notes}
                        onChange={e => updateAiFeedback(i, 'notes', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAiFeedback}
                className="flex items-center gap-1.5 text-xs text-novax-accent hover:text-novax transition-colors mt-3"
              >
                <Plus className="w-3.5 h-3.5" />
                Add AI feedback note
              </button>
            </SectionCard>

            {/* ── Section 6: Free Notes */}
            <SectionCard icon={FileText} title="Free Notes">
              <textarea
                rows={5}
                placeholder="Anything else worth recording — observations, ideas, things to follow up on, how the day felt overall…"
                value={form.free_notes}
                onChange={e => patch('free_notes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:border-novax-border transition-colors placeholder:text-muted-foreground"
              />
            </SectionCard>

            {/* Bottom save */}
            <div className="flex justify-end pb-6">
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                  dirty
                    ? 'bg-novax text-white hover:bg-novax-hover'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {saving
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />
                }
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
