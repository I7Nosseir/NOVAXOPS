import { NextRequest, NextResponse } from 'next/server'
import { fetchInstagramProfile } from '@/lib/data-providers/instagram'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const YT_KEY = process.env.YOUTUBE_API_KEY ?? ''

interface ScrapedMetrics {
  followers: number
  avg_er: number
  posting_frequency: number
  top_content_types: Record<string, number>
}

// ── Instagram ─────────────────────────────────────────────────────────────────
// Direct Instagram Mobile API via fetchInstagramProfile() — no Apify needed.
async function scrapeInstagram(handle: string): Promise<ScrapedMetrics> {
  const profile = await fetchInstagramProfile(handle)
  if (!profile) throw new Error(`Instagram profile not found for @${handle}`)
  return {
    followers:         profile.followers,
    avg_er:            profile.avgEngagementRate,
    posting_frequency: profile.postingFreqPerWeek,
    top_content_types: profile.topContentTypes,
  }
}

// ── TikTok ────────────────────────────────────────────────────────────────────
// TikTok's public web API — same endpoint their web app uses. No auth required.
async function scrapeTikTok(handle: string): Promise<ScrapedMetrics> {
  const username = handle.replace('@', '').trim()
  const url = `https://www.tiktok.com/api/user/detail/?aid=1988&app_name=tiktok_web&device_platform=web_pc&uniqueId=${encodeURIComponent(username)}&cookie_enabled=1&screen_width=1920&screen_height=1080&os=windows`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`TikTok API HTTP ${res.status}`)

  const data = await res.json() as {
    userInfo?: {
      stats?: {
        followerCount?: number
        heartCount?: number
        videoCount?: number
      }
    }
  }

  const stats     = data.userInfo?.stats
  const followers = stats?.followerCount ?? 0
  const videos    = stats?.videoCount    ?? 0
  const hearts    = stats?.heartCount    ?? 0

  const avgHearts = videos > 0 && hearts > 0 ? Math.round(hearts / videos) : 0
  const avg_er    = followers > 0 && avgHearts > 0
    ? parseFloat(((avgHearts / followers) * 100).toFixed(2))
    : 0

  return {
    followers,
    avg_er,
    posting_frequency: 0,
    top_content_types: { video: videos },
  }
}

// ── YouTube ───────────────────────────────────────────────────────────────────
// YouTube Data API v3 — free, 10,000 units/day.
async function scrapeYouTube(handle: string): Promise<ScrapedMetrics> {
  const query = handle.replace('@', '')

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${YT_KEY}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) throw new Error(`YouTube search HTTP ${searchRes.status}`)
  const searchData = await searchRes.json() as { items?: Array<{ id?: { channelId?: string } }> }
  const channelId = searchData.items?.[0]?.id?.channelId
  if (!channelId) throw new Error('YouTube channel not found')

  const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${YT_KEY}`
  const statsRes = await fetch(statsUrl)
  if (!statsRes.ok) throw new Error(`YouTube stats HTTP ${statsRes.status}`)
  const statsData = await statsRes.json() as {
    items?: Array<{
      statistics?: { subscriberCount?: string }
      contentDetails?: { relatedPlaylists?: { uploads?: string } }
    }>
  }

  const channel = statsData.items?.[0]
  const followers = parseInt(channel?.statistics?.subscriberCount ?? '0', 10)
  const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads

  let avg_er = 0
  let posting_frequency = 0

  if (uploadsPlaylist && followers > 0) {
    const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylist}&maxResults=20&key=${YT_KEY}`
    const videosRes = await fetch(videosUrl)
    if (videosRes.ok) {
      const videosData = await videosRes.json() as {
        items?: Array<{ contentDetails?: { videoPublishedAt?: string; videoId?: string } }>
      }
      const recentItems = videosData.items ?? []

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const recent = recentItems.filter(v => {
        const pub = v.contentDetails?.videoPublishedAt
        return pub && new Date(pub).getTime() > thirtyDaysAgo
      })
      if (recent.length > 0) posting_frequency = parseFloat((recent.length / 4.3).toFixed(1))

      const videoIds = recentItems.slice(0, 10).map(v => v.contentDetails?.videoId).filter(Boolean).join(',')
      if (videoIds) {
        const vidStatsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YT_KEY}`)
        if (vidStatsRes.ok) {
          const vs = await vidStatsRes.json() as { items?: Array<{ statistics?: { viewCount?: string } }> }
          const items = vs.items ?? []
          if (items.length > 0) {
            const totalViews = items.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount ?? '0', 10), 0)
            avg_er = parseFloat(((totalViews / items.length / followers) * 100).toFixed(2))
          }
        }
      }
    }
  }

  return { followers, avg_er, posting_frequency, top_content_types: { video: 100 } }
}

/**
 * POST /api/competitors/scrape
 * Body: { client_id, handle, platform }
 *
 * Platforms:
 *   instagram — Direct Instagram Mobile API (no Apify, no key needed beyond optional session cookie)
 *   tiktok    — Direct TikTok web API (no API key required)
 *   youtube   — YouTube Data API v3 (YOUTUBE_API_KEY)
 *   facebook, linkedin, twitter — saves zeros (no unauthenticated API available)
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; handle?: string; platform?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, handle, platform } = body
  if (!client_id || !handle || !platform) {
    return NextResponse.json({ error: 'client_id, handle, platform required' }, { status: 400 })
  }
  if (!HAS_DB) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let metrics: ScrapedMetrics = { followers: 0, avg_er: 0, posting_frequency: 0, top_content_types: {} }
  let scraped = false
  let scrapeError: string | null = null

  const p = platform.toLowerCase()

  try {
    if (p === 'instagram') {
      metrics = await scrapeInstagram(handle)
      scraped = true
    } else if (p === 'tiktok') {
      metrics = await scrapeTikTok(handle)
      scraped = true
    } else if (p === 'youtube' && YT_KEY) {
      metrics = await scrapeYouTube(handle)
      scraped = true
    }
  } catch (err) {
    scrapeError = err instanceof Error ? err.message : 'Scrape failed'
    console.error(`[competitors/scrape] ${p} error for ${handle}:`, scrapeError)
  }

  const { error } = await supabase
    .from('competitor_snapshots')
    .upsert({
      client_id,
      competitor_handle: handle,
      platform: p,
      followers: metrics.followers,
      avg_er: metrics.avg_er,
      posting_frequency: metrics.posting_frequency,
      top_content_types: metrics.top_content_types,
      captured_at: new Date().toISOString(),
    }, { onConflict: 'client_id,competitor_handle,platform' })

  if (error) {
    console.error('[competitors/scrape] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    saved: true,
    scraped,
    platform: p,
    metrics: scraped ? metrics : null,
    ...(scrapeError ? { scrape_error: scrapeError } : {}),
  })
}
