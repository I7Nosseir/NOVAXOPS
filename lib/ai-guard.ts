import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let cachedEnabled: boolean | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 30_000

async function readAiEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cachedEnabled !== null && now < cacheExpiresAt) return cachedEnabled

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return true // if misconfigured, allow through

    const db = createClient(url, key)
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_enabled')
      .single()

    const enabled = data?.value === true || data?.value === 'true' || data?.value === null
    cachedEnabled = enabled ?? true
    cacheExpiresAt = now + CACHE_TTL_MS
    return cachedEnabled
  } catch {
    return true // fail open so one bad DB read doesn't kill all AI
  }
}

/**
 * Call at the start of every AI route handler.
 * Returns a 503 NextResponse if AI is disabled by the kill switch, otherwise null.
 */
export async function aiGuard(): Promise<NextResponse | null> {
  const enabled = await readAiEnabled()
  if (!enabled) {
    return NextResponse.json(
      { error: 'AI generation is temporarily disabled by the admin. Please try again later.' },
      { status: 503 },
    )
  }
  return null
}

/** Force-clear the in-memory cache (call after toggling the setting). */
export function invalidateAiGuardCache() {
  cachedEnabled = null
  cacheExpiresAt = 0
}
