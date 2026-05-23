import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_CLAUDE = !!process.env.ANTHROPIC_API_KEY

const MOCK_INTEL = {
  viral_patterns: [
    'Behind-the-scenes content drives 2.4x higher saves vs standard posts',
    'Posts with questions in captions see 38% more comments',
    'Carousel posts outperform single images by 1.8x on engagement rate',
    'Short-form video (15-30s) achieves highest reach on Instagram',
    'Product demonstrations with lifestyle context outperform product-only shots',
  ],
  failure_patterns: [
    'Pure promotional posts without storytelling underperform by 60%',
    'Posts published Monday mornings see lowest engagement across all platforms',
    'Captions over 150 words correlate with lower completion rates',
    'Static images without text overlay perform poorly on LinkedIn',
  ],
  optimal_times: {
    instagram: 'Tuesday & Thursday 10:00–11:00 AM, Sunday 7:00–9:00 PM',
    tiktok: 'Weekdays 6:00–9:00 PM, Saturday 12:00–2:00 PM',
    facebook: 'Wednesday & Friday 1:00–4:00 PM',
    linkedin: 'Tuesday & Wednesday 8:00–10:00 AM',
  },
  content_mix_recommendation: {
    current: { video: 30, carousel: 40, static: 30 },
    recommended: { video: 50, carousel: 35, static: 15 },
    rationale: 'Short-form video drives 2x higher organic reach in current algorithm conditions',
  },
  next_recommendations: [
    {
      title: 'Day-in-the-life team walkthrough',
      platform: 'instagram',
      format: 'video',
      caption_angle: 'Authentic behind-the-scenes moment showing the team at work',
      timing: 'Thursday 10:30 AM',
      expected_er: '7.2–9.8%',
    },
    {
      title: 'Product benefit carousel',
      platform: 'instagram',
      format: 'carousel',
      caption_angle: 'Problem → Solution framing with strong opening hook',
      timing: 'Tuesday 11:00 AM',
      expected_er: '5.5–7.1%',
    },
    {
      title: 'Industry insight thought leadership',
      platform: 'linkedin',
      format: 'static',
      caption_angle: 'Bold contrarian take supported by one data point',
      timing: 'Wednesday 9:00 AM',
      expected_er: '4.8–6.2%',
    },
  ],
  one_line_summary: 'Video and carousel content are significantly outperforming static posts — shifting budget toward short-form video will drive the highest return on reach.',
}

interface PerformancePost {
  caption: string
  platform: string
  published_at: string
  reach: number
  engagement_rate: number
  likes: number
  comments: number
  shares: number
  saves: number
}

/**
 * POST /api/performance/analyze
 * Body: { client_id: string }
 *
 * Pulls all performance snapshots for a client, sends to Claude for pattern analysis,
 * saves result to clients.performance_intel.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB || !HAS_CLAUDE) {
    return NextResponse.json({ intel: MOCK_INTEL, _mock: true })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const Anthropic = (await import('@anthropic-ai/sdk')).default

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: client } = await supabase
    .from('clients')
    .select('name, brand_identity_json')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select(`
      caption, platforms, published_at,
      post_performance_snapshots ( platform, reach, likes, comments, shares, saves, engagement_rate )
    `)
    .eq('client_id', client_id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(100)

  type SnapRow = { platform: string; reach: number; likes: number; comments: number; shares: number; saves: number; engagement_rate: number }

  const enriched: PerformancePost[] = (posts ?? []).flatMap(post => {
    const snaps = (post.post_performance_snapshots as SnapRow[]) ?? []
    if (snaps.length === 0) return []
    return snaps.map(s => ({
      caption: (post.caption as string).slice(0, 120),
      platform: s.platform,
      published_at: post.published_at as string,
      reach: s.reach,
      engagement_rate: s.engagement_rate,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
      saves: s.saves,
    }))
  })

  if (enriched.length < 5) {
    return NextResponse.json({ error: 'Not enough performance data yet (need at least 5 posts with stats)' }, { status: 422 })
  }

  const sorted = [...enriched].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top10 = sorted.slice(0, 10)
  const bottom10 = sorted.slice(-10)

  const totalReach = enriched.reduce((s, p) => s + p.reach, 0)
  const avgER = enriched.reduce((s, p) => s + p.engagement_rate, 0) / enriched.length

  const platformGroups: Record<string, PerformancePost[]> = {}
  for (const p of enriched) {
    if (!platformGroups[p.platform]) platformGroups[p.platform] = []
    platformGroups[p.platform].push(p)
  }

  const platformSummary = Object.entries(platformGroups).map(([plat, items]) => ({
    platform: plat,
    posts: items.length,
    avg_er: (items.reduce((s, p) => s + p.engagement_rate, 0) / items.length).toFixed(2),
    avg_reach: Math.round(items.reduce((s, p) => s + p.reach, 0) / items.length),
  }))

  const prompt = `You are a senior social media strategist analyzing performance data for ${client.name as string}.

SUMMARY: ${enriched.length} published posts analyzed. Total reach: ${totalReach.toLocaleString()}. Average ER: ${avgER.toFixed(2)}%.

PLATFORM BREAKDOWN:
${platformSummary.map(p => `- ${p.platform}: ${p.posts} posts, avg ER ${p.avg_er}%, avg reach ${p.avg_reach.toLocaleString()}`).join('\n')}

TOP 10 POSTS (by engagement rate):
${top10.map((p, i) => `${i + 1}. [${p.platform}] ER: ${p.engagement_rate}% | Reach: ${p.reach.toLocaleString()} | Saves: ${p.saves} | Caption: "${p.caption}"`).join('\n')}

BOTTOM 10 POSTS:
${bottom10.map((p, i) => `${i + 1}. [${p.platform}] ER: ${p.engagement_rate}% | Reach: ${p.reach.toLocaleString()} | Caption: "${p.caption}"`).join('\n')}

Return a JSON object with EXACTLY this structure:
{
  "viral_patterns": ["3-5 patterns observed in top-performing content"],
  "failure_patterns": ["3-5 patterns in underperforming content"],
  "optimal_times": {
    "instagram": "best days/times based on publish dates of top posts",
    "tiktok": "...",
    "facebook": "...",
    "linkedin": "..."
  },
  "content_mix_recommendation": {
    "current": {"video": 30, "carousel": 40, "static": 30},
    "recommended": {"video": 50, "carousel": 35, "static": 15},
    "rationale": "one sentence"
  },
  "next_recommendations": [
    {
      "title": "specific content brief title",
      "platform": "platform name",
      "format": "video|carousel|static|story",
      "caption_angle": "what the caption should say/do",
      "timing": "when to post",
      "expected_er": "projected ER range"
    }
  ],
  "one_line_summary": "one executive sentence summarising performance"
}
No hashtags, no emojis. Return only valid JSON.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Non-JSON response from Claude' }, { status: 500 })

    const intel = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    await supabase.from('clients').update({
      performance_intel: intel,
      performance_analyzed_at: new Date().toISOString(),
    }).eq('id', client_id)

    return NextResponse.json({ intel })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
