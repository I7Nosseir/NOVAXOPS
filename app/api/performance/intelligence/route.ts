import { NextRequest, NextResponse } from 'next/server'

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

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
  _mock: true,
}

/**
 * GET /api/performance/intelligence?client_id=
 *
 * Returns the pre-computed performance intelligence JSONB from the clients table.
 * Includes last_analyzed_at so the UI can show staleness.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  if (!HAS_DB) {
    return NextResponse.json({
      intel: MOCK_INTEL,
      analyzed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      _mock: true,
    })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('clients')
    .select('performance_intel, performance_analyzed_at')
    .eq('id', client_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({
    intel: data.performance_intel ?? null,
    analyzed_at: data.performance_analyzed_at ?? null,
  })
}
