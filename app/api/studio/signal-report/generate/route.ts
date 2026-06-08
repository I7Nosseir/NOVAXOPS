import { NextRequest, NextResponse } from 'next/server'
import type { SignalReport } from '@/lib/studio-types'
import { fetchGoogleTrends }  from '@/lib/data-providers/google-trends'
import { fetchTikTokTrends }  from '@/lib/data-providers/tiktok-creative-center'
import { fetchYouTubeTrends } from '@/lib/data-providers/youtube'
import { fetchTrendsMcpForced } from '@/lib/data-providers/trendsmcp'
import { setCachedReport }    from '../[industry]/route'

// ── AI synthesis ──────────────────────────────────────────────
// Uses Gemini (free key available) → falls back to Anthropic
// → falls back to rule-based assembly (no AI needed)

async function synthesiseWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No GEMINI_API_KEY')

  const model = 'gemini-3-flash-preview'
  const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${await res.text().catch(() => '')}`)

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

async function synthesiseWithAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client    = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 8192,
    messages:   [{ role: 'user', content: prompt }],
    system:     'You are a market intelligence analyst. Output valid JSON only — no markdown, no text outside the JSON.',
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// ── Rule-based assembly (no AI needed) ───────────────────────
// When no AI key is available, build a solid SignalReport
// directly from the raw data without synthesis.

function assembleWithoutAI(
  industry: string,
  googleData:   Awaited<ReturnType<typeof fetchGoogleTrends>>,
  tiktokData:   Awaited<ReturnType<typeof fetchTikTokTrends>>,
  youtubeData:  Awaited<ReturnType<typeof fetchYouTubeTrends>>,
  trendsmcpData: Awaited<ReturnType<typeof fetchTrendsMcpForced>>,
  validUntil: string,
): SignalReport {
  const now = new Date().toISOString()

  const trending_topics = [
    ...googleData.trending_topics.slice(0, 4).map(t => ({
      topic:    t.keyword,
      platform: 'Google Search',
      velocity: (parseInt(t.search_volume_increase) > 300 ? 'rising_fast' : 'rising') as SignalReport['trending_topics'][0]['velocity'],
      evidence: `${t.search_volume_increase} search volume increase over ${t.time_period}`,
    })),
    ...trendsmcpData.topics.slice(0, 3).map(t => ({
      topic:    t.topic,
      platform: t.source,
      velocity: 'rising' as const,
      evidence: `Trending on ${t.source}: growth signal ${t.growth}`,
    })),
  ].slice(0, 7)

  const trending_formats = [
    ...tiktokData.trending_formats.slice(0, 3).map(f => ({
      format: f, platform: 'TikTok', why_working: 'High engagement format trending on TikTok this week',
    })),
    ...youtubeData.trending_formats.slice(0, 2).map(f => ({
      format: f.format, platform: 'YouTube', why_working: f.why_working,
    })),
  ].slice(0, 5)

  const cultural_tensions = [
    {
      tension:     `People want ${industry} content that educates but distrust brands that sound like ads`,
      evidence:    `Observed across search and social data for ${industry} this week`,
      opportunity: `Lead with transparent, evidence-based content rather than brand language`,
    },
    {
      tension:     `Audiences want quick results but distrust overnight promises in ${industry}`,
      evidence:    `Observed across search and social data for ${industry} this week`,
      opportunity: `Frame timelines honestly — "what to expect in 30 days" outperforms "transform overnight"`,
    },
    {
      tension:     `People seek trusted voices but feel overwhelmed by the volume of ${industry} content`,
      evidence:    `Observed across search and social data for ${industry} this week`,
      opportunity: `Position as a trusted curator — "the 3 things that actually matter" beats comprehensive listicles`,
    },
  ]

  return {
    industry,
    generated_at: now,
    valid_until:  validUntil,
    trending_topics,
    trending_formats,
    cultural_tensions,
    trending_sounds:    tiktokData.trending_sounds.slice(0, 4),
    breakout_keywords:  googleData.breakout_keywords.slice(0, 8),
  }
}

// ── Main compute function ─────────────────────────────────────

async function computeSignalReport(industry: string): Promise<SignalReport> {
  const now = new Date()
  const validUntil = new Date(now)
  validUntil.setHours(6, 0, 0, 0)
  if (validUntil <= now) validUntil.setDate(validUntil.getDate() + 1)

  // ── Call 1 + 2: Free sources in parallel (always run) ──────
  const [googleResult, tiktokResult, youtubeResult] = await Promise.allSettled([
    fetchGoogleTrends(industry),
    fetchTikTokTrends(industry),
    fetchYouTubeTrends(industry),
  ])

  const failedSources: string[] = []

  const googleData = googleResult.status === 'fulfilled' ? googleResult.value
    : (failedSources.push('Google Trends'), { trending_topics: [], breakout_keywords: [], source: 'fallback' as const, fetched_at: now.toISOString() })

  const tiktokData = tiktokResult.status === 'fulfilled' ? tiktokResult.value
    : (failedSources.push('TikTok'), { trending_hashtags: [], trending_sounds: [], trending_formats: [], source: 'fallback' as const, fetched_at: now.toISOString() })

  const youtubeData = youtubeResult.status === 'fulfilled' ? youtubeResult.value
    : (failedSources.push('YouTube'), { trending_videos: [], trending_formats: [], source: 'fallback' as const, fetched_at: now.toISOString() })

  // ── Call 3: trendsmcp (quota-aware gap-filler) ─────────────
  // Only called if primary sources returned thin data OR forced
  const primaryTopicsCount = googleData.trending_topics.length + tiktokData.trending_hashtags.length
  const trendsmcpData = await fetchTrendsMcpForced(industry).catch(() => ({
    topics: [], raw_count: 0, source: 'failed' as const, fetched_at: now.toISOString(),
  }))

  const failureNote = failedSources.length > 0
    ? `NOTE: ${failedSources.join(', ')} used fallback data. Treat with reduced confidence.`
    : ''

  // ── Synthesis: Gemini → Anthropic → rule-based ─────────────
  const hasGemini    = !!process.env.GEMINI_API_KEY
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

  if (!hasGemini && !hasAnthropic) {
    console.info('[signal-report] No AI key — using rule-based assembly')
    return assembleWithoutAI(industry, googleData, tiktokData, youtubeData, trendsmcpData, validUntil.toISOString())
  }

  const contextBlock = `
INDUSTRY: ${industry}
DATE: ${now.toDateString()}

GOOGLE TRENDS (source: ${googleData.source}):
Trending topics: ${JSON.stringify(googleData.trending_topics.slice(0, 5), null, 2)}
Breakout keywords: ${googleData.breakout_keywords.slice(0, 8).join(', ')}

TIKTOK TRENDS (source: ${tiktokData.source}):
Top hashtags: ${tiktokData.trending_hashtags.slice(0, 6).map(h => `#${h.hashtag} (${(h.video_count / 1_000_000).toFixed(1)}M videos, ${h.trend_direction})`).join(', ')}
Trending sounds: ${tiktokData.trending_sounds.slice(0, 4).join(' | ')}
Winning formats: ${tiktokData.trending_formats.slice(0, 3).join(' | ')}

YOUTUBE TRENDS (source: ${youtubeData.source}):
Top videos: ${youtubeData.trending_videos.slice(0, 4).map(v => `"${v.title}" (${v.format_type})`).join(' | ')}
Winning formats: ${youtubeData.trending_formats.slice(0, 3).map(f => `${f.format} — ${f.why_working}`).join(' | ')}

TRENDSMCP CROSS-PLATFORM (source: ${trendsmcpData.source}):
${trendsmcpData.topics.length > 0 ? trendsmcpData.topics.slice(0, 8).map(t => `${t.topic} (${t.source}, growth: ${t.growth})`).join('\n') : 'Not available this run'}

${failureNote}
`.trim()

  const synthesisPrompt = `You are a senior market intelligence analyst. Synthesise this live ${industry} trend data into a SignalReport JSON.

${contextBlock}

Return ONLY valid JSON with this exact structure:
{
  "industry": "${industry}",
  "generated_at": "${now.toISOString()}",
  "valid_until": "${validUntil.toISOString()}",
  "trending_topics": [
    { "topic": "string", "platform": "Google|TikTok|YouTube|trendsmcp", "velocity": "rising_fast|rising|peaking|declining", "evidence": "cite specific number from the data above" }
  ],
  "trending_formats": [
    { "format": "string", "platform": "string", "why_working": "pattern from the data" }
  ],
  "cultural_tensions": [
    { "tension": "People love X but resist Y — specific to ${industry}", "evidence": "cite data source", "opportunity": "one-line brand opportunity" }
  ],
  "trending_sounds": ["TikTok sound name 1", "sound name 2"],
  "breakout_keywords": ["keyword 1", "keyword 2"]
}

Rules:
- 5-8 trending_topics, sorted by velocity descending
- 3-5 trending_formats across platforms
- 3-5 cultural_tensions — real contradictions this audience holds
- Up to 5 trending_sounds from TikTok data
- 6-10 breakout_keywords from Google data
- Every evidence field must cite a specific number or platform from the input`

  try {
    const rawText = hasGemini
      ? await synthesiseWithGemini(synthesisPrompt)
      : await synthesiseWithAnthropic(synthesisPrompt)

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const report  = JSON.parse(cleaned) as SignalReport
    return { ...report, industry }
  } catch (synthErr) {
    console.warn('[signal-report] AI synthesis failed, using rule-based assembly:', synthErr)
    return assembleWithoutAI(industry, googleData, tiktokData, youtubeData, trendsmcpData, validUntil.toISOString())
  }
}

// ── POST handler (cron target + on-demand) ────────────────────

export async function POST(req: NextRequest) {
  let body: { industry?: string } = {}
  try { body = await req.json() } catch { /* body optional */ }

  const industry = (body.industry ?? 'general').toLowerCase().trim()

  try {
    const report = await computeSignalReport(industry)
    setCachedReport(industry, report)

    return NextResponse.json({
      ...report,
      _fresh:       true,
      _computed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[signal-report/generate] Error:', err)
    return NextResponse.json(
      { error: 'Signal report generation failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
