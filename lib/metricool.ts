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
  dateTime: string    // ISO 8601 without timezone suffix, e.g. "2026-06-01T10:00:00"
  timezone: string    // IANA timezone identifier, e.g. "UTC" or "America/New_York"
}

export interface MetricoolScheduleInput {
  blogId: string | number
  text: string
  providers: MetricoolProvider[]    // [{ network: "INSTAGRAM" }, { network: "FACEBOOK" }]
  publicationDate: DateTimeInfo     // { dateTime: "2026-06-01T10:00:00", timezone: "UTC" }
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
 * Schedule a post to one or more networks.
 * POST /api/v2/scheduler/posts?blogId=&userId=
 *
 * Body: { text, providers: [{ network: "INSTAGRAM" }], publicationDate, imageUrls? }
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, ...body } = input
  return mFetch<MetricoolScheduledPost>(`/scheduler/posts?${qs(blogId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
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
