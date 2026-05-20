const BASE = 'https://app.metricool.com/api/v2'

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
  // Images / carousels → sent as media: [url, url, ...]
  imageUrls?: string[]
  // Video → sent as videoUrl: "url" (mutually exclusive with imageUrls)
  videoUrl?: string
  autoPublish?: boolean
  // TikTok requires a privacy level; defaults to PUBLIC_TO_EVERYONE when TikTok is in providers
  tiktokPrivacy?: TikTokPrivacyLevel
}

const VIDEO_RE = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i

/** Splits a flat URL list into { imageUrls, videoUrl } for Metricool's distinct fields. */
export function splitMediaUrls(urls: string[] | undefined): { imageUrls?: string[]; videoUrl?: string } {
  if (!urls?.length) return {}
  const videos = urls.filter(u => VIDEO_RE.test(u))
  const images = urls.filter(u => !VIDEO_RE.test(u))
  return {
    videoUrl: videos[0],
    imageUrls: images.length ? images : undefined,
  }
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
 * Confirmed payload shape:
 *   text            string
 *   providers       [{ network: "instagram" }]  — lowercase
 *   publicationDate { date: "YYYY-MM-DD", time: "HH:mm" }
 *   media?          string[]  — array of public image URLs (omit if no media)
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, imageUrls, videoUrl, tiktokPrivacy, ...rest } = input

  const payload: Record<string, unknown> = {
    autoPublish: true,
    ...rest,
  }

  // Images (including carousels) → media array
  if (imageUrls?.length) payload.media = imageUrls
  // Video → separate videoUrl field; Metricool rejects videos in the media (image) array
  if (videoUrl) payload.videoUrl = videoUrl

  // TikTok requires privacyLevel — without it the TikTok API rejects the post
  const hasTikTok = (rest.providers as MetricoolProvider[]).some(p => p.network === 'tiktok')
  if (hasTikTok) {
    payload.tiktok = { privacyLevel: tiktokPrivacy ?? 'PUBLIC_TO_EVERYONE' }
  }

  return mFetch<MetricoolScheduledPost>(`/scheduler/posts?${qs(blogId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Delete (cancel) a scheduled post.
 * DELETE /api/v2/scheduler/posts/{id}?blogId=&userId=
 */
export async function deleteScheduledPost(postId: string, blogId: string | number): Promise<void> {
  await mFetch(`/scheduler/posts/${postId}?${qs(blogId)}`, { method: 'DELETE' })
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
