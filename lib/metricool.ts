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
// Metricool uses uppercase enum values for provider names
export const PLATFORM_TO_METRICOOL: Record<string, string> = {
  instagram: 'INSTAGRAM',
  facebook:  'FACEBOOK',
  linkedin:  'LINKEDIN',
  tiktok:    'TIKTOK',
  twitter:   'TWITTER',
  youtube:   'YOUTUBE',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricoolProvider {
  network: string   // "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK" | "TWITTER"
}

export interface MetricoolScheduledPost {
  id: string
  text: string
  providers: MetricoolProvider[]
  publicationDate: string
  status?: string
}

export interface DateTimeInfo {
  date: string   // "YYYY-MM-DD"
  time: string   // "HH:mm"
}

export interface MetricoolScheduleInput {
  blogId: string | number
  text: string
  providers: MetricoolProvider[]    // [{ network: "INSTAGRAM" }, { network: "FACEBOOK" }]
  publicationDate: DateTimeInfo     // { date: "YYYY-MM-DD", time: "HH:mm" }
  imageUrls?: string[]
  thumbnailUrl?: string             // Custom cover image for video / reel posts
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
 * Normalize a public image URL into a Metricool mediaId.
 * Must be called before attaching media to a scheduled post.
 * GET https://app.metricool.com/api/actions/normalize/image/url?url=...
 */
async function normalizeMediaUrl(url: string): Promise<string> {
  const endpoint = `https://app.metricool.com/api/actions/normalize/image/url?url=${encodeURIComponent(url)}`
  const res = await fetch(endpoint, {
    headers: { 'X-Mc-Auth': requireToken(), Accept: 'application/json' },
  })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    throw new Error(`Metricool normalize failed for URL (${res.status}): ${body}`)
  }
  const data = await res.json() as { mediaId?: string; id?: string }
  const id = data.mediaId ?? data.id
  if (!id) throw new Error(`Metricool normalize returned no mediaId for: ${url}`)
  return id
}

/**
 * Schedule a post to one or more networks.
 * POST /api/v2/scheduler/posts?blogId=&userId=
 *
 * Metricool does not accept imageUrls directly — each image URL must first be
 * normalized to a mediaId via /api/actions/normalize/image/url, then sent as
 * media: { mediaId } (single) or media: [{ mediaId }, ...] (carousel).
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, imageUrls, thumbnailUrl: _thumb, ...rest } = input

  // Normalize image URLs → mediaIds (skip if no media)
  let media: { mediaId: string } | { mediaId: string }[] | undefined
  if (imageUrls?.length) {
    const ids = await Promise.all(imageUrls.map(normalizeMediaUrl))
    media = ids.length === 1 ? { mediaId: ids[0] } : ids.map(id => ({ mediaId: id }))
  }

  const payload = { ...rest, ...(media !== undefined ? { media } : {}) }

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
 * The exact analytics path is TBD — probe if this endpoint returns 404.
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
