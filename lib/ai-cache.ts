import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AiEntityType = 'client' | 'task' | 'session' | 'post' | 'global'

export interface AiCacheKey {
  entityType: AiEntityType
  entityId: string
  agentType: string
  /** All inputs that affect the output, plus context_version. Hashed internally. */
  inputs: Record<string, unknown>
}

export interface AiCacheResult<T> {
  result: T
  fromCache: boolean
  generatedAt: string
}

function hashInputs(inputs: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(inputs))
    .digest('hex')
    .slice(0, 32) // 32 hex chars is enough
}

/**
 * Check cache first. If hit, return immediately (zero API cost).
 * If miss, call generate(), persist the result, return it.
 * Cache read/write errors are swallowed — the function always returns a result.
 */
export async function getOrGenerate<T>(
  db: SupabaseClient,
  key: AiCacheKey,
  generate: () => Promise<{ result: T; model?: string; tokensUsed?: number }>
): Promise<AiCacheResult<T>> {
  const contextHash = hashInputs(key.inputs)

  // Check cache (non-fatal — errors mean cache miss)
  try {
    const { data: hit } = await db
      .from('ai_generations')
      .select('response_json, response_text, created_at')
      .match({
        entity_type:  key.entityType,
        entity_id:    key.entityId,
        agent_type:   key.agentType,
        context_hash: contextHash,
      })
      .maybeSingle()

    if (hit) {
      const result = (hit.response_json ?? hit.response_text) as T
      return { result, fromCache: true, generatedAt: hit.created_at as string }
    }
  } catch { /* cache miss — proceed to generate */ }

  // Generate
  const { result, model, tokensUsed } = await generate()

  // Persist (non-fatal — persist failure must not fail the request)
  try {
    const isJson = typeof result === 'object' && result !== null
    await db.from('ai_generations').upsert({
      entity_type:   key.entityType,
      entity_id:     key.entityId,
      agent_type:    key.agentType,
      context_hash:  contextHash,
      response_json: isJson ? result : null,
      response_text: isJson ? null : String(result),
      model:         model ?? null,
      tokens_used:   tokensUsed ?? null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'entity_type,entity_id,agent_type,context_hash' })
  } catch { /* non-critical */ }

  return { result, fromCache: false, generatedAt: new Date().toISOString() }
}

/**
 * Fetch the latest saved generation for an entity + agent, regardless of context_hash.
 * Used by the frontend to show the most recent output on page load.
 */
export async function getLatestGeneration<T>(
  db: SupabaseClient,
  entityType: AiEntityType,
  entityId: string,
  agentType: string
): Promise<{ result: T; generatedAt: string; fromCache: true } | null> {
  try {
    const { data } = await db
      .from('ai_generations')
      .select('response_json, response_text, created_at')
      .match({ entity_type: entityType, entity_id: entityId, agent_type: agentType })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    const result = (data.response_json ?? data.response_text) as T
    return { result, generatedAt: data.created_at as string, fromCache: true }
  } catch {
    return null
  }
}
