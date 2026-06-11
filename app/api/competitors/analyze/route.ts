import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CompetitorAnalysis } from '@/lib/types'

const HAS_DB        = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI    = !!process.env.GEMINI_API_KEY

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/competitors/analyze
 * Body: { client_id, force_refresh? }
 *
 * Generates a world-class competitive intelligence report for the client.
 * Structured analysis: landscape (3 local + 3 global), blue ocean opportunities,
 * threat matrix, content gap, hook intelligence, 30-day action plan.
 * Result cached in competitor_intelligence_reports (one row per client, overwritten on refresh).
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; force_refresh?: boolean }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, force_refresh } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const supabase = getSupabase()

  // ── Cache check (skip if force_refresh) ─────────────────────────────────
  if (!force_refresh) {
    const { data: cached } = await supabase
      .from('competitor_intelligence_reports')
      .select('report_json, generated_at')
      .eq('client_id', client_id)
      .single()

    if (cached?.report_json) {
      const ageMs = Date.now() - new Date(cached.generated_at as string).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        return NextResponse.json({
          analysis:     cached.report_json as CompetitorAnalysis,
          cached:       true,
          generated_at: cached.generated_at,
        })
      }
    }
  }

  // ── Fetch client context ─────────────────────────────────────────────────
  const { data: clientRow } = await supabase
    .from('clients')
    .select('name, brand_identity_json')
    .eq('id', client_id)
    .single()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // ── Fetch tracked competitors ────────────────────────────────────────────
  const { data: snapshots } = await supabase
    .from('competitor_snapshots')
    .select('*')
    .eq('client_id', client_id)
    .order('followers', { ascending: false })

  // ── Fetch top competitor posts for content intelligence ──────────────────
  const { data: posts } = await supabase
    .from('competitor_post_samples')
    .select('competitor_handle, content_type, hook_text, engagement_rate, platform')
    .eq('client_id', client_id)
    .order('engagement_rate', { ascending: false })
    .limit(40)

  const identity  = (clientRow.brand_identity_json ?? {}) as Record<string, unknown>
  const industry  = (identity.industry as string | undefined) ?? 'Unknown'
  const audience  = (identity.target_audience as string | undefined) ?? ''
  const platforms = Array.isArray(identity.platforms) ? (identity.platforms as string[]).join(', ') : 'Instagram, TikTok'

  const localCompetitors  = (snapshots ?? []).filter(s => (s as Record<string, unknown>).scope === 'local')
  const globalCompetitors = (snapshots ?? []).filter(s => (s as Record<string, unknown>).scope !== 'local')

  const formatSnap = (s: Record<string, unknown>) =>
    `  • ${s.competitor_handle} [${s.platform}] — ${s.followers ?? 0} followers, ${s.avg_er ?? 0}% ER, ${s.posting_frequency ?? 0} posts/week` +
    (s.platform_strategy ? `\n    Strategy: ${s.platform_strategy}` : '')

  const localBlock  = localCompetitors.length
    ? localCompetitors.map(s => formatSnap(s as Record<string, unknown>)).join('\n')
    : '  (none tracked — infer from industry knowledge for this region)'

  const globalBlock = globalCompetitors.length
    ? globalCompetitors.map(s => formatSnap(s as Record<string, unknown>)).join('\n')
    : '  (none tracked — infer internationally known benchmark brands)'

  const postBlock = (posts ?? []).length
    ? (posts ?? []).slice(0, 20).map(p => {
        const post = p as Record<string, unknown>
        return `  • [${post.competitor_handle}/${post.platform}] ${post.content_type ?? 'post'}: "${post.hook_text ?? ''}" — ${post.engagement_rate}% ER`
      }).join('\n')
    : '  (no post data — infer content patterns from industry knowledge)'

  const prompt = `You are a senior competitive intelligence analyst specialising in social media brand strategy. Your analysis must be specific, evidence-based, and immediately actionable.

═══════════════════════════════════════════════
CLIENT BRIEF
═══════════════════════════════════════════════
Brand:            ${clientRow.name}
Industry/Niche:   ${industry}
Target Audience:  ${audience || 'Not specified'}
Active Platforms: ${platforms}

═══════════════════════════════════════════════
TRACKED LOCAL COMPETITORS
═══════════════════════════════════════════════
${localBlock}

═══════════════════════════════════════════════
TRACKED GLOBAL COMPETITORS
═══════════════════════════════════════════════
${globalBlock}

═══════════════════════════════════════════════
HIGH-PERFORMING COMPETITOR CONTENT SAMPLES
═══════════════════════════════════════════════
${postBlock}

═══════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════
Apply these frameworks:
1. POSITIONING MAP — Where does each competitor sit? What whitespace exists?
2. BLUE OCEAN GAPS — What value does NO competitor offer that the audience genuinely wants?
3. CONTENT INTELLIGENCE — What hook/format patterns are SATURATED vs. UNDERUTILISED?
4. THREAT MATRIX — Rate each competitor's threat to client growth.
5. 30-DAY PLAYBOOK — 5 specific actions that move the needle fastest right now.

RULES:
- Provide exactly 3 local + 3 global competitors in the landscape (fill from industry knowledge if gaps exist)
- Be specific: name real tactics, real content formats, real differentiators
- Never give generic advice — give differentiated, competitive recommendations
- All threat responses must be concrete counter-strategies

Return ONLY valid JSON — no markdown, no explanation:
{
  "landscape": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "followers": 0,
      "avg_er": 0.0,
      "posting_frequency": 3,
      "growth_signal": "stable",
      "scope": "local",
      "platform_strategy": "Their specific content approach and positioning in 1-2 sentences",
      "best_performing_format": "e.g. 15-30s educational Reels with strong hook in first 2 seconds",
      "key_strengths": ["Specific strength 1", "Specific strength 2"],
      "key_weaknesses": ["Specific weakness 1 — opportunity for client", "Specific weakness 2"],
      "social_url": "https://instagram.com/handle"
    }
  ],
  "opportunities": [
    "Specific content territory no competitor currently owns",
    "Specific format or topic gap in this niche",
    "Specific underserved audience segment",
    "Specific platform feature none are using well",
    "Specific emotional/cultural angle competitors miss"
  ],
  "threats": [
    {
      "handle": "@handle",
      "platform": "instagram",
      "threat_level": "high",
      "reasons": ["Specific reason this competitor threatens client growth", "Second reason"],
      "recommended_response": "Specific counter-strategy — what to post, what angle to own, what to do",
      "social_url": "https://instagram.com/handle"
    }
  ],
  "hooks_to_avoid": [
    "Hook pattern competitors overuse — why it is saturated",
    "Second saturated hook pattern in this niche"
  ],
  "hooks_to_try": [
    "Underused hook format with high potential in this space",
    "Second hook type competitors ignore but audience responds to"
  ],
  "recommended_formats": [
    "Specific content format with reason why it is underutilised here",
    "Second format gap",
    "Third format gap"
  ],
  "monthly_actions": [
    "1. [PLATFORM] Specific tactical action — what to create, what angle, what CTA",
    "2. [PLATFORM] Second action — differentiate from [specific competitor] by doing X",
    "3. [PLATFORM] Third action — own the [specific gap] territory",
    "4. Cross-platform action that exploits a competitor weakness",
    "5. Long-term positioning move to build moat against top threat"
  ],
  "summary": "2-3 sentences: the single biggest competitive opportunity right now, the most urgent threat, and the one move that changes the game.",
  "generated_at": "${new Date().toISOString()}"
}`

  if (!HAS_ANTHROPIC && !HAS_GEMINI) {
    return NextResponse.json({ error: 'No AI provider configured' }, { status: 503 })
  }

  try {
    let raw       = ''
    let modelUsed = ''

    if (HAS_ANTHROPIC) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const ai  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await ai.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 3000,
        messages:   [{ role: 'user', content: prompt }],
      })
      raw       = msg.content[0].type === 'text' ? msg.content[0].text : ''
      modelUsed = 'claude-sonnet-4-6'
    } else {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw       = await geminiGenerate(prompt, undefined, { jsonMode: true, maxOutputTokens: 3000 })
      modelUsed = 'gemini-3-flash-preview'
    }

    const cleaned  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const analysis = JSON.parse(cleaned) as CompetitorAnalysis

    const now = new Date().toISOString()

    // Save / overwrite cached report (primary store)
    await supabase
      .from('competitor_intelligence_reports')
      .upsert({
        client_id,
        report_json:  analysis,
        model_used:   modelUsed,
        generated_at: now,
      }, { onConflict: 'client_id' })

    // Back-sync enriched fields from landscape into competitor_snapshots.
    // Upserts by the unique key (client_id, competitor_handle, platform) so:
    //   • existing rows get scope/strategy/social_url/last_analyzed_at updated
    //   • AI-discovered competitors not yet in DB are inserted automatically
    if (analysis.landscape && analysis.landscape.length > 0) {
      const rows = analysis.landscape.map(comp => ({
        client_id,
        competitor_handle: comp.handle,
        platform:          comp.platform.toLowerCase(),
        followers:         comp.followers         ?? 0,
        avg_er:            comp.avg_er            ?? 0,
        posting_frequency: comp.posting_frequency ?? 0,
        scope:             comp.scope             ?? 'global',
        social_url:        comp.social_url        ?? null,
        platform_strategy: comp.platform_strategy ?? null,
        last_analyzed_at:  now,
      }))
      const { error: syncErr } = await supabase
        .from('competitor_snapshots')
        .upsert(rows, { onConflict: 'client_id,competitor_handle,platform' })
      if (syncErr) {
        console.error('[competitors/analyze] snapshot back-sync failed:', syncErr.message)
      }
    }

    return NextResponse.json({ analysis, cached: false, generated_at: analysis.generated_at })
  } catch (err) {
    console.error('[competitors/analyze]', err)
    return NextResponse.json({ error: 'Analysis generation failed' }, { status: 500 })
  }
}

/**
 * GET /api/competitors/analyze?client_id=
 * Returns the cached analysis without regenerating.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!HAS_DB)    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const supabase = getSupabase()

  const { data } = await supabase
    .from('competitor_intelligence_reports')
    .select('report_json, generated_at, model_used')
    .eq('client_id', client_id)
    .single()

  if (!data?.report_json) return NextResponse.json({ analysis: null })

  return NextResponse.json({
    analysis:     data.report_json as CompetitorAnalysis,
    generated_at: data.generated_at,
    model_used:   data.model_used,
    cached:       true,
  })
}
