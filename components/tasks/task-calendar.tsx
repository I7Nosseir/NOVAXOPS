'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  tasks: Task[]
  clients: { id: string; name: string; color: string }[]
  onSelectTask: (task: Task) => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun → convert to Mon-based (0=Mon)
  return (new Date(year, month, 1).getDay() + 6) % 7
}

export function TaskCalendar({ tasks, clients, onSelectTask }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const tasksByDay = useMemo(() => {
    const map: Record<number, Task[]> = {}
    tasks.forEach(t => {
      if (!t.due_date) return
      const d = new Date(t.due_date)
      if (d.getFullYear() !== year || d.getMonth() !== month) return
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push(t)
    })
    return map
  }, [tasks, year, month])

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setExpandedDay(null)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setExpandedDay(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayDate = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setExpandedDay(null) }}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Today
          </button>
          <button onClick={next} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAYS.map(d => (
          <div key={d} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="bg-slate-50 dark:bg-slate-900/40 min-h-[90px]" />
          }
          const dayTasks = tasksByDay[day] ?? []
          const isToday = day === todayDate
          const isExpanded = expandedDay === day
          const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, 3)
          const overflow = dayTasks.length - 3

          return (
            <div
              key={day}
              className={cn(
                'bg-white dark:bg-slate-900 p-1.5 min-h-[90px] relative transition-colors',
                isToday && 'bg-novax-light dark:bg-novax/10',
              )}
            >
              <div className={cn(
                'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                isToday
                  ? 'bg-novax text-white'
                  : 'text-slate-500 dark:text-slate-400',
              )}>
                {day}
              </div>

              <div className="space-y-0.5">
                {visibleTasks.map(t => {
                  const client = clientMap[t.client_id]
                  const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== 'completed'
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className={cn(
                        'w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate border-l-2 transition-opacity hover:opacity-75',
                        isOverdue
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                      )}
                      style={!isOverdue ? { borderLeftColor: client?.color ?? '#1B3D38' } : undefined}
                    >
                      {t.title}
                    </button>
                  )
                })}

                {!isExpanded && overflow > 0 && (
                  <button
                    onClick={() => setExpandedDay(day)}
                    className="text-[10px] text-novax-muted dark:text-novax-accent font-medium pl-1 hover:underline"
                  >
                    +{overflow} more
                  </button>
                )}
                {isExpanded && (
                  <button
                    onClick={() => setExpandedDay(null)}
                    className="text-[10px] text-slate-400 font-medium pl-1 hover:underline"
                  >
                    show less
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
