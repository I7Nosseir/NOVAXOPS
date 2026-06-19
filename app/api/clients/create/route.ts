import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCallerProfile } from '@/lib/api-auth'

interface SocialProfile {
  platform: string
  handle: string
  url: string
}

interface CreateClientBody {
  name: string
  industry: string
  primary_color: string
  language: 'en' | 'ar' | 'both'
  dialect?: string
  website?: string
  tone_formal: number
  tone_energy: number
  audience: string
  key_messages: string[]
  platforms: string[]
  competitors?: { handle: string; platform: string }[]
  social_profiles?: SocialProfile[]
  metricool_blog_id?: string
  posts_per_week?: number
}

export async function POST(req: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['admin', 'ceo', 'creative_director', 'account_manager']
  if (!allowed.includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateClientBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name?.trim() || !body.industry) {
    return NextResponse.json({ error: 'name and industry are required' }, { status: 400 })
  }

  const db = createAdminClient()

  // Resolve user's organization_id (multi-tenant isolation)
  const { data: userRow } = await db
    .from('users')
    .select('organization_id')
    .eq('id', caller.id)
    .single()
  const org_id = (userRow as { organization_id: string | null } | null)?.organization_id ?? null

  const initials = body.name.trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const toneDesc = [
    body.tone_formal > 60 ? 'formal' : body.tone_formal < 40 ? 'casual' : 'balanced',
    body.tone_energy > 60 ? 'playful' : body.tone_energy < 40 ? 'serious' : 'measured',
  ].join(', ')

  const { data, error } = await db
    .from('clients')
    .insert({
      name: body.name.trim(),
      initials,
      color: body.primary_color,
      status: 'active',
      organization_id: org_id,
      metricool_blog_id: body.metricool_blog_id || null,
      brand_identity_json: {
        primary_color: body.primary_color,
        secondary_color: '#FFFFFF',
        tone_of_voice: `${toneDesc.charAt(0).toUpperCase() + toneDesc.slice(1)}. ${body.audience}`,
        target_audience: body.audience,
        key_messages: (body.key_messages ?? []).filter(Boolean),
        industry: body.industry,
        language: body.language,
        dialect: body.dialect ?? 'msa',
        website: body.website ?? '',
        platforms: body.platforms,
        posts_per_week: body.posts_per_week ?? 4,
        social_profiles: body.social_profiles ?? [],
      },
      competitor_context_json: (body.competitors ?? []).map(c => `${c.handle} (${c.platform})`),
      reference_links: [],
    })
    .select()
    .single()

  if (error) {
    console.error('[clients/create] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Seed competitor_snapshots (fire-and-forget)
  if (body.competitors && body.competitors.length > 0) {
    void (async () => {
      try {
        await db.from('competitor_snapshots').insert(
          body.competitors!.map(c => ({
            client_id: data.id,
            competitor_handle: c.handle,
            platform: c.platform.toLowerCase(),
            followers: 0,
            avg_er: 0,
            posting_frequency: 0,
            top_content_types: {},
            captured_at: new Date().toISOString(),
          }))
        )
      } catch (err) {
        console.error('[clients/create] competitor_snapshots:', err)
      }
    })()
  }

  return NextResponse.json({ client: data })
}
