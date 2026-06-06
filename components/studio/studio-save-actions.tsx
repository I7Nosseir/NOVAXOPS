'use client'

import { useState } from 'react'
import { FileText, BookOpen, ListTodo, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/types'

interface Props {
  client?: Client | null
  sessionId?: string | null
  // The content snapshot to save (plain text or JSON stringified)
  contentSummary: string
  // For "Save as Document" — full document title
  documentTitle?: string
  // For "Create Task" — pre-filled title and description
  taskTitle?: string
  taskDescription?: string
  // Context bank category auto-assignment
  contextCategory?: string
  className?: string
}

type ActionState = 'idle' | 'loading' | 'done' | 'error'

export function StudioSaveActions({
  client,
  contentSummary,
  documentTitle,
  taskTitle,
  taskDescription,
  contextCategory = 'Campaign Feedback',
  className,
}: Props) {
  const { user } = useAuth()
  const [docState, setDocState] = useState<ActionState>('idle')
  const [ctxState, setCtxState] = useState<ActionState>('idle')
  const [taskState, setTaskState] = useState<ActionState>('idle')

  // ── Save as Document ──────────────────────────────────────────
  const handleSaveDoc = async () => {
    if (docState !== 'idle') return
    setDocState('loading')
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentTitle ?? `Studio Output — ${client?.name ?? 'Client'}`,
          client_id: client?.id ?? null,
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: contentSummary }] }] },
          doc_type: 'studio_output',
          created_by: user?.id,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setDocState('done')
    } catch {
      setDocState('error')
    }
  }

  // ── Add to Context Bank ───────────────────────────────────────
  const handleAddContext = async () => {
    if (!client?.id || ctxState !== 'idle') return
    setCtxState('loading')
    try {
      // Process with AI first
      const processRes = await fetch(`/api/clients/${client.id}/context-bank/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contentSummary, source_type: 'studio' }),
      })
      const processed = processRes.ok
        ? await processRes.json() as { category: string; summary: string; full_text: string }
        : { category: contextCategory, summary: contentSummary.slice(0, 300), full_text: contentSummary }

      await fetch(`/api/clients/${client.id}/context-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: processed.category,
          summary: processed.summary,
          full_text: processed.full_text,
          source_type: 'studio',
          created_by: user?.id,
        }),
      })
      setCtxState('done')
    } catch {
      setCtxState('error')
    }
  }

  // ── Create Task ───────────────────────────────────────────────
  const handleCreateTask = async () => {
    if (taskState !== 'idle' || !supabase) return
    setTaskState('loading')
    try {
      const { error } = await supabase.from('tasks').insert({
        title: taskTitle ?? documentTitle ?? 'Studio Output Task',
        description: taskDescription ?? contentSummary.slice(0, 800),
        client_id: client?.id ?? null,
        project_id: null,
        pipeline_stage: 'copy',
        priority: 'medium',
        status: 'active',
        assigned_to: user?.id ?? null,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setTaskState('done')
    } catch {
      setTaskState('error')
    }
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <ActionButton
        icon={FileText}
        label="Save as Document"
        state={docState}
        onClick={handleSaveDoc}
        doneLabel="Saved to Docs"
      />
      {client?.id && (
        <ActionButton
          icon={BookOpen}
          label="Add to Context Bank"
          state={ctxState}
          onClick={handleAddContext}
          doneLabel="Added to Memory"
        />
      )}
      <ActionButton
        icon={ListTodo}
        label="Create Task"
        state={taskState}
        onClick={handleCreateTask}
        doneLabel="Task Created"
      />
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  state,
  onClick,
  doneLabel,
}: {
  icon: typeof FileText
  label: string
  state: ActionState
  onClick: () => void
  doneLabel: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'loading' || state === 'done'}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
        state === 'done'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : state === 'error'
          ? 'bg-red-50 text-red-600 border-red-200'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-novax-light hover:text-novax hover:border-novax-border',
        'disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin"/>
      ) : state === 'done' ? (
        <Check className="w-3.5 h-3.5"/>
      ) : (
        <Icon className="w-3.5 h-3.5"/>
      )}
      {state === 'done' ? doneLabel : state === 'error' ? 'Try again' : label}
    </button>
  )
}
