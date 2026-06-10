'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Send, Sparkles, User, Bot,
  FileText, Layers, CheckSquare, Building2,
  ExternalLink, Copy, Check, Loader2, PenLine,
  History, Plus, AlertTriangle, Clipboard, ClipboardCheck,
  FilePlus,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { cn } from '@/lib/utils'
import type { ContextSearchResult } from '@/app/api/assistant/context/route'
import {
  useChatSessions, type StoredSession,
  MAX_MESSAGES, WARN_MESSAGES, loadMostRecentSession,
} from '@/lib/hooks/use-chat-sessions'

// ── Types ─────────────────────────────────────────────────────

type DocSignal =
  | { kind: 'edit';   docId: string; content: string; remainder: string }
  | { kind: 'create'; title: string; content: string; remainder: string }

interface ChatMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  docEdit?:  { docId: string; content: string }
  docCreate?: { title: string; content: string; clientId?: string }
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
- **Edit a document** — @ mention a document and ask me to rewrite/format it; I'll prepare the changes and show an Apply button
- **Create a new document** — ask me to "create a document" or "write a brief as a document"; I'll draft it and show an approval card
- Analyze performance data for any active client
- Generate hooks, captions, briefs, or full content structures
- Translate to Arabic
- Summarize documents or studio sessions
- Answer strategy questions scoped to a specific client or across all clients

**Slash commands:** /summarize · /rewrite · /shorten · /brief · /caption · /translate
**@ references:** type @ to attach a client, document, session, or task as context`

// ── Doc signal parser (handles doc_edit + doc_create) ─────────
// Uses a string-aware JSON-end finder so } inside content strings
// don't prematurely terminate the brace counter.

function findJsonEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escape   = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape)                     { escape = false; continue }
    if (ch === '\\' && inString)    { escape = true;  continue }
    if (ch === '"')                 { inString = !inString; continue }
    if (inString)                   continue
    if (ch === '{')                 depth++
    else if (ch === '}')            { depth--; if (depth === 0) return i }
  }
  return -1
}

function tryParseSignal(text: string): DocSignal | null {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{"type":"doc_')) return null
  const start = trimmed.indexOf('{')
  if (start === -1) return null
  const end = findJsonEnd(trimmed, start)
  if (end === -1) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      type?:    string
      doc_id?:  string
      title?:   string
      content?: string
    }
    const remainder = trimmed.slice(end + 1).trim()
    if (parsed.type === 'doc_edit' && parsed.doc_id && parsed.content) {
      return { kind: 'edit', docId: parsed.doc_id, content: parsed.content, remainder }
    }
    if (parsed.type === 'doc_create' && parsed.title && parsed.content) {
      return { kind: 'create', title: parsed.title, content: parsed.content, remainder }
    }
  } catch { /* fall through */ }
  return null
}

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

// ── Doc edit card ──────────────────────────────────────────────

function DocEditCard({ docEdit, contextItems }: { docEdit: { docId: string; content: string }; contextItems: ContextItem[] }) {
  const [applyState, setApplyState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const docLabel = contextItems.find(c => c.id === docEdit.docId)?.label ?? 'Document'

  const apply = async () => {
    if (applyState !== 'idle') return
    setApplyState('loading')
    try {
      const res = await fetch(`/api/docs/${docEdit.docId}/ai-edit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: docEdit.content }),
      })
      if (!res.ok) throw new Error('Apply failed')
      // Update the editor in real-time if the document is open in the same window
      window.dispatchEvent(new CustomEvent('novax:apply-to-doc', {
        detail: { docId: docEdit.docId, text: docEdit.content },
      }))
      setApplyState('done')
    } catch {
      setApplyState('error')
    }
  }

  return (
    <div className="border border-novax-border bg-novax-light/60 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-novax-muted shrink-0" />
        <span className="text-xs font-bold text-novax uppercase tracking-wide">Document Edit Ready</span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        AI has prepared edits for <span className="font-semibold">"{docLabel}"</span>. Review the preview, then apply.
      </p>
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 max-h-28 overflow-y-auto">
        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
          {docEdit.content.slice(0, 600)}{docEdit.content.length > 600 ? '\n…' : ''}
        </pre>
      </div>
      <div className="flex items-center gap-2">
        {applyState === 'done' ? (
          <Link
            href={`/docs/${docEdit.docId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
          >
            <Check className="w-3 h-3" /> Applied — Open Document
          </Link>
        ) : (
          <button
            onClick={() => void apply()}
            disabled={applyState === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-novax text-white rounded-lg text-xs font-semibold hover:bg-novax-hover transition-colors disabled:opacity-60"
          >
            {applyState === 'loading'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
              : <><PenLine className="w-3 h-3" /> Apply to Document</>}
          </button>
        )}
        {applyState === 'error' && (
          <span className="text-xs text-red-600">Failed — try again</span>
        )}
      </div>
    </div>
  )
}

// ── Doc create card ────────────────────────────────────────────

function DocCreateCard({ docCreate }: { docCreate: { title: string; content: string; clientId?: string } }) {
  const [state,    setState]    = useState<'pending' | 'creating' | 'done' | 'error'>('pending')
  const [newDocId, setNewDocId] = useState<string | null>(null)

  const approve = async () => {
    if (state !== 'pending') return
    setState('creating')
    try {
      const res = await fetch('/api/docs/ai-create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:     docCreate.title,
          content:   docCreate.content,
          client_id: docCreate.clientId ?? null,
        }),
      })
      if (!res.ok) throw new Error('Create failed')
      const data = await res.json() as { id: string }
      setNewDocId(data.id)
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <FilePlus className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">New Document Ready</span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Approve to create <span className="font-semibold">"{docCreate.title}"</span> as a new document.
      </p>
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 max-h-28 overflow-y-auto">
        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
          {docCreate.content.slice(0, 600)}{docCreate.content.length > 600 ? '\n…' : ''}
        </pre>
      </div>
      <div className="flex items-center gap-2">
        {state === 'done' && newDocId ? (
          <Link
            href={`/docs/${newDocId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
          >
            <Check className="w-3 h-3" /> Created — Open Document
          </Link>
        ) : (
          <>
            <button
              onClick={() => void approve()}
              disabled={state === 'creating'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
            >
              {state === 'creating'
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating…</>
                : <><FilePlus className="w-3 h-3" /> Create Document</>}
            </button>
            {state === 'error' && (
              <span className="text-xs text-red-600">Failed — try again</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────

function MessageBubble({ msg, docContextItems }: { msg: ChatMessage; docContextItems: ContextItem[] }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  // Doc signal — show Apply card or Create card (+ any explanation below)
  if (msg.docEdit || msg.docCreate) {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3 h-3 text-novax-muted" />
        </div>
        <div className="max-w-[90%] space-y-2">
          {msg.docEdit   && <DocEditCard   docEdit={msg.docEdit}     contextItems={docContextItems} />}
          {msg.docCreate && <DocCreateCard docCreate={msg.docCreate} />}
          {msg.content && (
            <p className="text-xs text-slate-500 leading-relaxed px-1">{msg.content}</p>
          )}
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
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                code: ({ children, className }) => className
                  ? <code className="block bg-slate-100 rounded p-2 text-xs font-mono my-2 overflow-x-auto whitespace-pre">{children}</code>
                  : <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-novax-muted underline hover:text-novax">{children}</a>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
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
      </div>
    </div>
  )
}

// ── Streaming bubble ───────────────────────────────────────────

function StreamingBubble({ text }: { text: string }) {
  const isDocSignal = text.trimStart().startsWith('{"type":"doc_')
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-3 h-3 text-novax-muted" />
      </div>
      <div className="max-w-[90%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
        {isDocSignal ? (
          <span className="flex items-center gap-1.5 text-novax-muted italic text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Preparing document…
          </span>
        ) : (
          <>
            {text}
            <span className="inline-block w-1.5 h-4 bg-novax-accent ml-0.5 animate-pulse align-text-bottom rounded-sm" />
          </>
        )}
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
  // Phase 3: DB-backed persistence
  chatId?:          string
  initialMessages?: ChatMessage[]
  initialClientId?: string
  hasSidebar?:      boolean
  onSave?: (
    chatId: string,
    messages: ChatMessage[],
    title: string,
    clientId?: string,
  ) => void
}

export function ChatPanel({
  open,
  onClose,
  fullPage = false,
  chatId,
  initialMessages,
  initialClientId,
  hasSidebar = false,
  onSave,
}: ChatPanelProps) {
  const { user }    = useAuth()
  const { clients } = useClients()

  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [input,          setInput]          = useState('')
  const [contextItems,   setContextItems]   = useState<ContextItem[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [streaming,      setStreaming]      = useState(false)
  const [streamingText,  setStreamingText]  = useState('')
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)

  // ── Session persistence ────────────────────────────────────────
  const { sessions, upsert: upsertSession, remove: removeSession } = useChatSessions()
  const [sessionId,         setSessionId]         = useState(() => crypto.randomUUID())
  const [sessionCreatedAt,  setSessionCreatedAt]  = useState(() => new Date().toISOString())
  const [handoffBlock,      setHandoffBlock]      = useState<string | null>(null)
  const [generatingHandoff, setGeneratingHandoff] = useState(false)
  const [showHandoffModal,  setShowHandoffModal]  = useState(false)
  const [showHistory,       setShowHistory]       = useState(false)
  const [copiedHandoff,     setCopiedHandoff]     = useState(false)

  // @ mention
  const [atQuery, setAtQuery] = useState<string | null>(null)
  const [atStart, setAtStart] = useState(0)
  const { results: mentionResults, loading: mentionLoading } = useAtMention(atQuery)

  // / command
  const [slashQuery, setSlashQuery] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const panelRef       = useRef<HTMLDivElement>(null)
  const historyRef     = useRef<HTMLDivElement>(null)
  const onSaveRef      = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const isCeo             = user?.role === 'ceo' || user?.role === 'admin'
  const sessionIsComplete = messages.length >= MAX_MESSAGES
  const sessionNearLimit  = messages.length >= WARN_MESSAGES && !sessionIsComplete

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

  // Load messages on mount — prefer DB-supplied initialMessages, fall back to localStorage
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages)
      if (initialClientId) setSelectedClient(initialClientId)
      return
    }
    // Fallback: no DB session provided — load most recent localStorage session
    if (!chatId) {
      const recent = loadMostRecentSession()
      if (!recent || recent.messages.length === 0) return
      setSessionId(recent.id)
      setSessionCreatedAt(recent.created_at)
      setMessages(recent.messages as ChatMessage[])
      if (recent.client_id) setSelectedClient(recent.client_id)
      if (recent.is_complete) {
        if (recent.handoff_block) setHandoffBlock(recent.handoff_block)
        setShowHandoffModal(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save after every message exchange
  useEffect(() => {
    const title = messages.find(m => m.role === 'user')?.content.slice(0, 60) ?? 'New Chat'

    // DB save — if chatId prop provided, persist via onSave callback
    if (chatId && messages.length > 0 && onSaveRef.current) {
      onSaveRef.current(chatId, messages, title, selectedClient || undefined)
    }

    // localStorage save — keep for legacy non-DB panels
    if (!sessionId || messages.length === 0) return
    const clientData = clients.find(c => c.id === selectedClient)
    upsertSession({
      id:            sessionId,
      title,
      created_at:    sessionCreatedAt,
      updated_at:    new Date().toISOString(),
      messages:      messages as StoredSession['messages'],
      client_id:     selectedClient || undefined,
      client_name:   clientData?.name,
      is_complete:   messages.length >= MAX_MESSAGES,
      handoff_block: handoffBlock ?? undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, handoffBlock])

  // Kick off handoff generation once we're within 4 messages of the limit
  useEffect(() => {
    if (messages.length >= WARN_MESSAGES && !handoffBlock && !generatingHandoff) {
      void generateHandoff()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // Show modal once complete + block is ready
  useEffect(() => {
    if (messages.length >= MAX_MESSAGES && handoffBlock && !showHandoffModal) {
      setShowHandoffModal(true)
    }
  }, [messages.length, handoffBlock, showHandoffModal])

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHistory])

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

      const signal = tryParseSignal(full)
      if (signal?.kind === 'edit') {
        setMessages(prev => [...prev, {
          id:      crypto.randomUUID(),
          role:    'assistant',
          content: signal.remainder,
          docEdit: { docId: signal.docId, content: signal.content },
        }])
      } else if (signal?.kind === 'create') {
        setMessages(prev => [...prev, {
          id:       crypto.randomUUID(),
          role:     'assistant',
          content:  signal.remainder,
          docCreate: { title: signal.title, content: signal.content, clientId: selectedClient || undefined },
        }])
      } else {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: full || 'No response.' }])
      }
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

  // ── These three useCallbacks MUST be before the early return ─────────────────
  // Moving them below `if (!open && !fullPage) return null` causes React error #310
  // (hook count mismatch between renders) because hooks must be called unconditionally.

  const generateHandoff = useCallback(async () => {
    if (generatingHandoff || handoffBlock) return
    setGeneratingHandoff(true)
    try {
      const clientData = clients.find(c => c.id === selectedClient)
      const res  = await fetch('/api/assistant/handoff', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:    messages.map(m => ({ role: m.role, content: m.content })),
          client_name: clientData?.name,
        }),
      })
      const data = await res.json() as { block?: string }
      if (data.block) setHandoffBlock(data.block)
    } catch {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content ?? ''
      setHandoffBlock(
        `[CONTEXT HANDOFF]\n\nSession: ${messages.length} messages\nClient: ${clients.find(c => c.id === selectedClient)?.name ?? 'None'}\nLast topic: ${lastUserMsg.slice(0, 120)}\n\nPaste this at the start of your next chat to continue.`
      )
    } finally {
      setGeneratingHandoff(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatingHandoff, handoffBlock, messages, selectedClient, clients])

  const newChat = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setSessionCreatedAt(new Date().toISOString())
    setMessages([])
    setContextItems([])
    setSelectedClient('')
    setErrorMsg(null)
    setHandoffBlock(null)
    setShowHandoffModal(false)
    setShowHistory(false)
    setStreaming(false)
    setStreamingText('')
    setTimeout(() => inputRef.current?.focus(), 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSession = useCallback((session: StoredSession) => {
    setSessionId(session.id)
    setSessionCreatedAt(session.created_at)
    setMessages(session.messages as ChatMessage[])
    setSelectedClient(session.client_id ?? '')
    setHandoffBlock(session.handoff_block ?? null)
    setErrorMsg(null)
    setShowHistory(false)
    if (session.is_complete && session.handoff_block) {
      setShowHandoffModal(true)
    }
  }, [])

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

  // ── Handoff modal ────────────────────────────────────────────
  const handoffModal = showHandoffModal ? (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between rounded-t-2xl" style={{ background: '#1B3D38' }}>
          <div>
            <p className="text-sm font-bold text-white">Chat Limit Reached</p>
            <p className="text-[11px] text-white/60 mt-0.5">{MAX_MESSAGES} messages — copy the block below to continue in a new chat</p>
          </div>
          <button onClick={() => setShowHandoffModal(false)} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Copy this context block and paste it at the start of your new chat to pick up exactly where you left off.
          </p>
          {generatingHandoff ? (
            <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-xl">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin"/>
              <span className="text-sm text-slate-500">Preparing your context handoff…</span>
            </div>
          ) : (
            <div className="relative">
              <textarea
                readOnly
                value={handoffBlock ?? ''}
                rows={10}
                className="w-full text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 resize-none outline-none focus:border-slate-300 leading-relaxed"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(handoffBlock ?? '').catch(() => {})
                  setCopiedHandoff(true)
                  setTimeout(() => setCopiedHandoff(false), 2000)
                }}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-600 hover:border-slate-300 transition-all shadow-sm"
              >
                {copiedHandoff
                  ? <><ClipboardCheck className="w-3 h-3 text-emerald-600"/> Copied</>
                  : <><Clipboard className="w-3 h-3"/> Copy</>}
              </button>
            </div>
          )}
          <button
            onClick={() => { setShowHandoffModal(false); newChat() }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: '#1B3D38' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#163330')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1B3D38')}
          >
            Start New Chat
          </button>
        </div>
      </div>
    </div>
  ) : null

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

          {/* History dropdown — full page only, hidden when sidebar handles navigation */}
          {fullPage && !hasSidebar && (
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setShowHistory(v => !v)}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] transition-colors',
                  showHistory ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/15 text-white/70',
                )}
              >
                <History className="w-3 h-3"/>
                <span>History</span>
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Recent Chats</p>
                    <button
                      onClick={() => { setShowHistory(false); newChat() }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-novax hover:text-novax-hover transition-colors"
                    >
                      <Plus className="w-3 h-3"/> New
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {sessions.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400">No saved chats yet</p>
                    ) : sessions.slice(0, 15).map(s => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s)}
                        className={cn(
                          'w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50/80 last:border-0',
                          s.id === sessionId && 'bg-novax-light/50',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{s.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {s.client_name && <span className="text-[10px] text-novax-muted truncate max-w-[80px]">{s.client_name}</span>}
                            <span className="text-[10px] text-slate-400">{new Date(s.updated_at).toLocaleDateString()}</span>
                            {s.is_complete && (
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Complete</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeSession(s.id) }}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                        >
                          <X className="w-3 h-3"/>
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={newChat}
            className="text-white/50 hover:text-white/90 transition-colors text-[10px] font-medium px-1"
            title="Start new chat"
          >
            New
          </button>

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

        {/* Approaching limit warning */}
        {sessionNearLimit && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
            <span className="flex-1">{MAX_MESSAGES - messages.length} messages remaining before this chat closes.</span>
            {generatingHandoff && <Loader2 className="w-3 h-3 animate-spin shrink-0"/>}
          </div>
        )}

        {/* Chat complete — show button to re-open handoff */}
        {sessionIsComplete && !showHandoffModal && (
          <div className="flex flex-col items-center gap-2.5 py-4 text-center">
            <p className="text-sm font-semibold text-slate-700">This chat has reached its limit</p>
            <p className="text-xs text-slate-400 max-w-[220px]">Start a new chat to continue. Use the context block to carry your work forward.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHandoffModal(true)}
                className="px-3 py-1.5 text-xs font-semibold border border-novax-border text-novax rounded-lg hover:bg-novax-light transition-colors"
              >
                View Context Block
              </button>
              <button
                onClick={newChat}
                className="px-3 py-1.5 text-xs font-semibold bg-novax text-white rounded-lg hover:bg-novax-hover transition-colors"
              >
                New Chat
              </button>
            </div>
          </div>
        )}

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
            docContextItems={msg.role === 'assistant' && i > 0 ? contextItems : []}
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
          streaming || sessionIsComplete
            ? 'border-slate-200 opacity-70'
            : 'border-slate-200 focus-within:border-novax-muted focus-within:ring-2 focus-within:ring-novax-light',
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={sessionIsComplete ? 'Chat limit reached — start a new chat above' : 'Ask anything… @ to reference, / for commands'}
            rows={1}
            disabled={streaming || sessionIsComplete}
            className="flex-1 text-sm text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-400 overflow-y-auto leading-relaxed disabled:cursor-not-allowed"
            style={{ height: 'auto', minHeight: '24px', maxHeight: '128px' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || streaming || sessionIsComplete}
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

  if (fullPage) return <>{handoffModal}{content}</>

  return (
    <>
      {handoffModal}
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
