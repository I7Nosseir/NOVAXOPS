'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Task, PipelineStage } from '@/lib/types'
import { STAGE_CONFIG, cn } from '@/lib/utils'
import { TaskCard } from './task-card'

interface Props {
  stage: PipelineStage
  tasks: Task[]
  onSelectTask: (task: Task) => void
  onAddTask: () => void
}

export function PipelineColumn({ stage, tasks, onSelectTask, onAddTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const config = STAGE_CONFIG[stage]

  return (
    <div className="flex flex-col w-64 sm:w-72 shrink-0">
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0', config.border, config.bg)}>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold uppercase tracking-wider', config.color)}>
            {config.label}
          </span>
        </div>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', config.bg, config.color, config.border)}>
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-72 p-2 rounded-b-xl border border-t-0 transition-colors flex flex-col',
          config.border,
          isOver ? 'bg-novax-light/60' : 'bg-slate-50/50',
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5 flex-1">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onSelect={onSelectTask} />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className={cn(
            'flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs transition-colors',
            isOver ? 'border-novax-border-active text-novax-accent' : `${config.border} text-slate-300`,
          )}>
            Drop here
          </div>
        )}

        {/* Add task button */}
        <button
          onClick={onAddTask}
          className={cn(
            'mt-2 flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
            'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add task
        </button>
      </div>
    </div>
  )
}
