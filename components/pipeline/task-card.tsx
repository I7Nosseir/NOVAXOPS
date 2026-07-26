'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, AlertCircle, ListChecks, CheckSquare, Square, BookmarkCheck } from 'lucide-react'
import type { Task } from '@/lib/types'
import { PRIORITY_CONFIG, formatDate, isOverdue, daysUntil, getSubtypeStyle, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'

const STATUS_DOT: Record<string, string> = {
  pending:   'bg-slate-400',
  active:    'bg-blue-500',
  blocked:   'bg-red-500',
  completed: 'bg-emerald-500',
}

const STATUS_PILL: Record<string, string> = {
  pending:   'bg-slate-100 text-slate-500',
  active:    'bg-blue-50 text-blue-600',
  blocked:   'bg-red-50 text-red-600',
  completed: 'bg-emerald-50 text-emerald-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'To Do',
  active:    'In Progress',
  blocked:   'Blocked',
  completed: 'Done',
}

interface Props {
  task: Task
  onSelect: (task: Task) => void
  isDragOverlay?: boolean
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (taskId: string) => void
}

export function TaskCard({ task, onSelect, isDragOverlay, isSelectMode, isSelected, onToggleSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isSelectMode,
  })

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
  const overdue = !!task.due_date && isOverdue(task.due_date) && task.status !== 'completed'
  const days = task.due_date ? daysUntil(task.due_date) : null

  const checklistItems = task.checklist ?? []
  const checklistDone  = checklistItems.filter(i => i.done).length

  const handleClick = () => {
    if (isSelectMode) {
      onToggleSelect?.(task.id)
    } else {
      onSelect(task)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isSelectMode ? {} : listeners)}
      onClick={handleClick}
      className={cn(
        'bg-white rounded-xl border p-3.5 transition-all duration-150 group select-none',
        isSelectMode
          ? 'cursor-pointer'
          : 'cursor-grab active:cursor-grabbing',
        isSelected
          ? 'border-novax bg-novax-light shadow-md'
          : 'border-slate-200 hover:border-novax-border-active hover:shadow-md',
        isDragOverlay && 'shadow-xl rotate-1 border-novax-border-active',
      )}
    >
      {/* Client tag + select checkbox */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {isSelectMode ? (
            <span className="text-novax shrink-0">
              {isSelected
                ? <CheckSquare className="w-3.5 h-3.5" />
                : <Square className="w-3.5 h-3.5 text-slate-300" />
              }
            </span>
          ) : (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: client?.color }} />
          )}
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{client?.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {task.is_pinned && <BookmarkCheck className="w-3 h-3 text-novax shrink-0" />}
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', priority.bg, priority.color)}>
            {priority.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 leading-snug mb-3 group-hover:text-novax transition-colors">
        {task.title}
      </p>

      {/* Sub-type + Tags */}
      {(task.sub_type || task.tags.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.sub_type && (() => {
            const s = getSubtypeStyle(task.sub_type)
            return (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', s.bg, s.color)}>
                {task.sub_type}
              </span>
            )
          })()}
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
          {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
          {task.due_date
            ? overdue
              ? `${Math.abs(days!)}d overdue`
              : days === 0 ? 'Due today' : days! > 0 ? `${days}d left` : formatDate(task.due_date)
            : '—'}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Checklist badge */}
          {checklistItems.length > 0 && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
              checklistDone === checklistItems.length
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500',
            )}>
              <ListChecks className="w-2.5 h-2.5" />
              {checklistDone}/{checklistItems.length}
            </span>
          )}
          {/* Status pill */}
          <span className={cn(
            'inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
            STATUS_PILL[task.status] ?? 'bg-slate-100 text-slate-400',
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[task.status] ?? 'bg-slate-300')} />
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {user && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ background: user.color }}
            >
              {user.initials}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
