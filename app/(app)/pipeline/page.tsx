'use client'

import { useState, useCallback, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List, Filter, Layers } from 'lucide-react'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useMyAssignedClientIds } from '@/lib/hooks/use-client-assignments'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import { TaskList } from '@/components/pipeline/task-list'
import { FilterPanel, EMPTY_FILTERS, type FilterState } from '@/components/pipeline/filter-panel'
import { FilterChips } from '@/components/pipeline/filter-chips'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { cn } from '@/lib/utils'
import type { PipelineStage, Priority, TaskStatus } from '@/lib/types'

function parseFilters(params: URLSearchParams): FilterState {
  return {
    clientIds:     params.get('client')?.split(',').filter(Boolean) ?? [],
    assignedTo:    params.get('assignee')?.split(',').filter(Boolean) ?? [],
    priorities:    (params.get('priority')?.split(',').filter(Boolean) ?? []) as Priority[],
    stages:        (params.get('stage')?.split(',').filter(Boolean) ?? []) as PipelineStage[],
    statuses:      (params.get('status')?.split(',').filter(Boolean) ?? []) as TaskStatus[],
    subTypes:      params.get('subtype')?.split(',').filter(Boolean) ?? [],
    dueDatePreset: (params.get('due') ?? '') as FilterState['dueDatePreset'],
  }
}

function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.clientIds.length)     p.set('client',   f.clientIds.join(','))
  if (f.assignedTo.length)    p.set('assignee', f.assignedTo.join(','))
  if (f.priorities.length)    p.set('priority', f.priorities.join(','))
  if (f.stages.length)        p.set('stage',    f.stages.join(','))
  if (f.statuses.length)      p.set('status',   f.statuses.join(','))
  if (f.subTypes.length)      p.set('subtype',  f.subTypes.join(','))
  if (f.dueDatePreset)        p.set('due',      f.dueDatePreset)
  return p
}

function hasActiveFilters(f: FilterState) {
  return f.clientIds.length > 0 || f.assignedTo.length > 0 ||
    f.priorities.length > 0 || f.stages.length > 0 ||
    f.statuses.length > 0 || f.subTypes.length > 0 || !!f.dueDatePreset
}

function PipelineContent() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [boardMode, setBoardMode] = useState<'full' | 'grouped'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('pipeline_board_mode') as 'full' | 'grouped') ?? 'full'
    return 'full'
  })
  const [showFilter, setShowFilter] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawFilters = parseFilters(searchParams)
  const assignedClientIds = useMyAssignedClientIds()

  // Intersect URL client filter with the user's assigned clients
  const filters = useMemo((): FilterState => {
    if (assignedClientIds === null) return rawFilters // bypass role — no restriction
    const scope = assignedClientIds // user's allowed set
    const urlClientIds = rawFilters.clientIds
    const intersection = urlClientIds.length > 0
      ? urlClientIds.filter(id => scope.includes(id))
      : scope // no URL filter → restrict to assigned clients
    return { ...rawFilters, clientIds: intersection }
  }, [rawFilters, assignedClientIds])

  // Bypass roles (admin/ceo/creative_director) with no URL client filter should
  // see ALL tasks. Pass clientIds: undefined so useTasks doesn't treat [] as
  // "user has no assigned clients → return nothing."
  const taskFilters = assignedClientIds === null && filters.clientIds.length === 0
    ? { ...filters, clientIds: undefined }
    : filters

  const { tasks } = useTasks(taskFilters)
  const active = hasActiveFilters(rawFilters)

  useRealtime('tasks', ['tasks'])

  const updateFilters = useCallback((newFilters: FilterState) => {
    const params = filtersToParams(newFilters)
    router.replace(`/pipeline${params.toString() ? '?' + params.toString() : ''}`)
    setShowFilter(false)
  }, [router])

  const clearFilters = useCallback(() => {
    router.replace('/pipeline')
    setShowFilter(false)
  }, [router])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{tasks.length} tasks across 10 stages</p>

        <div className="flex items-center gap-2">
          {/* Filter button */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                active
                  ? 'border-novax-border-active bg-novax-light text-novax font-medium'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
              {active && (
                <span className="ml-0.5 text-[10px] font-bold bg-novax text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {[filters.clientIds, filters.assignedTo, filters.priorities, filters.stages, filters.statuses, filters.subTypes].reduce((n, a) => n + a.length, 0) + (filters.dueDatePreset ? 1 : 0)}
                </span>
              )}
            </button>

            {showFilter && (
              <FilterPanel
                filters={filters}
                onUpdate={updateFilters}
                onClose={() => setShowFilter(false)}
              />
            )}
          </div>

          {/* Board mode toggle (only when board view) */}
          {view === 'board' && (
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs">
              <button
                onClick={() => { setBoardMode('full'); localStorage.setItem('pipeline_board_mode', 'full') }}
                title="Full view — all 10 stages"
                className={cn('px-2.5 py-1.5 flex items-center gap-1 transition-colors font-medium', boardMode === 'full' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Full
              </button>
              <button
                onClick={() => { setBoardMode('grouped'); localStorage.setItem('pipeline_board_mode', 'grouped') }}
                title="Grouped view — 5 phase bands"
                className={cn('px-2.5 py-1.5 flex items-center gap-1 transition-colors font-medium', boardMode === 'grouped' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
              >
                <Layers className="w-3.5 h-3.5" />
                Grouped
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={cn('p-2 transition-colors', view === 'board' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('p-2 transition-colors', view === 'list' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {active && (
        <FilterChips
          filters={filters}
          onRemove={updateFilters}
          onClear={clearFilters}
        />
      )}

      {/* Views */}
      {view === 'board' ? (
        <PipelineBoard initialTasks={tasks} boardMode={boardMode} />
      ) : (
        <TaskList tasks={tasks} />
      )}

      <CreateTaskDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500 py-8 text-center">Loading pipeline…</div>}>
      <PipelineContent />
    </Suspense>
  )
}
