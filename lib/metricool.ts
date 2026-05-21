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
  // Public URLs — normalized to Metricool mediaIds before the API call
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

export interface MetricoolStats {
  reach: number
  impressions: number
  engagement_rate: number
  likes: number
  comments: number
  shares: number
  saves: number
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
    headers: {
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
    },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new Error(`Metricool media normalize failed (${res.status}): ${body}. URL was: ${url}`)
  }
  const data = await res.json() as Record<string, unknown>
  // Response field may be "mediaId" or "id" depending on API version
  const mediaId = (data.mediaId ?? data.id) as string | undefined
  if (!mediaId) {
    throw new Error(`Metricool normalize returned no mediaId. Response: ${JSON.stringify(data)}`)
  }
  return mediaId
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
 * Pass imageUrls[] — each URL is normalized to a Metricool mediaId before the
 * payload is sent. Single image → media: { mediaId }; carousel → media: [{ mediaId }].
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, imageUrls, tiktokPrivacy, ...rest } = input

  const payload: Record<string, unknown> = {
    autoPublish: true,
    ...rest,
  }

  if (imageUrls?.length) {
    // Normalize all URLs in parallel — Metricool requires mediaIds, not raw URLs.
    // Raw URLs cause "cannot determine media type/dimensions" errors on carousels.
    const mediaIds = await Promise.all(imageUrls.map(normalizeMediaUrl))
    // Single image → object; carousel (2+) → array of objects
    payload.media = mediaIds.length === 1
      ? { mediaId: mediaIds[0] }
      : mediaIds.map(id => ({ mediaId: id }))
  }

  // TikTok requires privacy inside tiktokData — field name confirmed by Metricool's ScheduledPostTikTokData class
  const hasTikTok = (rest.providers as MetricoolProvider[]).some(p => p.network === 'tiktok')
  if (hasTikTok) {
    payload.tiktokData = { privacyOption: tiktokPrivacy ?? 'PUBLIC_TO_EVERYONE' }
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
 * Fetch analytics stats for a blog in a date range.
 */
export async function getStats(
  blogId: string | number,
  startDate: string,
  endDate: string
): Promise<MetricoolStats> {
  const data = await mFetch<{ data: MetricoolStats }>(
    `/analytics/summary?${qs(blogId, { startDate, endDate })}`
  )
  return data.data
}
