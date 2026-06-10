// lib/report-prompts.ts
// Gemini prompt builders for each report template type.
// All prompts strictly forbid recommendations, suggestions, or action items.

const ARABIC_INSTRUCTION = `
LANGUAGE REQUIREMENT: Write all body text in Arabic (Modern Standard Arabic — الفصحى المعاصرة).
CRITICAL: The ### section headings must remain exactly in English as specified — do not translate them.
Write flowing, professional Arabic prose in each section body. Do not mix languages within a paragraph.
`.trim()

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
- Each section: 3–5 clear, simple sentences that anyone can understand. Cite at least one specific number per sentence.
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

export type PaidAdsData = {
  platform: string
  spend: string
  currency: string
  impressions: string
  reach: string
  clicks: string
  ctr: string
  cpc: string
  cpm: string
  conversions: string
  roas: string
  campaignName?: string
  imageUrl?: string
}

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
  if (stats.engagement_rate) lines.push(`Engagement Rate: ${Math.round(Number(stats.engagement_rate))}%`)
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
      `er=${Math.round(Number(p.engagement_rate))}%, posts=${p.posts}, ` +
      `likes=${p.likes}, comments=${p.comments}, shares=${p.shares}, saves=${p.saves}`
    )
    .join('\n')
}

function formatTrend(trend: MetricoolTrend[]): string {
  if (!trend.length) return 'No trend data available.'
  return trend.map(t =>
    `${t.month}: reach=${t.reach.toLocaleString()}, impressions=${t.impressions.toLocaleString()}, er=${Math.round(Number(t.er))}%`
  ).join('\n')
}

function formatPaidAds(ads: PaidAdsData): string {
  const lines: string[] = []
  if (ads.campaignName) lines.push(`Campaign: ${ads.campaignName}`)
  lines.push(`Platform: ${ads.platform}`)
  if (ads.currency) lines.push(`Currency: ${ads.currency}`)
  if (ads.spend) lines.push(`Total Ad Spend: ${ads.currency} ${Number(ads.spend).toLocaleString()}`)
  if (ads.impressions) lines.push(`Paid Impressions: ${Number(ads.impressions).toLocaleString()}`)
  if (ads.reach) lines.push(`Paid Reach: ${Number(ads.reach).toLocaleString()}`)
  if (ads.clicks) lines.push(`Link Clicks: ${Number(ads.clicks).toLocaleString()}`)
  if (ads.ctr) lines.push(`CTR (Click-Through Rate): ${ads.ctr}%`)
  if (ads.cpc) lines.push(`CPC (Cost Per Click): ${ads.currency} ${ads.cpc}`)
  if (ads.cpm) lines.push(`CPM (Cost Per 1,000 Impressions): ${ads.currency} ${ads.cpm}`)
  if (ads.conversions) lines.push(`Conversions / Results: ${Number(ads.conversions).toLocaleString()}`)
  if (ads.roas) lines.push(`ROAS (Return on Ad Spend): ${ads.roas}x`)
  return lines.join('\n')
}

function formatMultiplePaidAds(campaigns: PaidAdsData[]): string {
  const active = campaigns.filter(c => c.spend)
  if (!active.length) return ''
  if (active.length === 1) return formatPaidAds(active[0])
  return active
    .map((c, i) => `--- Campaign ${i + 1}${c.campaignName ? ` (${c.campaignName})` : ''} ---\n${formatPaidAds(c)}`)
    .join('\n\n')
}

// ─── Monthly Performance ────────────────────────────────────────────────────

export function buildMonthlyPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext,
  language?: 'en' | 'ar',
  adCampaigns?: PaidAdsData[] | null
): string {
  const activeCampaigns = (adCampaigns ?? []).filter(c => c.spend)
  const hasPaid = activeCampaigns.length > 0
  const activePlatforms = data.platforms.filter(p => p.reach > 0 || p.impressions > 0 || p.likes > 0)

  return `${language === 'ar' ? ARABIC_INSTRUCTION + '\n\n' : ''}You are a social media analyst at NOVAX, a creative marketing agency.
Write a plain-language Monthly Performance Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}
${brand?.tone ? `Brand tone: ${brand.tone}` : ''}

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

ORGANIC PERFORMANCE DATA — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

5-MONTH TREND:
${formatTrend(data.trend)}

ENGAGEMENT RATE CONTEXT (for interpretation):
- Good interaction rate on Instagram: 1–3% is solid, 4%+ is excellent
- Good interaction rate on TikTok: 5–9% of viewers
- Good interaction rate on Facebook: 0.5–1.5% of viewers
- Good interaction rate on LinkedIn: 2–4% of viewers
- Industry average across platforms: ~2%

${hasPaid ? `PAID ADVERTISING DATA — ${period}:\n${formatMultiplePaidAds(activeCampaigns)}` : ''}

${NO_RECS}

Write exactly these sections in order. Use plain, simple language throughout — no jargon. Each section must contain 3–5 sentences and cite specific numbers in every sentence.

### Executive Summary
A clear 3–4 sentence overview of the month. Open with the single most impressive number and explain what it means to a non-marketer. Mention the total reach, the engagement rate in plain language (e.g. "X out of every 100 people who saw the content took an action"), and the total number of posts published. If trend data is available, note whether this was an improvement or decline compared to the previous month.

### Reach & Impressions Analysis
Explain in plain terms how many different people the content reached this month, and how many total times it appeared on screens. State both numbers clearly. If available, describe how these numbers compare to previous months from the trend data — were they higher, lower, or about the same? Explain the difference between reach and impressions in one plain sentence (one person can see your content multiple times — impressions count every time, reach only counts each person once). If the impressions-to-reach ratio is notably high or low, note what that means about how many times on average each person saw the content.

### Engagement Analysis
Describe in detail how people reacted to the content — total likes, comments, shares, and saves, citing every number. State the overall engagement rate as a whole number percentage (e.g. "X% of people who saw the content took an action"). Break down which type of interaction was highest — if saves are high, explain that saves mean people found the content valuable enough to come back to it; if comments are high, explain that comments show people were motivated to have a conversation. If the engagement rate is above 2%, note that this is above the industry average.

### Platform Performance
Compare all active platforms side-by-side this month. State the reach, total interactions (likes + comments + shares), and engagement rate for every active platform with specific numbers. Identify clearly which platform delivered the highest reach and which delivered the highest engagement rate — and by how much. If one platform has significantly more posts than another, note the volume difference and what it implies about content distribution.

### Platform Narratives
${activePlatforms.length > 0 ? `Active platforms to cover: ${activePlatforms.map(p => p.platform).join(', ')}.` : ''}For each platform listed in the PER-PLATFORM BREAKDOWN that has non-zero data, write exactly one dedicated paragraph. Start each paragraph with the platform name in bold (e.g. **Instagram**). For each platform state: the exact reach, the exact engagement rate as a percentage, the top interaction type (likes / comments / saves / shares), and one observation about what the numbers reveal about that platform's audience. If only one platform has data, still write this section for that platform.

### Trend Analysis
Using the 5-month data, explain in simple terms whether the audience is growing, shrinking, or staying stable. Compare this month's reach to the previous month and to the earliest month in the trend data — state the actual numbers for both. If the engagement rate is trending up or down over the months, state the direction and the figures for the most recent and oldest months. Note whether any specific month stood out as a peak or dip.

### Content Frequency & Publishing Cadence
State exactly how many posts were published this month across all platforms. Calculate the approximate posting frequency (posts per week) and state it plainly. If per-platform data is available, state how many posts each platform received this month. Compare to previous months if trend data provides post counts.

### Audience Interaction Depth
Go deeper on the quality of audience interaction this month. State the saves count and what it represents as a percentage of total reach (saves / reach × 100) — high save rates mean people found the content worth keeping. State the total comments and what it reveals about how actively people engaged with the content. If shares data is available, note how many times people chose to share the content with their own followers, which is a sign the content resonated beyond the original audience. Summarise the overall quality of interaction in one plain sentence.

${hasPaid ? `### Paid Media Performance
Describe the paid advertising results for this month in plain terms.${activeCampaigns.length > 1 ? ` There are ${activeCampaigns.length} campaigns — briefly describe each one's spend and key result.` : ''} State the total amount spent${activeCampaigns.length > 1 ? ' across all campaigns' : ''} and what it bought in terms of reach and impressions. If CTR data is available, explain it in plain language (e.g. "out of every 100 people who saw the ad, X clicked it"). If ROAS or conversions data is available, state those figures clearly. Compare the paid reach to the organic reach if both are available, noting how the two channels worked together this month.` : ''}

${PLAIN_FORMAT}`
}

// ─── Paid Ads ────────────────────────────────────────────────────────────────

export function buildPaidPrompt(
  data: ReportData,
  clientName: string,
  period: string,
  brand?: BrandContext
): string {
  return `You are a senior paid media analyst at NOVAX, a creative marketing agency.
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
  return `You are a senior social media strategist at NOVAX, a creative marketing agency.
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

  return `You are a senior social media analyst at NOVAX, a creative marketing agency.
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
  return `You are a senior social media analyst at NOVAX, a creative marketing agency.
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
  return `You are a senior analyst at NOVAX, a creative marketing agency.
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
  brand?: BrandContext,
  language?: 'en' | 'ar',
  adCampaigns?: PaidAdsData[] | null
): string {
  switch (reportType) {
    case 'monthly':   return buildMonthlyPrompt(data, clientName, period, brand, language, adCampaigns)
    case 'paid':      return buildPaidPrompt(data, clientName, period, brand)
    case 'combined':  return buildCombinedPrompt(data, clientName, period, brand)
    case 'platform':  return buildPlatformPrompt(data, clientName, period, brand)
    case 'quarterly': return buildQuarterlyPrompt(data, clientName, period, brand)
    case 'executive': return buildExecutivePrompt(data, clientName, period, brand)
    default:          return buildMonthlyPrompt(data, clientName, period, brand, language, adCampaigns)
  }
}
