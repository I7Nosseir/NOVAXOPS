import { NextRequest, NextResponse } from 'next/server'

const HAS_DB     = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_CLAUDE = !!process.env.ANTHROPIC_API_KEY

interface BrandIdentityJson {
  tone_of_voice?: string
  target_audience?: string
  key_messages?: string[]
  industry?: string
  language?: string
  website?: string
  platforms?: string[]
  posts_per_week?: number
  [key: string]: unknown
}

interface IntelResult {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  market_position: string
  growth_score: number
  engagement_trend: string
  content_gap: string[]
  key_insights: string[]
  strategy_90_days: string[]
}

const MOCK_INTEL: IntelResult = {
  strengths: [
    'Strong visual brand identity with consistent color language across platforms',
    'High audience trust score based on organic reach-to-follower ratio',
    'Differentiated tone of voice in a category dominated by generic messaging',
    'Active cross-platform presence enabling multi-touchpoint engagement',
  ],
  weaknesses: [
    'Underutilisation of video content despite strong platform algorithm preference',
    'Low posting cadence on LinkedIn relative to B2B opportunity size',
    'Limited community engagement strategy beyond reply volume',
    'No consistent editorial calendar resulting in reactive rather than strategic publishing',
  ],
  opportunities: [
    'Growing creator economy partnerships in category — authenticity-led collabs outperform paid ads',
    'Short-form video adoption curve still early — first-mover advantage remains available',
    'SEO-optimised social content can double as discoverability layer',
    'Comment section engagement as a brand differentiation signal — still largely ignored by competitors',
  ],
  threats: [
    'Algorithm shifts on Instagram deprioritising static content in favour of Reels',
    'Increasing ad costs reducing paid amplification ROI',
    'Emerging competitor brands with higher video production investment',
    'Platform policy changes affecting organic DM and comment reach',
  ],
  market_position: 'The brand occupies a mid-premium position with strong creative differentiation but underdeveloped content volume. Organic growth is above-category-average, supported by high-quality visual output and an engaged core audience segment. The primary opportunity is in scaling content frequency without sacrificing quality.',
  growth_score: 72,
  engagement_trend: '+18% projected MoM based on current audience growth trajectory and content-mix optimisation',
  content_gap: [
    'Educational series content (how-to, tutorials, explainers)',
    'Behind-the-scenes and team storytelling',
    'User-generated content repurposing strategy',
    'Seasonal and trend-reactive content',
    'Long-form LinkedIn thought leadership',
  ],
  key_insights: [
    'Carousel posts are generating 2.1x more saves than single-image posts — indicate high educational intent',
    'Posts published Tuesday and Thursday between 10am–12pm consistently outperform by 34% on reach',
    'Audience skews 28–38 female — content featuring process and authenticity over polished output resonates more',
    'Comments asking questions drive 3x more follow-up engagement than broadcast-style captions',
    'Video content has 60% lower production volume but 2.4x higher organic reach — underinvested relative to ROI',
  ],
  strategy_90_days: [
    'Launch a 4-week Reels series (1 per week) — behind-the-scenes format — to establish video habit and test audience response',
    'Implement a Tuesday/Thursday 10am publish schedule across Instagram and LinkedIn to capture peak engagement windows',
    'Develop a 5-piece educational carousel series addressing the top 5 audience questions — drive saves and shares',
    'Establish a monthly competitor content audit to identify emerging content formats before they peak',
    'Set up a UGC capture workflow — brief current customers on resharing protocols and offer incentives',
    'Test LinkedIn thought leadership — 1 long-form post per week from a named team member voice',
    'Introduce a monthly content performance review to identify which formats to double down on vs retire',
  ],
}

/**
 * POST /api/clients/analyze
 * Body: { client_id: string }
 *
 * Runs Claude analysis on the client's brand identity data and generates a full
 * intelligence report (SWOT, market position, content gaps, 90-day strategy).
 * Saves result to clients.performance_intel.
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

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const brand = (client.brand_identity_json ?? {}) as BrandIdentityJson
  const competitors = (client.competitor_context_json ?? []) as string[]

  const prompt = `You are a senior social media strategist and brand consultant. Analyze the following client brief and generate a comprehensive intelligence report.

CLIENT: ${client.name as string}
INDUSTRY: ${brand.industry ?? 'Unknown'}
WEBSITE: ${brand.website ?? 'Not provided'}
PLATFORMS: ${(brand.platforms ?? []).join(', ') || 'Not specified'}
POSTING CADENCE: ${brand.posts_per_week ?? '?'} posts/week
LANGUAGE: ${brand.language ?? 'en'}
TONE OF VOICE: ${brand.tone_of_voice ?? 'Not specified'}
TARGET AUDIENCE: ${brand.target_audience ?? 'Not specified'}
KEY MESSAGES: ${(brand.key_messages ?? []).join(' | ') || 'Not specified'}
KNOWN COMPETITORS: ${competitors.join(', ') || 'None listed'}

Return a JSON object with EXACTLY this structure — no explanation outside the JSON:
{
  "strengths": ["3-5 specific strengths based on the brief"],
  "weaknesses": ["3-5 specific weaknesses or gaps"],
  "opportunities": ["3-5 market opportunities for this brand"],
  "threats": ["3-5 threats or risks to watch"],
  "market_position": "2-3 sentence market position statement",
  "growth_score": <integer 0-100 representing growth potential>,
  "engagement_trend": "e.g. +15% projected MoM based on strategy alignment",
  "content_gap": ["3-5 specific content types or topics not covered"],
  "key_insights": ["3-5 data-backed or strategic insights"],
  "strategy_90_days": ["5-7 specific action items for the next 90 days, each with expected outcome"]
}

Be specific to this client's industry, audience, and competitive context. No hashtags, no emojis.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude returned non-JSON response' }, { status: 500 })

    const intel = JSON.parse(jsonMatch[0]) as IntelResult

    await supabase.from('clients').update({
      performance_intel: intel,
      performance_analyzed_at: new Date().toISOString(),
    }).eq('id', client_id)

    return NextResponse.json({ intel })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
