'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export interface AssistantChat {
  id: string
  user_id: string
  title: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; docEdit?: { docId: string; content: string } }>
  client_id: string | null
  created_at: string
  updated_at: string
}

const QUERY_KEY = (userId: string) => ['assistant-chats', userId]

export function useAssistantChats() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const qk = user?.id ? QUERY_KEY(user.id) : ['assistant-chats-none']

  const { data: chats = [], isLoading } = useQuery<AssistantChat[]>({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_chats')
        .select('id, title, client_id, messages, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AssistantChat[]
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  })

  const createChat = useMutation({
    mutationFn: async (params?: { title?: string; client_id?: string }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('assistant_chats')
        .insert({
          user_id: user.id,
          title: params?.title ?? 'New Chat',
          messages: [],
          client_id: params?.client_id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as AssistantChat
    },
    onSuccess: (newChat) => {
      queryClient.setQueryData<AssistantChat[]>(qk, prev =>
        [newChat, ...(prev ?? [])]
      )
    },
  })

  const updateChat = useMutation({
    mutationFn: async ({
      id,
      messages,
      title,
      client_id,
    }: {
      id: string
      messages?: AssistantChat['messages']
      title?: string
      client_id?: string | null
    }) => {
      const updates: Record<string, unknown> = {}
      if (messages !== undefined) updates.messages = messages
      if (title !== undefined) updates.title = title
      if (client_id !== undefined) updates.client_id = client_id
      const { error } = await supabase
        .from('assistant_chats')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<AssistantChat[]>(qk, prev =>
        (prev ?? []).map(c =>
          c.id === variables.id
            ? { ...c, ...variables, updated_at: new Date().toISOString() }
            : c
        )
      )
    },
  })

  const deleteChat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assistant_chats')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<AssistantChat[]>(qk, prev =>
        (prev ?? []).filter(c => c.id !== deletedId)
      )
    },
  })

  return {
    chats,
    isLoading,
    createChat,
    updateChat,
    deleteChat,
  }
}
