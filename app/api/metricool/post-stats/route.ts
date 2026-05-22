import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://app.metricool.com/api/v2'

function requireToken() {
  const t = process.env.METRICOOL_API_TOKEN
  if (!t) throw new Error('METRICOOL_API_TOKEN not configured')
  return t
}
function requireUserId() {
  const u = process.env.METRICOOL_USER_ID
  if (!u) throw new Error('METRICOOL_USER_ID not configured')
  return u
}

// Fields vary by platform (TikTok != Instagram != Facebook) — all optional.
// Some accounts return "engagement" (rate %) instead of "engagementRate".
// "clicks" is the FB/LinkedIn alias for "linkClicks".
interface MetricoolPostStats {
  id?: string
  reach?: number
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  linkClicks?: number
  clicks?: number          // Facebook/LinkedIn alias for linkClicks
  engagementRate?: number
  engagement?: number      // alternate field name used by some account types
  network?: string
  publishedAt?: string
}

async function fetchPostStats(metricoolPostId: string, blogId: string): Promise<MetricoolPostStats | null> {
  const params = new URLSearchParams({ userId: requireUserId(), blogId })
  const res = await fetch(`${BASE}/analytics/posts/${metricoolPostId}?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Mc-Auth': requireToken(),
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Metricool ${res.status} on post stats ${metricoolPostId}`)
  const data = await res.json() as { data?: MetricoolPostStats }
  return data.data ?? null
}

/**
 * GET /api/metricool/post-stats?post_id=<db-post-uuid>
 *
 * Pulls per-post engagement from Metricool and upserts into post_performance_snapshots.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const { data: post, error: postErr } = await supabase
    .from('scheduled_posts')
    .select('id, metricool_post_id, platforms, client_id')
    .eq('id', post_id)
    .single()

  if (postErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!post.metricool_post_id) return NextResponse.json({ error: 'No Metricool post ID' }, { status: 400 })

  const { data: client } = await supabase
    .from('clients')
    .select('metricool_blog_id')
    .eq('id', post.client_id)
    .single()

  if (!client?.metricool_blog_id) return NextResponse.json({ error: 'Client has no blog ID' }, { status: 400 })

  try {
    const stats = await fetchPostStats(post.metricool_post_id, client.metricool_blog_id)
    if (!stats) return NextResponse.json({ error: 'No stats from Metricool (post may be too new)' }, { status: 404 })

    const platforms: string[] = post.platforms ?? []
    const platform = stats.network ?? platforms[0] ?? 'unknown'

    // Normalise field aliases: "engagement" == "engagementRate", "clicks" == "linkClicks"
    const er = stats.engagementRate ?? stats.engagement ?? 0
    const lc = stats.linkClicks ?? stats.clicks ?? 0

    await supabase.from('post_performance_snapshots').upsert({
      post_id,
      platform,
      reach: stats.reach ?? 0,
      impressions: stats.impressions ?? 0,
      likes: stats.likes ?? 0,
      comments: stats.comments ?? 0,
      shares: stats.shares ?? 0,
      saves: stats.saves ?? 0,
      link_clicks: lc,
      engagement_rate: er,
      captured_at: new Date().toISOString(),
    }, { onConflict: 'post_id,platform' })

    // Also update the inline performance_data on the post itself
    await supabase.from('scheduled_posts').update({
      performance_data: {
        reach: stats.reach ?? 0,
        impressions: stats.impressions ?? 0,
        engagement_rate: er,
        likes: stats.likes ?? 0,
        comments: stats.comments ?? 0,
        shares: stats.shares ?? 0,
        saves: stats.saves ?? 0,
      },
    }).eq('id', post_id)

    return NextResponse.json({ post_id, platform, stats })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
