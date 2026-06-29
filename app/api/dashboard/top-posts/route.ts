import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

export interface TopPost {
  post_id: string
  caption: string
  post_type: string
  platform: string
  er: number
  likes: number
  reach: number
  client_name: string
  client_color: string
  client_avg_er: number
}

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ posts: [] }, { status: 401 })

  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Step 1: recent high-ER snapshots
    const { data: recentSnaps } = await db
      .from('post_performance_snapshots')
      .select('post_id, engagement_rate, likes, reach, platform')
      .gte('captured_at', cutoff)
      .gt('engagement_rate', 0)
      .order('engagement_rate', { ascending: false })
      .limit(50)

    if (!recentSnaps?.length) return NextResponse.json({ posts: [] })

    const postIds = recentSnaps.map(s => s.post_id).filter(Boolean)

    // Step 2: fetch post details + client info
    const { data: posts } = await db
      .from('scheduled_posts')
      .select('id, caption, post_type, client_id, platforms')
      .in('id', postIds)

    if (!posts?.length) return NextResponse.json({ posts: [] })

    const clientIds = [...new Set(posts.map(p => p.client_id).filter(Boolean))]

    const { data: clients } = await db
      .from('clients')
      .select('id, name, color')
      .in('id', clientIds)

    // Step 3: get all posts for these clients to compute avg ER
    const { data: allClientPosts } = await db
      .from('scheduled_posts')
      .select('id, client_id')
      .in('client_id', clientIds)

    const allPostIds = (allClientPosts ?? []).map(p => p.id)

    const { data: allSnaps } = allPostIds.length > 0
      ? await db
          .from('post_performance_snapshots')
          .select('post_id, engagement_rate')
          .in('post_id', allPostIds)
          .gt('engagement_rate', 0)
      : { data: [] }

    // Build post → client map
    const postClientMap = new Map<string, string>(
      (allClientPosts ?? []).map(p => [p.id, p.client_id])
    )

    // Accumulate ER per client
    const clientErAccum = new Map<string, number[]>()
    for (const snap of (allSnaps ?? [])) {
      const cid = postClientMap.get(snap.post_id)
      if (!cid) continue
      if (!clientErAccum.has(cid)) clientErAccum.set(cid, [])
      clientErAccum.get(cid)!.push(Number(snap.engagement_rate))
    }

    const clientAvgEr = new Map<string, number>()
    for (const [cid, ers] of clientErAccum) {
      clientAvgEr.set(cid, ers.reduce((s, e) => s + e, 0) / ers.length)
    }

    // Join everything
    const postMap = new Map(posts.map(p => [p.id, p]))
    const clientMap = new Map((clients ?? []).map(c => [c.id, c]))

    const results: TopPost[] = []
    for (const snap of recentSnaps) {
      const post = postMap.get(snap.post_id)
      if (!post) continue
      const client = clientMap.get(post.client_id)
      if (!client) continue
      const avgEr = clientAvgEr.get(post.client_id) ?? 0
      if (avgEr > 0 && Number(snap.engagement_rate) <= avgEr * 2) continue

      results.push({
        post_id:      snap.post_id,
        caption:      (post.caption ?? '').slice(0, 140),
        post_type:    post.post_type ?? 'post',
        platform:     snap.platform,
        er:           Math.round(Number(snap.engagement_rate) * 100) / 100,
        likes:        Number(snap.likes ?? 0),
        reach:        Number(snap.reach ?? 0),
        client_name:  client.name,
        client_color: client.color ?? '#1B3D38',
        client_avg_er: Math.round(avgEr * 100) / 100,
      })

      if (results.length >= 10) break
    }

    return NextResponse.json({ posts: results })
  } catch (err) {
    console.error('[dashboard/top-posts]', err)
    return NextResponse.json({ posts: [] }, { status: 500 })
  }
}
