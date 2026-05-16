'use client'

import { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { PipelineStage, Priority, TaskStatus } from '@/lib/types'
import { STAGE_CONFIG, PIPELINE_STAGES, PRIORITY_CONFIG, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'

export interface FilterState {
  clientIds: string[]
  assignedTo: string[]
  priorities: Priority[]
  stages: PipelineStage[]
  statuses: TaskStatus[]
  dueDatePreset: '' | 'overdue' | 'today' | 'this_week'
}

export const EMPTY_FILTERS: FilterState = {
  clientIds: [], assignedTo: [], priorities: [], stages: [], statuses: [], dueDatePreset: '',
}

interface Props {
  filters: FilterState
  onUpdate: (filters: FilterState) => void
  onClose: () => void
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export function FilterPanel({ filters, onUpdate, onClose }: Props) {
  const { clients } = useClients()
  const { users } = useUsers()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-4 space-y-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Filter Tasks</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Client */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Client</p>
        <div className="space-y-1.5">
          {clients.map(c => (
            <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.clientIds.includes(c.id)}
                onChange={() => onUpdate({ ...filters, clientIds: toggle(filters.clientIds, c.id) })}
                className="rounded border-slate-300 text-novax"
              />
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Assignee</p>
        <div className="flex flex-wrap gap-2">
          {users.map(u => (
            <button
              key={u.id}
              title={u.name}
              onClick={() => onUpdate({ ...filters, assignedTo: toggle(filters.assignedTo, u.id) })}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-all',
                filters.assignedTo.includes(u.id) ? 'ring-2 ring-novax ring-offset-1' : 'opacity-50 hover:opacity-100',
              )}
              style={{ background: u.color }}
            >
              {u.initials}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority</p>
        <div className="flex flex-wrap gap-2">
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => {
            const pc = PRIORITY_CONFIG[p]
            const active = filters.priorities.includes(p)
            return (
              <button
                key={p}
                onClick={() => onUpdate({ ...filters, priorities: toggle(filters.priorities, p) })}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize',
                  active ? 'bg-novax text-white border-novax' : cn(pc.bg, pc.color, 'border-transparent hover:border-slate-300'),
                )}
              >
                {pc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stage */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Stage</p>
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STAGES.map(s => {
            const sc = STAGE_CONFIG[s]
            const active = filters.stages.includes(s)
            return (
              <button
                key={s}
                onClick={() => onUpdate({ ...filters, stages: toggle(filters.stages, s) })}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                  active ? 'bg-novax text-white border-novax' : cn(sc.bg, sc.color, sc.border),
                )}
              >
                {sc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
        <div className="flex gap-2">
          {(['active', 'blocked', 'completed'] as TaskStatus[]).map(s => {
            const active = filters.statuses.includes(s)
            return (
              <button
                key={s}
                onClick={() => onUpdate({ ...filters, statuses: toggle(filters.statuses, s) })}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all',
                  active ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      {/* Due date */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Due Date</p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'overdue' as const, label: 'Overdue' },
            { value: 'today' as const, label: 'Today' },
            { value: 'this_week' as const, label: 'This week' },
          ]).map(({ value, label }) => {
            const active = filters.dueDatePreset === value
            return (
              <button
                key={value}
                onClick={() => onUpdate({ ...filters, dueDatePreset: active ? '' : value })}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                  active ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={() => onUpdate(EMPTY_FILTERS)}
        className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        Clear all filters
      </button>
    </div>
  )
}
