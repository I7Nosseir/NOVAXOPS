// ============================================================
// Studio Session Store — In-Memory Mock Store
// Module-level Map so both session routes share state within
// a single server process (mock / dev mode only).
// ============================================================

import type { StudioSession } from './studio-types'
import { randomBytes } from 'crypto'

const sessionStore = new Map<string, StudioSession>()

// ─── Helpers ─────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function newId(): string {
  return randomBytes(12).toString('hex')
}

// ─── CRUD ─────────────────────────────────────────────────────

export function createMockSession(data: Partial<StudioSession>): StudioSession {
  const id = data.id ?? newId()
  const ts = now()

  const session: StudioSession = {
    id,
    name: data.name ?? 'Untitled Session',
    client_id: data.client_id ?? null,
    tool: data.tool ?? 'content',
    created_by: data.created_by ?? null,
    status: data.status ?? 'running',
    brief: data.brief ?? null,
    inputs: data.inputs ?? {},
    outputs: data.outputs ?? {},
    executive_summary: data.executive_summary ?? null,
    boss_brief: data.boss_brief ?? null,
    structured_answers: data.structured_answers ?? {},
    chat_history: data.chat_history ?? [],
    edit_history: data.edit_history ?? [],
    signal_report_used: data.signal_report_used ?? null,
    metricool_snapshot: data.metricool_snapshot ?? null,
    performance: data.performance ?? null,
    performance_verdict: data.performance_verdict ?? null,
    created_at: data.created_at ?? ts,
    updated_at: data.updated_at ?? ts,
  }

  sessionStore.set(id, session)
  return session
}

export function getMockSession(id: string): StudioSession | undefined {
  return sessionStore.get(id)
}

export function updateMockSession(
  id: string,
  updates: Partial<StudioSession>,
): StudioSession | null {
  const existing = sessionStore.get(id)
  if (!existing) return null

  const updated: StudioSession = {
    ...existing,
    ...updates,
    // Never overwrite id or created_at
    id: existing.id,
    created_at: existing.created_at,
    updated_at: now(),
    // Deep-merge outputs so phase saves accumulate
    outputs:
      updates.outputs !== undefined
        ? { ...existing.outputs, ...updates.outputs }
        : existing.outputs,
  }

  sessionStore.set(id, updated)
  return updated
}

export function listMockSessions(filters?: {
  tool?: string
  client_id?: string
  created_by?: string
}): StudioSession[] {
  let sessions = Array.from(sessionStore.values())

  if (filters?.tool) {
    sessions = sessions.filter((s) => s.tool === filters.tool)
  }
  if (filters?.client_id) {
    sessions = sessions.filter((s) => s.client_id === filters.client_id)
  }
  if (filters?.created_by) {
    sessions = sessions.filter((s) => s.created_by === filters.created_by)
  }

  // Most recently updated first
  return sessions.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export function deleteMockSession(id: string): boolean {
  return sessionStore.delete(id)
}
