// lib/report-prompts.ts
// Gemini prompt builders for each report template type.
// All prompts strictly forbid recommendations, suggestions, or action items.

// Plain-language format rule for the master monthly template (client-facing)
const PLAIN_FORMAT = `
FORMAT RULES — PLAIN LANGUAGE:
- Write as if explaining to someone who has never read a social media report
- When you first use a technical term, briefly explain it in parentheses:
  e.g. "reach (how many different people saw your content)"
  e.g. "engagement rate (the percentage of people who interacted with what they saw)"
- Replace "impressions" with "times your content appeared on screens"
- Avoid: "KPIs", "organic", "amplification", "trajectory", "benchmark", "synergy"
- Bold (**text**) every key number and percentage
- No hashtags, no emojis
- Conversational tone — imagine explaining to a business owner with no marketing background
- Each section: 2–4 clear, simple sentences that anyone can understand
- If data for a section is unavailable or all zeros, skip that section entirely
`.trim()

const NO_RECS = `
STRICT RULE — DO NOT INCLUDE:
- Recommendations, suggestions, or action items of any kind
- "You should...", "We recommend...", "Consider...", "It would be beneficial..."
- "Next steps", "Action plan", "Strategic priorities", "Q2 priorities"
- Any forward-looking advice or prescriptive language
Your report describes what happened. It does not tell anyone what to do next.
`.trim()

const FORMAT = `
FORMAT RULES:
- Write in flowing prose paragraphs — no bullet points
- Bold (**text**) every key number, percentage, and metric name
- No hashtags, no emojis
- Professional, analytical tone — senior analyst briefing a CEO
- Each section: 2–4 substantive sentences. Cite specific numbers.
- If data for a section is unavailable or all zeros, skip that section entirely.
`.trim()

type MetricoolStats = Record<string, number>
type MetricoolPlatform = {
  platform: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  posts: number
  engagement_rate: number
}
type MetricoolTrend = { month: string; reach: number; impressions: number; er: number }

type ReportData = {
  stats: MetricoolStats
  platforms: MetricoolPlatform[]
  trend: MetricoolTrend[]
  isMock: boolean
}

type BrandContext = {
  industry?: string
  tone?: string
  primaryPlatforms?: string[]
}

function formatStats(stats: MetricoolStats): string {
  const lines: string[] = []
  if (stats.reach)           lines.push(`Total Reach: ${Math.round(stats.reach).toLocaleString()}`)
  if (stats.impressions)     lines.push(`Total Impressions: ${Math.round(stats.impressions).toLocaleString()}`)
  if (stats.engagement_rate) lines.push(`Engagement Rate: ${Number(stats.engagement_rate).toFixed(2)}%`)
  if (stats.likes)           lines.push(`Total Likes: ${Math.round(stats.likes).toLocaleString()}`)
  if (stats.comments)        lines.push(`Total Comments: ${Math.round(stats.comments).toLocaleString()}`)
  if (stats.shares)          lines.push(`Total Shares: ${Math.round(stats.shares).toLocaleString()}`)
  if (stats.saves)           lines.push(`Total Saves: ${Math.round(stats.saves).toLocaleString()}`)
  if (stats.followers)       lines.push(`Net New Followers: ${Math.round(stats.followers).toLocaleString()}`)
  if (stats.clicks)          lines.push(`Website Clicks: ${Math.round(stats.clicks).toLocaleString()}`)
  if (stats.posts)           lines.push(`Total Posts Published: ${Math.round(stats.posts).toLocaleString()}`)
  return lines.join('\n')
}

function formatPlatforms(platforms: MetricoolPlatform[]): string {
  if (!platforms.length) return 'No per-platform data available.'
  return platforms
    .filter(p => p.reach > 0 || p.impressions > 0)
    .map(p =>
      `${p.platform.toUpperCase()}: reach=${p.reach.toLocaleString()}, impressions=${p.impressions.toLocaleString()}, ` +
      `er=${Number(p.engagement_rate).toFixed(2)}%, posts=${p.posts}, ` +
      `likes=${p.likes}, comments=${p.comments}, shares=${p.shares}, saves=${p.saves}`
    )
    .join('\n')
}

function formatTrend(trend: MetricoolTrend[]): string {
  if (!trend.length) return 'No trend data available.'
  return trend.map(t =>
    `${t.month}: reach=${t.reach.toLocaleString()}, impressions=${t.impressions.toLocaleString()}, er=${Number(t.er).toFixed(2)}%`
  ).join('\n')
}

// ─── Monthly Performance ────────────────────────────────────────────────────

export function buildMonthlyPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  return `You are a social media analyst at NOVAX, a creative marketing agency.
Write a plain-language Monthly Performance Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}
${brand?.tone ? `Brand tone: ${brand.tone}` : ''}

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

PERFORMANCE DATA — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

5-MONTH TREND:
${formatTrend(data.trend)}

CONTEXT:
- Good interaction rate on Instagram: 1.5–3.5% of viewers
- Good interaction rate on TikTok: 5–9% of viewers
- Good interaction rate on Facebook: 0.5–1.5% of viewers
- Good interaction rate on LinkedIn: 2–4% of viewers

${NO_RECS}

Write exactly these sections in order. Use plain, simple language throughout — no jargon.

### Executive Summary
A simple 3-sentence overview of the month. Lead with the most impressive number. Explain what it means in everyday language.

### Reach & Impressions Analysis
Explain in plain terms how many people the content reached and how many times it appeared on screens. Say whether this is more or less than before, if trend data is available.

### Engagement Analysis
Explain how people reacted to the content — how many liked, commented, or shared. Put the interaction rate in plain language (e.g. "X out of every 100 people who saw the content interacted with it").

### Platform Performance
Describe which social media platforms performed best and worst, in simple terms. Reference specific numbers from each platform.

### Trend Analysis
Explain in simple terms whether the audience is growing, shrinking, or staying stable compared to previous months. Reference specific monthly figures.

### Audience Engagement
Summarise the quality of audience interaction — are people saving, sharing, or commenting? State the specific numbers. Explain what this shows about how the content is resonating.

${PLAIN_FORMAT}`
}

// ─── Paid Ads ────────────────────────────────────────────────────────────────

export function buildPaidPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  return `You are a senior paid media analyst at NOVA, a creative marketing agency.
Write a professional Paid Media Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}

NOTE: Paid campaign spend and ROAS data is sourced from ad platforms (Meta Ads Manager, TikTok Ads, etc.) and is not available via the scheduling platform API. The data below reflects organic reach and engagement metrics that can serve as performance proxies.

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

AVAILABLE METRICS — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

${NO_RECS}

Write exactly these sections in order:

### Executive Summary
3 key findings. Each must reference a specific number.

### Organic Reach & Impressions
State the total organic reach and impressions for the period. Reference platform distribution where available.

### Engagement Performance
State the engagement rate, saves, comments, and shares with specific numbers. Compare against the benchmarks above.

### Platform Distribution
State each platform's reach, impressions, and ER. Identify which platform recorded the highest and lowest figures.

${FORMAT}`
}

// ─── Paid + Organic Combined ─────────────────────────────────────────────────

export function buildCombinedPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  return `You are a senior social media strategist at NOVA, a creative marketing agency.
Write a Paid + Organic Combined Performance Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}

NOTE: This report reflects organic metrics from the scheduling platform. Paid campaign data (spend, ROAS, CPC) would be overlaid from ad platform integrations.

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

ORGANIC METRICS — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

5-MONTH ORGANIC TREND:
${formatTrend(data.trend)}

${NO_RECS}

Write exactly these sections in order:

### Executive Summary
3 key findings about organic performance. Each must reference a specific number.

### Organic Performance Analysis
Analyse total organic reach, impressions, and engagement rate.

### Channel Mix Analysis
Analyse how reach is distributed across platforms. Identify over- and under-performing channels.

### Cross-Channel Performance
State the engagement quality metrics — save rate, comment rate, and ER — for each platform with specific numbers.

${FORMAT}`
}

// ─── Platform Deep Dive ───────────────────────────────────────────────────────

export function buildPlatformPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  const topPlatform = data.platforms.length
    ? data.platforms.reduce((a, b) => (a.reach > b.reach ? a : b))
    : null
  const platformName = topPlatform ? topPlatform.platform.charAt(0).toUpperCase() + topPlatform.platform.slice(1) : 'Primary Platform'
  const platformData = topPlatform ? formatPlatforms([topPlatform]) : 'No platform data available.'

  return `You are a senior social media analyst at NOVA, a creative marketing agency.
Write a Platform Deep Dive Report for ${clientName} focusing on ${platformName} for ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

${platformName.toUpperCase()} PLATFORM DATA — ${period}:
${platformData}

ALL PLATFORMS FOR CONTEXT:
${formatPlatforms(data.platforms)}

5-MONTH TREND (all platforms):
${formatTrend(data.trend)}

BENCHMARKS:
- Instagram average organic ER: 1.5–3.5%
- TikTok average organic ER: 5–9%
- Healthy save rate: 2%+ of reach
- Story completion benchmark: 55%+

${NO_RECS}

Write exactly these sections in order:

### Executive Summary
3 key findings about ${platformName} performance. Each must reference a specific number.

### Follower Growth & Reach
Analyse reach and audience growth on ${platformName}.

### Engagement Quality
Analyse engagement rate, saves, comments, and what they indicate about audience quality. Apply the benchmarks above.

### Engagement Composition
State the save rate, comment rate, and share rate as percentages of reach. Identify which engagement metric is highest and which is lowest, with the specific numbers.

${FORMAT}`
}

// ─── Quarterly Report ────────────────────────────────────────────────────────

export function buildQuarterlyPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  const quarterMonths = data.trend.slice(-3)
  return `You are a senior social media analyst at NOVA, a creative marketing agency.
Write a Quarterly Performance Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

QUARTERLY AGGREGATED DATA — ${period}:
${formatStats(data.stats)}

MONTH-BY-MONTH BREAKDOWN:
${quarterMonths.length ? formatTrend(quarterMonths) : formatTrend(data.trend)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

BENCHMARKS:
- Instagram average organic ER: 1.5–3.5%
- Healthy quarterly follower growth: 5%+
- Healthy quarterly reach growth: 10%+

${NO_RECS}

Write exactly these sections in order:

### Executive Summary
3 key quarterly achievements. Each must reference a specific number.

### Quarterly Performance Overview
Summarise the overall quarter performance across reach, impressions, and engagement.

### Month-by-Month Analysis
Describe the monthly progression across the quarter. Identify which month performed strongest and why the data suggests that.

### Platform Performance
Compare platform-by-platform results for the full quarter.

### Growth Analysis
Analyse follower growth, reach growth, and engagement rate trajectory across the quarter.

${FORMAT}`
}

// ─── Executive Summary ────────────────────────────────────────────────────────

export function buildExecutivePrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  return `You are a senior analyst at NOVA, a creative marketing agency.
Write an Executive Summary performance report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}
This report is for the agency CEO and client leadership — keep it high-level and focused on the numbers that matter most.

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

KEY METRICS — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

5-MONTH TREND:
${formatTrend(data.trend)}

BENCHMARKS:
- Industry average organic ER: 2–4%
- Healthy monthly follower growth: 2%+
- Healthy monthly reach growth: 5%+

${NO_RECS}

Write exactly these sections in order:

### Portfolio Overview
A high-level summary of the period performance — reach, impressions, ER, follower growth in 2–3 sentences. Lead with the headline number.

### Performance Highlights
What stood out this period? Reference the top 2–3 metric achievements with specific numbers.

### Platform Distribution
Which platforms contributed most to reach and engagement? Reference the data.

### Audience & Engagement Quality
Summarise the quality of the audience engagement — ER, saves, comments as signals.

${FORMAT}`
}

// ─── Master dispatcher ────────────────────────────────────────────────────────

export function buildReportPrompt(
  reportType: string,
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  switch (reportType) {
    case 'monthly':   return buildMonthlyPrompt(data, clientName, period, brand)
    case 'paid':      return buildPaidPrompt(data, clientName, period, brand)
    case 'combined':  return buildCombinedPrompt(data, clientName, period, brand)
    case 'platform':  return buildPlatformPrompt(data, clientName, period, brand)
    case 'quarterly': return buildQuarterlyPrompt(data, clientName, period, brand)
    case 'executive': return buildExecutivePrompt(data, clientName, period, brand)
    default:          return buildMonthlyPrompt(data, clientName, period, brand)
  }
}
