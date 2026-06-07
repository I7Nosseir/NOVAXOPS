'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Send, Sparkles, User, Bot,
  FileText, Layers, CheckSquare, Building2,
  ExternalLink, Copy, Check, Loader2, PenLine,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import type { ContextSearchResult } from '@/app/api/assistant/context/route'

// ── Types ─────────────────────────────────────────────────────

interface ChatMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
}

interface ContextItem {
  type:  'client' | 'document' | 'session' | 'task'
  id:    string
  label: string
}

// ── Constants ─────────────────────────────────────────────────

const CONTEXT_ICONS: Record<ContextItem['type'], React.ReactNode> = {
  client:   <Building2   className="w-3 h-3" />,
  document: <FileText    className="w-3 h-3" />,
  session:  <Layers      className="w-3 h-3" />,
  task:     <CheckSquare className="w-3 h-3" />,
}

const SLASH_COMMANDS = [
  { cmd: '/summarize', desc: 'Summarize the referenced content'  },
  { cmd: '/rewrite',   desc: 'Rewrite in a different tone'       },
  { cmd: '/shorten',   desc: 'Make the content shorter'          },
  { cmd: '/brief',     desc: 'Convert idea into a content brief' },
  { cmd: '/caption',   desc: 'Generate captions from a brief'    },
  { cmd: '/translate', desc: 'Translate to Arabic'               },
]

const QUICK_PROMPTS = [
  "Analyze last month's performance",
  'Write 3 hook options for a reel',
  'Rewrite this caption — casual tone',
  'Best content format for this niche',
]

const ASSISTANT_CAPABILITIES_REPLY = `I'm the NOVAX Assistant. Here's what I can do:

- Answer questions about any client, project, task, or studio session — use @ to reference them
- Edit or rewrite content (captions, scripts, copy) — paste it in and ask
- Analyze performance data for any active client
- Generate hooks, captions, briefs, or full content structures
- Translate to Arabic
- Summarize documents or studio sessions
- Answer strategy questions scoped to a specific client or across all clients

**Slash commands:** /summarize · /rewrite · /shorten · /brief · /caption · /translate
**@ references:** type @ to attach a client, document, session, or task as context`

// ── @ mention hook ─────────────────────────────────────────────
// query is null when @ is not active.
// query === '' → show recent items (no debounce).
// query !== '' → search documents, sessions, tasks (180ms debounce).
// Clients are NOT in @mention — they are set via the header dropdown.

function useAtMention(query: string | null) {
  const [results, setResults] = useState<ContextSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query === null) { setResults([]); return }
    const isRecent = query === ''
    const delay    = isRecent ? 0 : 180
    const tid = setTimeout(async () => {
      setLoading(true)
      try {
        const url = isRecent
          ? `/api/assistant/context?recent=true&types=document,session,task`
          : `/api/assistant/context?q=${encodeURIComponent(query)}&types=document,session,task`
        const res  = await fetch(url)
        const data = await res.json() as { results: ContextSearchResult[] }
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, delay)
    return () => clearTimeout(tid)
  }, [query])

  return { results, loading }
}

// Group @mention results by type for a cleaner dropdown
function groupByType(results: ContextSearchResult[]) {
  const order: ContextSearchResult['type'][] = ['document', 'session', 'task']
  const grouped = new Map<ContextSearchResult['type'], ContextSearchResult[]>()
  for (const r of results) {
    if (!grouped.has(r.type)) grouped.set(r.type, [])
    grouped.get(r.type)!.push(r)
  }
  return order.filter(t => grouped.has(t)).map(t => ({ type: t, items: grouped.get(t)! }))
}

const TYPE_LABELS: Record<string, string> = {
  document: 'Documents',
  session:  'Studio Sessions',
  task:     'Tasks',
}

// ── Auto-resize textarea helper ───────────────────────────────

function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

// ── Message bubble ─────────────────────────────────────────────

function MessageBubble({ msg, docContextItems }: { msg: ChatMessage; docContextItems: ContextItem[] }) {
  const [copied,  setCopied]  = useState(false)
  const [applied, setApplied] = useState(false)

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [msg.content])

  const applyToDoc = useCallback((docId: string) => {
    window.dispatchEvent(new CustomEvent('novax:apply-to-doc', { detail: { docId, text: msg.content } }))
    setApplied(true)
    setTimeout(() => setApplied(false), 3000)
  }, [msg.content])

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[85%] bg-novax text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {msg.content}
        </div>
        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
          <User className="w-3 h-3 text-slate-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 group">
      <div className="w-6 h-6 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-3 h-3 text-novax-muted" />
      </div>
      <div className="max-w-[90%] space-y-1.5">
        <div className="relative">
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
          <button
            onClick={copy}
            className={cn(
              'absolute -bottom-2.5 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100',
              copied
                ? 'bg-emerald-100 text-emerald-700 opacity-100'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-novax-border hover:text-novax shadow-sm',
            )}
          >
            {copied
              ? <><Check className="w-2.5 h-2.5" /> Copied</>
              : <><Copy className="w-2.5 h-2.5" /> Copy</>}
          </button>
        </div>

        {/* Apply to document buttons — shown for each doc in context */}
        {docContextItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {docContextItems.map(doc => (
              <button
                key={doc.id}
                onClick={() => applyToDoc(doc.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                  applied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-novax-light border-novax-border text-novax hover:bg-novax hover:text-white',
                )}
              >
                {applied
                  ? <><Check className="w-3 h-3" /> Applied to "{doc.label}"</>
                  : <><PenLine className="w-3 h-3" /> Apply to "{doc.label}"</>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Streaming bubble ───────────────────────────────────────────

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-3 h-3 text-novax-muted" />
      </div>
      <div className="max-w-[90%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
        {text}
        <span className="inline-block w-1.5 h-4 bg-novax-accent ml-0.5 animate-pulse align-text-bottom rounded-sm" />
      </div>
    </div>
  )
}

// ── Context chip ───────────────────────────────────────────────

function ContextChip({ item, onRemove }: { item: ContextItem; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-novax-light border border-novax-border text-novax rounded-full text-[11px] font-medium">
      {CONTEXT_ICONS[item.type]}
      {item.label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  )
}

// ── Main chat panel ────────────────────────────────────────────

interface ChatPanelProps {
  open:    boolean
  onClose: () => void
  fullPage?: boolean
}

export function ChatPanel({ open, onClose, fullPage = false }: ChatPanelProps) {
  const { user }    = useAuth()
  const { clients } = useClients()

  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [input,          setInput]          = useState('')
  const [contextItems,   setContextItems]   = useState<ContextItem[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [streaming,      setStreaming]      = useState(false)
  const [streamingText,  setStreamingText]  = useState('')
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)

  // @ mention
  const [atQuery, setAtQuery] = useState<string | null>(null)
  const [atStart, setAtStart] = useState(0)
  const { results: mentionResults, loading: mentionLoading } = useAtMention(atQuery)

  // / command
  const [slashQuery, setSlashQuery] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const panelRef       = useRef<HTMLDivElement>(null)

  const isCeo = user?.role === 'ceo' || user?.role === 'admin'

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Focus input when panel opens
  useEffect(() => {
    if (open || fullPage) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, fullPage])

  // ── Send message — must be defined before early return (Rules of Hooks) ──────
  // immediateText bypasses the input state (used by quick-send buttons)
  const sendMessage = useCallback(async (immediateText?: string) => {
    const text = (immediateText !== undefined ? immediateText : input).trim()
    if (!text || streaming) return

    setErrorMsg(null)
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setStreaming(true)
    setStreamingText('')

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

    try {
      const res = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:      history.map(m => ({ role: m.role, content: m.content })),
          context_items: contextItems,
          client_id:     selectedClient || undefined,
          is_ceo:        isCeo,
          user_role:     user?.role,
          user_id:       user?.id,
        }),
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: 'Request failed.' })) as { error?: string }
        throw new Error(errData.error ?? `HTTP ${res.status}`)
      }

      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full   = ''
      let done   = false

      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') { done = true; break }
          try {
            const chunk = JSON.parse(payload) as { text?: string; error?: string }
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.text) { full += chunk.text; setStreamingText(full) }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        const payload = buffer.slice(6)
        if (payload && payload !== '[DONE]') {
          try {
            const chunk = JSON.parse(payload) as { text?: string }
            if (chunk.text) full += chunk.text
          } catch { /* ignore partial */ }
        }
      }

      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: full || 'No response.' }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setErrorMsg(msg)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      try { await reader?.cancel() } catch { /* ignore */ }
      setStreaming(false)
      setStreamingText('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, messages, contextItems, selectedClient, isCeo, user?.role, user?.id, streaming])

  if (!open && !fullPage) return null

  // ── Input change handler ──────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setInput(val)
    resizeTextarea(e.target)

    const before = val.slice(0, cursor)

    // Detect @ mention — stop on newline or second @
    const atMatch = before.match(/@([^@\n]*)$/)
    if (atMatch) {
      setAtQuery(atMatch[1])
      setAtStart(before.lastIndexOf('@'))
      setSlashQuery(null)
      return
    }

    // Detect / command — only at start of input
    const slashMatch = val.match(/^\/(\w*)$/)
    if (slashMatch) {
      setSlashQuery(slashMatch[1])
      setAtQuery(null)
      return
    }

    setAtQuery(null)
    setSlashQuery(null)
  }

  const insertMention = (item: ContextSearchResult) => {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const before = input.slice(0, atStart)
    const after  = input.slice(cursor)
    const next   = `${before}@${item.label} ${after}`
    setInput(next)
    setContextItems(prev => prev.find(c => c.id === item.id) ? prev : [...prev, { type: item.type, id: item.id, label: item.label }])
    setAtQuery(null)
    // Restore focus and resize after state update
    setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = atStart + item.label.length + 2 // after "@Label "
      el.setSelectionRange(pos, pos)
      resizeTextarea(el)
    }, 0)
  }

  const insertSlashCommand = (cmd: string) => {
    setInput(cmd + ' ')
    setSlashQuery(null)
    setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = cmd.length + 1
      el.setSelectionRange(pos, pos)
      resizeTextarea(el)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Arrow keys to navigate dropdowns (basic — just close on Escape)
    if (e.key === 'Escape') {
      if (atQuery !== null || slashQuery !== null) {
        setAtQuery(null)
        setSlashQuery(null)
      } else if (!fullPage) {
        onClose()
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (atQuery !== null || slashQuery !== null) return
      e.preventDefault()
      void sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setContextItems([])
    setErrorMsg(null)
    setStreaming(false)
    setStreamingText('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // ── Render ────────────────────────────────────────────────────

  const content = (
    <div
      ref={panelRef}
      className={cn(
        'flex flex-col bg-white',
        fullPage
          ? 'h-full rounded-2xl border border-slate-200 shadow-sm'
          : 'fixed bottom-0 right-0 z-50 w-full sm:w-[440px] h-[85vh] sm:h-[78vh] sm:bottom-6 sm:right-6 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200',
      )}
    >

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-novax rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">NOVAX Assistant</p>
            {isCeo && (
              <p className="text-[10px] text-white/60 mt-0.5 font-medium uppercase tracking-wide">
                CEO Mode
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Client context selector — sets the active client for the full conversation */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors',
            selectedClient ? 'bg-white/20 ring-1 ring-white/30' : 'bg-white/10',
          )}>
            <Building2 className={cn('w-3 h-3 shrink-0', selectedClient ? 'text-white' : 'text-white/70')} />
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="text-[11px] text-white bg-transparent outline-none cursor-pointer max-w-[120px]"
              title="Active client context — sets the client for the entire conversation"
            >
              <option value="" className="text-slate-800">No client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-white/50 hover:text-white/90 transition-colors text-[10px] font-medium px-1"
            >
              Clear
            </button>
          )}

          {/* Open full page — only show when NOT already on full page */}
          {!fullPage && (
            <Link
              href="/assistant"
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
              title="Open full page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          {!fullPage && (
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors ml-0.5">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50">

        {/* Empty state */}
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-novax-light border border-novax-border flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-novax-muted" />
            </div>
            <p className="text-sm font-semibold text-slate-700">How can I help?</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[260px] leading-relaxed">
              Ask strategy questions, edit content, or analyze performance.
              Type <span className="font-mono bg-slate-100 px-1 rounded text-novax-muted">@</span> to reference a client, document, or studio session.
            </p>
            {/* CEO morning brief — full-width CTA above quick prompts */}
            {isCeo && (
              <button
                onClick={() => void sendMessage('Give me a full morning briefing — agency status, active clients, overdue tasks, pipeline bottlenecks, and anything that needs my attention today.')}
                className="mt-4 w-full max-w-[280px] px-4 py-2.5 bg-novax text-white text-xs font-bold rounded-xl hover:bg-novax-hover transition-colors"
              >
                Morning Brief
              </button>
            )}

            <div className={cn('grid grid-cols-2 gap-2 w-full max-w-[280px]', isCeo ? 'mt-3' : 'mt-5')}>
              {QUICK_PROMPTS.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                    setTimeout(() => {
                      const el = inputRef.current
                      if (!el) return
                      el.focus()
                      resizeTextarea(el)
                    }, 0)
                  }}
                  className="text-[11px] text-left px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMessages([
                  { id: crypto.randomUUID(), role: 'user', content: 'What can you do?' },
                  { id: crypto.randomUUID(), role: 'assistant', content: ASSISTANT_CAPABILITIES_REPLY },
                ])
              }}
              className="mt-3 px-4 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors"
            >
              What can you do?
            </button>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            docContextItems={
              // Only show "Apply" on assistant replies, and only when there are doc context items
              msg.role === 'assistant' && i > 0
                ? contextItems.filter(c => c.type === 'document')
                : []
            }
          />
        ))}

        {/* Streaming response */}
        {streaming && streamingText  && <StreamingBubble text={streamingText} />}

        {/* Thinking dots */}
        {streaming && !streamingText && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0 mt-1">
              <Loader2 className="w-3 h-3 text-novax-muted animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-novax-muted animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error banner (persists below messages) */}
        {errorMsg && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {errorMsg}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context chips */}
      {contextItems.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 bg-white flex flex-wrap gap-1.5">
          {contextItems.map(item => (
            <ContextChip
              key={item.id}
              item={item}
              onRemove={() => setContextItems(prev => prev.filter(c => c.id !== item.id))}
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative px-3 pb-3 pt-2 border-t border-slate-100 bg-white rounded-b-2xl">

        {/* @ mention dropdown — grouped by type, recents when query is empty */}
        {atQuery !== null && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-3 pt-2 pb-1">
              {atQuery === '' ? 'Recent' : 'Search results'}
            </p>
            {mentionLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" /> {atQuery === '' ? 'Loading…' : 'Searching…'}
              </div>
            ) : mentionResults.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-slate-400">
                {atQuery === '' ? 'No recent items' : `No results for "${atQuery}"`}
              </p>
            ) : (
              groupByType(mentionResults).map(({ type, items }) => (
                <div key={type}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-3 pt-2 pb-0.5 bg-slate-50/80">
                    {TYPE_LABELS[type]}
                  </p>
                  {items.map(r => (
                    <button
                      key={r.id}
                      onMouseDown={e => { e.preventDefault(); insertMention(r) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-novax-light/60 transition-colors"
                    >
                      <span className="text-novax-muted shrink-0">{CONTEXT_ICONS[r.type]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">{r.label}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{r.sublabel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* / command dropdown */}
        {slashQuery !== null && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-3 pt-2 pb-1">Commands</p>
            {SLASH_COMMANDS.filter(c => c.cmd.slice(1).startsWith(slashQuery)).map(c => (
              <button
                key={c.cmd}
                onMouseDown={e => { e.preventDefault(); insertSlashCommand(c.cmd) }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-novax-light/60 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-novax w-24 shrink-0">{c.cmd}</span>
                <span className="text-xs text-slate-500">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Textarea + send */}
        <div className={cn(
          'flex items-end gap-2 bg-slate-50 border rounded-xl px-3 py-2 transition-all',
          streaming
            ? 'border-slate-200 opacity-70'
            : 'border-slate-200 focus-within:border-novax-muted focus-within:ring-2 focus-within:ring-novax-light',
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… @ to reference, / for commands"
            rows={1}
            disabled={streaming}
            className="flex-1 text-sm text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-400 overflow-y-auto leading-relaxed"
            style={{ height: 'auto', minHeight: '24px', maxHeight: '128px' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || streaming}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all',
              input.trim() && !streaming
                ? 'bg-novax text-white hover:bg-novax-hover'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            )}
          >
            {streaming
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send    className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-1.5 select-none">
          <kbd className="font-mono bg-slate-100 px-1 rounded">Enter</kbd> send ·{' '}
          <kbd className="font-mono bg-slate-100 px-1 rounded">Shift+Enter</kbd> new line ·{' '}
          <kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> close
        </p>
      </div>
    </div>
  )

  if (fullPage) return content

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
        onClick={onClose}
      />
      {content}
    </>
  )
}

// ── Floating trigger button ────────────────────────────────────

interface AssistantFabProps {
  onClick: () => void
  isOpen:  boolean
}

export function AssistantFab({ onClick, isOpen }: AssistantFabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 text-white font-semibold text-sm',
        isOpen
          ? 'bg-novax-hover shadow-xl'
          : 'bg-novax hover:bg-novax-hover hover:shadow-xl',
      )}
      title="AI Assistant"
    >
      <Sparkles className="w-4 h-4" />
      <span className="hidden sm:inline">Assistant</span>
    </button>
  )
}
