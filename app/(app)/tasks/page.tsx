'use client'

import { useState, useMemo } from 'react'
import { Search, Calendar, AlertCircle, X, ChevronDown } from 'lucide-react'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'
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

export default function TasksPage() {
  const { user } = useAuth()
  const { tasks, isLoading } = useTasks()
  const { clients } = useClients()
  const { users } = useUsers()

  // Filters
  const [search, setSearch] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [clientFilter, setClientFilter] = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage[]>([])
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([])
  const [subTypeFilter, setSubTypeFilter] = useState<string[]>([])
  const [duePreset, setDuePreset] = useState<'overdue' | 'today' | 'this_week' | ''>('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const toggleStage = (s: PipelineStage) =>
    setStageFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const togglePriority = (p: Priority) =>
    setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  const toggleSubType = (t: string) =>
    setSubTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const filtered = useMemo(() => {
    let list = tasks
    if (assignedToMe && user) list = list.filter(t => t.assigned_to === user.id)
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
    return list
  }, [tasks, assignedToMe, user, clientFilter, stageFilter, priorityFilter, subTypeFilter, duePreset, search, clients])

  const hasFilters = assignedToMe || clientFilter || stageFilter.length || priorityFilter.length || subTypeFilter.length || duePreset || search
  const clearFilters = () => {
    setAssignedToMe(false)
    setClientFilter('')
    setStageFilter([])
    setPriorityFilter([])
    setSubTypeFilter([])
    setDuePreset('')
    setSearch('')
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <X className="w-3 h-3"/> Clear filters
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
        {/* Row 1: Search + Assigned to me + Client */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border-active focus:ring-1 focus:ring-novax-light"
            />
          </div>
          <button
            onClick={() => setAssignedToMe(v => !v)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors whitespace-nowrap',
              assignedToMe ? 'bg-novax border-novax text-white' : 'border-slate-200 text-slate-600 hover:border-novax-border',
            )}
          >
            My Tasks
          </button>
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
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400"/>
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
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400"/>
          </div>
        </div>

        {/* Row 2: Stage chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Stage</span>
          {PIPELINE_STAGES.map(s => {
            const cfg = STAGE_CONFIG[s]
            const active = stageFilter.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStage(s)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                  active ? `${cfg.bg} ${cfg.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300',
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Row 3: Priority chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Priority</span>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => {
            const cfg = PRIORITY_CONFIG[p]
            const active = priorityFilter.includes(p)
            return (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                  active ? `${cfg.bg} ${cfg.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300',
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Row 4: Sub-type chips (most common ones) */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-center mr-1">Type</span>
          {ALL_SUBTYPES.slice(0, 14).map(t => {
            const style = getSubtypeStyle(t)
            const active = subTypeFilter.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleSubType(t)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                  active ? `${style.bg} ${style.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300',
                )}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 rounded-full border-2 border-novax-accent border-t-transparent animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">No tasks match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map(task => {
              const client = clients.find(c => c.id === task.client_id)
              const assignee = users.find(u => u.id === task.assigned_to)
              const stage = STAGE_CONFIG[task.pipeline_stage]
              const priority = PRIORITY_CONFIG[task.priority]
              const overdue = !!task.due_date && isOverdue(task.due_date) && task.status !== 'completed'
              const days = task.due_date ? daysUntil(task.due_date) : null
              const subStyle = task.sub_type ? getSubtypeStyle(task.sub_type) : null

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
                >
                  {/* Client dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: client?.color ?? '#94a3b8' }}/>

                  {/* Title + sub-type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-novax transition-colors truncate">
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

                  {/* Stage */}
                  <span className={cn('hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium', stage.bg, stage.color)}>
                    {stage.label}
                  </span>

                  {/* Priority */}
                  <span className={cn('hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium', priority.bg, priority.color)}>
                    {priority.label}
                  </span>

                  {/* Due date */}
                  <div className={cn(
                    'hidden sm:flex items-center gap-1 text-[11px] shrink-0',
                    overdue ? 'text-red-500 font-medium' : 'text-slate-400',
                  )}>
                    {overdue ? <AlertCircle className="w-3 h-3"/> : <Calendar className="w-3 h-3"/>}
                    {task.due_date
                      ? overdue
                        ? `${Math.abs(days!)}d overdue`
                        : days === 0 ? 'Today' : days! > 0 ? `${days}d` : formatDate(task.due_date)
                      : '—'}
                  </div>

                  {/* Assignee avatar */}
                  {assignee ? (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: assignee.color }}
                      title={assignee.name}
                    >
                      {assignee.initials}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0"/>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Task detail slide-over */}
      {selectedTask && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedTask(null)}/>
          <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)}/>
        </>
      )}
    </div>
  )
}
