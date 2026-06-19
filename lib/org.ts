import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import type { Organization } from '@/lib/types'

/**
 * Resolve the organization ID for the current request.
 *
 * Strategy:
 * 1. Read x-org-slug from the request headers (stamped by middleware).
 * 2. Look up the org by slug in the organizations table.
 * 3. For custom domains, the slug is the full hostname — look up by branding->>'custom_domain'.
 * 4. Fall back to the NOVAX default org (slug = 'novax') if nothing matches.
 */
export async function getRequestOrgId(): Promise<string | null> {
  const headerList = await headers()
  const slug = headerList.get('x-org-slug') ?? 'novax'

  const supabase = createAdminClient()

  // Try by slug first
  const { data: bySlug } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (bySlug?.id) return bySlug.id

  // If slug looks like a custom domain (contains a dot), try custom domain lookup
  if (slug.includes('.')) {
    const { data: byDomain } = await supabase
      .from('organizations')
      .select('id')
      .eq("branding->>'custom_domain'", slug)
      .single()
    if (byDomain?.id) return byDomain.id
  }

  // Final fallback: the NOVAX default org
  const { data: fallback } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'novax')
    .single()

  return fallback?.id ?? null
}

/**
 * Fetch the full organization record for the current request.
 */
export async function getRequestOrg(): Promise<Organization | null> {
  const headerList = await headers()
  const slug = headerList.get('x-org-slug') ?? 'novax'

  const supabase = createAdminClient()

  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  return (data as Organization) ?? null
}

/**
 * Look up the organization_id for a given user ID.
 * Used in API routes where the auth header gives us the user but not the org.
 */
export async function getOrgIdForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  return (data as { organization_id: string } | null)?.organization_id ?? null
}
