// Shared server-side auth helpers for API routes.
// Import in any route that uses createAdminClient() to protect it.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface CallerProfile {
  id:   string
  role: string
}

/** Returns the authenticated caller's profile, or null if not logged in. */
export async function getCallerProfile(): Promise<CallerProfile | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Use service-role client so RLS on users table never blocks profile lookup
    const { createAdminClient } = await import('@/lib/supabase')
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single()

    return profile ?? null
  } catch {
    return null
  }
}

/**
 * Require authentication. Returns { error: NextResponse } if not authenticated,
 * or { caller: CallerProfile } if the user is authenticated.
 */
export async function requireAuth(): Promise<
  { error: NextResponse } | { caller: CallerProfile }
> {
  const caller = await getCallerProfile()
  if (!caller) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { caller }
}

/**
 * Resolve an organization_id for use in DB inserts.
 * Tries client first, then user record, then falls back to the NOVAX founding org.
 * Never throws — returns null only if every lookup fails (caller should treat as fatal).
 */
export async function resolveOrgId(opts: {
  clientId?: string | null
  userId?: string | null
} = {}): Promise<string | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase')
    const db = createAdminClient()

    if (opts.clientId) {
      const { data } = await db
        .from('clients')
        .select('organization_id')
        .eq('id', opts.clientId)
        .single()
      const orgId = (data as Record<string, unknown> | null)?.organization_id as string | null
      if (orgId) return orgId
    }

    if (opts.userId) {
      const { data } = await db
        .from('users')
        .select('organization_id')
        .eq('id', opts.userId)
        .single()
      const orgId = (data as Record<string, unknown> | null)?.organization_id as string | null
      if (orgId) return orgId
    }

    // Last resort: NOVAX founding org
    const { data: org } = await db
      .from('organizations')
      .select('id')
      .eq('slug', 'novax')
      .single()
    return (org as Record<string, unknown> | null)?.id as string | null
  } catch {
    return null
  }
}

/**
 * Require authentication AND one of the listed roles.
 * Returns { error: NextResponse } if auth fails or role not permitted.
 */
export async function requireRole(
  allowedRoles: string[],
): Promise<{ error: NextResponse } | { caller: CallerProfile }> {
  const result = await requireAuth()
  if ('error' in result) return result
  if (!allowedRoles.includes(result.caller.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}
