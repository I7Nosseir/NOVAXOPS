'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatPanel } from '@/components/assistant/chat-panel'
import { ChatSidebar } from '@/components/assistant/chat-sidebar'
import { useAssistantChats } from '@/lib/hooks/use-assistant-chats'
import type { AssistantChat } from '@/lib/hooks/use-assistant-chats'

type ChatMessage = AssistantChat['messages'][number]

export default function AssistantPage() {
  const { chats, isLoading, createChat, updateChat, deleteChat } = useAssistantChats()
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  // Once chats load, select the most recent or prompt creation
  useEffect(() => {
    if (isLoading || activeChatId) return
    if (chats.length > 0) {
      setActiveChatId(chats[0].id)
    } else {
      // No chats — create one immediately
      createChat.mutateAsync({}).then(c => setActiveChatId(c.id)).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, chats.length])

  const activeChat = chats.find(c => c.id === activeChatId) ?? null

  const handleNewChat = async () => {
    const chat = await createChat.mutateAsync({})
    setActiveChatId(chat.id)
  }

  const handleDelete = useCallback((id: string) => {
    deleteChat.mutate(id)
    if (activeChatId === id) {
      const next = chats.find(c => c.id !== id)
      if (next) {
        setActiveChatId(next.id)
      } else {
        setActiveChatId(null)
        createChat.mutateAsync({}).then(c => setActiveChatId(c.id)).catch(() => {})
      }
    }
  }, [activeChatId, chats, deleteChat, createChat])

  const handleSave = useCallback((
    chatId: string,
    messages: ChatMessage[],
    title: string,
    clientId?: string,
  ) => {
    updateChat.mutate({
      id: chatId,
      messages,
      title,
      client_id: clientId ?? null,
    })
  }, [updateChat])

  return (
    // Stretch to fill the content area below the fixed header (h-14 = 3.5rem)
    // -m-4 lg:-m-6 undoes the PreviewAwareMain padding so we get edge-to-edge
    <div className="flex -m-4 lg:-m-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <ChatSidebar
        chats={chats}
        isLoading={isLoading}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNew={handleNewChat}
        onDelete={handleDelete}
        isCreating={createChat.isPending}
      />

      <div className="flex-1 min-w-0 p-4 lg:p-6">
        {activeChatId ? (
          <ChatPanel
            key={activeChatId}
            open={true}
            onClose={() => {}}
            fullPage={true}
            hasSidebar={true}
            chatId={activeChatId}
            initialMessages={activeChat?.messages}
            initialClientId={activeChat?.client_id ?? undefined}
            onSave={handleSave}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        )}
      </div>
    </div>
  )
}
