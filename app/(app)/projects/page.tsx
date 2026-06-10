'use client'

import { useState } from 'react'
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects'
import { useClients } from '@/lib/hooks/use-clients'
import { useTasks } from '@/lib/hooks/use-tasks'
import { STAGE_CONFIG, formatDate, cn } from '@/lib/utils'
import { Calendar, CheckCircle, Clock, Target, X, Loader2, Plus } from 'lucide-react'

// ─── Create project dialog ─────────────────────────────────────────────────────

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const createProject = useCreateProject()
  const today = new Date().toISOString().split('T')[0]
  const threeMonths = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]

  const [form, setForm] = useState({
    name: '',
    client_id: '',
    start_date: today,
    end_date: threeMonths,
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.client_id) {
      setError('Project name and client are required.')
      return
    }
    setError(null)
    try {
      await createProject.mutateAsync(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Q3 Brand Campaign"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
            <select
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
            >
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={createProject.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {createProject.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Creating…</>
                : <><Plus className="w-3.5 h-3.5"/>Create Project</>}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Projects page ─────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { projects } = useProjects()
  const { clients } = useClients()
  const { tasks } = useTasks()
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      {creating && <CreateProjectDialog onClose={() => setCreating(false)}/>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{projects.length} active project{projects.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5"/>
          New Project
        </button>
      </div>

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Target className="w-8 h-8 mb-2"/>
          <p className="text-sm font-medium text-slate-600">No projects yet</p>
          <p className="text-xs mt-1">Create a project to group tasks and track campaign progress.</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5"/>New Project
          </button>
        </div>
      )}

      <div className="space-y-4">
        {projects.map(project => {
          const client = clients.find(c => c.id === project.client_id)
          const projectTasks = tasks.filter(t => t.project_id === project.id)
          const completed = projectTasks.filter(t => t.status === 'completed').length
          const progress = Math.round((completed / Math.max(projectTasks.length, 1)) * 100)

          const stageBreakdown = Object.entries(
            projectTasks.reduce((acc, t) => {
              acc[t.pipeline_stage] = (acc[t.pipeline_stage] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          )

          const daysLeft = Math.ceil((new Date(project.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

          return (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: client?.color }}>
                    {client?.initials}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{project.name}</h3>
                    <p className="text-xs text-slate-500">{client?.name} · {client?.brand_identity.industry}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  project.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                  project.status === 'paused' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-100 text-slate-500')}>
                  {project.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { icon: CheckCircle, label: 'Tasks', value: projectTasks.length },
                  { icon: Clock, label: 'In Progress', value: projectTasks.filter(t => t.status === 'active').length },
                  { icon: Calendar, label: 'Days Left', value: daysLeft > 0 ? daysLeft : 0 },
                  { icon: Target, label: 'Progress', value: `${progress}%` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
                    <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1"/>
                    <p className="text-lg font-bold text-slate-900">{value}</p>
                    <p className="text-[10px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Overall progress</span>
                  <span>{completed} / {projectTasks.length} tasks</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: client?.color }}
                  />
                </div>
              </div>

              {/* Stage breakdown */}
              {stageBreakdown.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Task Distribution</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stageBreakdown.map(([stage, count]) => {
                      const cfg = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]
                      return cfg ? (
                        <span key={stage} className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
                          {cfg.label} · {count as number}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {/* Quarter strategy */}
              {project.quarter_strategy.goals.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Quarter Goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.quarter_strategy.goals.map((goal, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">{goal}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
                <span>{formatDate(project.start_date)} → {formatDate(project.end_date)}</span>
                <a href="/pipeline" className="text-novax hover:text-novax-hover font-medium">View tasks →</a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
