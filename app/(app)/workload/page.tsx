'use client'

import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useUsers } from '@/lib/hooks/use-users'
import { useTasks } from '@/lib/hooks/use-tasks'
import { STAGE_CONFIG, formatDate, isOverdue, cn } from '@/lib/utils'

const CAPACITY = 8 // max tasks per person before overload

export default function WorkloadPage() {
  const { users } = useUsers()
  const { tasks: allTasks } = useTasks()
  const members = users.map(user => {
    const tasks = allTasks.filter(t => t.assigned_to === user.id && t.status === 'active')
    const overdue = tasks.filter(t => t.due_date && isOverdue(t.due_date))
    const highPriority = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high')
    const load = tasks.length / CAPACITY
    return { user, tasks, overdue, highPriority, load }
  }).sort((a, b) => b.tasks.length - a.tasks.length)

  const totalActive = allTasks.filter(t => t.status === 'active').length
  const overloaded = members.filter(m => m.load >= 1).length
  const atRisk = members.filter(m => m.load >= 0.75 && m.load < 1).length

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Team Members', value: users.length, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Active Tasks', value: totalActive, color: 'text-novax', bg: 'bg-novax-light' },
          { label: 'Overloaded', value: overloaded, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'At Capacity', value: atRisk, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold', bg, color)}>
              {value}
            </div>
            <p className="text-sm font-medium text-slate-700">{label}</p>
          </div>
        ))}
      </div>

      {/* Member cards */}
      <div className="space-y-3">
        {members.map(({ user, tasks, overdue, highPriority, load }) => {
          const isOverloaded = load >= 1
          const isAtRisk = load >= 0.75 && load < 1
          const barColor = isOverloaded ? 'bg-red-400' : isAtRisk ? 'bg-amber-400' : 'bg-emerald-400'
          const barWidth = Math.min(load * 100, 100)

          return (
            <div key={user.id} className={cn('bg-white rounded-xl border overflow-hidden', isOverloaded ? 'border-red-200' : 'border-slate-200')}>
              {/* Header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: user.color }}>
                  {user.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                    <span className="text-[10px] text-slate-400 capitalize">{user.role.replace(/_/g, ' ')}</span>
                    {isOverloaded && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5"/>
                        Overloaded
                      </span>
                    )}
                    {isAtRisk && !isOverloaded && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5"/>
                        At Capacity
                      </span>
                    )}
                    {!isOverloaded && !isAtRisk && tasks.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-2.5 h-2.5"/>
                        Healthy
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${barWidth}%` }}/>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">{tasks.length}/{CAPACITY} tasks</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-center shrink-0">
                  {[
                    { label: 'Active', value: tasks.length, color: 'text-slate-900' },
                    { label: 'Overdue', value: overdue.length, color: overdue.length > 0 ? 'text-red-600' : 'text-slate-400' },
                    { label: 'High Priority', value: highPriority.length, color: highPriority.length > 0 ? 'text-amber-600' : 'text-slate-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className={cn('text-base font-bold', color)}>{value}</p>
                      <p className="text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks list */}
              {tasks.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-3">
                  <div className="space-y-1.5">
                    {tasks.slice(0, 4).map(task => {
                      const stage = STAGE_CONFIG[task.pipeline_stage]
                      const isTaskOverdue = task.due_date ? isOverdue(task.due_date) : false
                      return (
                        <div key={task.id} className="flex items-center gap-2 py-1">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', stage.color, stage.bg, stage.border)}>
                            {stage.label}
                          </span>
                          <p className="flex-1 text-xs text-slate-700 truncate">{task.title}</p>
                          <span className={cn('text-[10px] font-medium shrink-0', isTaskOverdue ? 'text-red-500' : 'text-slate-400')}>
                            {formatDate(task.due_date)}
                          </span>
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                            task.priority === 'urgent' ? 'bg-red-400' : task.priority === 'high' ? 'bg-orange-400' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                          )}/>
                        </div>
                      )
                    })}
                    {tasks.length > 4 && (
                      <p className="text-[11px] text-slate-400 pl-1">+{tasks.length - 4} more tasks</p>
                    )}
                  </div>
                </div>
              )}

              {tasks.length === 0 && (
                <div className="border-t border-slate-100 px-5 py-3">
                  <p className="text-xs text-slate-400">No active tasks assigned</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
