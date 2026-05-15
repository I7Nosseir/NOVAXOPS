'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task, PipelineStage } from '@/lib/types'
import { PIPELINE_STAGES } from '@/lib/utils'
import { useUpdateTaskStage } from '@/lib/hooks/use-tasks'
import { PipelineColumn } from './pipeline-column'
import { TaskCard } from './task-card'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'

interface Props {
  initialTasks: Task[]
}

export function PipelineBoard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const updateStage = useUpdateTaskStage()

  // Sync when fresh data arrives from server
  useState(() => { setTasks(initialTasks) })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

    // Determine the target stage
    const overIsStage = PIPELINE_STAGES.includes(over.id as PipelineStage)
    const overTask = tasks.find(t => t.id === over.id)
    const targetStage: PipelineStage = overIsStage
      ? (over.id as PipelineStage)
      : overTask?.pipeline_stage ?? activeTask.pipeline_stage

    if (targetStage === activeTask.pipeline_stage) {
      // Same column — reorder
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
      // Cross-column move — optimistic update + persist
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

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: 'calc(100vh - 140px)' }}>
          {PIPELINE_STAGES.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              tasks={getTasksByStage(stage)}
              onSelectTask={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard task={activeTask} onSelect={() => {}} isDragOverlay />
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  )
}
