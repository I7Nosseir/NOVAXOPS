import { NextRequest, NextResponse } from 'next/server'

const HAS_DB    = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const APIFY_KEY = process.env.APIFY_API_KEY ?? ''
const YT_KEY    = process.env.YOUTUBE_API_KEY ?? ''

interface ScrapedMetrics {
  followers: number
  avg_er: number
  posting_frequency: number
  top_content_types: Record<string, number>
}

// ── Instagram ──────────────────────────────────────────────────────────────────
async function scrapeInstagram(handle: string): Promise<ScrapedMetrics> {
  const username = handle.replace('@', '')
  const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=60&memory=256`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], resultsType: 'details', resultsLimit: 1 }),
  })
  if (!res.ok) throw new Error(`Apify Instagram HTTP ${res.status}`)

  const items = await res.json() as Array<{
    followersCount?: number
    latestPosts?: Array<{
      likesCount?: number
      commentsCount?: number
      timestamp?: string
      type?: string
    }>
  }>

  const item = items[0]
  if (!item) throw new Error('No Instagram data returned')

  const followers = item.followersCount ?? 0
  const posts = item.latestPosts ?? []

  // ER = avg (likes + comments) / followers × 100 across last N posts
  let avg_er = 0
  if (followers > 0 && posts.length > 0) {
    const totalEng = posts.reduce((sum, p) => sum + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0)
    avg_er = parseFloat(((totalEng / posts.length / followers) * 100).toFixed(2))
  }

  // Posting frequency — posts per week from timestamps in the last 30 days
  let posting_frequency = 0
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const recentPosts = posts.filter(p => p.timestamp && new Date(p.timestamp).getTime() > thirtyDaysAgo)
  if (recentPosts.length > 0) {
    posting_frequency = parseFloat((recentPosts.length / 4.3).toFixed(1)) // 4.3 weeks per month
  }

  // Content type breakdown
  const top_content_types: Record<string, number> = {}
  for (const p of posts) {
    const t = (p.type ?? 'post').toLowerCase()
    top_content_types[t] = (top_content_types[t] ?? 0) + 1
  }

  return { followers, avg_er, posting_frequency, top_content_types }
}

// ── TikTok ─────────────────────────────────────────────────────────────────────
async function scrapeTikTok(handle: string): Promise<ScrapedMetrics> {
  const username = handle.replace('@', '')
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=60&memory=256`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles: [username], profilesPerPage: 1 }),
  })
  if (!res.ok) throw new Error(`Apify TikTok HTTP ${res.status}`)

  const items = await res.json() as Array<{
    stats?: {
      followerCount?: number
      heartCount?: number
      videoCount?: number
    }
    videos?: Array<{
      diggCount?: number
      commentCount?: number
      shareCount?: number
      playCount?: number
      createTime?: number
    }>
  }>

  const item = items[0]
  if (!item) throw new Error('No TikTok data returned')

  const followers = item.stats?.followerCount ?? 0
  const videos = item.videos ?? []

  // ER for TikTok = avg (likes + comments + shares) / followers × 100
  let avg_er = 0
  if (followers > 0 && videos.length > 0) {
    const totalEng = videos.reduce((sum, v) =>
      sum + (v.diggCount ?? 0) + (v.commentCount ?? 0) + (v.shareCount ?? 0), 0
    )
    avg_er = parseFloat(((totalEng / videos.length / followers) * 100).toFixed(2))
  }

  // Posting frequency — videos per week from last 30 days
  let posting_frequency = 0
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const recentVids = videos.filter(v => v.createTime && v.createTime * 1000 > thirtyDaysAgo)
  if (recentVids.length > 0) {
    posting_frequency = parseFloat((recentVids.length / 4.3).toFixed(1))
  }

  return {
    followers,
    avg_er,
    posting_frequency,
    top_content_types: { video: videos.length },
  }
}

// ── YouTube ────────────────────────────────────────────────────────────────────
async function scrapeYouTube(handle: string): Promise<ScrapedMetrics> {
  // handle may be a @username, channel name, or channel ID
  const query = handle.replace('@', '')

  // Search for channel by handle/name
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${YT_KEY}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) throw new Error(`YouTube search HTTP ${searchRes.status}`)
  const searchData = await searchRes.json() as { items?: Array<{ id?: { channelId?: string } }> }
  const channelId = searchData.items?.[0]?.id?.channelId
  if (!channelId) throw new Error('YouTube channel not found')

  // Get channel statistics
  const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${YT_KEY}`
  const statsRes = await fetch(statsUrl)
  if (!statsRes.ok) throw new Error(`YouTube stats HTTP ${statsRes.status}`)
  const statsData = await statsRes.json() as {
    items?: Array<{
      statistics?: {
        subscriberCount?: string
        viewCount?: string
        videoCount?: string
      }
      contentDetails?: {
        relatedPlaylists?: { uploads?: string }
      }
    }>
  }

  const channel = statsData.items?.[0]
  const followers = parseInt(channel?.statistics?.subscriberCount ?? '0', 10)
  const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads

  // Get recent videos to calculate avg views (proxy for ER on YouTube)
  let avg_er = 0
  let posting_frequency = 0

  if (uploadsPlaylist) {
    const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylist}&maxResults=20&key=${YT_KEY}`
    const videosRes = await fetch(videosUrl)
    if (videosRes.ok) {
      const videosData = await videosRes.json() as {
        items?: Array<{ contentDetails?: { videoPublishedAt?: string; videoId?: string } }>
      }
      const recentItems = videosData.items ?? []

      // Posting frequency from publish dates
      const now = Date.now()
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
      const recentVids = recentItems.filter(v => {
        const pub = v.contentDetails?.videoPublishedAt
        return pub && new Date(pub).getTime() > thirtyDaysAgo
      })
      if (recentVids.length > 0) {
        posting_frequency = parseFloat((recentVids.length / 4.3).toFixed(1))
      }

      // Get video stats for ER approximation (views / subscribers × 100)
      const videoIds = recentItems.slice(0, 10).map(v => v.contentDetails?.videoId).filter(Boolean).join(',')
      if (videoIds && followers > 0) {
        const vidStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YT_KEY}`
        const vidStatsRes = await fetch(vidStatsUrl)
        if (vidStatsRes.ok) {
          const vidStats = await vidStatsRes.json() as {
            items?: Array<{ statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }>
          }
          const vidItems = vidStats.items ?? []
          if (vidItems.length > 0) {
            const totalViews = vidItems.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount ?? '0', 10), 0)
            avg_er = parseFloat(((totalViews / vidItems.length / followers) * 100).toFixed(2))
          }
        }
      }
    }
  }

  return {
    followers,
    avg_er,
    posting_frequency,
    top_content_types: { video: 100 },
  }
}

/**
 * POST /api/competitors/scrape
 * Body: { client_id, handle, platform }
 *
 * Platforms supported:
 *   instagram — Apify (followers + ER from latestPosts + posting freq)
 *   tiktok    — Apify (followers + ER from videos + posting freq)
 *   youtube   — YouTube Data API (subscribers + view-based ER + posting freq)
 *   facebook, linkedin, twitter — saves zeros (no unauthenticated API available)
 *
 * Always saves to competitor_snapshots even if scraping fails (graceful fallback).
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
    if (p === 'instagram' && APIFY_KEY) {
      metrics = await scrapeInstagram(handle)
      scraped = true
    } else if (p === 'tiktok' && APIFY_KEY) {
      metrics = await scrapeTikTok(handle)
      scraped = true
    } else if (p === 'youtube' && YT_KEY) {
      metrics = await scrapeYouTube(handle)
      scraped = true
    }
    // facebook, linkedin, twitter: no unauthenticated API — leaves metrics at 0
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
