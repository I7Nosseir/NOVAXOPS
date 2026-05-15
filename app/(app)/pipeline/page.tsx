'use client'

import { useState } from 'react'
import { LayoutGrid, List, Filter } from 'lucide-react'
import { useTasks } from '@/lib/hooks/use-tasks'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import { cn } from '@/lib/utils'

export default function PipelinePage() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const { tasks } = useTasks()

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{tasks.length} tasks across 10 stages</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-3.5 h-3.5"/>
            Filter
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={cn('p-2 transition-colors', view === 'board' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
            >
              <LayoutGrid className="w-4 h-4"/>
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('p-2 transition-colors', view === 'list' ? 'bg-novax-light text-novax' : 'text-slate-400 hover:text-slate-600')}
            >
              <List className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </div>

      <PipelineBoard initialTasks={tasks} />
    </div>
  )
}
