import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { SignalReport } from '@/lib/studio-types'
import { fetchGoogleTrends } from '@/lib/data-providers/google-trends'
import { fetchRedditRising } from '@/lib/data-providers/reddit'
import { fetchTikTokTrends } from '@/lib/data-providers/tiktok-creative-center'
import { fetchYouTubeTrends } from '@/lib/data-providers/youtube'

// ── In-memory cache ───────────────────────────────────────────
// Key: signal_{industry}_{YYYY-MM-DD}

interface CacheEntry {
  report: SignalReport
  cached_at: number
}

const SIGNAL_CACHE = new Map<string, CacheEntry>()

function todayKey(industry: string): string {
  const date = new Date().toISOString().split('T')[0]
  return `signal_${industry}_${date}`
}

function getCachedReport(industry: string): SignalReport | null {
  const key = todayKey(industry)
  const entry = SIGNAL_CACHE.get(key)
  if (!entry) return null
  return entry.report
}

export function setCachedReport(industry: string, report: SignalReport): void {
  const key = todayKey(industry)
  SIGNAL_CACHE.set(key, { report, cached_at: Date.now() })
}

// ── Anthropic synthesis ───────────────────────────────────────

const anthropic = new Anthropic()

async function synthesizeSignalReport(
  industry: string,
  googleData: Awaited<ReturnType<typeof fetchGoogleTrends>>,
  redditData: Awaited<ReturnType<typeof fetchRedditRising>>,
  tiktokData: Awaited<ReturnType<typeof fetchTikTokTrends>>,
  youtubeData: Awaited<ReturnType<typeof fetchYouTubeTrends>>,
): Promise<SignalReport> {
  const now = new Date()
  const validUntil = new Date(now)
  validUntil.setHours(6, 0, 0, 0)
  if (validUntil <= now) validUntil.setDate(validUntil.getDate() + 1)

  const dataSourceNotes = [
    `Google Trends source: ${googleData.source}`,
    `Reddit source: ${redditData.source}`,
    `TikTok source: ${tiktokData.source}`,
    `YouTube source: ${youtubeData.source}`,
  ]
    .filter((n) => n.includes('fallback'))
    .map((n) => `NOTE: ${n.replace('source: fallback', 'data is using fallback mock data')}`)
    .join('\n')

  const contextBlock = `
INDUSTRY: ${industry}

GOOGLE TRENDS — Search intent velocity:
${JSON.stringify(googleData.trending_topics, null, 2)}
Breakout keywords: ${googleData.breakout_keywords.join(', ')}

REDDIT RISING — Cultural signals:
${JSON.stringify(redditData.rising_posts.slice(0, 8), null, 2)}
Cultural tensions observed: ${JSON.stringify(redditData.cultural_tensions, null, 2)}

TIKTOK CREATIVE CENTER — Viral formats and sounds:
Trending hashtags: ${JSON.stringify(tiktokData.trending_hashtags.slice(0, 6), null, 2)}
Trending sounds: ${tiktokData.trending_sounds.join('; ')}
Trending formats: ${tiktokData.trending_formats.join('; ')}

YOUTUBE TRENDS — Video format performance:
${JSON.stringify(youtubeData.trending_videos.slice(0, 4), null, 2)}
Top formats: ${JSON.stringify(youtubeData.trending_formats.slice(0, 3), null, 2)}

${dataSourceNotes ? `\n${dataSourceNotes}` : ''}
`.trim()

  const systemPrompt = `You are a senior market intelligence analyst specializing in social media trend synthesis.
You receive raw data from 4 sources (Google Trends, Reddit, TikTok, YouTube) and synthesize them into a structured signal report.
Your output must be valid JSON only — no markdown, no explanations, no text outside the JSON.
Be specific and evidence-based. Reference actual data points in the evidence fields.
Never invent data. If something is unclear, say so in the evidence field.`

  const userPrompt = `Synthesize the following market intelligence data for the ${industry} industry into a SignalReport JSON object.

${contextBlock}

Return ONLY a JSON object matching this exact shape (no extra fields, no markdown):
{
  "industry": "${industry}",
  "generated_at": "${now.toISOString()}",
  "valid_until": "${validUntil.toISOString()}",
  "trending_topics": [
    {
      "topic": "exact topic string",
      "platform": "Google/TikTok/Reddit/YouTube",
      "velocity": "rising_fast|rising|peaking|declining",
      "evidence": "specific data point, e.g. up 340% in 48h on Google Search"
    }
  ],
  "trending_formats": [
    {
      "format": "format description",
      "platform": "platform name",
      "why_working": "AI-extracted pattern explanation"
    }
  ],
  "cultural_tensions": [
    {
      "tension": "People love X but hate Y",
      "evidence": "source: subreddit + search data",
      "opportunity": "what a brand could do with this"
    }
  ],
  "trending_sounds": ["sound 1", "sound 2"],
  "breakout_keywords": ["keyword 1", "keyword 2"]
}

Requirements:
- trending_topics: 5-8 entries, sorted by velocity descending
- trending_formats: 3-5 entries across platforms
- cultural_tensions: 3-5 specific, actionable tensions observed in this data
- trending_sounds: up to 5 TikTok sounds
- breakout_keywords: 6-10 keywords
All evidence fields must cite specific data from the input, not generic statements.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  const report = JSON.parse(jsonText) as SignalReport
  return report
}

// ── Fallback signal report ─────────────────────────────────────

function buildFallbackReport(industry: string): SignalReport {
  const now = new Date()
  const validUntil = new Date(now)
  validUntil.setHours(6, 0, 0, 0)
  if (validUntil <= now) validUntil.setDate(validUntil.getDate() + 1)

  return {
    industry,
    generated_at: now.toISOString(),
    valid_until: validUntil.toISOString(),
    trending_topics: [
      { topic: `${industry} trends 2026`, platform: 'Google', velocity: 'rising', evidence: 'Fallback data — live fetch unavailable' },
      { topic: `best ${industry} tips`, platform: 'TikTok', velocity: 'rising', evidence: 'Fallback data — live fetch unavailable' },
      { topic: `${industry} mistakes to avoid`, platform: 'YouTube', velocity: 'peaking', evidence: 'Fallback data — live fetch unavailable' },
    ],
    trending_formats: [
      { format: 'Short-form educational video (30-60s)', platform: 'TikTok/Instagram', why_working: 'High information density in low attention span environment' },
      { format: 'Before/after transformation', platform: 'Instagram', why_working: 'Visual proof reduces skepticism and drives saves' },
      { format: 'Expert myth-busting', platform: 'YouTube', why_working: 'Contrarian framing creates urgency and challenge to existing beliefs' },
    ],
    cultural_tensions: [
      {
        tension: `People want ${industry} results but resist the effort and consistency required`,
        evidence: 'Observed across Reddit and Google Trends search velocity patterns',
        opportunity: 'Position your brand as the shortcut or simplification that makes consistency achievable',
      },
      {
        tension: 'Audiences want authentic content but engage most with polished, aspirational formats',
        evidence: 'YouTube high-view-count analysis shows production quality correlates with retention',
        opportunity: 'Lead with authentic hook, deliver aspirational outcome — marry both expectations',
      },
    ],
    trending_sounds: ['Original sound — lofi ambient', 'Trending audio — cinematic reveal'],
    breakout_keywords: [`${industry} guide`, `${industry} tips 2026`, `${industry} beginners`, `best ${industry}`, 'how to improve', 'honest review'],
  }
}

// ── GET handler ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  const { industry } = await params
  const normalizedIndustry = (industry ?? 'general').toLowerCase()

  // Cache hit — return immediately
  const cached = getCachedReport(normalizedIndustry)
  if (cached) {
    return NextResponse.json({ ...cached, _cache_hit: true })
  }

  // Cache miss — run all 4 providers in parallel
  const [googleResult, redditResult, tiktokResult, youtubeResult] = await Promise.allSettled([
    fetchGoogleTrends(normalizedIndustry),
    fetchRedditRising(normalizedIndustry),
    fetchTikTokTrends(normalizedIndustry),
    fetchYouTubeTrends(normalizedIndustry),
  ])

  const googleData = googleResult.status === 'fulfilled' ? googleResult.value : await fetchGoogleTrends(normalizedIndustry).catch(() => ({ trending_topics: [], breakout_keywords: [], source: 'fallback' as const, fetched_at: new Date().toISOString() }))
  const redditData = redditResult.status === 'fulfilled' ? redditResult.value : await fetchRedditRising(normalizedIndustry).catch(() => ({ rising_posts: [], relevant_subreddits: [], cultural_tensions: [], source: 'fallback' as const, fetched_at: new Date().toISOString() }))
  const tiktokData = tiktokResult.status === 'fulfilled' ? tiktokResult.value : await fetchTikTokTrends(normalizedIndustry).catch(() => ({ trending_hashtags: [], trending_sounds: [], trending_formats: [], source: 'fallback' as const, fetched_at: new Date().toISOString() }))
  const youtubeData = youtubeResult.status === 'fulfilled' ? youtubeResult.value : await fetchYouTubeTrends(normalizedIndustry).catch(() => ({ trending_videos: [], trending_formats: [], source: 'fallback' as const, fetched_at: new Date().toISOString() }))

  // Only synthesize with AI if key is available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const report = await synthesizeSignalReport(
        normalizedIndustry,
        googleData,
        redditData,
        tiktokData,
        youtubeData,
      )
      setCachedReport(normalizedIndustry, report)
      return NextResponse.json(report)
    } catch (err) {
      console.error('[signal-report] Synthesis failed:', err)
    }
  }

  // Fallback: build a basic report from the raw provider data
  const fallback = buildFallbackReport(normalizedIndustry)
  setCachedReport(normalizedIndustry, fallback)
  return NextResponse.json({ ...fallback, _fallback: true })
}
