import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getCallerProfile } from '@/lib/api-auth'
import { scrapeProfile } from '@/lib/social-scraper'

interface SocialProfile {
  platform: string
  handle: string
  url: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await params

  let body: { profiles: SocialProfile[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profiles = body.profiles ?? []
  if (profiles.length === 0) {
    return NextResponse.json({ scraped: 0 })
  }

  const db = createAdminClient()

  // Scrape all profiles in parallel
  const results = await Promise.allSettled(
    profiles.map(async (p) => {
      const { metrics, scraped, error } = await scrapeProfile(p.handle, p.platform)
      return { platform: p.platform, handle: p.handle, metrics, scraped, error }
    })
  )

  // Build the own_profile_metrics map: platform → metrics
  const own_profile_metrics: Record<string, {
    handle: string
    followers: number
    avg_er: number
    posting_frequency: number
    top_content_types: Record<string, number>
    scraped_at: string
  }> = {}

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { platform, handle, metrics, scraped } = r.value
      if (scraped) {
        own_profile_metrics[platform.toLowerCase()] = {
          handle,
          ...metrics,
          scraped_at: new Date().toISOString(),
        }
      }
    }
  }

  if (Object.keys(own_profile_metrics).length > 0) {
    // Fetch current brand_identity_json and merge
    const { data: current } = await db
      .from('clients')
      .select('brand_identity_json')
      .eq('id', clientId)
      .single()

    const existing = (current?.brand_identity_json as Record<string, unknown>) ?? {}
    await db
      .from('clients')
      .update({
        brand_identity_json: {
          ...existing,
          own_profile_metrics,
        },
      })
      .eq('id', clientId)
  }

  const scraped = results.filter(r => r.status === 'fulfilled' && r.value.scraped).length
  return NextResponse.json({ scraped, platforms: Object.keys(own_profile_metrics) })
}
