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
  date: string   // "YYYY-MM-DD"
  time: string   // "HH:mm"
}

export interface MetricoolScheduleInput {
  blogId: string | number
  text: string
  providers: MetricoolProvider[]   // [{ network: "instagram" }, { network: "facebook" }]
  publicationDate: DateTimeInfo    // { date: "YYYY-MM-DD", time: "HH:mm" }
  imageUrls?: string[]             // public URLs — sent as media: [url, ...] in the API payload
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
  const { blogId, imageUrls, ...rest } = input

  const payload: Record<string, unknown> = { ...rest }
  if (imageUrls?.length) {
    payload.media = imageUrls
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
