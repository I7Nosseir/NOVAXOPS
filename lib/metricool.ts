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
    cache: 'no-store',
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
    const isHtml = body.trimStart().startsWith('<')
    const detail = isHtml ? `(HTML error page — route may not exist)` : body.slice(0, 300)
    throw new Error(`Metricool ${res.status} on ${path}: ${detail}`)
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
  // Explicit override — use when URL extension alone can't determine media type (Drive, signed URLs, etc.)
  isVideo?: boolean
  // Explicit post type per platform — overrides auto-detection
  instagramPostType?: 'POST' | 'REEL' | 'STORY'
  facebookPostType?:  'POST' | 'REEL' | 'STORY'
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
  posts?: number
  // per-platform sub-objects (Metricool sometimes nests stats by network)
  instagram?: Partial<MetricoolStats>
  facebook?: Partial<MetricoolStats>
  linkedin?: Partial<MetricoolStats>
  tiktok?: Partial<MetricoolStats>
  twitter?: Partial<MetricoolStats>
}

// ─── Media normalization ──────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  // Match by file extension OR by Metricool's /video/ CDN path
  return /\.(mp4|mov|avi|webm|mkv|m4v|wmv|flv)(\?.*)?$/i.test(url)
    || /static\.metricool\.com\/video\//i.test(url)
}

/**
 * Normalizes a public media URL to a Metricool CDN URL.
 *
 * /normalize/image/url handles BOTH images and videos — confirmed in official Metricool PDF:
 * "that will return the URL of the copy of your image/video on our servers".
 * There is no separate /normalize/video/url endpoint.
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
  if (!trimmed.startsWith('http')) {
    throw new Error(
      `Metricool normalize returned an invalid URL for: ${url}\n` +
      `Got: "${trimmed.slice(0, 200)}"`
    )
  }
  console.log(`[Metricool] normalize "${url}" → "${trimmed}"`)
  return trimmed
}

// ─── API calls ────────────────────────────────────────────────────────────────

// ─── Blog/workspace listing ───────────────────────────────────────────────────

export interface MetricoolBlog {
  id: string
  name: string
  url?: string
  type?: string
}

/**
 * List all blogs (client workspaces) for this Metricool account.
 * GET /api/v2/user?userId=
 *
 * Metricool returns the user object which contains a `blogs` array.
 * Each blog represents one client workspace with its own connected profiles.
 */
export async function getBlogs(): Promise<MetricoolBlog[]> {
  const userId = requireUserId()
  const raw = await mFetch<Record<string, unknown>>(`/user?userId=${userId}`)

  // Response shape can be { data: { blogs: [...] } } or { blogs: [...] } or { data: [...] }
  const inner = (raw.data ?? raw) as Record<string, unknown>
  const blogs = (inner.blogs ?? raw.blogs ?? inner.workspaces ?? []) as Record<string, unknown>[]

  if (!Array.isArray(blogs) || blogs.length === 0) {
    // Fallback: some plans return a flat user object with id/name = the single blog
    const id = String(inner.blogId ?? inner.id ?? raw.blogId ?? '')
    const name = String(inner.blogName ?? inner.name ?? raw.name ?? 'Main account')
    if (id) return [{ id, name }]
    return []
  }

  return blogs.map(b => ({
    id:   String(b.id ?? b.blogId ?? ''),
    name: String(b.name ?? b.blogName ?? b.title ?? b.id ?? ''),
    url:  b.url ? String(b.url) : undefined,
    type: b.type ? String(b.type) : undefined,
  })).filter(b => b.id)
}

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
 *   Facebook  → facebookData: { type: 'POST'|'REEL' }   (POST for images/carousels, REEL for video)
 *   Instagram → instagramData: { type: 'POST'|'REEL' }  (POST for images/carousels, REEL for video)
 *   TikTok    → tiktokData: { privacyOption }
 * Callers can override by passing instagramData/facebookData in the input.
 */
export async function schedulePost(input: MetricoolScheduleInput): Promise<MetricoolScheduledPost> {
  const { blogId, imageUrls, tiktokPrivacy, instagramData: instagramDataIn, facebookData: facebookDataIn, isVideo: isVideoOverride, instagramPostType, facebookPostType, ...rest } = input

  const payload: Record<string, unknown> = {
    autoPublish: true,
    ...rest,
  }

  // isVideoOverride takes priority; pre-normalization URL extension is the fallback.
  let hasVideo = isVideoOverride ?? imageUrls?.some(isVideoUrl) ?? false

  if (imageUrls?.length) {
    // Normalize sequentially — parallel calls can hit Metricool's undocumented rate limit.
    // /normalize/image/url handles BOTH images and videos (official PDF confirmed).
    const mediaIds: string[] = []
    for (const url of imageUrls) {
      mediaIds.push(await normalizeMediaUrl(url))
    }
    // media is a flat array of CDN URL strings — confirmed from Metricool official docs.
    payload.media = mediaIds
    // Re-check after normalization: Metricool CDN uses /video/ in the path for video files,
    // reliably catching Drive/signed/extension-less URLs missed by pre-normalization detection.
    if (!hasVideo) hasVideo = mediaIds.some(isVideoUrl)
  }

  const networks = (rest.providers as MetricoolProvider[]).map(p => p.network)

  // TikTok requires privacy inside tiktokData — field name confirmed by Metricool's ScheduledPostTikTokData class
  if (networks.includes('tiktok')) {
    payload.tiktokData = { privacyOption: tiktokPrivacy ?? 'PUBLIC_TO_EVERYONE' }
  }

  // Facebook: explicit type takes priority; auto-detects REEL for video, POST otherwise.
  if (networks.includes('facebook')) {
    const fbType = facebookPostType ?? (hasVideo ? 'REEL' : 'POST')
    payload.facebookData = { type: fbType, ...(facebookDataIn ?? {}) }
  }

  // Instagram: explicit type takes priority; auto-detects REEL for video, POST otherwise.
  // STORY: no showReelOnFeed. REEL: showReelOnFeed=true (confirmed from Metricool live payload).
  if (networks.includes('instagram')) {
    const igType = instagramPostType ?? (hasVideo ? 'REEL' : 'POST')
    const showOnFeed = igType === 'REEL'
    payload.instagramData = {
      type: igType,
      ...(showOnFeed ? { showReelOnFeed: true } : {}),
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

// ─── Post-level analytics ─────────────────────────────────────────────────────
// Endpoint: GET /api/v2/analytics/posts/{network}?userId=&blogId=&from=yyyy-MM-ddTHH:mm:ss&to=yyyy-MM-ddTHH:mm:ss
// Each network is a separate call. Returns 400 if network not connected — skipped silently.

export interface MetricoolPostAnalytics {
  id?: string
  network?: string
  platform?: string
  publishDate?: string
  reach?: number
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  linkClicks?: number
  clicks?: number
  engagementRate?: number
  engagement?: number
  engagement_rate?: number
}

const ANALYTICS_NETWORKS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'] as const

/**
 * Fetch published posts with analytics for one network.
 * Returns [] if the network is not connected to the blog (400) or has no data.
 * Dates must be full ISO datetime: "2026-05-01" → "2026-05-01T00:00:00"
 */
async function fetchNetworkPosts(
  blogId: string | number,
  network: string,
  startDate: string,
  endDate: string
): Promise<MetricoolPostAnalytics[]> {
  const from = startDate.includes('T') ? startDate : `${startDate}T00:00:00`
  const to   = endDate.includes('T')   ? endDate   : `${endDate}T23:59:59`
  const params = qs(blogId, { from, to })
  let raw: Record<string, unknown>
  try {
    raw = await mFetch<Record<string, unknown>>(`/analytics/posts/${network}?${params}`)
  } catch (err) {
    // 400 = network not connected to this blog — not an error worth surfacing
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('400')) return []
    throw err
  }
  const items = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : []
  return (items as MetricoolPostAnalytics[]).map(p => ({ ...p, network: p.network ?? network }))
}

/**
 * Fetch posts across all connected networks for a date range.
 * Networks that return 400 (not connected) are skipped silently.
 */
async function fetchPostsList(
  blogId: string | number,
  startDate: string,
  endDate: string
): Promise<MetricoolPostAnalytics[]> {
  const results = await Promise.all(
    ANALYTICS_NETWORKS.map(net => fetchNetworkPosts(blogId, net, startDate, endDate))
  )
  return results.flat()
}

/**
 * Aggregate stats for a blog over a date range.
 * Sums reach/impressions/likes/comments/shares/saves across all posts in the period.
 * Engagement rate is averaged across posts that have ER data.
 */
export async function getStats(
  blogId: string | number,
  startDate: string,
  endDate: string
): Promise<MetricoolStats> {
  const posts = await fetchPostsList(blogId, startDate, endDate)
  if (posts.length === 0) return {}

  const agg: MetricoolStats = { posts: posts.length }
  for (const p of posts) {
    agg.reach       = (agg.reach       ?? 0) + Number(p.reach       ?? 0)
    agg.impressions = (agg.impressions ?? 0) + Number(p.impressions ?? 0)
    agg.likes       = (agg.likes       ?? 0) + Number(p.likes       ?? 0)
    agg.comments    = (agg.comments    ?? 0) + Number(p.comments    ?? 0)
    agg.shares      = (agg.shares      ?? 0) + Number(p.shares      ?? 0)
    agg.saves       = (agg.saves       ?? 0) + Number(p.saves       ?? 0)
    agg.clicks      = (agg.clicks      ?? 0) + Number(p.linkClicks  ?? p.clicks ?? 0)
  }

  const ers = posts.map(p => Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)).filter(v => v > 0)
  if (ers.length > 0) agg.engagement_rate = ers.reduce((a, b) => a + b, 0) / ers.length

  return agg
}

/**
 * Per-platform breakdown — groups the same posts list by network.
 * Returns only platforms that have real data (reach > 0 or impressions > 0).
 * Single API call covers all platforms in one shot.
 */
export async function getPlatformStats(
  blogId: string | number,
  startDate: string,
  endDate: string
): Promise<{ platform: string; reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; posts: number; engagement_rate: number }[]> {
  const allPosts = await fetchPostsList(blogId, startDate, endDate)
  if (allPosts.length === 0) return []

  type Acc = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; posts: number; erSum: number; erN: number }
  const map = new Map<string, Acc>()

  for (const p of allPosts) {
    const net = String(p.network ?? p.platform ?? 'unknown').toLowerCase()
    if (!map.has(net)) map.set(net, { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, erSum: 0, erN: 0 })
    const a = map.get(net)!
    a.reach       += Number(p.reach       ?? 0)
    a.impressions += Number(p.impressions ?? 0)
    a.likes       += Number(p.likes       ?? 0)
    a.comments    += Number(p.comments    ?? 0)
    a.shares      += Number(p.shares      ?? 0)
    a.saves       += Number(p.saves       ?? 0)
    a.posts       += 1
    const er = Number(p.engagementRate ?? p.engagement_rate ?? p.engagement ?? 0)
    if (er > 0) { a.erSum += er; a.erN++ }
  }

  return Array.from(map.entries())
    .map(([platform, a]) => ({
      platform,
      reach:           a.reach,
      impressions:     a.impressions,
      likes:           a.likes,
      comments:        a.comments,
      shares:          a.shares,
      saves:           a.saves,
      posts:           a.posts,
      engagement_rate: a.erN > 0 ? a.erSum / a.erN : 0,
    }))
    .filter(p => p.reach > 0 || p.impressions > 0)
}
