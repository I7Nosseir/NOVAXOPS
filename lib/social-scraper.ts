// Shared social media scraping utilities — used by competitor and own-profile scrapers.

import { fetchInstagramProfile } from '@/lib/data-providers/instagram'

export interface ScrapedMetrics {
  followers: number
  avg_er: number
  posting_frequency: number
  top_content_types: Record<string, number>
}

/**
 * Scrape public metrics for a given social media handle + platform.
 * Returns zeroed metrics (not null) on failure so callers can always upsert.
 */
export async function scrapeProfile(
  handle: string,
  platform: string,
): Promise<{ metrics: ScrapedMetrics; scraped: boolean; error?: string }> {
  const p = platform.toLowerCase()

  try {
    if (p === 'instagram') {
      const metrics = await scrapeInstagram(handle)
      return { metrics, scraped: true }
    }
    if (p === 'tiktok') {
      const metrics = await scrapeTikTok(handle)
      return { metrics, scraped: true }
    }
    if (p === 'youtube' && process.env.YOUTUBE_API_KEY) {
      const metrics = await scrapeYouTube(handle)
      return { metrics, scraped: true }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape failed'
    console.error(`[social-scraper] ${p} error for ${handle}:`, message)
    return { metrics: empty(), scraped: false, error: message }
  }

  return { metrics: empty(), scraped: false }
}

function empty(): ScrapedMetrics {
  return { followers: 0, avg_er: 0, posting_frequency: 0, top_content_types: {} }
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function scrapeInstagram(handle: string): Promise<ScrapedMetrics> {
  const profile = await fetchInstagramProfile(handle)
  if (!profile) throw new Error(`Instagram profile not found for ${handle}`)
  return {
    followers:         profile.followers,
    avg_er:            profile.avgEngagementRate,
    posting_frequency: profile.postingFreqPerWeek,
    top_content_types: profile.topContentTypes,
  }
}

// ── TikTok ────────────────────────────────────────────────────────────────────

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
      stats?: { followerCount?: number; heartCount?: number; videoCount?: number }
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

async function scrapeYouTube(handle: string): Promise<ScrapedMetrics> {
  const key   = process.env.YOUTUBE_API_KEY!
  const query = handle.replace('@', '')

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`
  )
  if (!searchRes.ok) throw new Error(`YouTube search HTTP ${searchRes.status}`)
  const searchData = await searchRes.json() as { items?: Array<{ id?: { channelId?: string } }> }
  const channelId  = searchData.items?.[0]?.id?.channelId
  if (!channelId) throw new Error('YouTube channel not found')

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${key}`
  )
  if (!statsRes.ok) throw new Error(`YouTube stats HTTP ${statsRes.status}`)
  const statsData = await statsRes.json() as {
    items?: Array<{
      statistics?: { subscriberCount?: string }
      contentDetails?: { relatedPlaylists?: { uploads?: string } }
    }>
  }

  const channel        = statsData.items?.[0]
  const followers      = parseInt(channel?.statistics?.subscriberCount ?? '0', 10)
  const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads
  let avg_er = 0, posting_frequency = 0

  if (uploadsPlaylist && followers > 0) {
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylist}&maxResults=20&key=${key}`
    )
    if (videosRes.ok) {
      const videosData = await videosRes.json() as {
        items?: Array<{ contentDetails?: { videoPublishedAt?: string; videoId?: string } }>
      }
      const items = videosData.items ?? []
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const recent = items.filter(v => {
        const pub = v.contentDetails?.videoPublishedAt
        return pub && new Date(pub).getTime() > thirtyDaysAgo
      })
      if (recent.length > 0) posting_frequency = parseFloat((recent.length / 4.3).toFixed(1))

      const videoIds = items.slice(0, 10)
        .map(v => v.contentDetails?.videoId)
        .filter(Boolean)
        .join(',')
      if (videoIds) {
        const vidRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${key}`
        )
        if (vidRes.ok) {
          const vs = await vidRes.json() as { items?: Array<{ statistics?: { viewCount?: string } }> }
          const vItems = vs.items ?? []
          if (vItems.length > 0) {
            const totalViews = vItems.reduce((s, v) => s + parseInt(v.statistics?.viewCount ?? '0', 10), 0)
            avg_er = parseFloat(((totalViews / vItems.length / followers) * 100).toFixed(2))
          }
        }
      }
    }
  }

  return { followers, avg_er, posting_frequency, top_content_types: { video: 100 } }
}
