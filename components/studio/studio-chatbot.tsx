'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditPayload } from '@/lib/studio-types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  edit?: EditPayload
}

export interface StudioChatbotProps {
  sessionId: string
  sessionContext: Record<string, unknown>
  initialHistory?: ChatMessage[]
  onEditDetected?: (edit: EditPayload) => void
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-max">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ── Edit card ────────────────────────────────────────────────────────────────

function EditCard({ edit, onApply }: { edit: EditPayload; onApply: (edit: EditPayload) => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mt-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
        Suggested edit — {edit.target}
      </p>
      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-2">{edit.new_content}</p>
      {edit.reasoning && (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-2">{edit.reasoning}</p>
      )}
      <button
        onClick={() => onApply(edit)}
        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Apply
      </button>
    </div>
  )
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED = [
  'What can you do?',
  'What is the weakest part?',
  'Rewrite the hook',
  'Why this approach?',
]

// ── Main component ────────────────────────────────────────────────────────────

export function StudioChatbot({
  sessionId,
  sessionContext,
  initialHistory = [],
  onEditDetected,
}: StudioChatbotProps) {
  const [isOpen, setIsOpen]         = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(initialHistory)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading]   = useState(false)
  const messagesEndRef               = useRef<HTMLDivElement>(null)
  const textareaRef                  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setChatHistory(initialHistory)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isLoading])

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 60)
  }, [isOpen])

  // ── Core send — accepts an optional override text so suggested prompts
  //    can fire without touching the input field.
  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? inputValue).trim()
    if (!text || isLoading) return

    if (!override) {
      setInputValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    // Snapshot history before the optimistic update so we send the correct context
    const historySnapshot = chatHistory
    setChatHistory(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message:    text,
          history:    historySnapshot,
          context:    sessionContext,
        }),
      })

      const data = (await res.json()) as { reply?: string; edit?: EditPayload; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Chat failed')

      if (data.edit && onEditDetected) onEditDetected(data.edit)

      const assistantMsg: ChatMessage = {
        role:      'assistant',
        content:   data.reply ?? '',
        timestamp: new Date().toISOString(),
        edit:      data.edit,
      }
      const newHistory = [...historySnapshot, userMsg, assistantMsg]
      setChatHistory(newHistory)

      // Persist to session (fire-and-forget)
      if (sessionId) {
        fetch(`/api/studio/session/${sessionId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_history: newHistory }),
        }).catch(() => {})
      }
    } catch {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: 'Request failed. Check your connection and try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, chatHistory, sessionId, sessionContext, onEditDetected])

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (e.key === 'Escape') setIsOpen(false)
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  const panel = (
    <div className={cn(
      'fixed z-50 flex flex-col',
      'bg-white dark:bg-slate-900',
      'shadow-2xl border border-slate-200 dark:border-slate-700',
      // Mobile: full-width bottom sheet
      'inset-x-0 bottom-0 rounded-t-2xl',
      // Desktop: right-side panel
      'sm:inset-x-auto sm:right-4 sm:bottom-4 sm:rounded-2xl sm:w-[420px]',
      'h-[72vh] sm:h-[calc(100vh-5rem)]',
    )}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-novax-light dark:bg-novax/20 flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-novax-muted dark:text-novax-accent" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Studio Intelligence</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center">
              Ask anything about this session — edits, strategy, or why something was built this way.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:border-novax-border hover:bg-novax-light/50 dark:hover:bg-novax/10 dark:hover:border-novax/40 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-sm',
              msg.role === 'user'
                ? 'bg-novax text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
            )}>
              {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
              {msg.edit && onEditDetected && (
                <EditCard edit={msg.edit} onApply={edit => onEditDetected(edit)} />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this session…"
            rows={1}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded-xl resize-none outline-none transition-colors',
              'border border-slate-200 dark:border-slate-700',
              'bg-white dark:bg-slate-800',
              'text-slate-800 dark:text-slate-200',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus:border-novax-border dark:focus:border-novax-border/60',
            )}
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-novax hover:bg-novax-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
          <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">Enter</kbd> send ·{' '}
          <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">Shift+Enter</kbd> new line ·{' '}
          <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">Esc</kbd> close
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB — visible when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          Studio Chat
        </button>
      )}

      {isOpen && panel}
    </>
  )
}
