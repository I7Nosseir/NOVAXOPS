'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, FileText, Paperclip, Sheet } from 'lucide-react'
import { cn, STAGE_CONFIG, PIPELINE_STAGES } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useProjects } from '@/lib/hooks/use-projects'
import { useUsers } from '@/lib/hooks/use-users'
import { useCreateTask } from '@/lib/hooks/use-tasks'
import { supabase } from '@/lib/supabase'
import type { PipelineStage, Priority } from '@/lib/types'

interface DocOption {
  id: string
  title: string
  is_template: boolean
  doc_type: string
}

interface Props {
  open: boolean
  defaultStage?: PipelineStage
  onClose: () => void
}

export function CreateTaskDialog({ open, defaultStage, onClose }: Props) {
  const { clients } = useClients()
  const { projects } = useProjects()
  const { users } = useUsers()
  const createTask = useCreateTask()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [finalSubmission, setFinalSubmission] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [stage, setStage] = useState<PipelineStage>(defaultStage ?? 'strategy')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagFocused, setTagFocused] = useState(false)
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([])
  const [docSearch, setDocSearch] = useState('')
  const [showDocPicker, setShowDocPicker] = useState(false)

  const { data: tagRows = [] } = useQuery<{ tags: string[] | null }[]>({
    queryKey: ['task-tags'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('tags').not('tags', 'is', null)
      return (data ?? []) as { tags: string[] | null }[]
    },
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const existingTags = useMemo(() => {
    const flat = tagRows.flatMap(r => r.tags ?? [])
    return [...new Set(flat)].sort()
  }, [tagRows])

  const tagSuggestions = existingTags.filter(
    t => !tags.includes(t) && (tagInput === '' || t.toLowerCase().includes(tagInput.toLowerCase()))
  )

  const { data: allDocs = [] } = useQuery<DocOption[]>({
    queryKey: ['docs'],
    queryFn: () => fetch('/api/docs').then(r => r.json()),
    staleTime: 60_000,
    enabled: open,
  })

  const nonTemplateDocs = allDocs.filter(d => !d.is_template)
  const availableDocs = nonTemplateDocs.filter(d => !linkedDocIds.includes(d.id))
  const searchResults = docSearch.trim()
    ? availableDocs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase())).slice(0, 6)
    : availableDocs.slice(0, 5)
  const linkedDocs = allDocs.filter(d => linkedDocIds.includes(d.id))

  const filteredProjects = projects.filter(p => !clientId || p.client_id === clientId)

  const reset = () => {
    setTitle(''); setDescription(''); setFinalSubmission(''); setClientId(''); setProjectId('')
    setAssignedTo(''); setStage(defaultStage ?? 'strategy'); setPriority('medium')
    setDueDate(''); setTagInput(''); setTags([])
    setLinkedDocIds([]); setDocSearch(''); setShowDocPicker(false)
    createTask.reset()
  }

  const handleClose = () => { reset(); onClose() }

  const addTag = (value: string) => {
    const tag = value.trim().replace(/^#/, '')
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
  }

  const attachDoc = (docId: string) => {
    setLinkedDocIds(prev => [...prev, docId])
    setDocSearch('')
    setShowDocPicker(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !clientId) return
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description,
        final_submission: finalSubmission.trim() || null,
        client_id: clientId,
        project_id: projectId || null,
        assigned_to: assignedTo || null,
        pipeline_stage: stage,
        priority,
        status: 'active',
        due_date: dueDate || null,
        tags,
        linked_doc_ids: linkedDocIds.length > 0 ? linkedDocIds : undefined,
      })
      handleClose()
    } catch {
      // Error is displayed inline via createTask.isError
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">New Task</h2>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task title…"
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none"
              />
            </div>

            {/* Final submission */}
            <div className="rounded-xl border border-novax-border bg-novax-light p-3 space-y-1.5">
              <label className="text-[11px] font-bold text-novax uppercase tracking-wider block">
                Final submission should be
              </label>
              <textarea
                value={finalSubmission}
                onChange={e => setFinalSubmission(e.target.value)}
                placeholder="e.g. 3 caption variants in a Google Doc, shared with the account manager for review…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-novax-border text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none bg-white"
              />
            </div>

            {/* Error banner */}
            {createTask.isError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                {createTask.error instanceof Error ? createTask.error.message : 'Failed to create task. Please try again.'}
              </div>
            )}

            {/* Client + Project */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Client *</label>
                <select
                  value={clientId}
                  onChange={e => { setClientId(e.target.value); setProjectId('') }}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:border-novax-muted bg-white"
                >
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Project</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  disabled={!clientId}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:border-novax-muted bg-white disabled:opacity-50"
                >
                  <option value="">No project</option>
                  {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Stage</label>
              <select
                value={stage}
                onChange={e => setStage(e.target.value as PipelineStage)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:border-novax-muted bg-white"
              >
                {PIPELINE_STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Priority</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all',
                      priority === p
                        ? 'bg-novax text-white border-novax'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee + Due date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Assignee</label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 min-h-[40px] items-center">
                  {users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      title={u.name}
                      onClick={() => setAssignedTo(assignedTo === u.id ? '' : u.id)}
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold transition-all',
                        assignedTo === u.id ? 'ring-2 ring-novax ring-offset-1' : 'opacity-50 hover:opacity-100',
                      )}
                      style={{ background: u.color }}
                    >
                      {u.initials}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:border-novax-muted"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5 items-center p-2 rounded-lg border border-slate-200 min-h-[40px]">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                      className="text-slate-400 hover:text-slate-700 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onFocus={() => setTagFocused(true)}
                  onBlur={() => setTimeout(() => setTagFocused(false), 150)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
                    if (e.key === ',') { e.preventDefault(); addTag(tagInput) }
                  }}
                  placeholder={tags.length === 0 ? 'Type or pick from existing…' : ''}
                  className="flex-1 min-w-[80px] text-xs text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
              {tagFocused && tagSuggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tagSuggestions.slice(0, 15).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-novax-light hover:text-novax border border-transparent hover:border-novax-border text-slate-500 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Documents
              </label>
              <div className="space-y-1.5">
                {linkedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 p-2 bg-novax-light rounded-lg border border-novax-border">
                    {doc.doc_type === 'sheet'
                      ? <Sheet className="w-3 h-3 text-novax-muted shrink-0" />
                      : <FileText className="w-3 h-3 text-novax-muted shrink-0" />}
                    <span className="text-xs text-slate-700 flex-1 truncate">{doc.title}</span>
                    <button
                      type="button"
                      onClick={() => setLinkedDocIds(prev => prev.filter(id => id !== doc.id))}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {!showDocPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowDocPicker(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-novax transition-colors px-1 py-0.5"
                  >
                    <Paperclip className="w-3 h-3" />
                    Attach a document
                  </button>
                ) : (
                  <div className="space-y-1">
                    <input
                      autoFocus
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      onBlur={() => { if (!docSearch) setShowDocPicker(false) }}
                      placeholder="Search documents…"
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-novax-muted text-slate-700 placeholder:text-slate-400"
                    />
                    {searchResults.length > 0 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        {searchResults.map(doc => (
                          <button
                            key={doc.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); attachDoc(doc.id) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-novax-light transition-colors border-b border-slate-100 last:border-0"
                          >
                            {doc.doc_type === 'sheet'
                              ? <Sheet className="w-3 h-3 text-slate-400 shrink-0" />
                              : <FileText className="w-3 h-3 text-slate-400 shrink-0" />}
                            {doc.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {docSearch.trim() && searchResults.length === 0 && (
                      <p className="text-[11px] text-slate-400 px-1">No matching documents</p>
                    )}
                    {!docSearch.trim() && availableDocs.length === 0 && (
                      <p className="text-[11px] text-slate-400 px-1">No documents available</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTask.isPending || !title.trim() || !clientId}
                className="px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTask.isPending ? 'Creating…' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
