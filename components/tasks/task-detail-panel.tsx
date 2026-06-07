'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Sparkles, FileSearch, Search, BookOpen, Loader2, CheckCircle,
  Clock, Zap, Copy, MoreHorizontal, Trash2, Eye, BookOpen as ReadIcon,
  ChevronDown, ChevronRight, Monitor, FileText, Plus, ExternalLink,
  Wand2, ClipboardList,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Task, AgentType, PipelineStage, Priority, TaskStatus, ContentBriefRequest, ContentBriefData } from '@/lib/types'
import { BriefRequestButton } from './brief-request-button'
import { STAGE_CONFIG, PIPELINE_STAGES, PRIORITY_CONFIG, formatDate, formatDateTime, timeAgo, getSubtypesForStage, getSubtypeStyle, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useProjects } from '@/lib/hooks/use-projects'
import { useUsers } from '@/lib/hooks/use-users'
import { useUpdateTask, useDeleteTask } from '@/lib/hooks/use-tasks'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { useAuth } from '@/lib/auth-context'
import { TaskComments } from './task-comments'
import { AIFeedbackButtons } from '@/components/shared/ai-feedback-buttons'

interface CopyVariant {
  id: string; label: string; tone: string; framework?: string; hook?: string; text: string
}

const DEFAULT_COPY_VARIANTS: CopyVariant[] = [
  { id: 'v1', label: 'AIDA — Aspirational', tone: 'Elegant & story-driven', framework: 'AIDA' },
  { id: 'v2', label: 'PAS — Problem-led',   tone: 'Urgent & empathetic',    framework: 'PAS' },
  { id: 'v3', label: 'Social Currency',     tone: 'Peer-to-peer',           framework: 'STEPPS' },
].map(v => ({ ...v, text: '' }))

const AGENTS: { type: AgentType; label: string; icon: typeof Sparkles; description: string }[] = [
  { type: 'task_analyzer',       label: 'Analyze Task',  icon: Sparkles,   description: 'Breaks down brief and flags missing info' },
  { type: 'copywriter',          label: 'Write Copy',    icon: FileSearch, description: 'Generates brand-aware copy for this stage' },
  { type: 'researcher',          label: 'Research',      icon: Search,     description: 'Market context, trends, competitors' },
  { type: 'asset_finder',        label: 'Find Assets',   icon: BookOpen,   description: 'Finds relevant assets from Google Drive' },
  { type: 'presentation_builder', label: 'Build Deck',   icon: Zap,        description: 'Generates a .pptx from task outputs' },
]

const STATUS_CONFIG = {
  active:    { label: 'Active',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  blocked:   { label: 'Blocked',  dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
  completed: { label: 'Done',     dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200' },
}

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskDetailPanel({ task, onClose }: Props) {
  // AI agent state
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null)
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [showVariants, setShowVariants] = useState(false)
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>(DEFAULT_COPY_VARIANTS)

  // Edit state — tracks which field is being edited
  const [editingField, setEditingField] = useState<string | null>(null)

  // Draft values — synced from task when not editing
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftFinalSubmission, setDraftFinalSubmission] = useState('')
  const [draftStage, setDraftStage] = useState<PipelineStage>('strategy')
  const [draftPriority, setDraftPriority] = useState<Priority>('medium')
  const [draftAssignee, setDraftAssignee] = useState('')
  const [draftDueDate, setDraftDueDate] = useState('')
  const [draftTagInput, setDraftTagInput] = useState('')

  // Delete state
  const [showMenu, setShowMenu] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Design brief collapsible
  const [briefExpanded, setBriefExpanded] = useState(false)

  // Client brief collapsible
  const [clientBriefExpanded, setClientBriefExpanded] = useState(false)

  // Linked documents
  const [docsExpanded, setDocsExpanded] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [showDocSearch, setShowDocSearch] = useState(false)

  const { clients } = useClients()
  const { projects } = useProjects()
  const { users } = useUsers()
  const { user: authUser } = useAuth()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const queryClient = useQueryClient()

  // Roles that can manage task metadata (title, stage, priority, assignee, due date, delete)
  const canManage = !!authUser && ['admin', 'ceo', 'creative_director', 'account_manager', 'strategist'].includes(authUser.role)

  const { data: allDocs = [] } = useQuery<{ id: string; title: string; is_template: boolean }[]>({
    queryKey: ['docs'],
    queryFn: () => fetch('/api/docs').then(r => r.json()),
    staleTime: 60_000,
  })

  const { data: clientBriefRequest } = useQuery<ContentBriefRequest | null>({
    queryKey: ['brief-request', task?.id],
    queryFn: () => fetch(`/api/brief-requests?task_id=${task!.id}`).then(r => r.json()),
    enabled: !!task?.id,
    staleTime: 30_000,
  })

  // Sync drafts when task changes (e.g. after a save re-fetches)
  useEffect(() => {
    if (task) {
      setDraftTitle(task.title)
      setDraftDesc(task.description ?? '')
      setDraftStage(task.pipeline_stage)
      setDraftPriority(task.priority)
      setDraftAssignee(task.assigned_to ?? '')
      setDraftDueDate(task.due_date ?? '')
      setEditingField(null)
      setShowMenu(false)
      setDeleteConfirm(false)
    }
  }, [task?.id])

  const acknowledge = useCallback(async (type: 'seen' | 'read') => {
    if (!authUser || !task) return
    try {
      await fetch(`/api/tasks/${task.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authUser.id, type }),
      })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch { /* non-critical */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, authUser?.id])

  // Auto-mark seen when assignee opens the task
  useEffect(() => {
    if (task && authUser && authUser.id === task.assigned_to && !task.seen_at) {
      acknowledge('seen')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setDeleteConfirm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  if (!task) return null

  const stage = STAGE_CONFIG[task.pipeline_stage]
  const priority = PRIORITY_CONFIG[task.priority]
  const client = clients.find(c => c.id === task.client_id)
  const project = projects.find(p => p.id === task.project_id)
  const user = users.find(u => u.id === task.assigned_to)
  const statusCfg = STATUS_CONFIG[task.status]

  const save = (field: string, value: unknown) => {
    updateTask.mutate({ id: task.id, [field]: value })
    setEditingField(null)
  }

  const markRead = () => acknowledge('read')

  const handleDelete = () => {
    deleteTask.mutate(task.id, { onSuccess: onClose })
  }

  const isAssignee = !!authUser && authUser.id === task.assigned_to
  const seenUser = users.find(u => u.id === task.seen_by)
  const readUser = users.find(u => u.id === task.read_by)

  const handleRunAgent = async (agentType: AgentType) => {
    setActiveAgent(agentType)
    setOutput(null)
    setAgentError(null)
    setShowVariants(false)
    setSelectedVariant(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentType,
          task: { id: task.id, title: task.title, description: task.description, pipeline_stage: task.pipeline_stage },
          client: client ? { id: client.id, name: client.name, brand_identity: client.brand_identity, competitor_context: client.competitor_context } : undefined,
          project: project ? { name: project.name } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setAgentError(data.error ?? 'Generation failed.'); return }
      if (agentType === 'copywriter') {
        try { setCopyVariants(JSON.parse(data.text)); setShowVariants(true) }
        catch { setOutput(data.text) }
      } else {
        setOutput(data.text)
      }
    } catch {
      setAgentError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-3">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Stage — managers can edit, workers see display-only */}
              {canManage && editingField === 'pipeline_stage' ? (
                <select
                  value={draftStage}
                  autoFocus
                  onChange={e => { setDraftStage(e.target.value as PipelineStage); save('pipeline_stage', e.target.value) }}
                  onBlur={() => setEditingField(null)}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-0.5 outline-none focus:border-novax-muted bg-white"
                >
                  {PIPELINE_STAGES.map(s => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </select>
              ) : (
                <span
                  onClick={canManage ? () => { setDraftStage(task.pipeline_stage); setEditingField('pipeline_stage') } : undefined}
                  className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', stage.bg, stage.color, stage.border, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                >
                  {stage.label}
                </span>
              )}

              {/* Priority — managers can edit, workers see display-only */}
              {canManage && editingField === 'priority' ? (
                <div className="flex gap-1">
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => { setDraftPriority(p); save('priority', p) }}
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize transition-all',
                        draftPriority === p ? 'bg-novax text-white border-novax' : 'border-slate-200 text-slate-500 hover:border-slate-300',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setEditingField(null)} className="text-[10px] text-slate-400 hover:text-slate-600 px-1">✕</button>
                </div>
              ) : (
                <span
                  onClick={canManage ? () => { setDraftPriority(task.priority); setEditingField('priority') } : undefined}
                  className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', priority.bg, priority.color, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                >
                  {priority.label}
                </span>
              )}

              {/* Sub-type — managers can edit, workers see display-only */}
              {(() => {
                const subtypes = getSubtypesForStage(task.pipeline_stage)
                if (subtypes.length === 0) return null
                const currentStyle = task.sub_type ? getSubtypeStyle(task.sub_type) : null
                if (canManage && editingField === 'sub_type') {
                  return (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => { save('sub_type', null) }}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400 hover:border-slate-300"
                      >
                        None
                      </button>
                      {subtypes.map(st => (
                        <button
                          key={st.label}
                          onClick={() => save('sub_type', st.label)}
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all',
                            task.sub_type === st.label ? `${st.bg} ${st.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300',
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                      <button onClick={() => setEditingField(null)} className="text-[10px] text-slate-400 hover:text-slate-600 px-1">✕</button>
                    </div>
                  )
                }
                if (task.sub_type && currentStyle) {
                  return (
                    <span
                      onClick={canManage ? () => setEditingField('sub_type') : undefined}
                      className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', currentStyle.bg, currentStyle.color, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                    >
                      {task.sub_type}
                    </span>
                  )
                }
                if (!canManage) return null
                return (
                  <button
                    onClick={() => setEditingField('sub_type')}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-novax-border transition-colors"
                  >
                    + Type
                  </button>
                )
              })()}

              {/* Status toggle — available to assignee and managers */}
              <div className="flex items-center gap-1 ml-auto">
                {(['active', 'blocked', 'completed'] as TaskStatus[]).map(s => {
                  const sc = STATUS_CONFIG[s]
                  const active = task.status === s
                  return (
                    <button
                      key={s}
                      onClick={async () => {
                        if (!authUser || active) return
                        const res = await fetch(`/api/tasks/${task.id}/status`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user_id: authUser.id, role: authUser.role, status: s }),
                        })
                        if (!res.ok) {
                          const d = await res.json()
                          toast.error(d.error ?? 'Failed to update status')
                          return
                        }
                        queryClient.invalidateQueries({ queryKey: ['tasks'] })
                      }}
                      title={sc.label}
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                        active ? cn(sc.bg, sc.text, sc.border) : 'border-transparent text-slate-400 hover:bg-slate-100',
                      )}
                    >
                      <div className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
                      {active && sc.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title — managers can edit, workers see display-only */}
            {canManage && editingField === 'title' ? (
              <input
                value={draftTitle}
                autoFocus
                onChange={e => setDraftTitle(e.target.value)}
                onBlur={() => { if (draftTitle.trim()) save('title', draftTitle.trim()); else setEditingField(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { if (draftTitle.trim()) save('title', draftTitle.trim()); else setEditingField(null) }
                  if (e.key === 'Escape') { setDraftTitle(task.title); setEditingField(null) }
                }}
                className="w-full text-base font-semibold text-slate-900 border-b-2 border-novax outline-none bg-transparent"
              />
            ) : (
              <h2
                onClick={canManage ? () => { setDraftTitle(task.title); setEditingField('title') } : undefined}
                className={cn('text-base font-semibold text-slate-900 leading-snug', canManage && 'cursor-text hover:text-novax transition-colors')}
                title={canManage ? 'Click to edit' : undefined}
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 3-dot menu — managers only */}
            {canManage && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => { setShowMenu(v => !v); setDeleteConfirm(false) }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-slate-500" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {deleteConfirm ? (
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-slate-600 font-medium">Delete this task?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDelete}
                            disabled={deleteTask.isPending}
                            className="flex-1 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deleteTask.isPending ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete task
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Meta */}
          <div className="p-5 space-y-4 border-b border-slate-100">
            {/* Description */}
            {editingField === 'description' ? (
              <textarea
                value={draftDesc}
                autoFocus
                rows={3}
                onChange={e => setDraftDesc(e.target.value)}
                onBlur={() => { save('description', draftDesc) }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setDraftDesc(task.description ?? ''); setEditingField(null) }
                }}
                className="w-full text-sm text-slate-600 border border-novax-border rounded-lg p-2 outline-none focus:border-novax-muted resize-none leading-relaxed"
              />
            ) : (
              <p
                onClick={() => { setDraftDesc(task.description ?? ''); setEditingField('description') }}
                className={cn(
                  'text-sm text-slate-600 leading-relaxed cursor-text hover:text-slate-800 transition-colors min-h-[20px]',
                  !task.description && 'text-slate-400 italic',
                )}
                title="Click to edit"
              >
                {task.description || 'Add a description…'}
              </p>
            )}

            {/* Final submission */}
            <div className="rounded-xl border border-novax-border bg-novax-light p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-novax uppercase tracking-wider">Final submission should be</p>
              {editingField === 'final_submission' ? (
                <textarea
                  value={draftFinalSubmission}
                  autoFocus
                  rows={3}
                  onChange={e => setDraftFinalSubmission(e.target.value)}
                  onBlur={() => { save('final_submission', draftFinalSubmission) }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setDraftFinalSubmission(task.final_submission ?? ''); setEditingField(null) }
                  }}
                  className="w-full text-sm text-slate-700 border border-novax-border rounded-lg p-2 outline-none focus:border-novax-muted resize-none leading-relaxed bg-white"
                />
              ) : (
                <p
                  onClick={() => { setDraftFinalSubmission(task.final_submission ?? ''); setEditingField('final_submission') }}
                  className={cn(
                    'text-sm leading-relaxed cursor-text transition-colors min-h-[20px]',
                    task.final_submission ? 'text-slate-700 hover:text-slate-900' : 'text-novax-muted italic hover:text-novax',
                  )}
                  title="Click to edit"
                >
                  {task.final_submission || 'Click to define the expected deliverable…'}
                </p>
              )}
            </div>

            {/* Grid fields */}
            <div className="grid grid-cols-2 gap-3">
              {/* Client — display only */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Client</p>
                <div className="flex items-center gap-1.5">
                  {client?.color && <div className="w-2 h-2 rounded-full" style={{ background: client.color }} />}
                  <p className="text-sm font-medium text-slate-700">{client?.name ?? '—'}</p>
                </div>
              </div>

              {/* Project — display only */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Project</p>
                <p className="text-sm font-medium text-slate-700">{project?.name ?? '—'}</p>
              </div>

              {/* Assignee — managers can edit, workers see display-only */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Assigned to</p>
                {canManage && editingField === 'assigned_to' ? (
                  <div className="flex flex-wrap gap-1 p-1.5 rounded-lg border border-novax-border bg-slate-50">
                    {users.map(u => (
                      <button
                        key={u.id}
                        title={u.name}
                        onClick={() => { setDraftAssignee(u.id); save('assigned_to', u.id) }}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold transition-all',
                          draftAssignee === u.id ? 'ring-2 ring-novax ring-offset-1' : 'opacity-50 hover:opacity-100',
                        )}
                        style={{ background: u.color }}
                      >
                        {u.initials}
                      </button>
                    ))}
                    <button onClick={() => setEditingField(null)} className="text-[10px] text-slate-400 px-1">✕</button>
                  </div>
                ) : (
                  <div
                    onClick={canManage ? () => { setDraftAssignee(task.assigned_to ?? ''); setEditingField('assigned_to') } : undefined}
                    className={cn('flex items-center gap-1.5', canManage && 'cursor-pointer hover:text-novax transition-colors')}
                  >
                    {user ? (
                      <>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: user.color }}>
                          {user.initials}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{user.name}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Unassigned</p>
                    )}
                  </div>
                )}
              </div>

              {/* Due date — managers can edit, workers see display-only */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Due date</p>
                {canManage && editingField === 'due_date' ? (
                  <input
                    type="date"
                    value={draftDueDate}
                    autoFocus
                    onChange={e => setDraftDueDate(e.target.value)}
                    onBlur={() => save('due_date', draftDueDate || null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') save('due_date', draftDueDate || null)
                      if (e.key === 'Escape') { setDraftDueDate(task.due_date ?? ''); setEditingField(null) }
                    }}
                    className="text-sm border border-novax-border rounded-lg px-2 py-0.5 outline-none focus:border-novax-muted w-full"
                  />
                ) : (
                  <p
                    onClick={canManage ? () => { setDraftDueDate(task.due_date ?? ''); setEditingField('due_date') } : undefined}
                    className={cn('text-sm font-medium text-slate-700', canManage && 'cursor-pointer hover:text-novax transition-colors')}
                    title={canManage ? 'Click to edit' : undefined}
                  >
                    {task.due_date ? formatDate(task.due_date) : <span className="text-slate-400 italic">{canManage ? 'Set due date' : '—'}</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {task.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                    #{tag}
                    <button
                      onClick={() => updateTask.mutate({ id: task.id, tags: task.tags.filter(t => t !== tag) })}
                      className="text-slate-400 hover:text-slate-700 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {editingField === 'tags' ? (
                  <input
                    value={draftTagInput}
                    autoFocus
                    placeholder="tag, enter"
                    onChange={e => setDraftTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        const tag = draftTagInput.trim().replace(/^#/, '')
                        if (tag && !task.tags.includes(tag)) {
                          updateTask.mutate({ id: task.id, tags: [...task.tags, tag] })
                        }
                        setDraftTagInput('')
                        setEditingField(null)
                      }
                      if (e.key === 'Escape') { setDraftTagInput(''); setEditingField(null) }
                    }}
                    onBlur={() => { setDraftTagInput(''); setEditingField(null) }}
                    className="text-xs border border-novax-border rounded-md px-2 py-0.5 outline-none focus:border-novax-muted w-24"
                  />
                ) : (
                  <button
                    onClick={() => setEditingField('tags')}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-novax-border hover:text-novax transition-colors"
                  >
                    + tag
                  </button>
                )}
              </div>
            </div>

            {/* Acknowledgment */}
            <div className="pt-1 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Acknowledgment</p>
              {isAssignee ? (
                /* Assignee view — action buttons */
                <div className="flex items-center gap-3">
                  <div className={cn('flex items-center gap-1.5 text-xs font-medium', task.seen_at ? 'text-emerald-600' : 'text-slate-400')}>
                    <Eye className="w-3.5 h-3.5" />
                    {task.seen_at ? `Seen ${timeAgo(task.seen_at)}` : 'Not seen yet'}
                  </div>
                  {task.read_at ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Read {timeAgo(task.read_at)}
                    </div>
                  ) : (
                    <button
                      onClick={markRead}
                      disabled={updateTask.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-novax-light border border-novax-border text-xs font-semibold text-novax hover:bg-novax-light-hover transition-colors disabled:opacity-50"
                    >
                      <ReadIcon className="w-3 h-3" />
                      Mark as Read
                    </button>
                  )}
                </div>
              ) : (
                /* Assigner / others view — tracking status */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium mb-1">Seen</p>
                    {task.seen_at && seenUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: seenUser.color }}>
                          {seenUser.initials}
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">{timeAgo(task.seen_at)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not yet</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium mb-1">Read</p>
                    {task.read_at && readUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: readUser.color }}>
                          {readUser.initials}
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">{timeAgo(task.read_at)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not yet</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Agents */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-novax-muted" />
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">AI Agents</p>
              </div>
              <a
                href={`/studio/content?brief=${encodeURIComponent(task.description ?? task.title)}&client=${task.client_id ?? ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-novax-muted bg-novax-light border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors"
              >
                <Wand2 className="w-3 h-3"/>
                Open in Studio
              </a>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {AGENTS.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => handleRunAgent(type)}
                  disabled={generating}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                    activeAgent === type
                      ? 'border-novax-border-active bg-novax-light'
                      : 'border-slate-200 hover:border-novax-border hover:bg-slate-50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg', activeAgent === type ? 'bg-novax-light-hover' : 'bg-slate-100')}>
                    <Icon className={cn('w-3.5 h-3.5', activeAgent === type ? 'text-novax' : 'text-slate-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', activeAgent === type ? 'text-novax' : 'text-slate-700')}>{label}</p>
                    <p className="text-[10px] text-slate-400">{description}</p>
                  </div>
                  {generating && activeAgent === type && (
                    <Loader2 className="w-3.5 h-3.5 text-novax-muted animate-spin shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* AI Output */}
          {(generating || output || showVariants || agentError) && (
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">AI Output</p>
                {(output || showVariants) && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    <Clock className="w-3 h-3" />
                    Generated
                  </div>
                )}
              </div>
              {generating ? (
                <div className="flex items-center gap-2 p-4 bg-novax-light rounded-xl">
                  <Loader2 className="w-4 h-4 text-novax-muted animate-spin" />
                  <span className="text-sm text-novax-muted">Generating with context injection…</span>
                </div>
              ) : agentError ? (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600">{agentError}</p>
                </div>
              ) : showVariants ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">3 copy variants generated. Select the one that best fits the brief.</p>
                  {copyVariants.map(variant => (
                    <div
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={cn(
                        'rounded-xl border p-3.5 cursor-pointer transition-all',
                        selectedVariant === variant.id ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-novax-border bg-slate-50 hover:bg-white',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider', selectedVariant === variant.id ? 'text-novax' : 'text-slate-600')}>
                            {variant.label}
                          </span>
                          {variant.framework && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wide">
                              {variant.framework}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">· {variant.tone}</span>
                        </div>
                        {selectedVariant === variant.id && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-novax">
                            <CheckCircle className="w-3 h-3" />Selected
                          </div>
                        )}
                      </div>
                      {variant.hook && (
                        <p className="text-[10px] text-novax-muted font-semibold mb-2 italic">Hook: &ldquo;{variant.hook}&rdquo;</p>
                      )}
                      <MarkdownContent content={variant.text} size="xs" />
                      {selectedVariant === variant.id && (
                        <button
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(variant.text).catch(() => {}) }}
                          className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-novax hover:text-novax-hover transition-colors"
                        >
                          <Copy className="w-3 h-3" />Copy to clipboard
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedVariant && (
                    <button className="w-full py-2 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors">
                      Use Selected Version
                    </button>
                  )}
                  <AIFeedbackButtons
                    clientId={client?.id}
                    agentType={activeAgent ?? 'copywriter'}
                    contentSnapshot={copyVariants.map(v => v.text).join('\n\n')}
                    className="pt-1"
                  />
                </div>
              ) : output ? (
                <div className="space-y-2">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <MarkdownContent content={output} size="xs" />
                  </div>
                  <AIFeedbackButtons
                    clientId={client?.id}
                    agentType={activeAgent ?? 'task_analyzer'}
                    contentSnapshot={output}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Design Brief (read-only summary) */}
          {client?.design_brief_json && (
            <div className="border-b border-slate-100">
              <button
                onClick={() => setBriefExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Design Brief</p>
                </div>
                {briefExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                }
              </button>
              {briefExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Canvas sizes */}
                  {client.design_brief_json.canvas_sizes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Canvas Sizes</p>
                      <div className="space-y-1">
                        {client.design_brief_json.canvas_sizes.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-slate-400">{s.width} × {s.height}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{s.format}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Visual style */}
                  {client.design_brief_json.visual_style_notes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Visual Style</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{client.design_brief_json.visual_style_notes}</p>
                    </div>
                  )}
                  {/* General notes */}
                  {client.design_brief_json.general_notes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{client.design_brief_json.general_notes}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 italic">Edit the full brief in the Clients page.</p>
                </div>
              )}
            </div>
          )}

          {/* Client Brief Request */}
          {client && (
            <div className="border-b border-slate-100">
              <button
                onClick={() => setClientBriefExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Client Brief</p>
                  {clientBriefRequest?.status === 'submitted' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Received
                    </span>
                  )}
                  {clientBriefRequest?.status === 'pending' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  )}
                </div>
                {clientBriefExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                }
              </button>

              {clientBriefExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  <BriefRequestButton taskId={task.id} clientId={client.id} />

                  {clientBriefRequest?.status === 'submitted' && clientBriefRequest.brief_data && (
                    <ClientBriefDisplay brief={clientBriefRequest.brief_data} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Linked Documents */}
          {(() => {
            const linkedIds = task.linked_doc_ids ?? []
            const linkedDocs = allDocs.filter(d => linkedIds.includes(d.id))
            const searchResults = docSearch.trim()
              ? allDocs.filter(d => !linkedIds.includes(d.id) && d.title.toLowerCase().includes(docSearch.toLowerCase())).slice(0, 6)
              : []

            const linkDoc = (docId: string) => {
              updateTask.mutate({ id: task.id, linked_doc_ids: [...linkedIds, docId] })
              setDocSearch('')
              setShowDocSearch(false)
            }

            const unlinkDoc = (docId: string) => {
              updateTask.mutate({ id: task.id, linked_doc_ids: linkedIds.filter(id => id !== docId) })
            }

            return (
              <div className="border-b border-slate-100">
                <button
                  onClick={() => setDocsExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Documents</p>
                    {linkedDocs.length > 0 && (
                      <span className="flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-novax text-white">{linkedDocs.length}</span>
                    )}
                  </div>
                  {docsExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {docsExpanded && (
                  <div className="px-5 pb-4 space-y-2">
                    {linkedDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-novax-light rounded-lg border border-novax-border">
                        <FileText className="w-3.5 h-3.5 text-novax-muted shrink-0" />
                        <p className="text-xs text-slate-700 flex-1 min-w-0 truncate">{doc.title}</p>
                        <button
                          onClick={() => window.open(`/docs/${doc.id}`, '_blank')}
                          className="text-slate-400 hover:text-novax transition-colors shrink-0"
                          title="Open document"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => unlinkDoc(doc.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                          title="Unlink"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {!showDocSearch ? (
                      <button
                        onClick={() => setShowDocSearch(true)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-novax transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Link a document
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <input
                          autoFocus
                          value={docSearch}
                          onChange={e => setDocSearch(e.target.value)}
                          placeholder="Search documents…"
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted bg-white text-slate-700 placeholder:text-slate-400"
                          onBlur={() => { if (!docSearch) setShowDocSearch(false) }}
                        />
                        {searchResults.length > 0 && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            {searchResults.map(doc => (
                              <button
                                key={doc.id}
                                onMouseDown={e => { e.preventDefault(); linkDoc(doc.id) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-novax-light transition-colors border-b border-slate-100 last:border-0"
                              >
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                {doc.title}
                              </button>
                            ))}
                          </div>
                        )}
                        {docSearch && searchResults.length === 0 && (
                          <p className="text-[11px] text-slate-400 px-1">No matching documents</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Comments */}
          <TaskComments
            taskId={task.id}
            taskLinkedDocIds={task.linked_doc_ids ?? []}
            onLinkDoc={(docId) => {
              const current = task.linked_doc_ids ?? []
              if (!current.includes(docId)) {
                updateTask.mutate({ id: task.id, linked_doc_ids: [...current, docId] })
              }
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] text-slate-400 text-center">
            Updated {formatDateTime(task.updated_at)} · Context: {client?.name} brand + {stage.label} stage
          </p>
        </div>
      </div>
    </>
  )
}

// ── Read-only brief display (shown in task panel after submission) ─────────────

function BriefRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
    </div>
  )
}

function BriefChips({ label, values }: { label: string; values?: string[] }) {
  if (!values?.length) return null
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map(v => (
          <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-novax-light border border-novax-border text-novax-muted font-medium">
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  static: 'Static Image',
  carousel: 'Carousel',
  reel: 'Reel',
  story: 'Story',
}

function ClientBriefDisplay({ brief }: { brief: ContentBriefData }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-novax text-white uppercase tracking-wide">
          {CONTENT_TYPE_LABELS[brief.content_type] ?? brief.content_type}
        </span>
        {brief.submitter_name && (
          <span className="text-[10px] text-slate-400">from {brief.submitter_name}</span>
        )}
      </div>

      {/* Static fields */}
      <BriefRow label="Main message"   value={brief.main_message} />
      {/* Carousel fields */}
      <BriefRow label="Topic"          value={brief.carousel_topic} />
      <BriefRow label="Slide count"    value={brief.slide_count ? `${brief.slide_count} slides` : undefined} />
      <BriefRow label="First slide"    value={brief.first_slide_type} />
      <BriefRow label="Last slide CTA" value={brief.last_slide_cta} />
      <BriefRow label="Text density"   value={brief.text_density} />
      {/* Reel fields */}
      <BriefRow label="Core message"   value={brief.key_message} />
      <BriefRow label="Duration"       value={brief.duration} />
      <BriefRow label="Opening style"  value={brief.opening_style} />
      <BriefRow label="On camera"      value={brief.on_camera} />
      <BriefRow label="Music vibe"     value={brief.music_vibe} />
      <BriefRow label="Reel goal"      value={brief.reel_goal} />
      <BriefRow label="Specific scenes" value={brief.specific_scenes} />
      {/* Story fields */}
      <BriefRow label="Story message"  value={brief.story_message} />
      <BriefRow label="Story purpose"  value={brief.story_purpose} />
      <BriefChips label="Interactive elements" values={brief.interactive_elements} />
      {/* Shared */}
      <BriefRow label="Mood / feeling" value={brief.visual_feeling} />
      <BriefRow label="Subject focus"  value={brief.subject_focus} />
      <BriefRow label="Text on image"  value={brief.text_on_image} />
      <BriefChips label="Reference links" values={brief.reference_links} />
      {/* Timeline */}
      <BriefRow label="Needed by"      value={brief.needed_by} />
      <BriefRow label="Urgency"        value={brief.urgency} />
      {/* Notes */}
      {brief.additional_notes && (
        <div className="pt-2 border-t border-slate-200">
          <BriefRow label="Additional notes" value={brief.additional_notes} />
        </div>
      )}
    </div>
  )
}
