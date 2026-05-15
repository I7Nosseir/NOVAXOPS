'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, AlertCircle } from 'lucide-react'
import type { Task } from '@/lib/types'
import { PRIORITY_CONFIG, formatDate, isOverdue, daysUntil, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'

interface Props {
  task: Task
  onSelect: (task: Task) => void
  isDragOverlay?: boolean
}

export function TaskCard({ task, onSelect, isDragOverlay }: Props) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const { clients } = useClients()
  const { users } = useUsers()
  const priority = PRIORITY_CONFIG[task.priority]
  const client = clients.find(c => c.id === task.client_id)
  const user = users.find(u => u.id === task.assigned_to)
  const overdue = isOverdue(task.due_date) && task.status !== 'completed'
  const days = daysUntil(task.due_date)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-3.5 cursor-grab active:cursor-grabbing',
        'hover:border-novax-border-active hover:shadow-md transition-all duration-150 group select-none',
        isDragOverlay && 'shadow-xl rotate-1 border-novax-border-active',
      )}
    >
      {/* Client tag */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: client?.color }}/>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{client?.name}</span>
        </div>
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', priority.bg, priority.color)}>
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 leading-snug mb-3 group-hover:text-novax transition-colors">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-1 text-[11px]', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {overdue ? <AlertCircle className="w-3 h-3"/> : <Calendar className="w-3 h-3"/>}
          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : days > 0 ? `${days}d left` : formatDate(task.due_date)}
        </div>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ background: user?.color }}>
          {user?.initials}
        </div>
      </div>
    </div>
  )
}
