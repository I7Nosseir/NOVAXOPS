const BASE_ROOT = 'https://app.metricool.com'
const BASE = `${BASE_ROOT}/api/v2`

function requireToken(): string {
  const t = process.env.METRICOOL_API_TOKEN
  if (!t) throw new Error('METRICOOL_API_TOKEN missing — add it to Vercel → Settings → Environment Variables and redeploy.')
  return t
}

function requireUserId(): string {
  const u = process.env.METRICOOL_USER_ID
  if (!u) throw new Error('METRICOOL_USER_ID missing — add it to Vercel → Settings → Environment Variables (value: 4837620) and redeploy.')
  return u
}

function qs(blogId: string | number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    userId: requireUserId(),
    blogId: String(blogId),
    ...extra,
  })
  return params.toString()
}

async function mFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new Error(`Metricool ${res.status} on ${path}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── Network mapping ──────────────────────────────────────────────────────────
// Metricool v2 requires lowercase network names in the providers array
export const PLATFORM_TO_METRICOOL: Record<string, string> = {
  instagram: 'instagram',
  facebook:  'facebook',
  linkedin:  'linkedin',
  tiktok:    'tiktok',
  twitter:   'twitter',
  youtube:   'youtube',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricoolProvider {
  network: string   // "instagram" | "facebook" | "linkedin" | "tiktok" | "twitter" | "youtube"
}

export interface MetricoolScheduledPost {
  id: string
  text: string
  providers: MetricoolProvider[]
  publicationDate: unknown
  status?: string
}

export interface DateTimeInfo {
  dateTime: string   // "YYYY-MM-DDTHH:mm:ss" — no timezone suffix
  timezone: string   // IANA timezone, e.g. "UTC"
}

export type TikTokPrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'

export interface MetricoolScheduleInput {
  blogId: string | number
  text: string
  providers: MetricoolProvider[]
  publicationDate: DateTimeInfo
  // Public URLs — each normalized to a Metricool CDN URL used as the mediaId
  imageUrls?: string[]
  autoPublish?: boolean
  tiktokPrivacy?: TikTokPrivacyLevel
  instagramData?: Record<string, unknown>
  facebookData?: Record<string, unknown>
}

/** Pass-through helper — keeps call sites uniform across all schedule routes. */
export function splitMediaUrls(urls: string[] | undefined): { imageUrls?: string[] } {
  if (!urls?.length) return {}
  return { imageUrls: urls }
}

// All fields optional — Metricool returns different subsets per platform and account.
export interface MetricoolStats {
  reach?: number
  impressions?: number
  engagement_rate?: number
  engagement?: number   // some accounts return "engagement" not "engagement_rate"
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  followers?: number
  clicks?: number
  // per-platform sub-objects (Metricool sometimes nests stats by network)
  instagram?: Partial<MetricoolStats>
  facebook?: Partial<MetricoolStats>
  linkedin?: Partial<MetricoolStats>
  tiktok?: Partial<MetricoolStats>
  twitter?: Partial<MetricoolStats>
}

// ─── Media normalization ──────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm|mkv|m4v|wmv|flv)(\?.*)?$/i.test(url)
}

/**
 * Normalizes a public media URL to a Metricool CDN URL.
 *
 * Uses /normalize/image/url for images and /normalize/video/url for videos.
 * Mixing them causes the "Error validating MP4" / Telephoto JPEG-conversion error
 * on Instagram and Facebook when a video URL is sent to the image endpoint.
 */
async function normalizeMediaUrl(url: string): Promise<string> {
  const type = isVideoUrl(url) ? 'video' : 'image'
  const endpoint = `${BASE_ROOT}/api/actions/normalize/${type}/url?url=${encodeURIComponent(url)}`
  const res = await fetch(endpoint, {
    // No Accept header — the normalize endpoint returns an opaque type (not necessarily JSON).
    // Sending Accept: application/json causes Apache Tomcat to return 406 Not Acceptable.
    headers: {
      'X-Mc-Auth': requireToken(),
    },
  })

  let rawText = ''
  try { rawText = await res.text() } catch { /* ignore */ }

  if (!res.ok) {
    throw new Error(
      `Metricool normalize failed (HTTP ${res.status}) for URL: ${url}\n` +
      `Response body: ${rawText.slice(0, 300)}`
    )
  }

  const contentType = res.headers.get('content-type') ?? ''

  // Response is usually plain text (the normalized URL itself).
  // JSON variant uses "url" or "mediaUrl" — NOT "mediaId".
  if (contentType.includes('application/json')) {
    try {
      const data = JSON.parse(rawText) as Record<string, unknown>
      const mediaUrl = (data.url ?? data.mediaUrl ?? data.mediaId ?? data.id) as string | undefined
      if (mediaUrl) return String(mediaUrl)
    } catch { /* fall through to plain-text path */ }
  }

  // Plain-text path — the trimmed response IS the mediaId/normalized URL.
  // Guard against HTML error pages (e.g. redirect to login) being mistaken for a valid ID.
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error(`Metricool normalize returned empty response for URL: ${url}`)
  }
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Metricool normalize returned HTML instead of a mediaId for URL: ${url}\n` +
      `Check that the API token (METRICOOL_API_TOKEN) is valid and not expired.`
    )
  }
  console.log(`[Metricool] normalize "${url}" → "${trimmed}"`)
  return trimmed
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * List all scheduled/published posts for a blog.
 * GET /api/v2/scheduler/posts?blogId=&userId=
 */
export async function getScheduledPosts(blogId: string | number): Promise<MetricoolScheduledPost[]> {
  const data = await mFetch<{ data: MetricoolScheduledPost[] }>(
    `/scheduler/posts?${qs(blogId)}`
  )
  return data.data ?? []
}

/**
 * Schedule a post to one or more networks.
 * POST /api/v2/scheduler/posts?blogId=&userId=
 *
 * Pass imageUrls[] — each URL is normalized to a Metricool CDN URL (the mediaId).
 * Single image → media: { mediaId }; carousel → media: [{ mediaId }, ...].
 *
 * Platform-specific data is auto-injected:
 *   Facebook  → facebookData: { type: 'POST' }   (required or Metricool drops media)
 *   Instagram → instagramData: { type: 'POST' }  (required or carousel fails entirely)
 *   TikTok    → tiktokData: { privacyOption }
 * Callers can override by passing instagramData/facebookData in the input.
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, imageUrls, tiktokPrivacy, instagramData: instagramDataIn, facebookData: facebookDataIn, ...rest } = input

  const payload: Record<string, unknown> = {
    autoPublish: true,
    ...rest,
  }

  const isCarousel = (imageUrls?.length ?? 0) > 1
  const hasVideo = imageUrls?.some(isVideoUrl) ?? false

  if (imageUrls?.length) {
    // Normalize sequentially — parallel calls can hit Metricool's undocumented rate limit.
    // Each URL is routed to /normalize/image/url or /normalize/video/url as appropriate.
    // Using the image endpoint for a video causes "Error validating MP4" on Instagram/Facebook.
    const mediaIds: string[] = []
    for (const url of imageUrls) {
      mediaIds.push(await normalizeMediaUrl(url))
    }
    // media is a flat array of CDN URL strings — confirmed from Metricool official docs.
    payload.media = mediaIds
  }

  const networks = (rest.providers as MetricoolProvider[]).map(p => p.network)

  // TikTok requires privacy inside tiktokData — field name confirmed by Metricool's ScheduledPostTikTokData class
  if (networks.includes('tiktok')) {
    payload.tiktokData = { privacyOption: tiktokPrivacy ?? 'PUBLIC_TO_EVERYONE' }
  }

  // Facebook: type:'POST' covers images, carousels, and videos.
  if (networks.includes('facebook')) {
    payload.facebookData = { type: 'POST', ...(facebookDataIn ?? {}) }
  }

  // Instagram: type:'POST' covers images and carousels.
  // For video posts, showReel1nFeed:true is required — confirmed from Metricool browser
  // inspector capture (PDF page 14). Without it Instagram's Telephoto system tries to
  // process the video as a JPEG and throws "Error validating MP4".
  if (networks.includes('instagram')) {
    payload.instagramData = {
      type: 'POST',
      ...(hasVideo ? { showReel1nFeed: true } : {}),
      ...(instagramDataIn ?? {}),
    }
  }

  console.log('[Metricool] schedulePost payload:', JSON.stringify(payload, null, 2))

  const res = await fetch(`${BASE}/scheduler/posts?${qs(blogId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
    },
    body: JSON.stringify(payload),
  })

  let rawBody = ''
  try { rawBody = await res.text() } catch { /* ignore */ }
  console.log(`[Metricool] schedulePost response (${res.status}):`, rawBody)

  if (!res.ok) {
    throw new Error(`Metricool ${res.status} on /scheduler/posts: ${rawBody}`)
  }

  try {
    return JSON.parse(rawBody) as MetricoolScheduledPost
  } catch {
    throw new Error(`Metricool returned non-JSON (${res.status}): ${rawBody.slice(0, 300)}`)
  }
}

/**
 * Delete (cancel) a scheduled post.
 * DELETE /api/v2/scheduler/posts/{id}?blogId=&userId=
 *
 * Does NOT use mFetch because DELETE responses are often 204 No Content
 * (empty body), which causes res.json() to throw even on success.
 */
export async function deleteScheduledPost(postId: string, blogId: string | number): Promise<void> {
  const res = await fetch(`${BASE}/scheduler/posts/${postId}?${qs(blogId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
    },
  })
  // 204 No Content = success. 404 = already gone = also fine.
  if (!res.ok && res.status !== 404) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new Error(`Metricool ${res.status} on DELETE post ${postId}: ${body}`)
  }
}

/**
 * Fetch aggregate analytics stats for a blog in a date range.
 *
 * Metricool may return either:
 *   { data: { reach, impressions, ... } }        — flat aggregate
 *   { instagram: { reach, ... }, facebook: { ... } } — per-platform object
 *
 * We normalise to a flat MetricoolStats by summing numeric fields across platforms.
 */
export async function getStats(
  blogId: string | number,
  startDate: string,
  endDate: string
): Promise<MetricoolStats> {
  const raw = await mFetch<Record<string, unknown>>(
    `/analytics/summary?${qs(blogId, { startDate, endDate })}`
  )

  // Flat response: { data: { reach, ... } }
  const flat = raw.data as MetricoolStats | undefined
  if (flat && (flat.reach != null || flat.impressions != null)) return flat

  // Per-platform response: { instagram: { reach, ... }, facebook: { ... }, ... }
  const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']
  const aggregated: MetricoolStats = {}
  const numericKeys: (keyof MetricoolStats)[] = ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves', 'clicks', 'followers']

  for (const platform of PLATFORMS) {
    const p = raw[platform] as Partial<MetricoolStats> | undefined
    if (!p) continue
    for (const key of numericKeys) {
      const val = p[key] as number | undefined
      if (val != null) {
        (aggregated[key] as number) = ((aggregated[key] as number) ?? 0) + val
      }
    }
    // engagement is usually a rate — average instead of sum
    if (p.engagement != null || p.engagement_rate != null) {
      aggregated.engagement_rate = p.engagement_rate ?? p.engagement
    }
  }

  return aggregated
}
