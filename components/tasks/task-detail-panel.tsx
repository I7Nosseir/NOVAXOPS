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
  { type: 'task_analyzer',        label: 'Analyze',    icon: Sparkles,   description: 'Break down brief & flag gaps' },
  { type: 'copywriter',           label: 'Write Copy', icon: FileSearch, description: 'Brand-aware copy variants' },
  { type: 'researcher',           label: 'Research',   icon: Search,     description: 'Market context & trends' },
  { type: 'asset_finder',         label: 'Assets',     icon: BookOpen,   description: 'Find assets from Drive' },
  { type: 'presentation_builder', label: 'Build Deck', icon: Zap,        description: 'Generate a .pptx' },
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
  const [activeAgent, setActiveAgent]           = useState<AgentType | null>(null)
  const [generating, setGenerating]             = useState(false)
  const [output, setOutput]                     = useState<string | null>(null)
  const [agentError, setAgentError]             = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant]   = useState<string | null>(null)
  const [showVariants, setShowVariants]         = useState(false)
  const [copyVariants, setCopyVariants]         = useState<CopyVariant[]>(DEFAULT_COPY_VARIANTS)

  const [editingField, setEditingField]         = useState<string | null>(null)
  const [draftTitle, setDraftTitle]             = useState('')
  const [draftDesc, setDraftDesc]               = useState('')
  const [draftFinalSubmission, setDraftFinalSubmission] = useState('')
  const [draftStage, setDraftStage]             = useState<PipelineStage>('strategy')
  const [draftPriority, setDraftPriority]       = useState<Priority>('medium')
  const [draftAssignee, setDraftAssignee]       = useState('')
  const [draftDueDate, setDraftDueDate]         = useState('')
  const [draftTagInput, setDraftTagInput]       = useState('')

  const [showMenu, setShowMenu]                 = useState(false)
  const [deleteConfirm, setDeleteConfirm]       = useState(false)
  const menuRef                                 = useRef<HTMLDivElement>(null)

  const [saveDocState, setSaveDocState]         = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [briefExpanded, setBriefExpanded]       = useState(false)
  const [clientBriefExpanded, setClientBriefExpanded] = useState(false)
  const [docsExpanded, setDocsExpanded]         = useState(false)
  const [docSearch, setDocSearch]               = useState('')
  const [showDocSearch, setShowDocSearch]       = useState(false)

  const { clients }      = useClients()
  const { projects }     = useProjects()
  const { users }        = useUsers()
  const { user: authUser } = useAuth()
  const updateTask       = useUpdateTask()
  const deleteTask       = useDeleteTask()
  const queryClient      = useQueryClient()

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

  useEffect(() => { setSaveDocState('idle') }, [activeAgent])

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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false); setDeleteConfirm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

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

  useEffect(() => {
    if (task && authUser && authUser.id === task.assigned_to && !task.seen_at) {
      acknowledge('seen')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  if (!task) return null

  const stage     = STAGE_CONFIG[task.pipeline_stage]
  const priority  = PRIORITY_CONFIG[task.priority]
  const client    = clients.find(c => c.id === task.client_id)
  const project   = projects.find(p => p.id === task.project_id)
  const user      = users.find(u => u.id === task.assigned_to)
  const statusCfg = STATUS_CONFIG[task.status]
  const stageIdx  = PIPELINE_STAGES.indexOf(task.pipeline_stage)

  const save = (field: string, value: unknown) => {
    updateTask.mutate({ id: task.id, [field]: value })
    setEditingField(null)
  }

  const markRead = () => acknowledge('read')

  const handleDelete = () => {
    deleteTask.mutate(task.id, { onSuccess: onClose })
  }

  const isAssignee = !!authUser && authUser.id === task.assigned_to
  const seenUser   = users.find(u => u.id === task.seen_by)
  const readUser   = users.find(u => u.id === task.read_by)

  const handleSaveToDoc = async (content: string) => {
    if (saveDocState !== 'idle') return
    setSaveDocState('loading')
    const agentLabel = AGENTS.find(a => a.type === activeAgent)?.label ?? 'AI Output'
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${agentLabel} — ${task?.title ?? 'Task'}`,
          client_id: task?.client_id ?? null,
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] },
          doc_type: 'studio_output',
          created_by: authUser?.id,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveDocState('done')
      toast.success('Saved to Documents')
    } catch {
      setSaveDocState('error')
      toast.error('Save failed')
    }
  }

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

  // Linked documents helpers
  const linkedIds  = task.linked_doc_ids ?? []
  const linkedDocs = allDocs.filter(d => linkedIds.includes(d.id))
  const docSearchResults = docSearch.trim()
    ? allDocs.filter(d => !linkedIds.includes(d.id) && d.title.toLowerCase().includes(docSearch.toLowerCase())).slice(0, 6)
    : []

  const linkDoc = (docId: string) => {
    updateTask.mutate({ id: task.id, linked_doc_ids: [...linkedIds, docId] })
    setDocSearch(''); setShowDocSearch(false)
  }
  const unlinkDoc = (docId: string) => {
    updateTask.mutate({ id: task.id, linked_doc_ids: linkedIds.filter(id => id !== docId) })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Full-screen modal */}
      <div
        className="fixed inset-0 sm:inset-3 md:inset-5 lg:inset-8 bg-white z-50 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* ── TOP HEADER ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 shrink-0 bg-white">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0 flex-1">
            {client?.color && (
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: client.color }} />
            )}
            <span className="font-semibold text-slate-600 truncate">{client?.name ?? 'No Client'}</span>
            {project && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="text-slate-400 truncate">{project.name}</span>
              </>
            )}
          </div>

          {/* Pipeline stage progress strip */}
          <div className="hidden xl:flex items-center gap-0.5 w-60 shrink-0">
            {PIPELINE_STAGES.map((s, idx) => {
              const isActive = s === task.pipeline_stage
              const isPast   = idx < stageIdx
              const cfg      = STAGE_CONFIG[s]
              return (
                <div
                  key={s}
                  title={cfg.label}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    isActive ? cfg.bg : isPast ? 'bg-novax-border' : 'bg-slate-100',
                  )}
                />
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`/studio/content?brief=${encodeURIComponent(task.description ?? task.title)}&client=${task.client_id ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-novax-muted bg-novax-light border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Studio
            </a>

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

            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Close (Esc)">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── TWO-COLUMN BODY ────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* LEFT: Main content */}
          <div className="flex-1 min-w-0 overflow-y-auto">

            {/* Task identity section */}
            <div className="px-6 pt-6 pb-5 space-y-4">

              {/* Badges + Status */}
              <div className="flex items-center gap-2 flex-wrap">

                {/* Stage */}
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
                    className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border', stage.bg, stage.color, stage.border, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                  >
                    {stage.label}
                  </span>
                )}

                {/* Priority */}
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
                    className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full', priority.bg, priority.color, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                  >
                    {priority.label}
                  </span>
                )}

                {/* Sub-type */}
                {(() => {
                  const subtypes = getSubtypesForStage(task.pipeline_stage)
                  if (subtypes.length === 0) return null
                  const currentStyle = task.sub_type ? getSubtypeStyle(task.sub_type) : null
                  if (canManage && editingField === 'sub_type') {
                    return (
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => save('sub_type', null)} className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400 hover:border-slate-300">None</button>
                        {subtypes.map(st => (
                          <button
                            key={st.label}
                            onClick={() => save('sub_type', st.label)}
                            className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all', task.sub_type === st.label ? `${st.bg} ${st.color} border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300')}
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
                        className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full', currentStyle.bg, currentStyle.color, canManage && 'cursor-pointer hover:opacity-80 transition-all')}
                      >
                        {task.sub_type}
                      </span>
                    )
                  }
                  if (!canManage) return null
                  return (
                    <button onClick={() => setEditingField('sub_type')} className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-novax-border transition-colors">
                      + Type
                    </button>
                  )
                })()}

                {/* Status toggles */}
                <div className="ml-auto flex items-center gap-1">
                  {(['active', 'blocked', 'completed'] as TaskStatus[]).map(s => {
                    const sc  = STATUS_CONFIG[s]
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
                          'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all',
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

              {/* Title */}
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
                  className="w-full text-2xl font-bold text-slate-900 border-b-2 border-novax outline-none bg-transparent leading-tight pb-1"
                />
              ) : (
                <h1
                  onClick={canManage ? () => { setDraftTitle(task.title); setEditingField('title') } : undefined}
                  className={cn('text-2xl font-bold text-slate-900 leading-tight', canManage && 'cursor-text hover:text-novax transition-colors')}
                  title={canManage ? 'Click to edit' : undefined}
                >
                  {task.title}
                </h1>
              )}

              {/* Description */}
              {editingField === 'description' ? (
                <textarea
                  value={draftDesc}
                  autoFocus
                  rows={4}
                  onChange={e => setDraftDesc(e.target.value)}
                  onBlur={() => { save('description', draftDesc) }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setDraftDesc(task.description ?? ''); setEditingField(null) }
                  }}
                  className="w-full text-sm text-slate-600 border border-novax-border rounded-xl p-3 outline-none focus:border-novax-muted resize-none leading-relaxed"
                />
              ) : (
                <p
                  onClick={() => { setDraftDesc(task.description ?? ''); setEditingField('description') }}
                  className={cn(
                    'text-sm leading-relaxed cursor-text transition-colors min-h-[20px]',
                    task.description ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 italic',
                  )}
                  title="Click to edit"
                >
                  {task.description || 'Add a description…'}
                </p>
              )}

              {/* Final deliverable */}
              <div className="rounded-xl border border-novax-border bg-novax-light p-4 space-y-2">
                <p className="text-[10px] font-bold text-novax uppercase tracking-wider">Final Deliverable</p>
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
                    className="w-full text-sm text-slate-700 border border-novax-border rounded-lg p-2.5 outline-none focus:border-novax-muted resize-none leading-relaxed bg-white"
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
            </div>

            {/* ── AI WORKSPACE ───────────────────────────────────────── */}
            <div className="border-t border-slate-100 px-6 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-novax-muted" />
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">AI Workspace</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {AGENTS.map(({ type, label, icon: Icon, description }) => (
                  <button
                    key={type}
                    onClick={() => handleRunAgent(type)}
                    disabled={generating}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all',
                      activeAgent === type
                        ? 'border-novax-border-active bg-novax-light'
                        : 'border-slate-200 hover:border-novax-border hover:bg-slate-50',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    <div className={cn('p-1.5 rounded-lg', activeAgent === type ? 'bg-novax-light-hover' : 'bg-slate-100')}>
                      {generating && activeAgent === type
                        ? <Loader2 className="w-3.5 h-3.5 text-novax-muted animate-spin" />
                        : <Icon className={cn('w-3.5 h-3.5', activeAgent === type ? 'text-novax' : 'text-slate-500')} />
                      }
                    </div>
                    <p className={cn('text-[10px] font-semibold leading-tight', activeAgent === type ? 'text-novax' : 'text-slate-700')}>{label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── AI OUTPUT ──────────────────────────────────────────── */}
            {(generating || output || showVariants || agentError) && (
              <div className="border-t border-slate-100 px-6 py-5 space-y-3">
                <div className="flex items-center justify-between">
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
                          'rounded-xl border p-4 cursor-pointer transition-all',
                          selectedVariant === variant.id ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-novax-border bg-slate-50 hover:bg-white',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider', selectedVariant === variant.id ? 'text-novax' : 'text-slate-600')}>{variant.label}</span>
                            {variant.framework && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wide">{variant.framework}</span>
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
                      <button
                        onClick={() => {
                          const variant = copyVariants.find(v => v.id === selectedVariant)
                          if (variant) handleSaveToDoc(variant.text)
                        }}
                        disabled={saveDocState !== 'idle'}
                        className="w-full py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        {saveDocState === 'loading' ? 'Saving…' : saveDocState === 'done' ? 'Saved to Documents' : 'Save Selected to Document'}
                      </button>
                    )}
                    <AIFeedbackButtons clientId={client?.id} agentType={activeAgent ?? 'copywriter'} contentSnapshot={copyVariants.map(v => v.text).join('\n\n')} className="pt-1" />
                  </div>
                ) : output ? (
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <MarkdownContent content={output} size="xs" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <AIFeedbackButtons clientId={client?.id} agentType={activeAgent ?? 'task_analyzer'} contentSnapshot={output} />
                      <button
                        onClick={() => handleSaveToDoc(output)}
                        disabled={saveDocState !== 'idle'}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all shrink-0',
                          saveDocState === 'done'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          saveDocState === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-white text-slate-600 border-slate-200 hover:bg-novax-light hover:text-novax hover:border-novax-border disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        {saveDocState === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveDocState === 'done' ? <CheckCircle className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {saveDocState === 'done' ? 'Saved' : saveDocState === 'error' ? 'Retry' : 'Save to Doc'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── DESIGN BRIEF ───────────────────────────────────────── */}
            {client?.design_brief_json && (
              <div className="border-t border-slate-100">
                <button
                  onClick={() => setBriefExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Design Brief</p>
                  </div>
                  {briefExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {briefExpanded && (
                  <div className="px-6 pb-5 space-y-4">
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
                    {client.design_brief_json.visual_style_notes && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Visual Style</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{client.design_brief_json.visual_style_notes}</p>
                      </div>
                    )}
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

            {/* ── CLIENT BRIEF ───────────────────────────────────────── */}
            {client && (
              <div className="border-t border-slate-100">
                <button
                  onClick={() => setClientBriefExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Client Brief</p>
                    {clientBriefRequest?.status === 'submitted' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Received</span>
                    )}
                    {clientBriefRequest?.status === 'pending' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                    )}
                  </div>
                  {clientBriefExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {clientBriefExpanded && (
                  <div className="px-6 pb-5 space-y-4">
                    <BriefRequestButton taskId={task.id} clientId={client.id} />
                    {clientBriefRequest?.status === 'submitted' && clientBriefRequest.brief_data && (
                      <ClientBriefDisplay brief={clientBriefRequest.brief_data} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── LINKED DOCUMENTS ───────────────────────────────────── */}
            <div className="border-t border-slate-100">
              <button
                onClick={() => setDocsExpanded(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Documents</p>
                  {linkedDocs.length > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-novax text-white">{linkedDocs.length}</span>
                  )}
                </div>
                {docsExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {docsExpanded && (
                <div className="px-6 pb-5 space-y-2">
                  {linkedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-novax-light rounded-lg border border-novax-border">
                      <FileText className="w-3.5 h-3.5 text-novax-muted shrink-0" />
                      <p className="text-xs text-slate-700 flex-1 min-w-0 truncate">{doc.title}</p>
                      <button onClick={() => window.open(`/docs/${doc.id}`, '_blank')} className="text-slate-400 hover:text-novax transition-colors shrink-0" title="Open document">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button onClick={() => unlinkDoc(doc.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0" title="Unlink">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {!showDocSearch ? (
                    <button onClick={() => setShowDocSearch(true)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-novax transition-colors">
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
                      {docSearchResults.length > 0 && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          {docSearchResults.map(doc => (
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
                      {docSearch && docSearchResults.length === 0 && (
                        <p className="text-[11px] text-slate-400 px-1">No matching documents</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── COMMENTS ───────────────────────────────────────────── */}
            <div className="border-t border-slate-100">
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
          </div>

          {/* RIGHT: Metadata sidebar */}
          <div className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 bg-slate-50/40 overflow-y-auto">
            <div className="p-5 space-y-5">

              {/* Client */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Client</p>
                <div className="flex items-center gap-2">
                  {client?.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: client.color }} />}
                  <p className="text-sm font-medium text-slate-700">{client?.name ?? '—'}</p>
                </div>
              </div>

              {/* Project */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Project</p>
                <p className="text-sm font-medium text-slate-700">{project?.name ?? '—'}</p>
              </div>

              {/* Assignee */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Assigned To</p>
                {canManage && editingField === 'assigned_to' ? (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-novax-border bg-slate-50">
                    {users.map(u => (
                      <button
                        key={u.id}
                        title={u.name}
                        onClick={() => { setDraftAssignee(u.id); save('assigned_to', u.id) }}
                        className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold transition-all', draftAssignee === u.id ? 'ring-2 ring-novax ring-offset-1' : 'opacity-50 hover:opacity-100')}
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
                    className={cn('flex items-center gap-2', canManage && 'cursor-pointer hover:text-novax transition-colors')}
                  >
                    {user ? (
                      <>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: user.color }}>
                          {user.initials}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{user.name}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 italic">{canManage ? 'Click to assign' : 'Unassigned'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Due Date</p>
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
                    className="text-sm border border-novax-border rounded-lg px-2 py-1 outline-none focus:border-novax-muted w-full"
                  />
                ) : (
                  <p
                    onClick={canManage ? () => { setDraftDueDate(task.due_date ?? ''); setEditingField('due_date') } : undefined}
                    className={cn('text-sm font-medium', canManage && 'cursor-pointer hover:text-novax transition-colors', task.due_date ? 'text-slate-700' : 'text-slate-400 italic')}
                    title={canManage ? 'Click to edit' : undefined}
                  >
                    {task.due_date ? formatDate(task.due_date) : canManage ? 'Set due date' : '—'}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {task.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                      #{tag}
                      <button onClick={() => updateTask.mutate({ id: task.id, tags: task.tags.filter(t => t !== tag) })} className="text-slate-400 hover:text-slate-700 leading-none">×</button>
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
                          if (tag && !task.tags.includes(tag)) updateTask.mutate({ id: task.id, tags: [...task.tags, tag] })
                          setDraftTagInput(''); setEditingField(null)
                        }
                        if (e.key === 'Escape') { setDraftTagInput(''); setEditingField(null) }
                      }}
                      onBlur={() => { setDraftTagInput(''); setEditingField(null) }}
                      className="text-xs border border-novax-border rounded-md px-2 py-0.5 outline-none focus:border-novax-muted w-24"
                    />
                  ) : (
                    <button onClick={() => setEditingField('tags')} className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-novax-border hover:text-novax transition-colors">
                      + tag
                    </button>
                  )}
                </div>
              </div>

              {/* Acknowledgment */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Acknowledgment</p>
                {isAssignee ? (
                  <div className="space-y-2">
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-novax-light border border-novax-border text-xs font-semibold text-novax hover:bg-novax-light-hover transition-colors disabled:opacity-50 w-full justify-center"
                      >
                        <ReadIcon className="w-3 h-3" />
                        Mark as Read
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium mb-1">Seen</p>
                      {task.seen_at && seenUser ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: seenUser.color }}>{seenUser.initials}</div>
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
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: readUser.color }}>{readUser.initials}</div>
                          <span className="text-xs text-emerald-600 font-medium">{timeAgo(task.read_at)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not yet</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[10px] text-slate-400">Updated {formatDateTime(task.updated_at)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{client?.name ?? ''} · {stage.label} stage</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

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
          <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-novax-light border border-novax-border text-novax-muted font-medium">{v}</span>
        ))}
      </div>
    </div>
  )
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  static: 'Static Image', carousel: 'Carousel', reel: 'Reel', story: 'Story',
}

function ClientBriefDisplay({ brief }: { brief: ContentBriefData }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-novax text-white uppercase tracking-wide">
          {CONTENT_TYPE_LABELS[brief.content_type] ?? brief.content_type}
        </span>
        {brief.submitter_name && <span className="text-[10px] text-slate-400">from {brief.submitter_name}</span>}
      </div>
      <BriefRow label="Main message"    value={brief.main_message} />
      <BriefRow label="Topic"           value={brief.carousel_topic} />
      <BriefRow label="Slide count"     value={brief.slide_count ? `${brief.slide_count} slides` : undefined} />
      <BriefRow label="First slide"     value={brief.first_slide_type} />
      <BriefRow label="Last slide CTA"  value={brief.last_slide_cta} />
      <BriefRow label="Text density"    value={brief.text_density} />
      <BriefRow label="Core message"    value={brief.key_message} />
      <BriefRow label="Duration"        value={brief.duration} />
      <BriefRow label="Opening style"   value={brief.opening_style} />
      <BriefRow label="On camera"       value={brief.on_camera} />
      <BriefRow label="Music vibe"      value={brief.music_vibe} />
      <BriefRow label="Reel goal"       value={brief.reel_goal} />
      <BriefRow label="Specific scenes" value={brief.specific_scenes} />
      <BriefRow label="Story message"   value={brief.story_message} />
      <BriefRow label="Story purpose"   value={brief.story_purpose} />
      <BriefChips label="Interactive elements" values={brief.interactive_elements} />
      <BriefRow label="Mood / feeling"  value={brief.visual_feeling} />
      <BriefRow label="Subject focus"   value={brief.subject_focus} />
      <BriefRow label="Text on image"   value={brief.text_on_image} />
      <BriefChips label="Reference links" values={brief.reference_links} />
      <BriefRow label="Needed by"       value={brief.needed_by} />
      <BriefRow label="Urgency"         value={brief.urgency} />
      {brief.additional_notes && (
        <div className="pt-2 border-t border-slate-200">
          <BriefRow label="Additional notes" value={brief.additional_notes} />
        </div>
      )}
    </div>
  )
}
