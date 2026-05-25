'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Wrench, X, ChevronDown, ChevronUp, Copy, Check,
  Loader2, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ToolDef {
  id: string
  label: string
  description: string
  inputType: 'textarea' | 'select' | 'textarea+select'
  inputLabel: string
  inputPlaceholder?: string
  selectOptions?: string[]
  selectLabel?: string
  needsClient?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions per role
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS_BY_ROLE: Record<string, ToolDef[]> = {
  copywriter: [
    {
      id: 'caption_rewriter',
      label: 'Caption Rewriter',
      description: 'Paste any caption to get 3 distinct rewrite variants: punchy, informative, and story-led.',
      inputType: 'textarea',
      inputLabel: 'Original caption',
      inputPlaceholder: 'Paste your caption here...',
    },
    {
      id: 'tone_checker',
      label: 'Tone Checker',
      description: 'Check copy against brand voice standards — score + specific corrections.',
      inputType: 'textarea',
      inputLabel: 'Copy to check',
      inputPlaceholder: 'Paste the copy you want to evaluate...',
    },
    {
      id: 'hook_generator',
      label: 'Hook Generator',
      description: 'Enter a topic to get 5 hooks ranked by scroll-stop potential, each using a different psychological trigger.',
      inputType: 'textarea',
      inputLabel: 'Topic or concept',
      inputPlaceholder: 'e.g. "New collagen serum launch" or "B2B onboarding time reduction"',
    },
    {
      id: 'arabic_translator',
      label: 'Arabic Translator',
      description: 'Translate English social media copy into Gulf dialect Arabic, professionally adapted for the platform.',
      inputType: 'textarea',
      inputLabel: 'English text',
      inputPlaceholder: 'Paste the English copy to translate...',
    },
  ],

  designer: [
    {
      id: 'design_brief_summarizer',
      label: 'Design Brief Summarizer',
      description: 'Summarise a client brief into 5 sharp visual direction points a designer can act on.',
      inputType: 'textarea',
      inputLabel: 'Brief input',
      inputPlaceholder: 'Paste the full brief or describe the design requirement...',
      needsClient: true,
    },
    {
      id: 'asset_keyword_extractor',
      label: 'Asset Keyword Extractor',
      description: 'Extract 8 optimised image search keywords from a post caption, plus an AI generation prompt.',
      inputType: 'textarea',
      inputLabel: 'Post caption',
      inputPlaceholder: 'Paste the post caption...',
    },
    {
      id: 'format_recommender',
      label: 'Format Recommender',
      description: 'Get recommended canvas dimensions, file specs, and safe zone guidance for your content type.',
      inputType: 'textarea',
      inputLabel: 'Describe the content',
      inputPlaceholder: 'e.g. "Instagram Reel for a product launch with text overlay" or "LinkedIn carousel for B2B case study"',
    },
    {
      id: 'color_palette_check',
      label: 'Colour Palette Check',
      description: 'Evaluate your colour choices against brand standards, accessibility (WCAG), and psychological impact.',
      inputType: 'textarea',
      inputLabel: 'Describe your palette',
      inputPlaceholder: 'e.g. "Deep navy #0a1628 background, coral #ff6b4a accent, white text. For a fitness brand targeting women 25-35."',
    },
  ],

  social_manager: [
    {
      id: 'posting_time_optimizer',
      label: 'Posting Time Optimizer',
      description: 'Get the 3 optimal posting windows for a platform with algorithm and audience reasoning.',
      inputType: 'select',
      inputLabel: 'Select platform',
      selectOptions: ['Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Twitter/X', 'YouTube', 'Pinterest'],
    },
    {
      id: 'moderation_reply_generator',
      label: 'Moderation Reply Generator',
      description: 'Generate 2 reply tones (professional + friendly) for any incoming comment.',
      inputType: 'textarea',
      inputLabel: 'Incoming comment',
      inputPlaceholder: 'Paste the comment you need to reply to...',
    },
    {
      id: 'caption_hashtag_audit',
      label: 'Caption Hashtag Audit',
      description: 'Audit caption + hashtag alignment — keep/remove/add recommendations.',
      inputType: 'textarea',
      inputLabel: 'Caption + hashtags',
      inputPlaceholder: 'Paste the full caption including hashtags...',
    },
    {
      id: 'crisis_checklist',
      label: 'Crisis Response Protocol',
      description: 'Get the full step-by-step crisis communications checklist — phases 1 through 5.',
      inputType: 'textarea',
      inputLabel: 'Describe the situation (optional)',
      inputPlaceholder: 'Optional: briefly describe the type of crisis for context, or leave blank for the general protocol.',
    },
  ],

  account_manager: [
    {
      id: 'client_health_summary',
      label: 'Client Health Summary',
      description: '3-bullet client status: risks, wins, and top 7-day priority — ready for internal alignment.',
      inputType: 'textarea',
      inputLabel: 'Client context',
      inputPlaceholder: 'Paste recent notes, pending items, recent metrics, or anything relevant to this client\'s current state...',
      needsClient: true,
    },
    {
      id: 'approval_email_drafter',
      label: 'Approval Email Drafter',
      description: 'Generate a polished client approval request email from the approval link and client name.',
      inputType: 'textarea',
      inputLabel: 'Details',
      inputPlaceholder: 'Client name, approval link, deadline date, and what content is being approved...',
    },
    {
      id: 'report_narrative_generator',
      label: 'Report Narrative Generator',
      description: 'Transform 3–5 KPI values into an executive-ready performance paragraph.',
      inputType: 'textarea',
      inputLabel: 'KPI values',
      inputPlaceholder: 'e.g. "Reach: 48,200 (+23% MoM), Engagement rate: 4.7%, Follower growth: +342, Best post: 2,100 saves"',
    },
    {
      id: 'meeting_prep_brief',
      label: 'Meeting Prep Brief',
      description: 'Talking points, risk flags, and closing objectives for your next client meeting.',
      inputType: 'textarea',
      inputLabel: 'Context & agenda',
      inputPlaceholder: 'Client name, meeting purpose, any open items, recent performance notes...',
      needsClient: true,
    },
  ],

  strategist: [
    {
      id: 'content_calendar_generator',
      label: 'Content Calendar Generator',
      description: 'Platform + objective → detailed 4-week content plan with narrative arc.',
      inputType: 'textarea',
      inputLabel: 'Platform, month, objective',
      inputPlaceholder: 'e.g. "Instagram, June 2026, Ramadan campaign for a food brand targeting Gulf families"',
    },
    {
      id: 'campaign_brief_drafter',
      label: 'Campaign Brief Drafter',
      description: 'Turn an objective into a full, execution-ready campaign brief.',
      inputType: 'textarea',
      inputLabel: 'Objective + context',
      inputPlaceholder: 'Client name, campaign objective, key message, target audience, budget range, timeline...',
      needsClient: true,
    },
    {
      id: 'trend_relevance_checker',
      label: 'Trend Relevance Checker',
      description: 'Assess a trending topic against a client\'s brand — use / avoid / adapt recommendation.',
      inputType: 'textarea',
      inputLabel: 'Trending topic + client industry',
      inputPlaceholder: 'e.g. "The #QuietLuxury trend — for a mid-market fashion brand targeting women 25-40 in the Gulf"',
    },
    {
      id: 'quarter_okr_drafter',
      label: 'Quarter OKR Drafter',
      description: 'Generate 3 quarterly OKRs with Key Results and confidence scores.',
      inputType: 'textarea',
      inputLabel: 'Client name + main goal',
      inputPlaceholder: 'e.g. "Luxe Cosmetics — grow Instagram presence and drive online store traffic in Q3 2026"',
      needsClient: true,
    },
  ],

  creative_director: [
    {
      id: 'creative_brief_scorer',
      label: 'Creative Brief Scorer',
      description: 'Score a brief 0–100 across 5 quality dimensions + 3 improvement points.',
      inputType: 'textarea',
      inputLabel: 'Creative brief',
      inputPlaceholder: 'Paste the full creative brief...',
    },
    {
      id: 'copy_quality_gate',
      label: 'Copy Quality Gate',
      description: 'Final QA pass — brand voice, grammar, platform compliance, and clarity check.',
      inputType: 'textarea',
      inputLabel: 'Final copy',
      inputPlaceholder: 'Paste the copy ready for quality gate review...',
    },
    {
      id: 'campaign_concept_generator',
      label: 'Campaign Concept Generator',
      description: 'Generate 3 distinct campaign concepts from a goal, emotion, and client.',
      inputType: 'textarea',
      inputLabel: 'Goal + emotion + context',
      inputPlaceholder: 'e.g. "Launch a new product line for FitForge targeting gym beginners, feeling of transformation"',
      needsClient: true,
    },
    {
      id: 'visual_direction_generator',
      label: 'Visual Direction Generator',
      description: 'Full visual direction: mood, photography references, colour rules, typography, and don\'ts.',
      inputType: 'textarea',
      inputLabel: 'Client + context',
      inputPlaceholder: 'Client name, industry, target audience, and any specific campaign context...',
      needsClient: true,
    },
  ],
}

// Admin/CEO/default gets a curated mix of the most powerful tools
const DEFAULT_TOOLS: ToolDef[] = [
  TOOLS_BY_ROLE.copywriter[0], // Caption Rewriter
  TOOLS_BY_ROLE.copywriter[2], // Hook Generator
  TOOLS_BY_ROLE.creative_director[0], // Creative Brief Scorer
]

function getToolsForRole(role: UserRole): ToolDef[] {
  if (role === 'admin' || role === 'ceo') return DEFAULT_TOOLS
  return TOOLS_BY_ROLE[role] ?? DEFAULT_TOOLS
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    ceo: 'CEO',
    creative_director: 'Creative Director',
    copywriter: 'Copywriter',
    designer: 'Designer',
    social_manager: 'Social Manager',
    account_manager: 'Account Manager',
    strategist: 'Strategist',
  }
  return labels[role] ?? role
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual tool item
// ─────────────────────────────────────────────────────────────────────────────

interface ToolItemProps {
  tool: ToolDef
  role: string
  isOpen: boolean
  onToggle: () => void
  clients: { id: string; name: string }[]
}

function ToolItem({ tool, role, isOpen, onToggle, clients }: ToolItemProps) {
  const [input, setInput] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const clientName = clients.find(c => c.id === selectedClientId)?.name

  const handleGenerate = useCallback(async () => {
    const inputVal = tool.inputType === 'select' ? selectValue : input
    if (!inputVal.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/tools/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          tool: tool.id,
          input: inputVal.trim(),
          client_id: selectedClientId || undefined,
          client_name: clientName || undefined,
        }),
      })

      const data = await res.json() as { result?: string; error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Generation failed. Please try again.')
      } else {
        setResult(data.result ?? '')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [role, tool, input, selectValue, selectedClientId, clientName])

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const hasInput = tool.inputType === 'select' ? !!selectValue.trim() : !!input.trim()

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Tool header — accordion trigger */}
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">{tool.label}</p>
          {!isOpen && (
            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{tool.description}</p>
          )}
        </div>
        <span className="text-slate-400 shrink-0 mt-0.5">
          {isOpen
            ? <ChevronUp className="w-3.5 h-3.5"/>
            : <ChevronDown className="w-3.5 h-3.5"/>
          }
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-500">{tool.description}</p>

          {/* Client selector — only for tools that need it */}
          {tool.needsClient && clients.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Client (optional)
              </label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border-active bg-white"
              >
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Platform select */}
          {(tool.inputType === 'select' || tool.inputType === 'textarea+select') && tool.selectOptions && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {tool.selectLabel ?? tool.inputLabel}
              </label>
              <select
                value={selectValue}
                onChange={e => setSelectValue(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border-active bg-white"
              >
                <option value="">— Select —</option>
                {tool.selectOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Textarea input */}
          {(tool.inputType === 'textarea' || tool.inputType === 'textarea+select') && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {tool.inputLabel}
              </label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={tool.inputPlaceholder}
                rows={3}
                className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border-active bg-white resize-none placeholder:text-slate-300"
              />
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !hasInput}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
              loading || !hasInput
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-novax text-white hover:bg-novax-hover',
            )}
          >
            {loading
              ? <><Loader2 className="w-3 h-3 animate-spin"/> Generating...</>
              : 'Generate'
            }
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5"/>
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="relative">
              <div className="p-3 bg-novax-light border border-novax-border rounded-lg max-h-52 overflow-y-auto">
                <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{result}</p>
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  'absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all',
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax',
                )}
              >
                {copied
                  ? <><Check className="w-2.5 h-2.5"/> Copied</>
                  : <><Copy className="w-2.5 h-2.5"/> Copy</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export function RoleToolsPanel() {
  const [open, setOpen] = useState(false)
  const [openToolId, setOpenToolId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const { clients } = useClients()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!user) return null

  const tools = getToolsForRole(user.role)
  const roleLabel = getRoleLabel(user.role)

  return (
    <>
      {/* Floating trigger button — sits at bottom-6, offset left of MyTasksFloat */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-6 right-24 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shadow-lg transition-all duration-200 text-sm font-semibold',
          open
            ? 'bg-novax-hover text-white shadow-xl'
            : 'bg-novax text-white hover:bg-novax-hover hover:shadow-xl',
        )}
        title="Role Tools"
      >
        <Wrench className="w-3.5 h-3.5"/>
        <span className="hidden sm:inline">Tools</span>
      </button>

      {/* Panel — slides up from trigger */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-24 z-50 w-[380px] max-h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ animation: 'slideUp 0.18s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-novax rounded-t-2xl">
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest">{roleLabel}</p>
              <p className="text-sm font-semibold text-white">Quick Tools</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>

          {/* Tool list — scrollable */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {tools.map(tool => (
              <ToolItem
                key={tool.id}
                tool={tool}
                role={user.role}
                isOpen={openToolId === tool.id}
                onToggle={() => setOpenToolId(prev => prev === tool.id ? null : tool.id)}
                clients={clients}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
