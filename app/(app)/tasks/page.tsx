'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, Calendar, AlertCircle, X, ChevronDown, User, List, Clock, Send, ArrowUpDown, Download, Bookmark, BookmarkCheck, CalendarDays, LayoutTemplate, RefreshCw } from 'lucide-react'
import { useTasks, useUpdateTask } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { useMyAssignedClientIds } from '@/lib/hooks/use-client-assignments'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'
import { TaskCalendar } from '@/components/tasks/task-calendar'
import {
  STAGE_CONFIG, PRIORITY_CONFIG, PIPELINE_STAGES, TASK_SUBTYPES,
  formatDate, isOverdue, daysUntil, getSubtypeStyle, cn,
} from '@/lib/utils'
import type { Task, PipelineStage, Priority } from '@/lib/types'

const ALL_SUBTYPES = Object.values(TASK_SUBTYPES).flat().map(s => s.label)

const DUE_PRESETS = [
  { value: 'overdue',   label: 'Overdue' },
  { value: 'today',     label: 'Due Today' },
  { value: 'this_week', label: 'This Week' },
] as const

type ViewTab = 'all' | 'mine' | 'assigned' | 'calendar' | 'templates'
type SortBy = 'created' | 'due' | 'priority' | 'stage'

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const STAGE_ORDER: Record<string, number> = {
  strategy: 0, ideas: 1, calendar: 2, copy: 3, design: 4,
  review: 5, approval: 6, scheduled: 7, published: 8, reporting: 9,
}

function sortTasks(list: Task[], by: SortBy): Task[] {
  const sorted = [...list]
  switch (by) {
    case 'due':
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'priority':
      return sorted.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
    case 'stage':
      return sorted.sort((a, b) => (STAGE_ORDER[a.pipeline_stage] ?? 0) - (STAGE_ORDER[b.pipeline_stage] ?? 0))
    default:
      return sorted // created_at desc is already the default from the query
  }
}

function exportCSV(tasks: Task[], clients: { id: string; name: string }[], users: { id: string; name: string }[]) {
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]))
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
  const rows = [
    ['Title', 'Client', 'Stage', 'Priority', 'Status', 'Assignee', 'Due Date', 'Start Date', 'Estimated Hours', 'Tags'],
    ...tasks.map(t => [
      t.title,
      clientMap[t.client_id] ?? '',
      t.pipeline_stage,
      t.priority,
      t.status,
      t.assigned_to ? (userMap[t.assigned_to] ?? '') : '',
      t.due_date ?? '',
      t.start_date ?? '',
      t.estimated_hours != null ? String(t.estimated_hours) : '',
      (t.tags ?? []).join('; '),
    ]),
  ]
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `novax-tasks-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface TaskGroup { label: string; tasks: Task[]; urgency: number }

function groupMyTasks(tasks: Task[]): TaskGroup[] {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const weekStr = new Date(now.getTime() + 7 * 864e5).toISOString().split('T')[0]

  const groups: TaskGroup[] = [
    { label: 'Overdue',    tasks: [], urgency: 0 },
    { label: 'Due Today',  tasks: [], urgency: 1 },
    { label: 'This Week',  tasks: [], urgency: 2 },
    { label: 'Upcoming',   tasks: [], urgency: 3 },
    { label: 'No Due Date',tasks: [], urgency: 4 },
  ]

  for (const task of tasks) {
    if (task.status === 'completed') continue
    if (!task.due_date) {
      groups[4].tasks.push(task)
    } else if (isOverdue(task.due_date)) {
      groups[0].tasks.push(task)
    } else if (task.due_date.startsWith(todayStr)) {
      groups[1].tasks.push(task)
    } else if (task.due_date <= weekStr) {
      groups[2].tasks.push(task)
    } else {
      groups[3].tasks.push(task)
    }
  }

  // Pinned tasks sort to the top within each group
  for (const g of groups) {
    g.tasks.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
  }
  return groups.filter(g => g.tasks.length > 0)
}

function formatDueTime(task: Task): string {
  if (!task.due_date) return '—'
  const days = daysUntil(task.due_date)
  const overdue = isOverdue(task.due_date) && task.status !== 'completed'
  const timeStr = task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''
  if (overdue) return `${Math.abs(days!)}d overdue${timeStr}`
  if (days === 0) return `Today${timeStr}`
  if (days === 1) return `Tomorrow${timeStr}`
  return `${formatDate(task.due_date)}${timeStr}`
}

function TaskRow({
  task,
  clients,
  users,
  onClick,
  onPin,
}: {
  task: Task
  clients: ReturnType<typeof useClients>['clients']
  users: ReturnType<typeof useUsers>['users']
  onClick: () => void
  onPin?: (taskId: string, pinned: boolean) => void
}) {
  const client   = clients.find(c => c.id === task.client_id)
  const assignee = users.find(u => u.id === task.assigned_to)
  const stage    = STAGE_CONFIG[task.pipeline_stage]
  const priority = PRIORITY_CONFIG[task.priority]
  const overdue  = !!task.due_date && isOverdue(task.due_date) && task.status !== 'completed'
  const subStyle = task.sub_type ? getSubtypeStyle(task.sub_type) : null

  const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    active:    { label: 'Active',    bg: 'bg-emerald-50',  color: 'text-emerald-700', dot: 'bg-emerald-500' },
    pending:   { label: 'Pending',   bg: 'bg-amber-50',    color: 'text-amber-700',   dot: 'bg-amber-400'   },
    blocked:   { label: 'Blocked',   bg: 'bg-red-50',      color: 'text-red-600',     dot: 'bg-red-500'     },
    completed: { label: 'Completed', bg: 'bg-slate-100',   color: 'text-slate-500',   dot: 'bg-slate-400'   },
  }
  const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE.active

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
    >
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: client?.color ?? '#94a3b8' }} />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium group-hover:text-novax transition-colors truncate',
          task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800')}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-400 font-medium">{client?.name}</span>
          {task.sub_type && subStyle && (
            <span className={cn('text-[10px] px-1.5 py-px rounded font-medium', subStyle.bg, subStyle.color)}>
              {task.sub_type}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className={cn('hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0', statusStyle.bg, statusStyle.color)}>
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusStyle.dot)} />
        {statusStyle.label}
      </span>

      <span className={cn('hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium', stage.bg, stage.color)}>
        {stage.label}
      </span>

      <span className={cn('hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium', priority.bg, priority.color)}>
        {priority.label}
      </span>

      <div className={cn('hidden sm:flex items-center gap-1 text-[11px] shrink-0 min-w-[80px]',
        overdue ? 'text-red-500 font-medium' : 'text-slate-400',
      )}>
        {task.due_time
          ? <Clock className="w-3 h-3 shrink-0" />
          : overdue
            ? <AlertCircle className="w-3 h-3 shrink-0" />
            : <Calendar className="w-3 h-3 shrink-0" />}
        {formatDueTime(task)}
      </div>

      {assignee ? (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ background: assignee.color }}
          title={assignee.name}
        >
          {assignee.initials}
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
      )}

      {onPin && (
        <button
          onClick={e => { e.stopPropagation(); onPin(task.id, !task.is_pinned) }}
          title={task.is_pinned ? 'Unpin task' : 'Pin task to top'}
          className={cn(
            'shrink-0 p-1 rounded transition-colors',
            task.is_pinned
              ? 'text-novax hover:text-novax-muted'
              : 'text-slate-200 hover:text-slate-400 opacity-0 group-hover:opacity-100',
          )}
        >
          {task.is_pinned
            ? <BookmarkCheck className="w-3.5 h-3.5" />
            : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      )}
    </button>
  )
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth()
  const assignedClientIds = useMyAssignedClientIds()
  // Don't fire queries until auth is settled — prevents double-fetch race where
  // assignedClientIds is null (loading) then changes once auth resolves.
  const ready = !authLoading
  const { tasks, isLoading, error } = useTasks(
    assignedClientIds !== null ? { clientIds: assignedClientIds } : undefined,
    { enabled: ready }
  )
  const { tasks: templates, isLoading: templatesLoading } = useTasks(
    assignedClientIds !== null
      ? { clientIds: assignedClientIds, templatesOnly: true }
      : { templatesOnly: true },
    { enabled: ready }
  )
  const allClients = useClients().clients
  const clients = assignedClientIds !== null
    ? allClients.filter(c => assignedClientIds.includes(c.id))
    : allClients
  const { users } = useUsers()
  const updateTask = useUpdateTask()
  useRealtime('tasks', ['tasks'])

  const [view, setView] = useState<ViewTab>('all')
  const [search, setSearch]           = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([])
  const [subTypeFilter, setSubTypeFilter] = useState<string[]>([])
  const [duePreset, setDuePreset]     = useState<'overdue' | 'today' | 'this_week' | ''>('')
  const [sortBy, setSortBy] = useState<SortBy>('created')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const handlePin = useCallback((taskId: string, pinned: boolean) => {
    updateTask.mutate({ id: taskId, is_pinned: pinned })
  }, [updateTask])

  const toggleStage    = (s: PipelineStage) =>
    setStageFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const togglePriority = (p: Priority) =>
    setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  const toggleSubType  = (t: string) =>
    setSubTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  // All-tasks filtered list
  const filtered = useMemo(() => {
    let list = tasks
    if (clientFilter) list = list.filter(t => t.client_id === clientFilter)
    if (stageFilter.length) list = list.filter(t => stageFilter.includes(t.pipeline_stage))
    if (priorityFilter.length) list = list.filter(t => priorityFilter.includes(t.priority))
    if (subTypeFilter.length) list = list.filter(t => t.sub_type && subTypeFilter.includes(t.sub_type))
    if (duePreset === 'overdue') list = list.filter(t => t.due_date && isOverdue(t.due_date) && t.status !== 'completed')
    if (duePreset === 'today') {
      const today = new Date().toISOString().split('T')[0]
      list = list.filter(t => t.due_date?.startsWith(today))
    }
    if (duePreset === 'this_week') {
      const end = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]
      list = list.filter(t => t.due_date && t.due_date <= end)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        clients.find(c => c.id === t.client_id)?.name.toLowerCase().includes(q)
      )
    }
    return sortTasks(list, sortBy)
  }, [tasks, clientFilter, stageFilter, priorityFilter, subTypeFilter, duePreset, search, clients, sortBy])

  // My-tasks grouped list
  const myTasks = useMemo(
    () => tasks.filter(t => user && t.assigned_to === user.id),
    [tasks, user],
  )
  const myTaskGroups = useMemo(() => groupMyTasks(myTasks), [myTasks])

  // Tasks created by me and assigned to someone else
  const assignedByMe = useMemo(
    () => tasks.filter(t =>
      user &&
      t.created_by === user.id &&
      t.assigned_to !== null &&
      t.assigned_to !== user.id,
    ),
    [tasks, user],
  )

  const hasFilters = clientFilter || stageFilter.length || priorityFilter.length || subTypeFilter.length || duePreset || search
  const clearFilters = () => {
    setClientFilter(''); setStageFilter([]); setPriorityFilter([])
    setSubTypeFilter([]); setDuePreset(''); setSearch('')
  }

  const completedCount = myTasks.filter(t => t.status === 'completed').length
  const overdueCount   = myTasks.filter(t => t.due_date && isOverdue(t.due_date) && t.status !== 'completed').length

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Query error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Failed to load tasks: {error.message}. Check your connection and try again.</span>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Reload
          </button>
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        <button
          onClick={() => setView('all')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <List className="w-3.5 h-3.5" />
          All Tasks
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
            view === 'all' ? 'bg-novax-light text-novax' : 'bg-slate-200 text-slate-500')}>
            {tasks.length}
          </span>
        </button>
        <button
          onClick={() => setView('mine')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'mine'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <User className="w-3.5 h-3.5" />
          My Tasks
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
            view === 'mine' ? 'bg-novax text-white' : 'bg-slate-200 text-slate-500')}>
            {myTasks.filter(t => t.status !== 'completed').length}
          </span>
          {overdueCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
              {overdueCount} overdue
            </span>
          )}
        </button>
        <button
          onClick={() => setView('assigned')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'assigned'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Assigned by Me
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
            view === 'assigned' ? 'bg-novax-light text-novax' : 'bg-slate-200 text-slate-500')}>
            {assignedByMe.filter(t => t.status !== 'completed').length}
          </span>
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'calendar'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Calendar
        </button>
        <button
          onClick={() => setView('templates')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'templates'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          Templates
          {templates.length > 0 && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
              view === 'templates' ? 'bg-novax-light text-novax' : 'bg-slate-200 text-slate-500')}>
              {templates.length}
            </span>
          )}
        </button>
      </div>

      {/* ── ALL TASKS VIEW ── */}
      {view === 'all' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortBy)}
                  className="appearance-none pl-6 pr-6 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 outline-none hover:border-slate-300 transition-colors"
                >
                  <option value="created">Created</option>
                  <option value="due">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="stage">Stage</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              </div>
              {/* CSV Export */}
              {filtered.length > 0 && (
                <button
                  onClick={() => exportCSV(filtered, clients, users)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Export to CSV"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              )}
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border-active focus:ring-1 focus:ring-novax-light"
                />
              </div>
              <div className="relative">
                <select
                  value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}
                  className={cn(
                    'appearance-none px-3 pr-7 py-1.5 text-sm border rounded-lg outline-none transition-colors',
                    clientFilter ? 'border-novax bg-novax-light text-novax font-medium' : 'border-slate-200 text-slate-600',
                  )}
                >
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={duePreset}
                  onChange={e => setDuePreset(e.target.value as typeof duePreset)}
                  className={cn(
                    'appearance-none px-3 pr-7 py-1.5 text-sm border rounded-lg outline-none transition-colors',
                    duePreset ? 'border-novax bg-novax-light text-novax font-medium' : 'border-slate-200 text-slate-600',
                  )}
                >
                  <option value="">Any Date</option>
                  {DUE_PRESETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Stage</span>
              {PIPELINE_STAGES.map(s => {
                const cfg = STAGE_CONFIG[s]; const active = stageFilter.includes(s)
                return (
                  <button key={s} onClick={() => toggleStage(s)}
                    className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                      active ? `${cfg.bg} ${cfg.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Priority</span>
              {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => {
                const cfg = PRIORITY_CONFIG[p]; const active = priorityFilter.includes(p)
                return (
                  <button key={p} onClick={() => togglePriority(p)}
                    className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                      active ? `${cfg.bg} ${cfg.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Type</span>
              {ALL_SUBTYPES.slice(0, 14).map(t => {
                const style = getSubtypeStyle(t); const active = subTypeFilter.includes(t)
                return (
                  <button key={t} onClick={() => toggleSubType(t)}
                    className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                      active ? `${style.bg} ${style.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Task list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-novax-accent border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-400">No tasks match the current filters.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filtered.map(task => (
                  <TaskRow key={task.id} task={task} clients={clients} users={users} onClick={() => setSelectedTask(task)} onPin={handlePin} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MY TASKS VIEW ── */}
      {view === 'mine' && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active',    value: myTasks.filter(t => t.status === 'active').length,    color: 'text-novax' },
              { label: 'Overdue',   value: overdueCount,                                          color: 'text-red-500' },
              { label: 'Completed', value: completedCount,                                        color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-novax-accent border-t-transparent animate-spin" />
            </div>
          ) : myTaskGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <User className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No active tasks assigned to you</p>
              <p className="text-xs text-slate-400 mt-1">Tasks assigned to you will appear here grouped by urgency</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myTaskGroups.map(group => (
                <div key={group.label} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={cn('px-4 py-2.5 border-b border-slate-100 flex items-center justify-between',
                    group.label === 'Overdue' ? 'bg-red-50' : 'bg-slate-50/50')}>
                    <div className="flex items-center gap-2">
                      {group.label === 'Overdue' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      {group.label === 'Due Today' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                      {(group.label === 'This Week' || group.label === 'Upcoming') && <Calendar className="w-3.5 h-3.5 text-slate-400" />}
                      <span className={cn('text-xs font-semibold',
                        group.label === 'Overdue' ? 'text-red-600' :
                        group.label === 'Due Today' ? 'text-amber-600' : 'text-slate-600')}>
                        {group.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">{group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.tasks.map(task => (
                      <TaskRow key={task.id} task={task} clients={clients} users={users} onClick={() => setSelectedTask(task)} onPin={handlePin} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ASSIGNED BY ME VIEW ── */}
      {view === 'assigned' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active',    value: assignedByMe.filter(t => t.status === 'active').length,    color: 'text-novax' },
              { label: 'Overdue',   value: assignedByMe.filter(t => t.due_date && isOverdue(t.due_date) && t.status !== 'completed').length, color: 'text-red-500' },
              { label: 'Completed', value: assignedByMe.filter(t => t.status === 'completed').length, color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-novax-accent border-t-transparent animate-spin" />
            </div>
          ) : assignedByMe.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Send className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No tasks assigned to others yet</p>
              <p className="text-xs text-slate-400 mt-1">Tasks you create and assign to teammates will appear here</p>
            </div>
          ) : (
            (() => {
              const groups = groupMyTasks(assignedByMe)
              return groups.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {assignedByMe.filter(t => t.status === 'completed').map(task => (
                      <TaskRow key={task.id} task={task} clients={clients} users={users} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map(group => (
                    <div key={group.label} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className={cn('px-4 py-2.5 border-b border-slate-100 flex items-center justify-between',
                        group.label === 'Overdue' ? 'bg-red-50' : 'bg-slate-50/50')}>
                        <div className="flex items-center gap-2">
                          {group.label === 'Overdue' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {group.label === 'Due Today' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                          {(group.label === 'This Week' || group.label === 'Upcoming') && <Calendar className="w-3.5 h-3.5 text-slate-400" />}
                          <span className={cn('text-xs font-semibold',
                            group.label === 'Overdue' ? 'text-red-600' :
                            group.label === 'Due Today' ? 'text-amber-600' : 'text-slate-600')}>
                            {group.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">{group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.tasks.map(task => (
                          <TaskRow key={task.id} task={task} clients={clients} users={users} onClick={() => setSelectedTask(task)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <TaskCalendar
            tasks={tasks}
            clients={clients}
            onSelectTask={setSelectedTask}
          />
        </div>
      )}

      {/* ── TEMPLATES VIEW ── */}
      {view === 'templates' && (
        <>
          <p className="text-xs text-slate-400">
            Templates are saved tasks reusable as starting points. To save a task as a template, open it and use the kebab menu.
          </p>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-novax-accent border-t-transparent animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <LayoutTemplate className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No templates yet</p>
              <p className="text-xs text-slate-400 mt-1">Open any task and use the menu to save it as a template</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {templates.map(task => (
                  <TaskRow key={task.id} task={task} clients={clients} users={users} onClick={() => setSelectedTask(task)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedTask && (
        <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
