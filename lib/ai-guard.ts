import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Kill-switch cache ─────────────────────────────────────────────────────────
let cachedEnabled: boolean | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 30_000

async function readAiEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cachedEnabled !== null && now < cacheExpiresAt) return cachedEnabled

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return true

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

// ── Rate limiter (10 requests / user-IP / minute) ─────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

/**
 * Call at the start of every AI route handler.
 * - Returns a 503 if AI is globally disabled by the admin kill switch.
 * - Returns a 429 if the caller has exceeded the per-minute rate limit (when req is passed).
 * - Returns null when the request should proceed.
 */
export async function aiGuard(req?: NextRequest): Promise<NextResponse | null> {
  const enabled = await readAiEnabled()
  if (!enabled) {
    return NextResponse.json(
      { error: 'AI generation is temporarily disabled by the admin. Please try again later.' },
      { status: 503 },
    )
  }

  if (req) {
    const ip = getClientIp(req)
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded — max 10 AI requests per minute.' },
        { status: 429 },
      )
    }
  }

  return null
}

/** Force-clear the in-memory cache (call after toggling the setting). */
export function invalidateAiGuardCache() {
  cachedEnabled = null
  cacheExpiresAt = 0
}
