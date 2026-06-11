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
Write a deep, plain-language Monthly Performance Report for ${clientName} covering ${period}.
${brand?.industry ? `Industry: ${brand.industry}` : ''}
${brand?.tone ? `Brand tone: ${brand.tone}` : ''}

This report is read by a business owner with no marketing background. Explain every number in plain terms, always compare it to a real-world benchmark, and tell them clearly whether each result is strong, average, or below average. Never use jargon without immediately explaining it. Use concrete analogies where they help — for example, if 50,000 people were reached, you can say "that is equivalent to filling a medium-sized concert hall 5 times."

${data.isMock ? '⚠ DATA NOTE: Live analytics unavailable — analysis is based on sample data.' : ''}

ORGANIC PERFORMANCE DATA — ${period}:
${formatStats(data.stats)}

PER-PLATFORM BREAKDOWN:
${formatPlatforms(data.platforms)}

5-MONTH TREND:
${formatTrend(data.trend)}

BENCHMARK STANDARDS (use these throughout the report to assess every number):
- Engagement rate (% of audience who took any action): below 1% = low; 1–2% = average; 2–4% = good; above 4% = excellent
- Instagram brand benchmark: 1.5–3.5% is typical; above 3.5% is strong
- TikTok brand benchmark: 5–9% is typical; above 9% is strong
- Facebook brand benchmark: 0.5–1.5% is typical; above 1.5% is strong
- LinkedIn brand benchmark: 2–4% is typical; above 4% is strong
- Save rate (saves ÷ reach): 0.5%+ is solid; 1%+ is strong (people found content worth keeping)
- Comment rate (comments ÷ reach): 0.3%+ shows genuine audience interest
- Share rate (shares ÷ reach): 0.2%+ means content resonated beyond the original audience
- Monthly reach growth: 5%+ month-over-month is healthy growth
- Posting frequency: 4–7 posts per week is a healthy content rhythm for most brands

${hasPaid ? `PAID ADVERTISING DATA — ${period}:\n${formatMultiplePaidAds(activeCampaigns)}` : ''}

${NO_RECS}

Write exactly these sections in order. Each section must be 5–7 sentences. Cite specific numbers in every sentence. After the data, always add a benchmark verdict — one sentence that clearly states whether this is strong, average, or below average.

### Executive Summary
Open with the single most impressive or important number from this month and immediately explain what it means in plain English (avoid the word "impressive" itself — just state the fact and what it means). State the total reach and explain it concretely (e.g. "that means X different people saw at least one post"). State the overall engagement rate as "X out of every 100 people who saw the content took an action" — then compare it to the 2% industry average and state whether this month was strong, average, or below average. Mention the total posts published and whether the data shows an improvement or decline compared to the previous month. End with one plain-language sentence that summarises the overall health of the account.

### Reach & Impressions Analysis
Start by explaining reach in one sentence: reach counts how many different people saw your content — each person counted once regardless of how many times they saw it. State the exact reach number. Then explain impressions in one sentence: impressions count every single time your content appeared on someone's screen, including repeat views from the same person. State the exact impressions number. Divide impressions by reach and state the average number of times each person encountered the content (e.g. "on average, each person saw your content X times"). Compare both figures to the previous month using the trend data — state the actual previous-month numbers and the percentage change. Assess whether this reach is above, in line with, or below the 5-month trend average.

### Engagement Analysis
Begin by defining engagement for a non-marketer: engagement means any action someone takes after seeing your content — a like, a comment, a share, or a save. State the total engagement actions (likes + comments + shares + saves) as one combined number. State the engagement rate as a percentage and translate it plainly: "X out of every 100 people who saw the content took an action." Compare this rate to the relevant platform benchmarks listed above and state explicitly whether this is strong, average, or below average. Break down the specific counts for likes, comments, shares, and saves — state every number. Identify which action was highest and explain what that reveals: high saves mean people found the content valuable enough to revisit later; high comments mean the content sparked real conversations; high shares mean people wanted their own followers to see it. If the combined engagement rate across all platforms is above 2%, note that this exceeds the general industry average.

### Platform Performance
For every active platform, state the reach, engagement rate, total interactions (likes + comments + shares + saves), and number of posts published — all with exact numbers. Identify which platform delivered the highest reach this month and by how much compared to the second-highest. Identify which platform had the highest engagement rate, compare it to that platform's own benchmark (e.g. if Instagram reached 4%, note it exceeds Instagram's 1.5–3.5% average), and state the verdict clearly. Note if any platform is receiving significantly more or fewer posts than others, and what the data says about content distribution. If a platform has a lower engagement rate than expected, note that without interpreting why — just state the number against its benchmark.

### Platform Narratives
${activePlatforms.length > 0 ? `Active platforms to cover: ${activePlatforms.map(p => p.platform).join(', ')}.` : ''}For each platform in the PER-PLATFORM BREAKDOWN with non-zero data, write one dedicated paragraph of 5–6 sentences. Start each paragraph with the platform name in bold (e.g. **Instagram**). State the exact reach and how many times each person on average saw the content on that platform (impressions ÷ reach). State the exact engagement rate and compare it clearly to that platform's benchmark — state whether it is strong, average, or below average. State the top interaction type with the exact count (likes, comments, saves, or shares). Explain what this combination of numbers says about how the audience on this specific platform is engaging — are they passively watching, actively interacting, or sharing content? End each paragraph with one observation about what the data reveals about the platform's audience behaviour.

### Trend Analysis
Using the 5-month data, explain in plain terms whether the brand's social media audience is growing, declining, or staying roughly the same. State this month's reach alongside last month's reach and calculate the change as a percentage — note whether it went up or down and by how much. Then compare this month's reach to the oldest month in the trend data — state both numbers and the percentage change over the full period to show the longer-term direction. If the engagement rate has changed over the 5 months, state the oldest rate and the newest rate, and describe the direction of travel plainly. Identify the peak month in the trend data and the lowest month, stating the specific numbers for both. End with one plain verdict about the trajectory — for example, "The account is growing steadily" or "Reach has declined over the past two months."

### Content Frequency & Publishing Cadence
State exactly how many posts were published this month across all platforms. Calculate the average weekly posting rate (posts ÷ 4) and state it plainly. Compare this to the benchmark of 4–7 posts per week and state whether the brand is posting above, within, or below that healthy range. If per-platform data shows post counts, state how many posts each platform received and identify which platform received the most content investment. Note whether months with higher post volumes in the trend data corresponded to higher reach or engagement — if the data supports a pattern, describe it in one plain sentence. Summarise what the posting volume this month tells us about content output and consistency.

### Audience Interaction Depth
Go deeper on interaction quality beyond surface-level counts. Calculate the save rate (saves ÷ reach × 100) — state the result and benchmark it: above 0.5% is solid, above 1% is strong. Explain what saves mean in plain language: when someone saves a post, they are choosing to come back to it later, which signals genuinely useful or inspiring content. Calculate the comment rate (comments ÷ reach × 100) — state the result. Note that comments require more effort than a like, so each comment represents a person who felt strongly enough to type a response. If shares are available, calculate the share rate (shares ÷ reach × 100) and explain that shares extend the content beyond the original audience to new people the brand hasn't reached before. Summarise the overall quality of audience connection this month in one plain sentence — combining the save rate, comment rate, and share rate to describe how deeply the content resonated.

${hasPaid ? `### Paid Media Performance
Start by explaining what paid advertising is for a non-marketer: it means paying the social media platform to show your content to more people than would naturally see it. State the total amount spent${activeCampaigns.length > 1 ? ` across all ${activeCampaigns.length} campaigns` : ''} and what currency. State the paid reach (number of unique people who saw the ads) and paid impressions (total number of times the ads appeared) with exact numbers. If CTR (click-through rate) data is available, explain it plainly: "out of every 100 people who saw the ad, X of them clicked on it" — state whether this is above or below the typical 1–2% CTR for social ads. If ROAS (return on ad spend) data is available, explain it in the simplest terms: "for every dollar/dirham spent, the campaign generated X dollars/dirhams in return." Compare the paid reach to the organic reach to show how the two channels combined to reach the overall audience this month.` : ''}

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
