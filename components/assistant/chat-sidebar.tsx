'use client'

import { useState } from 'react'
import { Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClients } from '@/lib/hooks/use-clients'
import type { AssistantChat } from '@/lib/hooks/use-assistant-chats'
import { formatDistanceToNow } from 'date-fns'

interface ChatSidebarProps {
  chats: AssistantChat[]
  isLoading: boolean
  activeChatId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  isCreating?: boolean
}

export function ChatSidebar({
  chats,
  isLoading,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
  isCreating,
}: ChatSidebarProps) {
  const { clients } = useClients()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null
    return clients.find(c => c.id === clientId)?.name ?? null
  }

  return (
    <div className="w-60 shrink-0 flex flex-col border-r border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-[#0a0e0d] h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-white/8 shrink-0">
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Chats</span>
        <button
          onClick={onNew}
          disabled={isCreating}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-novax text-white text-[11px] font-semibold hover:bg-novax-hover transition-colors disabled:opacity-50"
          title="New chat"
        >
          {isCreating
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Plus className="w-3 h-3" />}
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <MessageSquare className="w-6 h-6 text-slate-300" />
            <p className="text-xs text-slate-400">No chats yet</p>
            <p className="text-[10px] text-slate-300">Click New to start</p>
          </div>
        ) : (
          chats.map(chat => {
            const isActive = chat.id === activeChatId
            const clientName = getClientName(chat.client_id)
            const lastUpdated = formatDistanceToNow(new Date(chat.updated_at), { addSuffix: true })

            return (
              <div
                key={chat.id}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  'group relative flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-white/4 last:border-0',
                  isActive
                    ? 'bg-white dark:bg-white/6 border-l-2 border-l-novax-accent'
                    : 'hover:bg-white dark:hover:bg-white/4 border-l-2 border-l-transparent',
                )}
                onClick={() => onSelect(chat.id)}
              >
                <div className="flex-1 min-w-0 pr-5">
                  <p className={cn(
                    'text-xs font-medium truncate leading-snug',
                    isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300',
                  )}>
                    {chat.title === 'New Chat' && chat.messages.length === 0
                      ? 'New Chat'
                      : chat.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {clientName && (
                      <span className="text-[10px] text-novax-muted font-medium truncate max-w-[80px]">
                        {clientName}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{lastUpdated}</span>
                  </div>
                  {chat.messages.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Delete — shown on hover */}
                {hoveredId === chat.id && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(chat.id) }}
                    className="absolute right-2 top-2.5 p-1 rounded-md text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
