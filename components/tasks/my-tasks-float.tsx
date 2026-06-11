'use client'

import { useState, useEffect, useRef } from 'react'
import { ListTodo, X, AlertCircle, Calendar, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'
import { useUpdateTaskStage } from '@/lib/hooks/use-tasks'
import { useAuth } from '@/lib/auth-context'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'
import { STAGE_CONFIG, PRIORITY_CONFIG, PIPELINE_STAGES, isOverdue, daysUntil, getSubtypeStyle, cn } from '@/lib/utils'
import type { Task, PipelineStage } from '@/lib/types'

type Tab = 'active' | 'overdue' | 'done'

export function MyTasksFloat() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('active')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const { tasks } = useTasks(user ? { assignedTo: [user.id] } : undefined)
  const { clients } = useClients()
  const updateStage = useUpdateTaskStage()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Don't close if task detail is open
        if (!selectedTask) setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, selectedTask])

  const today = new Date().toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const activeTasks = tasks.filter(t =>
    t.status !== 'completed' && !(t.due_date && isOverdue(t.due_date))
  )
  const overdueTasks = tasks.filter(t =>
    t.status !== 'completed' && t.due_date && isOverdue(t.due_date)
  )
  const doneTasks = tasks.filter(t => {
    if (t.status !== 'completed') return false
    return !t.due_date || t.due_date >= today
  })

  const tabTasks: Record<Tab, Task[]> = {
    active: activeTasks,
    overdue: overdueTasks,
    done: doneTasks,
  }

  const displayTasks = tabTasks[tab]

  // Total unread/active badge count
  const urgentCount = overdueTasks.length + activeTasks.filter(t => t.priority === 'urgent').length

  return (
    <>
      {/* FAB — compact icon button, stacked above AI Assistant */}
      <div className="fixed bottom-[8.75rem] lg:bottom-[4.75rem] right-6 z-50 group">
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            'relative w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition-all duration-200',
            open ? 'bg-novax-hover text-white shadow-lg' : 'bg-novax text-white hover:bg-novax-hover hover:shadow-lg',
          )}
          title="My Tasks"
        >
          <ListTodo className="w-4 h-4"/>
          {urgentCount > 0 && !open && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {urgentCount > 99 ? '99+' : urgentCount}
            </span>
          )}
        </button>
        <span className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-800 text-white text-xs font-medium px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          My Tasks
        </span>
      </div>

      {/* Slide-over panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-[12.5rem] lg:bottom-[8.5rem] right-4 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[65vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-slate-900">My Tasks</p>
              <p className="text-[10px] text-slate-400">{tasks.length} assigned to you</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/tasks?assignedToMe=1"
                onClick={() => setOpen(false)}
                className="text-novax-muted hover:text-novax transition-colors"
                title="View all my tasks"
              >
                <ExternalLink className="w-3.5 h-3.5"/>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 shrink-0">
            {([
              { key: 'active',  label: 'Active',  count: activeTasks.length },
              { key: 'overdue', label: 'Overdue', count: overdueTasks.length },
              { key: 'done',    label: 'Done',    count: doneTasks.length },
            ] as { key: Tab; label: string; count: number }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 py-2 text-[11px] font-semibold transition-colors relative',
                  tab === t.key ? 'text-novax' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'ml-1 text-[9px] font-bold px-1 py-px rounded-full',
                    t.key === 'overdue' && t.count > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500',
                  )}>
                    {t.count}
                  </span>
                )}
                {tab === t.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-novax rounded-t-full"/>
                )}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {displayTasks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400">
                  {tab === 'overdue' ? 'No overdue tasks.' : tab === 'done' ? 'Nothing completed this week.' : 'No active tasks.'}
                </p>
              </div>
            ) : (
              displayTasks.map(task => {
                const client = clients.find(c => c.id === task.client_id)
                const stage = STAGE_CONFIG[task.pipeline_stage]
                const priority = PRIORITY_CONFIG[task.priority]
                const overdue = !!task.due_date && isOverdue(task.due_date)
                const days = task.due_date ? daysUntil(task.due_date) : null
                const subStyle = task.sub_type ? getSubtypeStyle(task.sub_type) : null

                return (
                  <div key={task.id} className="px-3 py-2.5 hover:bg-slate-50 group">
                    {/* Title row */}
                    <button
                      className="w-full text-left"
                      onClick={() => { setSelectedTask(task) }}
                    >
                      <p className="text-xs font-medium text-slate-800 group-hover:text-novax transition-colors line-clamp-2">
                        {task.title}
                      </p>
                    </button>

                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {client && (
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{client.name}</span>
                      )}
                      <span className={cn('text-[9px] px-1.5 py-px rounded-full font-medium', stage.bg, stage.color)}>
                        {stage.label}
                      </span>
                      {task.sub_type && subStyle && (
                        <span className={cn('text-[9px] px-1.5 py-px rounded font-medium', subStyle.bg, subStyle.color)}>
                          {task.sub_type}
                        </span>
                      )}
                      <span className={cn(
                        'ml-auto flex items-center gap-0.5 text-[9px] font-medium',
                        overdue ? 'text-red-500' : 'text-slate-400',
                      )}>
                        {overdue ? <AlertCircle className="w-2.5 h-2.5"/> : <Calendar className="w-2.5 h-2.5"/>}
                        {task.due_date
                          ? overdue ? `${Math.abs(days!)}d overdue`
                          : days === 0 ? 'Today' : days! > 0 ? `${days}d` : '—'
                          : '—'}
                      </span>
                    </div>

                    {/* Quick stage update */}
                    <div className="mt-1.5">
                      <select
                        value={task.pipeline_stage}
                        onChange={e => updateStage.mutate({ taskId: task.id, stage: e.target.value as PipelineStage })}
                        className="w-full text-[9px] py-0.5 px-1.5 border border-slate-200 rounded text-slate-500 outline-none focus:border-novax-border-active bg-white appearance-none"
                        onClick={e => e.stopPropagation()}
                      >
                        {PIPELINE_STAGES.map(s => (
                          <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </>
  )
}
