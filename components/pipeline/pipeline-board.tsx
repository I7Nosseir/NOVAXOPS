'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task, PipelineStage } from '@/lib/types'
import { PIPELINE_STAGES, PIPELINE_GROUPS } from '@/lib/utils'
import { useUpdateTaskStage } from '@/lib/hooks/use-tasks'
import { PipelineColumn } from './pipeline-column'
import { TaskCard } from './task-card'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'

interface Props {
  initialTasks: Task[]
  boardMode?: 'full' | 'grouped'
}

export function PipelineBoard({ initialTasks, boardMode = 'full' }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createStage, setCreateStage] = useState<PipelineStage | null>(null)
  const updateStage = useUpdateTaskStage()

  // Keep local task list in sync with server data
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  // Derive selected task from tasks so it auto-updates after mutations
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const getTasksByStage = useCallback(
    (stage: PipelineStage) => tasks.filter(t => t.pipeline_stage === stage),
    [tasks],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const overIsStage = PIPELINE_STAGES.includes(over.id as PipelineStage)
    const overTask = tasks.find(t => t.id === over.id)
    const targetStage: PipelineStage = overIsStage
      ? (over.id as PipelineStage)
      : overTask?.pipeline_stage ?? activeTask.pipeline_stage

    if (targetStage === activeTask.pipeline_stage) {
      const stageItems = getTasksByStage(targetStage)
      const oldIdx = stageItems.findIndex(t => t.id === active.id)
      const newIdx = stageItems.findIndex(t => t.id === over.id)
      if (oldIdx !== newIdx) {
        const reordered = arrayMove(stageItems, oldIdx, newIdx)
        setTasks(prev => [
          ...prev.filter(t => t.pipeline_stage !== targetStage),
          ...reordered,
        ])
      }
    } else {
      setTasks(prev =>
        prev.map(t =>
          t.id === active.id
            ? { ...t, pipeline_stage: targetStage, updated_at: new Date().toISOString() }
            : t,
        ),
      )
      updateStage.mutate({ taskId: active.id as string, stage: targetStage })
    }
  }

  // Track expanded groups in grouped mode
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (label: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })

  return (
    <>
      <CreateTaskDialog
        open={createStage !== null}
        defaultStage={createStage ?? undefined}
        onClose={() => setCreateStage(null)}
      />
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {boardMode === 'full' ? (
          <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
            {PIPELINE_STAGES.map(stage => (
              <PipelineColumn
                key={stage}
                stage={stage}
                tasks={getTasksByStage(stage)}
                onSelectTask={t => setSelectedTaskId(t.id)}
                onAddTask={() => setCreateStage(stage)}
              />
            ))}
          </div>
        ) : (
          /* Grouped view — 5 phase bands */
          <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
            {PIPELINE_GROUPS.map(group => {
              const groupTasks = group.stages.flatMap(s => getTasksByStage(s))
              const isExpanded = expandedGroups.has(group.label)
              return (
                <div key={group.label} className={`flex flex-col shrink-0 transition-all ${isExpanded ? 'w-[600px]' : 'w-56'}`}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border mb-2 transition-colors ${group.bg} border-slate-200 hover:border-slate-300`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${group.color}`}>{group.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/60 ${group.color}`}>
                        {groupTasks.length}
                      </span>
                    </div>
                    <span className={`text-[10px] ${group.color} opacity-60`}>{isExpanded ? '−' : '+'}</span>
                  </button>

                  {isExpanded ? (
                    /* Expanded: show each sub-stage column */
                    <div className="flex gap-3 flex-1">
                      {group.stages.map(stage => (
                        <PipelineColumn
                          key={stage}
                          stage={stage}
                          tasks={getTasksByStage(stage)}
                          onSelectTask={t => setSelectedTaskId(t.id)}
                          onAddTask={() => setCreateStage(stage)}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Collapsed: compact task list */
                    <div className="flex-1 space-y-1.5 overflow-y-auto px-1">
                      {groupTasks.slice(0, 8).map(task => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                        >
                          <p className="text-xs font-medium text-slate-700 line-clamp-1">{task.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{task.pipeline_stage}</p>
                        </button>
                      ))}
                      {groupTasks.length > 8 && (
                        <button onClick={() => toggleGroup(group.label)}
                          className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 py-1">
                          +{groupTasks.length - 8} more — click to expand
                        </button>
                      )}
                      {groupTasks.length === 0 && (
                        <p className="text-[11px] text-slate-300 text-center py-4">Empty</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onSelect={() => {}} isDragOverlay />}
        </DragOverlay>
      </DndContext>

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  )
}
