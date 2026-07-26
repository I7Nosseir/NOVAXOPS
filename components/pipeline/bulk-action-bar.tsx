'use client'

import { useState } from 'react'
import { X, ChevronDown, UserCheck, MoveRight, CheckCheck, Trash2, Loader2 } from 'lucide-react'
import { cn, PIPELINE_STAGES, STAGE_CONFIG } from '@/lib/utils'
import { useUsers } from '@/lib/hooks/use-users'
import { useUpdateTask, useDeleteTask } from '@/lib/hooks/use-tasks'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PipelineStage } from '@/lib/types'

interface Props {
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionBar({ selectedIds, onClear }: Props) {
  const { users } = useUsers()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const queryClient = useQueryClient()

  const [stageOpen,  setStageOpen]  = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  if (selectedIds.length === 0) return null

  const runBulk = async (fn: (id: string) => Promise<void>, successMsg: string) => {
    setBusy(true)
    try {
      await Promise.all(selectedIds.map(fn))
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(successMsg)
      onClear()
    } catch {
      toast.error('Some actions failed — please try again')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveStage = (stage: PipelineStage) => {
    setStageOpen(false)
    runBulk(
      id => new Promise<void>((resolve, reject) => {
        updateTask.mutate({ id, pipeline_stage: stage }, { onSuccess: resolve, onError: reject })
      }),
      `Moved ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''} to ${STAGE_CONFIG[stage].label}`,
    )
  }

  const handleAssign = (userId: string) => {
    setAssignOpen(false)
    runBulk(
      id => new Promise<void>((resolve, reject) => {
        updateTask.mutate({ id, assigned_to: userId }, { onSuccess: resolve, onError: reject })
      }),
      `Assigned ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''}`,
    )
  }

  const handleComplete = () => {
    runBulk(
      id => new Promise<void>((resolve, reject) => {
        updateTask.mutate({ id, status: 'completed' }, { onSuccess: resolve, onError: reject })
      }),
      `Marked ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''} complete`,
    )
  }

  const handleDelete = () => {
    runBulk(
      id => new Promise<void>((resolve, reject) => {
        deleteTask.mutate(id, { onSuccess: resolve, onError: reject })
      }),
      `Deleted ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''}`,
    )
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-[#1B3D38] text-white rounded-2xl shadow-2xl shadow-novax/30 border border-white/10">

      {/* Count */}
      <span className="text-sm font-bold mr-1 tabular-nums">
        {selectedIds.length} selected
      </span>

      <div className="w-px h-5 bg-white/20" />

      {/* Move Stage */}
      <div className="relative">
        <button
          onClick={() => { setStageOpen(v => !v); setAssignOpen(false); setDeleteConfirm(false) }}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors disabled:opacity-40"
        >
          <MoveRight className="w-3.5 h-3.5" />
          Move Stage
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {stageOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-44 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10">
            {PIPELINE_STAGES.map(s => {
              const cfg = STAGE_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => handleMoveStage(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-novax-light transition-colors border-b border-slate-50 last:border-0"
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.bg)} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Assign To */}
      <div className="relative">
        <button
          onClick={() => { setAssignOpen(v => !v); setStageOpen(false); setDeleteConfirm(false) }}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors disabled:opacity-40"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Assign To
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {assignOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-44 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10 max-h-56 overflow-y-auto">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleAssign(u.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-novax-light transition-colors border-b border-slate-50 last:border-0"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                  style={{ background: u.color }}
                >
                  {u.initials}
                </div>
                {u.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mark Complete */}
      <button
        onClick={handleComplete}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold transition-colors disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
        Complete
      </button>

      <div className="w-px h-5 bg-white/20" />

      {/* Delete */}
      {deleteConfirm ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-red-300 font-medium">Delete {selectedIds.length}?</span>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="px-2.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-xs font-bold transition-colors disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
          </button>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="px-2 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDeleteConfirm(true)}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-500/80 text-xs font-semibold transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Clear */}
      <button
        onClick={() => { onClear(); setStageOpen(false); setAssignOpen(false); setDeleteConfirm(false) }}
        className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
