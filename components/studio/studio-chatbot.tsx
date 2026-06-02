'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditPayload } from '@/lib/studio-types'

// Extended ChatMessage that carries an optional edit payload
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

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 rounded-xl max-w-max">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ── Edit card ─────────────────────────────────────────────────────────────────

function EditCard({
  edit,
  onApply,
}: {
  edit: EditPayload
  onApply: (edit: EditPayload) => void
}) {
  return (
    <div className="bg-white border border-emerald-200 rounded-xl p-3 mt-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
        Suggested edit — {edit.target}
      </p>
      <p className="text-sm text-slate-800 leading-relaxed mb-2">
        {edit.new_content}
      </p>
      {edit.reasoning && (
        <p className="text-xs text-slate-500 italic mb-2">{edit.reasoning}</p>
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

// ── Main component ─────────────────────────────────────────────────────────────

export function StudioChatbot({
  sessionId,
  sessionContext,
  initialHistory = [],
  onEditDetected,
}: StudioChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(initialHistory)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect mobile and set initial open state
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth <= 640
      setIsMobile(mobile)
      // Desktop: default open; mobile: default closed
      if (!mobile) setIsOpen(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isLoading])

  // Auto-grow textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setChatHistory(prev => [...prev, userMsg])
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          history: chatHistory,
          context: sessionContext,
        }),
      })

      const data = (await res.json()) as {
        reply?: string
        edit?: EditPayload
        error?: string
      }

      if (!res.ok) throw new Error(data.error ?? 'Chat failed')

      // Detect edit response
      if (data.edit && onEditDetected) {
        onEditDetected(data.edit)
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply ?? '',
        edit: data.edit,
      }
      setChatHistory(prev => [...prev, assistantMsg])
    } catch {
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Request failed. Check your connection and try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, chatHistory, sessionId, sessionContext, onEditDetected])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Panel content ─────────────────────────────────────────────────────────

  const panelContent = (
    <div
      className={cn(
        'flex flex-col bg-white',
        isMobile
          ? 'fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl shadow-2xl z-50 transition-transform duration-300'
          : 'h-full border-l border-slate-200',
        isMobile && !isOpen && 'translate-y-full',
        isMobile && isOpen && 'translate-y-0',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <p className="text-sm font-semibold text-slate-900">Studio Intelligence</p>
        {isMobile && (
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500 italic text-center px-4">
              Ask anything about this session — edits, strategy, or why something
              was built this way.
            </p>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-novax text-white'
                  : 'bg-slate-100 text-slate-800',
              )}
            >
              {msg.content && <p className="leading-relaxed">{msg.content}</p>}
              {msg.edit && onEditDetected && (
                <EditCard
                  edit={msg.edit}
                  onApply={edit => {
                    onEditDetected(edit)
                  }}
                />
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

      {/* Input area */}
      <div className="border-t border-slate-200 p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this session…"
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-novax-border bg-white text-slate-800 placeholder:text-slate-400 resize-none transition-colors"
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-novax hover:bg-novax-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  // ── Mobile: FAB + bottom sheet overlay ──────────────────────────────────────

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Bottom sheet */}
        {panelContent}

        {/* FAB */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-4 flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-full shadow-lg z-50 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
        )}
      </>
    )
  }

  // ── Desktop: inline panel (parent controls layout) ───────────────────────────

  if (!isOpen) return null
  return panelContent
}
