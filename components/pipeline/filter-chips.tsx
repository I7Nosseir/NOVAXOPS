'use client'

import { X } from 'lucide-react'
import type { FilterState } from './filter-panel'
import { STAGE_CONFIG, PRIORITY_CONFIG } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'

interface Props {
  filters: FilterState
  onRemove: (update: FilterState) => void
  onClear: () => void
}

export function FilterChips({ filters, onRemove, onClear }: Props) {
  const { clients } = useClients()
  const { users } = useUsers()

  type Chip = { label: string; remove: () => void }
  const chips: Chip[] = [
    ...filters.clientIds.map(id => ({
      label: `Client: ${clients.find(c => c.id === id)?.name ?? id}`,
      remove: () => onRemove({ ...filters, clientIds: filters.clientIds.filter(x => x !== id) }),
    })),
    ...filters.assignedTo.map(id => ({
      label: `Assignee: ${users.find(u => u.id === id)?.name ?? id}`,
      remove: () => onRemove({ ...filters, assignedTo: filters.assignedTo.filter(x => x !== id) }),
    })),
    ...filters.priorities.map(p => ({
      label: `Priority: ${PRIORITY_CONFIG[p].label}`,
      remove: () => onRemove({ ...filters, priorities: filters.priorities.filter(x => x !== p) }),
    })),
    ...filters.stages.map(s => ({
      label: `Stage: ${STAGE_CONFIG[s].label}`,
      remove: () => onRemove({ ...filters, stages: filters.stages.filter(x => x !== s) }),
    })),
    ...filters.statuses.map(s => ({
      label: `Status: ${s.charAt(0).toUpperCase() + s.slice(1)}`,
      remove: () => onRemove({ ...filters, statuses: filters.statuses.filter(x => x !== s) }),
    })),
    ...(filters.dueDatePreset ? [{
      label: `Due: ${filters.dueDatePreset === 'overdue' ? 'Overdue' : filters.dueDatePreset === 'today' ? 'Today' : 'This week'}`,
      remove: () => onRemove({ ...filters, dueDatePreset: '' }),
    }] : []),
    ...filters.subTypes.map(s => ({
      label: `Type: ${s}`,
      remove: () => onRemove({ ...filters, subTypes: filters.subTypes.filter(x => x !== s) }),
    })),
  ]

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-novax-light text-novax rounded-full border border-novax-border"
        >
          {chip.label}
          <button onClick={chip.remove} className="hover:text-novax-hover transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-700 underline transition-colors">
        Clear all
      </button>
    </div>
  )
}
