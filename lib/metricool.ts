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
  // Public URLs — each is normalized to a Metricool CDN URL before the API call
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

/**
 * Normalizes a public media URL to a Metricool-hosted mediaId.
 *
 * Metricool validates dimensions/duration/MIME type from its own servers, not
 * from raw external URLs. Skipping this step causes the vague "cannot determine
 * media type" errors on carousel and video posts.
 *
 * GET /api/actions/normalize/image/url?url=<encoded_url>
 */
async function normalizeMediaUrl(url: string): Promise<string> {
  const endpoint = `${BASE_ROOT}/api/actions/normalize/image/url?url=${encodeURIComponent(url)}`
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
 * Pass imageUrls[] — each URL is normalized to a Metricool CDN URL, then sent as
 * media: [{ url }, ...]. Always array format, even for single image.
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

  if (imageUrls?.length) {
    // Normalize all URLs in parallel — Metricool hosts the file and returns a cdn URL.
    // Always use array of { url } objects — even for a single image.
    // { mediaId } is wrong; Metricool resolves by URL not by an upload ID.
    const normalizedUrls = await Promise.all(imageUrls.map(normalizeMediaUrl))
    payload.media = normalizedUrls.map(url => ({ url }))
  }

  const networks = (rest.providers as MetricoolProvider[]).map(p => p.network)

  // TikTok requires privacy inside tiktokData — field name confirmed by Metricool's ScheduledPostTikTokData class
  if (networks.includes('tiktok')) {
    payload.tiktokData = { privacyOption: tiktokPrivacy ?? 'PUBLIC_TO_EVERYONE' }
  }

  // Facebook: type:'POST' is required for Metricool to attach images/carousels.
  // Without it Metricool creates a text-only status update and silently drops media.
  if (networks.includes('facebook')) {
    payload.facebookData = { type: 'POST', ...(facebookDataIn ?? {}) }
  }

  // Instagram: type:'POST' is required for image and carousel posts.
  // Without it Metricool cannot build the carousel container and the post fails.
  if (networks.includes('instagram')) {
    payload.instagramData = { type: 'POST', ...(instagramDataIn ?? {}) }
  }

  return mFetch<MetricoolScheduledPost>(`/scheduler/posts?${qs(blogId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
