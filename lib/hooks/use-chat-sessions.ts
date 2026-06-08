'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'novax_chat_sessions_v1'
const MAX_STORED   = 30

export const MAX_MESSAGES  = 40
export const WARN_MESSAGES = 36

export interface StoredMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
  docEdit?: { docId: string; content: string }
}

export interface StoredSession {
  id:            string
  title:         string
  created_at:    string
  updated_at:    string
  messages:      StoredMessage[]
  client_id?:    string
  client_name?:  string
  is_complete?:  boolean
  handoff_block?: string
}

function readAll(): StoredSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession[]) : []
  } catch { return [] }
}

function writeAll(sessions: StoredSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_STORED)))
  } catch { /* storage quota — ignore */ }
}

// Direct reads — callable without a hook (avoids async hydration issues on mount)
export function loadMostRecentSession(): StoredSession | null {
  return readAll().find(s => !s.is_complete && s.messages.length > 0) ?? null
}

export function loadSessionById(id: string): StoredSession | null {
  return readAll().find(s => s.id === id) ?? null
}

// React hook — keeps the history list in sync after mutations
export function useChatSessions() {
  const [sessions, setSessions] = useState<StoredSession[]>([])

  useEffect(() => { setSessions(readAll()) }, [])

  const upsert = useCallback((session: StoredSession) => {
    setSessions(prev => {
      const next = [session, ...prev.filter(s => s.id !== session.id)].slice(0, MAX_STORED)
      writeAll(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      writeAll(next)
      return next
    })
  }, [])

  return { sessions, upsert, remove }
}
