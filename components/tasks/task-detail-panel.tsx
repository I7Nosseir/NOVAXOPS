'use client'

import { useState } from 'react'
import { X, Sparkles, FileSearch, Search, BookOpen, Loader2, CheckCircle, Clock, Zap, Copy } from 'lucide-react'
import type { Task, AgentType } from '@/lib/types'
import { STAGE_CONFIG, PRIORITY_CONFIG, formatDate, formatDateTime, cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import { useProjects } from '@/lib/hooks/use-projects'
import { useUsers } from '@/lib/hooks/use-users'

interface CopyVariant {
  id: string
  label: string
  tone: string
  framework?: string
  hook?: string
  text: string
}

const DEFAULT_COPY_VARIANTS: CopyVariant[] = [
  { id: 'v1', label: 'AIDA — Aspirational', tone: 'Elegant & story-driven', framework: 'AIDA' },
  { id: 'v2', label: 'PAS — Problem-led',   tone: 'Urgent & empathetic',    framework: 'PAS' },
  { id: 'v3', label: 'Social Currency',     tone: 'Peer-to-peer',           framework: 'STEPPS' },
].map(v => ({ ...v, text: '' }))

const AGENTS: { type: AgentType; label: string; icon: typeof Sparkles; description: string }[] = [
  { type: 'task_analyzer',      label: 'Analyze Task',     icon: Sparkles,   description: 'Breaks down brief and flags missing info' },
  { type: 'copywriter',         label: 'Write Copy',       icon: FileSearch, description: 'Generates brand-aware copy for this stage' },
  { type: 'researcher',         label: 'Research',         icon: Search,     description: 'Market context, trends, competitors' },
  { type: 'asset_finder',       label: 'Find Assets',      icon: BookOpen,   description: 'Searches Freepik for relevant assets' },
  { type: 'presentation_builder', label: 'Build Deck',     icon: Zap,        description: 'Generates a .pptx from task outputs' },
]

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskDetailPanel({ task, onClose }: Props) {
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null)
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [showVariants, setShowVariants] = useState(false)
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>(DEFAULT_COPY_VARIANTS)

  const handleRunAgent = async (agentType: AgentType) => {
    setActiveAgent(agentType)
    setOutput(null)
    setError(null)
    setShowVariants(false)
    setSelectedVariant(null)
    setGenerating(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentType,
          task: task ? { id: task.id, title: task.title, description: task.description, pipeline_stage: task.pipeline_stage } : undefined,
          client: client ? { id: client.id, name: client.name, brand_identity: client.brand_identity, competitor_context: client.competitor_context } : undefined,
          project: project ? { name: project.name } : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Generation failed. Please try again.')
        return
      }

      if (agentType === 'copywriter') {
        try {
          const parsed: CopyVariant[] = JSON.parse(data.text)
          setCopyVariants(parsed)
          setShowVariants(true)
        } catch {
          setOutput(data.text)
        }
      } else {
        setOutput(data.text)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  const { clients } = useClients()
  const { projects } = useProjects()
  const { users } = useUsers()

  if (!task) return null

  const stage = STAGE_CONFIG[task.pipeline_stage]
  const priority = PRIORITY_CONFIG[task.priority]
  const client = clients.find(c => c.id === task.client_id)
  const project = projects.find(p => p.id === task.project_id)
  const user = users.find(u => u.id === task.assigned_to)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose}/>

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', stage.bg, stage.color, 'border', stage.border)}>
                {stage.label}
              </span>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', priority.bg, priority.color)}>
                {priority.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
            <X className="w-4 h-4 text-slate-500"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Meta */}
          <div className="p-5 space-y-4 border-b border-slate-100">
            <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Client', value: client?.name, color: client?.color },
                { label: 'Project', value: project?.name },
                { label: 'Assigned to', value: user?.name, initials: user?.initials, userColor: user?.color },
                { label: 'Due date', value: formatDate(task.due_date) },
              ].map(({ label, value, color, initials, userColor }) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">{label}</p>
                  <div className="flex items-center gap-1.5">
                    {color && <div className="w-2 h-2 rounded-full" style={{ background: color }}/>}
                    {initials && <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: userColor }}>{initials}</div>}
                    <p className="text-sm font-medium text-slate-700">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map(tag => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* AI Agents */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-novax-muted"/>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">AI Agents</p>
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
                    <Icon className={cn('w-3.5 h-3.5', activeAgent === type ? 'text-novax' : 'text-slate-500')}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', activeAgent === type ? 'text-novax' : 'text-slate-700')}>{label}</p>
                    <p className="text-[10px] text-slate-400">{description}</p>
                  </div>
                  {generating && activeAgent === type && (
                    <Loader2 className="w-3.5 h-3.5 text-novax-muted animate-spin shrink-0"/>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* AI Output */}
          {(generating || output || showVariants || error) && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">AI Output</p>
                {(output || showVariants) && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    <Clock className="w-3 h-3"/>
                    Generated
                  </div>
                )}
              </div>
              {generating ? (
                <div className="flex items-center gap-2 p-4 bg-novax-light rounded-xl">
                  <Loader2 className="w-4 h-4 text-novax-muted animate-spin"/>
                  <span className="text-sm text-novax-muted">Generating with context injection…</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              ) : showVariants ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">3 copy variants generated. Select the one that best fits the brief.</p>
                  {copyVariants.map(variant => (
                    <div key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={cn('rounded-xl border p-3.5 cursor-pointer transition-all',
                        selectedVariant === variant.id
                          ? 'border-novax bg-novax-light'
                          : 'border-slate-200 hover:border-novax-border bg-slate-50 hover:bg-white'
                      )}>
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
                            <CheckCircle className="w-3 h-3"/>
                            Selected
                          </div>
                        )}
                      </div>
                      {variant.hook && (
                        <p className="text-[10px] text-novax-muted font-semibold mb-2 italic">Hook: &ldquo;{variant.hook}&rdquo;</p>
                      )}
                      <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{variant.text}</pre>
                      {selectedVariant === variant.id && (
                        <button
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(variant.text).catch(() => {}) }}
                          className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-novax hover:text-novax-hover transition-colors">
                          <Copy className="w-3 h-3"/>
                          Copy to clipboard
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedVariant && (
                    <button className="w-full py-2 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors">
                      Use Selected Version
                    </button>
                  )}
                </div>
              ) : output ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
                </div>
              ) : null}
            </div>
          )}
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
