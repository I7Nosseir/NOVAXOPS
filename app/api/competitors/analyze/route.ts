import { NextRequest, NextResponse } from 'next/server'
import type { CompetitorAnalysis } from '@/lib/types'

const HAS_DB        = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI    = !!process.env.GEMINI_API_KEY

/**
 * POST /api/competitors/analyze
 * Body: { client_id, force_refresh? }
 * Returns: { analysis: CompetitorAnalysis }
 *
 * Runs Claude (or Gemini) gap analysis across all tracked competitors.
 * Result cached for 24h in ai_generation_cache unless force_refresh=true.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; force_refresh?: boolean }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, force_refresh } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const cacheKey = `competitor_analysis_${client_id}`

  // Check cache (24h TTL)
  if (!force_refresh) {
    const { data: cached } = await supabase
      .from('ai_generation_cache')
      .select('response_text, created_at')
      .eq('prompt_hash', cacheKey)
      .single()

    if (cached) {
      const age = Date.now() - new Date(cached.created_at as string).getTime()
      if (age < 24 * 60 * 60 * 1000) {
        try {
          const analysis = JSON.parse(cached.response_text as string) as CompetitorAnalysis
          return NextResponse.json({ analysis, cached: true })
        } catch { /* ignore corrupt cache */ }
      }
    }
  }

  // Fetch client data
  const { data: clientRow } = await supabase
    .from('clients')
    .select('name, brand_identity_json, competitor_context_json')
    .eq('id', client_id)
    .single()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Fetch competitor snapshots
  const { data: snapshots } = await supabase
    .from('competitor_snapshots')
    .select('*')
    .eq('client_id', client_id)
    .order('followers', { ascending: false })

  // Fetch recent competitor posts
  const { data: posts } = await supabase
    .from('competitor_post_samples')
    .select('competitor_handle, content_type, hook_text, engagement_rate')
    .eq('client_id', client_id)
    .order('engagement_rate', { ascending: false })
    .limit(50)

  const identity = clientRow.brand_identity_json as Record<string, unknown>
  const competitorList = (snapshots ?? []).map(s => {
    const snap = s as Record<string, unknown>
    return `- ${snap.competitor_handle} (${snap.platform}): ${snap.followers} followers, ${snap.avg_er}% ER, ${snap.posting_frequency} posts/week`
  }).join('\n')

  const postSamples = (posts ?? []).slice(0, 20).map(p => {
    const post = p as Record<string, unknown>
    return `[${post.competitor_handle}] ${post.content_type ?? 'post'}: "${post.hook_text ?? ''}" — ${post.engagement_rate}% ER`
  }).join('\n')

  const prompt = `You are a competitive intelligence analyst for a social media agency.

CLIENT: ${clientRow.name}
Industry: ${identity.industry ?? ''}
Audience: ${identity.target_audience ?? ''}
Platforms: ${Array.isArray(identity.platforms) ? (identity.platforms as string[]).join(', ') : ''}

TRACKED COMPETITORS:
${competitorList || '(none with metrics yet — provide general industry analysis)'}

TOP COMPETITOR CONTENT SAMPLES:
${postSamples || '(no post data yet)'}

Analyze the competitive landscape and return ONLY valid JSON — no markdown, no explanation:
{
  "landscape": [
    { "handle": "@handle", "platform": "Instagram", "followers": 0, "avg_er": 0, "posting_frequency": 0, "growth_signal": "stable" }
  ],
  "opportunities": ["3–5 actionable content opportunities competitors are missing"],
  "threats": [
    { "handle": "@handle", "platform": "Instagram", "threat_level": "high", "reasons": ["reason1", "reason2"], "recommended_response": "What the client should do" }
  ],
  "hooks_to_avoid": ["Hook patterns that competitors use heavily — client should differentiate"],
  "hooks_to_try": ["Hook types underused in this niche — high opportunity"],
  "recommended_formats": ["Content formats client should prioritize based on gaps"],
  "monthly_actions": ["5 prioritized actions for this month based on competitive landscape"],
  "summary": "2–3 sentence competitive intelligence summary",
  "generated_at": "${new Date().toISOString()}"
}`

  try {
    let raw = ''

    if (HAS_ANTHROPIC) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else if (HAS_GEMINI) {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { jsonMode: true, maxOutputTokens: 2000 })
    } else {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 503 })
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const analysis = JSON.parse(cleaned) as CompetitorAnalysis

    // Cache result
    await supabase.from('ai_generation_cache').upsert({
      prompt_hash: cacheKey,
      response_text: JSON.stringify(analysis),
      model_used: HAS_ANTHROPIC ? 'claude-sonnet-4-6' : 'gemini-3-flash-preview',
      cost_usd: 0,
    }, { onConflict: 'prompt_hash' })

    return NextResponse.json({ analysis, cached: false })
  } catch (err) {
    console.error('[competitors/analyze]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
