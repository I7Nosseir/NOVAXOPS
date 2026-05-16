'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react'
import type { Task } from '@/lib/types'
import { STAGE_CONFIG, PRIORITY_CONFIG, formatDate, isOverdue, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'

type SortKey = 'title' | 'pipeline_stage' | 'priority' | 'assigned_to' | 'due_date' | 'status'
type SortDir = 'asc' | 'desc'

const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 }
const STAGE_RANK: Record<string, number> = {
  strategy: 1, ideas: 2, calendar: 3, copy: 4, design: 5,
  review: 6, approval: 7, scheduled: 8, published: 9, reporting: 10,
}
const STATUS_RANK: Record<string, number> = { active: 1, blocked: 2, completed: 3 }
const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  blocked: 'bg-red-500',
  completed: 'bg-slate-400',
}

interface Props {
  tasks: Task[]
}

export function TaskList({ tasks }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { clients } = useClients()
  const { users } = useUsers()

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'title': cmp = a.title.localeCompare(b.title); break
      case 'pipeline_stage': cmp = (STAGE_RANK[a.pipeline_stage] ?? 0) - (STAGE_RANK[b.pipeline_stage] ?? 0); break
      case 'priority': cmp = (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0); break
      case 'assigned_to': {
        const na = users.find(u => u.id === a.assigned_to)?.name ?? ''
        const nb = users.find(u => u.id === b.assigned_to)?.name ?? ''
        cmp = na.localeCompare(nb); break
      }
      case 'due_date': {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
        cmp = da - db; break
      }
      case 'status': cmp = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-novax" />
      : <ChevronDown className="w-3 h-3 text-novax" />
  }

  const cols: { key: SortKey; label: string; cls?: string }[] = [
    { key: 'title', label: 'Task' },
    { key: 'pipeline_stage', label: 'Stage', cls: 'w-28' },
    { key: 'priority', label: 'Priority', cls: 'w-24' },
    { key: 'assigned_to', label: 'Assignee', cls: 'w-36' },
    { key: 'due_date', label: 'Due', cls: 'w-28' },
    { key: 'status', label: 'Status', cls: 'w-24' },
  ]

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-10 px-4 py-3" />
              {cols.map(({ key, label, cls }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className={cn(
                    'px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors select-none',
                    cls,
                  )}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon col={key} />
                  </div>
                </th>
              ))}
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(task => {
              const client = clients.find(c => c.id === task.client_id)
              const user = users.find(u => u.id === task.assigned_to)
              const stage = STAGE_CONFIG[task.pipeline_stage]
              const priority = PRIORITY_CONFIG[task.priority]
              const overdue = !!task.due_date && isOverdue(task.due_date) && task.status !== 'completed'

              return (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={e => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: client?.color }} />
                      <span className="text-sm font-medium text-slate-800 group-hover:text-novax transition-colors line-clamp-1">
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', stage.bg, stage.color, stage.border)}>
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', priority.bg, priority.color)}>
                      {priority.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {user ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ background: user.color }}
                        >
                          {user.initials}
                        </div>
                        <span className="text-xs text-slate-600 truncate">{user.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-xs', overdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[task.status] ?? 'bg-slate-300')} />
                      <span className="text-xs text-slate-600 capitalize">{task.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id) }}
                      className="p-1 rounded hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">No tasks match the current filters.</div>
        )}
      </div>

      <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
    </>
  )
}
