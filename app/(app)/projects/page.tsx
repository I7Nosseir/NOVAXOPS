'use client'

import { useProjects } from '@/lib/hooks/use-projects'
import { useClients } from '@/lib/hooks/use-clients'
import { useTasks } from '@/lib/hooks/use-tasks'
import { STAGE_CONFIG, formatDate, cn } from '@/lib/utils'
import { Calendar, CheckCircle, Clock, Target } from 'lucide-react'

export default function ProjectsPage() {
  const { projects } = useProjects()
  const { clients } = useClients()
  const { tasks } = useTasks()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{projects.length} active projects</p>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
          + New Project
        </button>
      </div>

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
              <div className="mb-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Task Distribution</p>
                <div className="flex flex-wrap gap-1.5">
                  {stageBreakdown.map(([stage, count]) => {
                    const cfg = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]
                    return (
                      <span key={stage} className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
                        {cfg.label} · {count as number}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Quarter strategy */}
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Quarter Goals</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.quarter_strategy.goals.map((goal, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">{goal}</span>
                  ))}
                </div>
              </div>

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
