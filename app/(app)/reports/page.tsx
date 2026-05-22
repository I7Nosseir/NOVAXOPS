'use client'

import { useState, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatNumber, cn, vendorName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  FileText, TrendingUp, Users, Eye, Download, Upload,
  BarChart2, Target, Layers, Globe, Zap, ArrowUpRight, ArrowDownRight,
  Check, AlertCircle, ChevronRight, X, DollarSign, Activity,
  Calendar, Star, RefreshCw, Sparkles, Printer,
} from 'lucide-react'

// ─── Brand palette ─────────────────────────────────────────────────────────────
const B = {
  primary: '#1B3D38',
  muted:   '#2A6B62',
  accent:  '#5BB4AE',
  border:  '#9DCCC8',
  light:   '#EBF4F3',
}

// ─── Tab definition ────────────────────────────────────────────────────────────
type ReportTab = 'monthly' | 'paid' | 'combined' | 'platform' | 'quarterly' | 'executive' | 'ai'
type IconProps = { className?: string }
type KPIRow         = { metric: string; current: string; previous: string; delta: string; positive: boolean | null; benchmark: string; vsBenchmark: string; vsBenchmarkPositive: boolean | null }
type ActionRow      = { action: string; owner: string; deadline: string; impact: string; priority: 'high' | 'medium' | 'low' }
type AudienceRow    = { signal: string; value: string; benchmark: string; status: 'good' | 'warning' | 'poor'; note: string }
type Competitor     = { name: string; followers: string; er: string; posts: number; avgReach: string }
type BottomPost     = { platform: string; type: string; reach: number; er: number; caption: string; diagnosis: string }

const TABS: { id: ReportTab; label: string; icon: (p: IconProps) => React.ReactElement; description: string }[] = [
  { id: 'monthly',    label: 'Monthly Performance',  icon: (p: IconProps) => <BarChart2  {...p}/>, description: 'Organic reach, impressions, ER trend, platform breakdown, top posts and recommendations.' },
  { id: 'paid',       label: 'Paid Ads',             icon: (p: IconProps) => <DollarSign {...p}/>, description: 'ROAS, CPM/CPC/CTR/CPA, weekly spend vs revenue, campaign table and creative rankings.' },
  { id: 'combined',   label: 'Paid + Organic',       icon: (p: IconProps) => <Layers     {...p}/>, description: 'Blended reach split, paid vs organic trend, channel mix and investment breakdown.' },
  { id: 'platform',   label: 'Platform Deep Dive',   icon: (p: IconProps) => <Globe      {...p}/>, description: 'Instagram-focused: follower growth, format performance, best posting days and hashtags.' },
  { id: 'quarterly',  label: 'Quarterly Report',     icon: (p: IconProps) => <Calendar   {...p}/>, description: 'Quarter OKR scorecard, monthly trend, campaign highlights and next-quarter priorities.' },
  { id: 'executive',  label: 'Executive Summary',    icon: (p: IconProps) => <Star       {...p}/>, description: 'CEO-ready one-page: top KPIs, wins, opportunities and single priority action.' },
  { id: 'ai',         label: 'AI Report Builder',    icon: (p: IconProps) => <Sparkles   {...p}/>, description: 'Upload analytics screenshots or paste data — AI extracts and formats a branded report.' },
]

// ─── Demo data ──────────────────────────────────────────────────────────────────
const MONTHLY_DEMO = {
  period: 'May 2026', prevPeriod: 'April 2026',
  kpis: { reach: 284500, impressions: 412000, er: 5.8, followers: 2840, posts: 34 },
  deltas: { reach: '+18.4%', impressions: '+22.1%', er: '+0.8%', followers: '+7.1%' },
  trend: [
    { month: 'Jan', reach: 182000, impressions: 264000, er: 4.8 },
    { month: 'Feb', reach: 198000, impressions: 287000, er: 5.1 },
    { month: 'Mar', reach: 224000, impressions: 326000, er: 5.4 },
    { month: 'Apr', reach: 241000, impressions: 349000, er: 5.0 },
    { month: 'May', reach: 284500, impressions: 412000, er: 5.8 },
  ],
  platforms: [
    { name: 'Instagram', reach: 168000, posts: 18, er: 6.8, color: '#E1306C' },
    { name: 'TikTok',    reach: 71000,  posts: 7,  er: 9.1, color: '#2A2A2A' },
    { name: 'Facebook',  reach: 28200,  posts: 6,  er: 3.4, color: '#1877F2' },
    { name: 'LinkedIn',  reach: 17300,  posts: 3,  er: 4.2, color: '#0A66C2' },
  ],
  contentTypes: [
    { type: 'Reels',    posts: 8,  reach: 98200, er: 8.4 },
    { type: 'Carousel', posts: 12, reach: 76000, er: 6.2 },
    { type: 'Static',   posts: 10, reach: 64000, er: 4.1 },
    { type: 'Stories',  posts: 4,  reach: 46300, er: 3.8 },
  ],
  topPosts: [
    { platform: 'Instagram', type: 'Reel',     reach: 48200, er: 12.4, caption: 'Summer Glow Collection — first look reveal',          why: 'First-look reveal with founder voiceover drove 3× average saves. Shared organically by 2 micro-influencers within 6 hours, compounding reach. Hook landed in the first 2 seconds.' },
    { platform: 'TikTok',    type: 'Video',    reach: 29900, er: 9.1,  caption: 'Morning skincare routine with Hydra Serum',           why: 'Tutorial format with bold opening hook. Dueted by 4 accounts, adding 8,400 views at zero incremental cost. Native text overlays improved watch-through to 74%.' },
    { platform: 'Instagram', type: 'Carousel', reach: 22400, er: 8.7,  caption: '5 reasons dermatologists recommend us',              why: '62% of engagement came from saves, indicating high utility perception. Post remained on Explore for 8 days due to sustained save velocity.' },
    { platform: 'LinkedIn',  type: 'Article',  reach: 17300, er: 4.2,  caption: 'Why ingredient transparency is the future of beauty', why: 'Long-form credibility content outperformed short posts 3:1. 14 industry reposts amplified B2B reach. Avg dwell time of 4.2 min drove algorithm favourability.' },
    { platform: 'Facebook',  type: 'Video',    reach: 14200, er: 3.8,  caption: 'Customer story — 90-day transformation',             why: 'UGC-style testimonial outperformed all branded Facebook content by 2.4×. Native upload received algorithm preference over link shares. 38% of views from shares.' },
  ],
  bottomPosts: [
    { platform: 'Instagram', type: 'Static',  reach: 4200, er: 1.2, caption: 'Colour palette inspiration — Summer Glow',           diagnosis: 'Over-designed static with no text hook reached only 14% of followers — a clear suppression signal. Static posts now average 3.1× less reach than Reels on this account.' },
    { platform: 'Instagram', type: 'Story',   reach: 3800, er: 0.8, caption: 'Flash sale — 24 hours only',                         diagnosis: 'Posted at 08:00 Sunday — worst time slot for this account (benchmark ER at that window: 2.1%). No prior trust-building content in the preceding 48 hours reduced conversion intent. Swipe-up rate was 0.3% vs account average of 2.4%.' },
    { platform: 'Facebook',  type: 'Static',  reach: 3100, er: 0.6, caption: '"Beauty begins the moment you decide to be yourself"', diagnosis: 'Inspirational quote format drives near-zero meaningful engagement on Facebook for B2C beauty brands. Algorithm systematically deprioritises text-heavy statics. Recommend discontinuing this format.' },
  ] as BottomPost[],
  kpiComparison: [
    { metric: 'Total Reach',          current: '284,500',  previous: '241,000',  delta: '+18.4%',  positive: true  as boolean|null, benchmark: '200,000',  vsBenchmark: '+42.3%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Impressions',    current: '412,000',  previous: '349,000',  delta: '+22.1%',  positive: true  as boolean|null, benchmark: '300,000',  vsBenchmark: '+37.3%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Avg Eng. Rate',        current: '5.8%',     previous: '5.0%',     delta: '+0.8pp',  positive: true  as boolean|null, benchmark: '4.0%',     vsBenchmark: '+1.8pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'New Followers',        current: '2,840',    previous: '2,650',    delta: '+7.2%',   positive: true  as boolean|null, benchmark: '1,500',    vsBenchmark: '+89.3%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Posts Published',      current: '34',       previous: '32',       delta: '+6.3%',   positive: true  as boolean|null, benchmark: '28',       vsBenchmark: '+21.4%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Saves',          current: '18,400',   previous: '14,200',   delta: '+29.6%',  positive: true  as boolean|null, benchmark: '8,000',    vsBenchmark: '+130.0%', vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Comments',       current: '6,840',    previous: '5,200',    delta: '+31.5%',  positive: true  as boolean|null, benchmark: '4,000',    vsBenchmark: '+71.0%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Shares',         current: '12,400',   previous: '9,800',    delta: '+26.5%',  positive: true  as boolean|null, benchmark: '6,000',    vsBenchmark: '+106.7%', vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Profile Visits',       current: '42,800',   previous: '36,200',   delta: '+18.2%',  positive: true  as boolean|null, benchmark: '30,000',   vsBenchmark: '+42.7%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Website Clicks',       current: '8,400',    previous: '6,800',    delta: '+23.5%',  positive: true  as boolean|null, benchmark: '5,000',    vsBenchmark: '+68.0%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Story Views',          current: '68,400',   previous: '58,200',   delta: '+17.5%',  positive: true  as boolean|null, benchmark: '50,000',   vsBenchmark: '+36.8%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Story Completion',     current: '68%',      previous: '64%',      delta: '+4pp',    positive: true  as boolean|null, benchmark: '55%',      vsBenchmark: '+13pp',   vsBenchmarkPositive: true  as boolean|null },
  ] as KPIRow[],
  audienceSignals: [
    { signal: 'Save Rate',               value: '6.5%',    benchmark: '2.0%',  status: 'good'    as 'good'|'warning'|'poor', note: 'Saves indicate bookmarked-for-reference intent — strong signal of genuine audience interest and content utility.' },
    { signal: 'Follower-to-Reach Ratio', value: '664%',    benchmark: '400%',  status: 'good'    as 'good'|'warning'|'poor', note: 'Reach significantly exceeds follower count — content is distributed via Explore and hashtags well beyond the core audience.' },
    { signal: 'Comment Sentiment',       value: '94% pos', benchmark: '85%',   status: 'good'    as 'good'|'warning'|'poor', note: 'Critical comments account for <1% and relate exclusively to pricing, not product quality.' },
    { signal: 'Audience Authenticity',   value: '96.2%',   benchmark: '90%',   status: 'good'    as 'good'|'warning'|'poor', note: 'Low bot/ghost follower count based on engagement-pattern analysis. Maintains algorithm favourability.' },
    { signal: 'Profile Visit Rate',      value: '15.1%',   benchmark: '8.0%',  status: 'good'    as 'good'|'warning'|'poor', note: '1 in 6.6 people who see content visit the profile — nearly 2× industry benchmark for beauty brands.' },
    { signal: 'Story Completion Rate',   value: '68%',     benchmark: '55%',   status: 'good'    as 'good'|'warning'|'poor', note: '68% of viewers watch to the final slide. Swipe-away rate is 4.2% vs a benchmark of 8%, confirming strong sequencing.' },
  ] as AudienceRow[],
  competitors: [
    { name: 'Charlotte Tilbury', followers: '12.4M',  er: '3.2%', posts: 8,  avgReach: '92,000'  },
    { name: 'NARS Cosmetics',    followers: '8.1M',   er: '2.8%', posts: 6,  avgReach: '74,000'  },
    { name: 'Fenty Beauty',      followers: '14.2M',  er: '4.1%', posts: 10, avgReach: '108,000' },
    { name: 'Luxe Cosmetics',    followers: '42.8K',  er: '6.8%', posts: 5,  avgReach: '9,300'   },
  ] as Competitor[],
  actionPlan: [
    { action: 'Increase Reel frequency to 4 per week',                          owner: 'Social Manager', deadline: 'June 7, 2026',  impact: '+40% organic reach based on current ER trajectory',                         priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'A/B test 3 video hook variants for TikTok',                       owner: 'Copywriter',     deadline: 'June 14, 2026', impact: '+25% CTR and watch-through rate',                                            priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Add 2 LinkedIn long-form articles per month',                     owner: 'Strategist',     deadline: 'June 1, 2026',  impact: 'Projected 3× engagement rate vs short LinkedIn posts',                      priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Replace Facebook statics with native video',                      owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'Estimated 2× reach for same production effort',                             priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Schedule 3 Stories per week (Tue/Wed/Thu)',                       owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'Story algorithm lift increases profile visits by an estimated 20–35%',      priority: 'low'    as 'high'|'medium'|'low' },
  ] as ActionRow[],
  narrative: {
    executive: 'May 2026 is the strongest organic month in twelve months for Luxe Cosmetics. Total reach grew 18.4% to 284,500 unique accounts — a gain of 43,500 over April — driven by a concentrated Reels push and two carousel posts that entered the Explore page. Engagement rate reached 5.8%, exceeding the 4.0% industry benchmark by 1.8 percentage points, while follower growth of 2,840 net new accounts confirmed that the Summer Glow campaign is converting reach into sustained audience growth.',
    reach: 'Organic reach was distributed across four platforms, with Instagram contributing 59% of total reach despite representing only 53% of posts — a clear signal that the algorithm is favouring Luxe content relative to peers. TikTok delivered the highest reach-per-post ratio at 10,143 per video on the lowest posting frequency, indicating significant untapped potential. Facebook and LinkedIn combined contributed 16% of total reach while accounting for 26% of posts, suggesting resource allocation should shift further toward Instagram and TikTok in June.',
    engagement: 'The 5.8% blended engagement rate masks significant format-level variation. Reels achieved 8.4% ER — more than double the industry benchmark for the format — with saves increasing 29.6% month-on-month as a reliable proxy for content utility. Static posts declined to 4.1% average ER as the algorithm increasingly deprioritises non-video formats. Stories averaged 3.8% interaction rate, below the account\'s own historical benchmark of 4.6%, and require corrective action in June through improved posting cadence and hook quality.',
    platform: 'Instagram remains the primary growth engine, accounting for 59% of total reach from 53% of posts — a favourable over-index that reflects algorithm alignment with current creative output. TikTok\'s 9.1% engagement rate on a comparatively small audience of 12,400 followers represents the highest-upside organic channel in the portfolio. Facebook continues to underperform relative to investment: at 3.4% ER and $6,800 CPC on boosted posts, the platform\'s return profile warrants reallocation of budget and creative attention toward Instagram and TikTok in Q2.',
  },
  recommendations: [
    'Increase Reel frequency to 3–4 per week — they deliver 34% more reach at 2.1× the ER of static posts.',
    'LinkedIn ER (4.2%) outperforms the B2C average (2.8%) — add 2 posts per month to compound this advantage.',
    'TikTok has the highest ER at 9.1% but the lowest follower count — consistent posting will accelerate compounding growth.',
  ],
}

const PAID_DEMO = {
  period: 'May 2026',
  budget: 10000, spend: 8500, revenue: 28900, roas: 3.4,
  impressions: 1240000, clicks: 38400, ctr: 3.1, cpc: 0.22, cpm: 6.85,
  conversions: 847, cpa: 10.04,
  campaigns: [
    { name: 'Summer Glow — Awareness',  platform: 'Instagram', spend: 2800, roas: 2.8, impressions: 420000, ctr: 3.0, status: 'active' },
    { name: 'Hydra Serum — Conversion', platform: 'Facebook',  spend: 2400, roas: 4.1, impressions: 320000, ctr: 3.2, status: 'active' },
    { name: 'Retargeting — Cart Rec.',  platform: 'Instagram', spend: 1800, roas: 5.2, impressions: 180000, ctr: 4.0, status: 'active' },
    { name: 'Brand Video — TikTok',     platform: 'TikTok',    spend: 1500, roas: 1.9, impressions: 320000, ctr: 2.6, status: 'paused' },
  ],
  weeklySpend: [
    { week: 'Week 1', spend: 1800, revenue: 6120 },
    { week: 'Week 2', spend: 2100, revenue: 7140 },
    { week: 'Week 3', spend: 2400, revenue: 8160 },
    { week: 'Week 4', spend: 2200, revenue: 7480 },
  ],
  audiences: [
    { name: 'Beauty 25–34',       spend: 3200, roas: 4.2 },
    { name: 'Lookalike Buyers',   spend: 2400, roas: 3.8 },
    { name: 'Interest: Skincare', spend: 1900, roas: 2.9 },
    { name: 'Retargeting — Web',  spend: 1000, roas: 5.4 },
  ],
  creatives: [
    { name: 'Reel — Morning Ritual',   platform: 'Instagram', ctr: 4.2, cpa: 7.80 },
    { name: 'Static — Before/After',   platform: 'Instagram', ctr: 3.8, cpa: 9.40 },
    { name: 'Carousel — Product Line', platform: 'Facebook',  ctr: 3.1, cpa: 11.20 },
    { name: 'Video — Founder Story',   platform: 'TikTok',    ctr: 2.6, cpa: 14.60 },
  ],
  kpiComparison: [
    { metric: 'Total Ad Spend',    current: '$8,500',   previous: '$8,100',   delta: '+4.9%',   positive: null  as boolean|null, benchmark: '$8,000',   vsBenchmark: '+6.3%',   vsBenchmarkPositive: null  as boolean|null },
    { metric: 'Total Revenue',     current: '$28,900',  previous: '$24,600',  delta: '+17.5%',  positive: true  as boolean|null, benchmark: '$24,000',  vsBenchmark: '+20.4%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'ROAS',              current: '3.4×',     previous: '3.0×',     delta: '+0.4×',   positive: true  as boolean|null, benchmark: '2.5×',     vsBenchmark: '+0.9×',   vsBenchmarkPositive: true  as boolean|null },
    { metric: 'CPM',               current: '$6.85',    previous: '$7.20',    delta: '−4.9%',   positive: true  as boolean|null, benchmark: '$9.50',    vsBenchmark: '−27.9%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'CPC',               current: '$0.22',    previous: '$0.26',    delta: '−15.4%',  positive: true  as boolean|null, benchmark: '$0.35',    vsBenchmark: '−37.1%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'CTR',               current: '3.1%',     previous: '2.9%',     delta: '+0.2pp',  positive: true  as boolean|null, benchmark: '1.0%',     vsBenchmark: '+2.1pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'CPA',               current: '$10.04',   previous: '$11.40',   delta: '−11.9%',  positive: true  as boolean|null, benchmark: '$18.00',   vsBenchmark: '−44.2%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Conversions',       current: '847',      previous: '711',      delta: '+19.1%',  positive: true  as boolean|null, benchmark: '500',      vsBenchmark: '+69.4%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Impressions',       current: '1,240,000',previous: '1,080,000',delta: '+14.8%',  positive: true  as boolean|null, benchmark: '900,000',  vsBenchmark: '+37.8%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Clicks',            current: '38,400',   previous: '31,300',   delta: '+22.7%',  positive: true  as boolean|null, benchmark: '20,000',   vsBenchmark: '+92.0%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Budget Utilisation',current: '85%',      previous: '81%',      delta: '+4pp',    positive: null  as boolean|null, benchmark: '90%',      vsBenchmark: '−5pp',    vsBenchmarkPositive: null  as boolean|null },
    { metric: 'Frequency',         current: '2.3×',     previous: '2.1×',     delta: '+0.2×',   positive: null  as boolean|null, benchmark: '2.5×',     vsBenchmark: '−0.2×',   vsBenchmarkPositive: null  as boolean|null },
  ] as KPIRow[],
  actionPlan: [
    { action: 'Scale Cart Retargeting from $1.8K to $3.6K',             owner: 'Paid Manager',   deadline: 'June 1, 2026',  impact: 'ROAS 5.2× makes this the highest-confidence budget move; projected +$9.4K revenue',    priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Pause TikTok Brand Video, reallocate to IG Conversion',   owner: 'Paid Manager',   deadline: 'June 1, 2026',  impact: 'Swap ROAS 1.9× for 4.1× on same spend; projected +$3.3K monthly revenue',              priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Test video-first creative for Hydra Serum campaign',       owner: 'Copywriter',     deadline: 'June 14, 2026', impact: 'Video ads average 40% lower CPA vs static on Instagram — projected CPA to $6.00',      priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Expand Beauty 25–34 audience budget by 25%',              owner: 'Paid Manager',   deadline: 'June 7, 2026',  impact: 'Highest-ROAS audience (4.2×) has headroom before saturation frequency',                 priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Set up automated budget rules for CPA threshold',          owner: 'Paid Manager',   deadline: 'June 21, 2026', impact: 'Auto-pause ad sets if CPA exceeds $14 — prevents budget drain on underperformers',       priority: 'low'    as 'high'|'medium'|'low' },
  ] as ActionRow[],
  narrative: {
    executive: 'May 2026 delivered a 3.4× portfolio ROAS — above the 2.5× agency benchmark and a +0.4× improvement on April. Total ad spend of $8,500 generated $28,900 in attributed revenue, with Cart Retargeting emerging as the standout performer at 5.2× ROAS. CPM fell to $6.85 (−4.9% vs April) while CTR climbed to 3.1%, signalling improving creative-audience fit across the portfolio.',
    efficiency: 'Cost efficiency improved across all primary metrics month-on-month. CPC dropped 15.4% to $0.22 — well below the $0.35 industry benchmark — driven by strong creative relevance scores on the Instagram Awareness and Conversion campaigns. CPA fell to $10.04, representing a 44.2% advantage over the $18.00 category benchmark, largely attributable to the Retargeting audience\'s superior purchase intent. The TikTok Brand Video campaign (ROAS 1.9×) is the sole underperformer and should be paused to free budget for higher-return placements.',
    creative: 'The top-performing creative was the "Morning Ritual" Reel, achieving 4.2% CTR and $7.80 CPA — the strongest result in the portfolio. The pattern across all top creatives is consistent: video-first formats with product in the first 3 seconds outperform static alternatives by 1.8–2.4× on CPA. The Founder Story video on TikTok underperformed despite high reach (320K impressions), suggesting the audience segment (broad interest targeting) is too high-funnel for a conversion objective.',
  },
  recommendations: [
    'Scale Retargeting — Cart Recovery to $5.4K: ROAS 5.2× is the strongest signal in the portfolio — 3× current budget has clear headroom.',
    'Pause TikTok Brand Video (ROAS 1.9×) and reallocate $1.5K to Instagram Hydra Serum Conversion (ROAS 4.1×).',
    'Test video-first creative for Hydra Serum — video ads average 40% lower CPA vs static on Instagram.',
  ],
}

const COMBINED_DEMO = {
  period: 'May 2026',
  organic: { reach: 284500, impressions: 412000, posts: 34, er: 5.8 },
  paid:    { reach: 847000, impressions: 1240000, spend: 8500, roas: 3.4 },
  total:   { reach: 1131500, blendedCPM: 7.52, blendedCPE: 0.19 },
  trend: [
    { month: 'Jan', organic: 182000, paid: 620000 },
    { month: 'Feb', organic: 198000, paid: 690000 },
    { month: 'Mar', organic: 224000, paid: 740000 },
    { month: 'Apr', organic: 241000, paid: 780000 },
    { month: 'May', organic: 284500, paid: 847000 },
  ],
  channels: [
    { platform: 'Instagram', organic: 168000, paid: 420000 },
    { platform: 'Facebook',  organic: 28200,  paid: 320000 },
    { platform: 'TikTok',    organic: 71000,  paid: 107000 },
    { platform: 'LinkedIn',  organic: 17300,  paid: 0 },
  ],
  kpiComparison: [
    { metric: 'Combined Total Reach',   current: '1,131,500', previous: '990,000',  delta: '+14.3%',  positive: true  as boolean|null, benchmark: '800,000',  vsBenchmark: '+41.4%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Organic Reach',          current: '284,500',   previous: '241,000',  delta: '+18.4%',  positive: true  as boolean|null, benchmark: '200,000',  vsBenchmark: '+42.3%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Paid Reach',             current: '847,000',   previous: '749,000',  delta: '+13.1%',  positive: true  as boolean|null, benchmark: '600,000',  vsBenchmark: '+41.2%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Paid Reach %',           current: '74.8%',     previous: '75.7%',    delta: '−0.9pp',  positive: null  as boolean|null, benchmark: '75%',      vsBenchmark: '−0.2pp',  vsBenchmarkPositive: null  as boolean|null },
    { metric: 'Blended CPM',            current: '$7.52',     previous: '$7.90',    delta: '−4.8%',   positive: true  as boolean|null, benchmark: '$9.50',    vsBenchmark: '−20.8%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Blended CPE',            current: '$0.19',     previous: '$0.22',    delta: '−13.6%',  positive: true  as boolean|null, benchmark: '$0.30',    vsBenchmark: '−36.7%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Organic Posts',          current: '34',        previous: '32',       delta: '+6.3%',   positive: true  as boolean|null, benchmark: '28',       vsBenchmark: '+21.4%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Paid Ad Spend',          current: '$8,500',    previous: '$8,100',   delta: '+4.9%',   positive: null  as boolean|null, benchmark: '$8,000',   vsBenchmark: '+6.3%',   vsBenchmarkPositive: null  as boolean|null },
    { metric: 'Paid ROAS',              current: '3.4×',      previous: '3.0×',     delta: '+0.4×',   positive: true  as boolean|null, benchmark: '2.5×',     vsBenchmark: '+0.9×',   vsBenchmarkPositive: true  as boolean|null },
  ] as KPIRow[],
  actionPlan: [
    { action: 'Boost top 2 organic posts as paid dark posts',             owner: 'Paid Manager',   deadline: 'June 7, 2026',  impact: 'Reduces creative production cost ~40% and validates copy before full budget commitment',   priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Increase TikTok organic posting to 3×/week',               owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'ER of 9.1% signals high-value audience; build organic base before adding paid spend',       priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Run $800 LinkedIn Campaign Manager test',                   owner: 'Paid Manager',   deadline: 'June 14, 2026', impact: 'Organic ER 4.2% is already above B2C benchmark — paid amplification is low-risk',          priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Move Instagram paid reporting to blended CPM dashboard',    owner: 'Strategist',     deadline: 'June 7, 2026',  impact: 'Unified view prevents double-counting reach and enables true channel ROI comparison',         priority: 'medium' as 'high'|'medium'|'low' },
  ] as ActionRow[],
  narrative: {
    executive: 'Luxe Cosmetics generated a combined reach of 1,131,500 accounts in May 2026 — a 14.3% increase on April. Paid channels account for 74.8% of total reach at a blended CPM of $7.52, while organic content continues to perform at a 5.8% engagement rate that requires zero incremental spend. The relationship between the two channels is complementary: organic content validates creative quality before paid amplification, a workflow that is currently underutilised.',
    synergy: 'The highest-performing paid creative (Morning Ritual Reel, CTR 4.2%) was originally an organic post that the team promoted after observing its 12.4% engagement rate. This creative-to-paid pipeline approach reduces production cost per acquisition by an estimated 38% compared to purpose-built paid creative. Only 2 of the 5 top organic posts this month were promoted — a gap that represents significant efficiency available without additional creative investment.',
    channel: 'TikTok presents the most compelling channel balance opportunity: organic ER of 9.1% and 71K organic reach on just 7 posts indicates a highly receptive audience, yet only $1,500 of the $8,500 paid budget was allocated here. The paid-to-organic reach ratio on TikTok is 1.5×, compared to 2.5× on Instagram — organic content is nearly as efficient as paid on this platform, suggesting paid investment should follow further organic proof-of-concept before scaling.',
  },
  recommendations: [
    'Top-performing organic posts should become paid ads — this reduces creative production costs by ~40% and validates creative before committing budget.',
    'TikTok organic (71K reach) vs paid uplift (+107K) is only 1.5× — organic performance is strong here; scale it before adding more paid spend.',
    'LinkedIn has no paid spend but 4.2% ER — a $800 Campaign Manager test could amplify B2B reach with minimal risk.',
  ],
}

const PLATFORM_DEMO = {
  platform: 'Instagram', period: 'May 2026',
  followers: 42800, netGrowth: 2840, growthRate: 7.1,
  reach: 168000, impressions: 247000, er: 6.8,
  followerTrend: [
    { month: 'Jan', followers: 34200 },
    { month: 'Feb', followers: 36400 },
    { month: 'Mar', followers: 38600 },
    { month: 'Apr', followers: 40800 },
    { month: 'May', followers: 42800 },
  ],
  formats: [
    { format: 'Reels',    posts: 8, reach: 98200, er: 9.4, saves: 4200 },
    { format: 'Carousel', posts: 6, reach: 52000, er: 7.2, saves: 2800 },
    { format: 'Static',   posts: 3, reach: 12400, er: 4.8, saves: 840 },
    { format: 'Stories',  posts: 1, reach: 5400,  er: 3.2, saves: 0 },
  ],
  erByDay: [
    { day: 'Mon', er: 5.4 },
    { day: 'Tue', er: 6.8 },
    { day: 'Wed', er: 8.2 },
    { day: 'Thu', er: 7.6 },
    { day: 'Fri', er: 5.9 },
    { day: 'Sat', er: 4.8 },
    { day: 'Sun', er: 4.2 },
  ],
  topHashtags: [
    { tag: '#LuxeCosmetics',   posts: 48, reach: 84000, er: 7.2 },
    { tag: '#SkincareRoutine', posts: 22, reach: 62000, er: 6.4 },
    { tag: '#GlowSkin',        posts: 18, reach: 48000, er: 5.8 },
    { tag: '#CrueltyFree',     posts: 12, reach: 34000, er: 5.2 },
    { tag: '#SummerGlow',      posts: 8,  reach: 22000, er: 8.4 },
  ],
  kpiComparison: [
    { metric: 'Total Followers',       current: '42,800',  previous: '40,800',  delta: '+4.9%',   positive: true  as boolean|null, benchmark: '30,000',   vsBenchmark: '+42.7%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Net New Followers',     current: '2,840',   previous: '2,420',   delta: '+17.4%',  positive: true  as boolean|null, benchmark: '1,200',    vsBenchmark: '+136.7%', vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Follower Growth Rate',  current: '7.1%',    previous: '6.3%',    delta: '+0.8pp',  positive: true  as boolean|null, benchmark: '1.8%',     vsBenchmark: '+5.3pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Reach',           current: '168,000', previous: '142,000', delta: '+18.3%',  positive: true  as boolean|null, benchmark: '120,000',  vsBenchmark: '+40.0%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Avg Eng. Rate',         current: '6.8%',    previous: '6.2%',    delta: '+0.6pp',  positive: true  as boolean|null, benchmark: '3.5%',     vsBenchmark: '+3.3pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Reels Avg ER',          current: '9.4%',    previous: '8.1%',    delta: '+1.3pp',  positive: true  as boolean|null, benchmark: '5.0%',     vsBenchmark: '+4.4pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Carousel Avg ER',       current: '7.2%',    previous: '6.8%',    delta: '+0.4pp',  positive: true  as boolean|null, benchmark: '4.5%',     vsBenchmark: '+2.7pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Story Completion',      current: '68%',     previous: '64%',     delta: '+4pp',    positive: true  as boolean|null, benchmark: '55%',      vsBenchmark: '+13pp',   vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Saves',           current: '14,200',  previous: '10,800',  delta: '+31.5%',  positive: true  as boolean|null, benchmark: '6,000',    vsBenchmark: '+136.7%', vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Avg Reach per Post',    current: '9,333',   previous: '8,222',   delta: '+13.5%',  positive: true  as boolean|null, benchmark: '6,500',    vsBenchmark: '+43.6%',  vsBenchmarkPositive: true  as boolean|null },
  ] as KPIRow[],
  audienceSignals: [
    { signal: 'Save Rate',               value: '8.5%',    benchmark: '2.0%',   status: 'good'    as 'good'|'warning'|'poor', note: 'Save rate on Instagram-only posts is 4× the platform average, confirming high content utility and evergreen appeal.' },
    { signal: 'Reel Watch-Through Rate', value: '74%',     benchmark: '50%',    status: 'good'    as 'good'|'warning'|'poor', note: '74% of Reel viewers watch to completion — a key input for the algorithm\'s distribution decisions. Well above the 50% benchmark.' },
    { signal: 'Explore Placement Rate',  value: '31%',     benchmark: '15%',    status: 'good'    as 'good'|'warning'|'poor', note: '31% of reach this month came from Explore, meaning content is consistently surfaced to non-followers.' },
    { signal: 'Follower Authenticity',   value: '96.2%',   benchmark: '90%',    status: 'good'    as 'good'|'warning'|'poor', note: 'Low estimated bot/ghost follower count based on engagement-pattern analysis. Maintains algorithm favourability.' },
    { signal: 'Wed/Thu Post ER Premium', value: '+38%',    benchmark: '0%',     status: 'good'    as 'good'|'warning'|'poor', note: 'Posts published Wed–Thu achieve 38% higher ER than the account average — currently only 42% of posts land on these days.' },
    { signal: 'Profile-to-Follow Rate', value: '6.6%',    benchmark: '3.0%',   status: 'good'    as 'good'|'warning'|'poor', note: '6.6% of profile visitors follow — more than double the benchmark, confirming strong profile page conversion.' },
  ] as AudienceRow[],
  actionPlan: [
    { action: 'Shift 60% of posts to Wed–Thu publish slots',              owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'Estimated +38% ER based on day-of-week performance data',                              priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Increase Reels to 4 per week',                             owner: 'Social Manager', deadline: 'June 7, 2026',  impact: 'Reels drive 9.4% ER vs 4.8% for static — 4 per week targets 12K+ additional reach',       priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Add #SummerGlow to all June Reel posts',                   owner: 'Copywriter',     deadline: 'June 1, 2026',  impact: '#SummerGlow delivers 8.4% ER vs account average 6.8% — highest hashtag performance',      priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Create 3 Stories per week with engagement stickers',       owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'Story stickers increase completion rate by 12–18% on average',                            priority: 'low'    as 'high'|'medium'|'low' },
  ] as ActionRow[],
  narrative: {
    executive: 'Luxe Cosmetics Instagram account delivered its strongest month in 2026, with 42,800 total followers, a 7.1% monthly growth rate, and a 6.8% average engagement rate — 3.3 percentage points above the platform benchmark. The account grew by 2,840 net new followers in May, 17.4% more than April, driven by the Explore placement of the Summer Glow Reel and two carousel posts with exceptional save velocity.',
    formats: 'Reels are the dominant growth engine, delivering 9.4% average engagement rate at 4× the reach of Carousels on equal posting frequency. The format also benefits from algorithm amplification: 31% of May\'s total reach came from Explore page placement, compared to 8% for static posts. Wednesday and Thursday are the highest-performing publishing days by a statistically significant margin — Wednesday posts average 8.2% ER versus 4.2% on Sundays, yet only 42% of posts are currently published on peak days.',
    hashtags: 'Branded hashtags (#LuxeCosmetics, #SummerGlow) outperform generic category tags in both reach and engagement rate. #SummerGlow in particular generated 8.4% ER across 8 posts — the highest in the hashtag portfolio — suggesting strong seasonal relevance for the campaign. The hashtag strategy should be consolidated to 3–5 consistent tags per post rather than rotating through large tag sets, which dilutes reach concentration.',
  },
}

const QUARTERLY_DEMO = {
  quarter: 'Q1 2026', client: 'Luxe Cosmetics',
  objectives: [
    { kpi: 'Total Reach',     target: 600000, actual: 604500, unit: '' },
    { kpi: 'Avg Engagement',  target: 5.0,    actual: 5.1,    unit: '%' },
    { kpi: 'Follower Growth', target: 6000,   actual: 7140,   unit: '' },
    { kpi: 'Published Posts', target: 90,     actual: 91,     unit: '' },
    { kpi: 'Paid ROAS',       target: 3.0,    actual: 3.4,    unit: '×' },
  ],
  trend: [
    { month: 'Jan', reach: 182000, er: 4.8, spend: 7200 },
    { month: 'Feb', reach: 198000, er: 5.1, spend: 8100 },
    { month: 'Mar', reach: 224500, er: 5.4, spend: 8500 },
  ],
  campaigns: [
    { name: "Valentine's Day Collection", reach: 84000,  er: 6.2, highlight: 'Highest-engagement campaign of Q1' },
    { name: 'Spring Renewal Launch',      reach: 112000, er: 5.8, highlight: 'Exceeded reach target by 22%' },
    { name: "International Women's Day",  reach: 64000,  er: 7.4, highlight: 'Top ER of the quarter — viral Reel reached 48K' },
  ],
  kpiComparison: [
    { metric: 'Q1 Total Reach',         current: '604,500',  previous: '498,000',  delta: '+21.4%',  positive: true  as boolean|null, benchmark: '540,000',  vsBenchmark: '+11.9%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Avg Eng. Rate',          current: '5.1%',     previous: '4.4%',     delta: '+0.7pp',  positive: true  as boolean|null, benchmark: '4.0%',     vsBenchmark: '+1.1pp',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Follower Growth (net)',   current: '7,140',    previous: '5,200',    delta: '+37.3%',  positive: true  as boolean|null, benchmark: '4,500',    vsBenchmark: '+58.7%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Posts Published',        current: '91',       previous: '84',       delta: '+8.3%',   positive: true  as boolean|null, benchmark: '90',       vsBenchmark: '+1.1%',   vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Paid ROAS',              current: '3.4×',     previous: '2.8×',     delta: '+0.6×',   positive: true  as boolean|null, benchmark: '2.5×',     vsBenchmark: '+0.9×',   vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Total Ad Spend',         current: '$23,800',  previous: '$21,600',  delta: '+10.2%',  positive: null  as boolean|null, benchmark: '$24,000',  vsBenchmark: '−0.8%',   vsBenchmarkPositive: null  as boolean|null },
    { metric: 'Total Paid Revenue',     current: '$80,920',  previous: '$60,480',  delta: '+33.8%',  positive: true  as boolean|null, benchmark: '$60,000',  vsBenchmark: '+34.9%',  vsBenchmarkPositive: true  as boolean|null },
    { metric: 'Campaigns Delivered',    current: '3',        previous: '3',        delta: '—',       positive: null  as boolean|null, benchmark: '3',        vsBenchmark: 'On plan',  vsBenchmarkPositive: null  as boolean|null },
  ] as KPIRow[],
  actionPlan: [
    { action: 'Brief Q2 campaign calendar by June 15',                    owner: 'Strategist',     deadline: 'June 15, 2026', impact: 'Earlier briefing reduces revision cycles and allows 2 weeks additional production time per campaign',  priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Set Q2 paid budget at $26,000 (+9% vs Q1)',               owner: 'Account Manager', deadline: 'June 1, 2026',  impact: 'ROAS trajectory supports budget increase; projected Q2 revenue $92K at 3.5× ROAS',                  priority: 'high'   as 'high'|'medium'|'low' },
    { action: 'Double TikTok organic posting in Q2',                      owner: 'Social Manager', deadline: 'June 1, 2026',  impact: 'Q1 TikTok ER of 9.1% on low frequency signals highest organic growth lever available',              priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Introduce monthly organic content audit',                  owner: 'Creative Director',deadline:'July 1, 2026', impact: 'Systematic bottom-post review prevents recurring format mistakes and improves portfolio ER',           priority: 'medium' as 'high'|'medium'|'low' },
    { action: 'Produce Q2 OKR presentation for client by June 30',        owner: 'Account Manager', deadline: 'June 30, 2026', impact: 'Aligns client expectations and secures Q2 budget approval before campaign launch',                  priority: 'low'    as 'high'|'medium'|'low' },
  ] as ActionRow[],
  narrative: {
    executive: 'Q1 2026 was a breakthrough quarter for Luxe Cosmetics across all tracked dimensions. Total organic reach of 604,500 exceeded the quarterly target of 600,000, average engagement rate improved from 4.4% to 5.1%, and follower growth of 7,140 net new accounts surpassed the 6,000 target by 19%. Paid ROAS improved from 2.8× to 3.4× quarter-on-quarter, driven by refined audience targeting and creative improvements validated through organic performance data.',
    trend: 'The month-on-month reach trajectory — 182K in January, 198K in February, 224K in March — represents a consistent 10–13% compounding growth rate. The growth acceleration in March (13.4% vs February) coincided with the International Women\'s Day campaign, confirming that culturally relevant content significantly amplifies organic distribution. If the Q1 growth rate is maintained in Q2, total quarterly reach should reach 740,000–780,000.',
    priorities: 'Three priorities define Q2 strategy. First, the TikTok opportunity: Q1\'s 9.1% ER at low posting frequency signals a highly receptive audience that is not yet being maximised. Doubling posting frequency to 14 videos per month is the single highest-upside action. Second, the paid retargeting stack produced 5.2× ROAS in Q1 — budget scaling to $5,000 per month is the highest-confidence paid investment. Third, the existing creative-to-paid promotion pipeline (boosting organic top performers) should be systematised to cover all posts with ER above 8%.',
  },
  q2Priorities: [
    { priority: 'Scale TikTok organic to 14 videos per month', rationale: 'Q1 TikTok ER of 9.1% on a modest following signals a highly engaged audience that is currently under-served. Doubling posting frequency is the single highest-upside organic action available and requires no incremental budget.' },
    { priority: 'Increase paid retargeting budget to $5,000/month', rationale: 'The retargeting campaign delivered 5.2× ROAS in Q1 — the highest-performing paid activation. Scaling spend to $5,000/month at current conversion rates projects $26,000 incremental revenue per month, representing the best risk-adjusted paid investment.' },
    { priority: 'Systematise organic-to-paid promotion pipeline', rationale: 'All organic posts achieving above 8% ER should be evaluated for paid promotion within 48 hours of publishing. This pipeline produced 3.8× ROAS on boosted posts in Q1 and should be formalised as a standing workflow across all campaigns.' },
  ],
}

const EXECUTIVE_DEMO = {
  period: 'May 2026',
  kpis: [
    { label: 'Total Reach',    value: '1.13M', delta: '+20.2%', positive: true  as boolean | null },
    { label: 'Avg Eng. Rate',  value: '5.8%',  delta: '+0.8%',  positive: true  as boolean | null },
    { label: 'Paid ROAS',      value: '3.4×',  delta: '+0.4',   positive: true  as boolean | null },
    { label: 'Active Clients', value: '4',     delta: '—',      positive: null  as boolean | null },
  ],
  trend: [
    { month: 'Mar', reach: 224000 },
    { month: 'Apr', reach: 241000 },
    { month: 'May', reach: 284500 },
  ],
  wins: [
    'Luxe Cosmetics Reel reached 48.2K organic — best single post in 12 months.',
    'Cart Retargeting achieved 5.2× ROAS — highest in portfolio history.',
    'LinkedIn average ER hit 4.2%, outperforming the 3.1% B2C benchmark.',
  ],
  opportunities: [
    'TikTok organic ER (9.1%) signals high-value untapped audience — increase posting frequency before adding paid spend.',
    'FitForge LinkedIn presence is near-zero — competitor Gymshark drives 28% of leads via this channel.',
    'Stories average only 4/month per account vs the recommended 12 — algorithm distribution is being left on the table.',
  ],
  action: 'Scale Luxe Cosmetics Instagram Retargeting from $1.8K to $3.6K in June — ROAS of 5.2× makes this the highest-confidence budget move in the portfolio.',
  clientBreakdown: [
    { client: 'Luxe Cosmetics', reach: '284,500', er: '5.8%', roas: '3.4×', status: 'ahead'    as 'ahead'|'on-track'|'at-risk' },
    { client: 'TechNova',       reach: '142,000', er: '4.2%', roas: '2.8×', status: 'on-track' as 'ahead'|'on-track'|'at-risk' },
    { client: 'Coastal Eats',   reach: '88,400',  er: '6.4%', roas: '—',    status: 'ahead'    as 'ahead'|'on-track'|'at-risk' },
    { client: 'FitForge',       reach: '64,200',  er: '3.8%', roas: '2.1×', status: 'at-risk'  as 'ahead'|'on-track'|'at-risk' },
  ],
  narrative: {
    portfolio: 'The NOVAX portfolio delivered a combined 579,100 organic reach accounts in May 2026, with a blended engagement rate of 5.05% — 26% above the 4.0% industry benchmark. Three of four clients are ahead of or on track to OKR targets; FitForge requires intervention due to declining ER (3.8%) against the fitness category benchmark of 4.5%.',
    highlights: 'Two portfolio records were set in May: the Luxe Cosmetics Summer Glow Reel reached 48,200 accounts organically — the best single post in twelve months — and Cart Retargeting achieved 5.2× ROAS, the highest paid return in portfolio history. Both followed the same workflow: validate organic performance, then amplify with paid budget. This pipeline should be standardised across all four accounts.',
  },
}

// ─── Shared components ──────────────────────────────────────────────────────────

function DeltaBadge({ delta, positive }: { delta: string; positive: boolean | null }) {
  if (positive === null) {
    return <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{delta}</span>
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50',
    )}>
      {positive ? <ArrowUpRight className="w-2.5 h-2.5"/> : <ArrowDownRight className="w-2.5 h-2.5"/>}
      {delta}
    </span>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-7 rounded-full shrink-0" style={{ background: B.primary }}/>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function ReportHeader({ title, subtitle, client, period }: { title: string; subtitle: string; client: string; period: string }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-1" style={{ background: B.primary }}>
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.12"/>
              <path d="M8 24V8l6 16 6-16v16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="24" cy="16" r="3" fill={B.accent}/>
            </svg>
            <div>
              <p className="text-white font-bold text-sm leading-none">NOVAX</p>
              <p className="text-[10px] leading-none mt-0.5 font-medium" style={{ color: B.accent }}>OPS PLATFORM</p>
            </div>
          </div>
          <div className="w-px h-10 bg-white/20"/>
          <div>
            <p className="text-white font-bold text-lg leading-tight">{title}</p>
            <p className="text-xs mt-0.5" style={{ color: B.border }}>{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-semibold text-sm">{client}</p>
          <div className="flex items-center gap-1.5 justify-end mt-1">
            <Calendar className="w-3 h-3" style={{ color: B.accent }}/>
            <p className="text-xs" style={{ color: B.border }}>{period}</p>
          </div>
          <p className="text-[10px] mt-2 opacity-50 text-white">Prepared by NOVAX Ops · Confidential</p>
        </div>
      </div>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
    </div>
  )
}

function RecommendationsList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((rec, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: B.light }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white" style={{ background: B.primary }}>
            {i + 1}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Deep report shared components ────────────────────────────────────────────

function CoverPage({ title, subtitle, client, period, tag }: { title: string; subtitle: string; client: string; period: string; tag: string }) {
  return (
    <div className="report-cover-page rounded-2xl overflow-hidden flex flex-col" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.accent}, ${B.border}, ${B.light})` }}/>
      <div className="px-12 pt-12 flex items-center gap-4">
        <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.12"/>
          <path d="M8 24V8l6 16 6-16v16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="24" cy="16" r="3" fill={B.accent}/>
        </svg>
        <div>
          <p className="text-white font-bold text-xl leading-none">NOVAX</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: B.accent }}>OPS PLATFORM</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-12 py-20">
        <div className="w-16 h-0.5 rounded-full mb-8" style={{ background: B.accent }}/>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: B.border }}>{tag}</p>
        <h1 className="text-5xl font-bold text-white leading-tight mb-6">{title}</h1>
        <p className="text-lg leading-relaxed" style={{ color: B.border }}>{subtitle}</p>
      </div>
      <div className="px-12 pb-10 flex items-end justify-between">
        <div>
          <p className="font-bold text-white text-lg">{client}</p>
          <p className="text-sm mt-0.5" style={{ color: B.border }}>{period}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: B.border }}>Prepared by NOVAX Ops</p>
          <p className="text-[10px] mt-0.5 text-white opacity-40">Confidential — Not for Distribution</p>
        </div>
      </div>
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${B.light}, ${B.border}, ${B.accent})` }}/>
    </div>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-7">{children}</p>
}

function KPIComparisonTable({ rows }: { rows: KPIRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Metric', 'Current Period', 'Prior Period', 'MoM Change', 'Industry Benchmark', 'vs Benchmark'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-700">{r.metric}</td>
              <td className="p-3 text-right font-bold text-slate-900">{r.current}</td>
              <td className="p-3 text-right text-slate-500">{r.previous}</td>
              <td className="p-3 text-right"><DeltaBadge delta={r.delta} positive={r.positive}/></td>
              <td className="p-3 text-right text-slate-400">{r.benchmark}</td>
              <td className="p-3 text-right"><DeltaBadge delta={r.vsBenchmark} positive={r.vsBenchmarkPositive}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PRIORITY_BADGE: Record<string, string> = { high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-slate-100 text-slate-500' }
const SIGNAL_BADGE:   Record<string, string> = { good: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', poor: 'bg-red-50 text-red-700' }

function ActionPlanTable({ items }: { items: ActionRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Action', 'Owner', 'Deadline', 'Expected Impact', 'Priority'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 4 ? 'text-center' : 'text-left')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-800">{r.action}</td>
              <td className="p-3 text-slate-600 whitespace-nowrap">{r.owner}</td>
              <td className="p-3 text-slate-600 whitespace-nowrap">{r.deadline}</td>
              <td className="p-3 text-slate-600 text-xs">{r.impact}</td>
              <td className="p-3 text-center"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', PRIORITY_BADGE[r.priority])}>{r.priority}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AudienceSignalsTable({ signals }: { signals: AudienceRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Audience Signal', 'Value', 'Benchmark', 'Status', 'Interpretation'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 3 ? 'text-center' : i < 2 || i === 4 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-700">{s.signal}</td>
              <td className="p-3 text-right font-bold text-slate-900">{s.value}</td>
              <td className="p-3 text-right text-slate-400">{s.benchmark}</td>
              <td className="p-3 text-center"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', SIGNAL_BADGE[s.status])}>{s.status}</span></td>
              <td className="p-3 text-slate-600 text-xs leading-relaxed">{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompetitorTable({ rows }: { rows: Competitor[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Account', 'Followers', 'Avg ER', 'Posts/Week', 'Avg Reach/Post'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isUs = r.name.includes('Luxe')
            return (
              <tr key={i} className={cn('border-t border-slate-50', isUs ? 'font-semibold' : i % 2 === 1 ? 'bg-slate-50/50' : '')} style={isUs ? { background: B.light } : {}}>
                <td className="p-3 font-medium" style={isUs ? { color: B.primary } : { color: '#334155' }}>
                  {r.name}{isUs && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: B.accent, color: 'white' }}>Us</span>}
                </td>
                <td className="p-3 text-right text-slate-700">{r.followers}</td>
                <td className="p-3 text-right font-bold" style={isUs ? { color: B.primary } : { color: '#475569' }}>{r.er}</td>
                <td className="p-3 text-right text-slate-700">{r.posts}</td>
                <td className="p-3 text-right text-slate-700">{r.avgReach}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Monthly Report ─────────────────────────────────────────────────────────────

function MonthlyReport({ client, liveStats }: { client: string; liveStats?: Record<string, number> | null }) {
  const d = MONTHLY_DEMO
  const maxReach = Math.max(...d.platforms.map(p => p.reach))
  return (
    <div className="space-y-5">
      <CoverPage
        title="Monthly Performance Report"
        subtitle="Organic social media performance across all active platforms — reach, engagement, audience quality, and content analysis"
        client={client} period={d.period}
        tag="Organic Social — Monthly"
      />
      <ReportHeader title="Monthly Performance Report" subtitle="Organic social media performance across all platforms" client={client} period={d.period}/>

      {/* Highlight callouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Eye,                          label: 'Total Reach',         value: liveStats?.reach != null ? formatNumber(liveStats.reach) : formatNumber(d.kpis.reach), delta: d.deltas.reach },
          { icon: TrendingUp,                   label: 'Avg Engagement Rate', value: liveStats?.engagement_rate != null ? `${Number(liveStats.engagement_rate).toFixed(1)}%` : `${d.kpis.er}%`, delta: d.deltas.er },
          { icon: liveStats ? BarChart2 : Users, label: liveStats ? 'Total Impressions' : 'New Followers', value: liveStats?.impressions != null ? formatNumber(liveStats.impressions) : `+${formatNumber(d.kpis.followers)}`, delta: d.deltas.followers },
        ].map(({ icon: Icon, label, value, delta }) => (
          <div key={label} className="rounded-2xl border border-novax-border p-5" style={{ background: B.light }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(27,61,56,0.12)' }}>
                <Icon className="w-4 h-4" style={{ color: B.primary }}/>
              </div>
              <span className="text-xs font-semibold" style={{ color: B.muted }}>{label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
            <DeltaBadge delta={`${delta} vs ${d.prevPeriod}`} positive={true}/>
          </div>
        ))}
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Reach & Impressions Trend" subtitle="5-month organic trajectory"/>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={d.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
              <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n === 'reach' ? 'Reach' : 'Impressions']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Bar dataKey="impressions" fill={B.light} stroke={B.border} radius={[3, 3, 0, 0]} name="Impressions"/>
              <Line type="monotone" dataKey="reach" stroke={B.primary} strokeWidth={2.5} dot={{ fill: B.primary, r: 3 }} name="Reach"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Engagement Rate Trend" subtitle="Monthly average — benchmark 4.0%"/>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.trend}>
              <defs>
                <linearGradient id="erGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.accent} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={B.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip formatter={v => [`${v}%`, 'Eng. Rate']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <ReferenceLine y={4} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: 'Benchmark 4%', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}/>
              <Area type="monotone" dataKey="er" stroke={B.accent} strokeWidth={2.5} fill="url(#erGrad)" dot={{ fill: B.accent, r: 3 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Platform Performance" subtitle="Reach, posts, and engagement rate by channel"/>
        <div className="space-y-4">
          {d.platforms.map(p => (
            <div key={p.name} className="grid items-center gap-4" style={{ gridTemplateColumns: '120px 1fr 280px' }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }}/>
                <span className="text-sm font-semibold text-slate-700">{p.name}</span>
              </div>
              <div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.reach / maxReach) * 100}%`, background: p.color }}/>
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <div className="text-right w-20"><span className="font-bold text-slate-800">{formatNumber(p.reach)}</span><span className="text-slate-400 ml-1">reach</span></div>
                <div className="text-right w-14"><span className="font-bold text-slate-800">{p.posts}</span><span className="text-slate-400 ml-1">posts</span></div>
                <div className="text-right w-16"><span className="font-bold text-slate-800">{p.er}%</span><span className="text-slate-400 ml-1">ER</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content type performance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Content Format Performance" subtitle="Reach by post type"/>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={d.contentTypes} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
            <YAxis type="category" dataKey="type" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={70}/>
            <Tooltip formatter={(v, n) => [n === 'reach' ? formatNumber(Number(v)) : `${v}%`, n === 'reach' ? 'Reach' : 'ER']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
            <Bar dataKey="reach" fill={B.primary} radius={[0, 4, 4, 0]} name="Reach"/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top posts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Top Performing Posts" subtitle="Highest-reach content this month"/>
        <div className="space-y-3">
          {d.topPosts.map((post, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#a16207' }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type}</p>
              </div>
              <div className="flex items-center gap-5 text-xs shrink-0">
                <div className="text-right"><p className="font-bold text-slate-800">{formatNumber(post.reach)}</p><p className="text-slate-400">reach</p></div>
                <div className="text-right"><p className="font-bold" style={{ color: B.primary }}>{post.er}%</p><p className="text-slate-400">ER</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Analyst interpretation of May 2026 results"/>
        <div className="space-y-4">
          <Paragraph>{d.narrative.executive}</Paragraph>
          <Paragraph>{d.narrative.reach}</Paragraph>
          <Paragraph>{d.narrative.engagement}</Paragraph>
          <Paragraph>{d.narrative.platform}</Paragraph>
        </div>
      </div>

      {/* KPI comparison table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current period vs prior period vs industry benchmark — 12 metrics"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Extended top posts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Top Performing Posts" subtitle="5 highest-reach posts with performance analysis"/>
        <div className="space-y-3">
          {d.topPosts.map((post, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#a16207' : B.border }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type}</p>
                </div>
                <div className="flex items-center gap-5 text-xs shrink-0">
                  <div className="text-right"><p className="font-bold text-slate-800">{formatNumber(post.reach)}</p><p className="text-slate-400">reach</p></div>
                  <div className="text-right"><p className="font-bold" style={{ color: B.primary }}>{post.er}%</p><p className="text-slate-400">ER</p></div>
                </div>
              </div>
              {post.why && (
                <div className="flex items-start gap-2 pl-11">
                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: B.accent }}/>
                  <p className="text-xs text-slate-500 leading-relaxed">{post.why}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom posts content audit */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Content Audit — Underperforming Posts" subtitle="3 lowest-reach posts with diagnosis and corrective action"/>
        <div className="space-y-3">
          {d.bottomPosts.map((post, i) => (
            <div key={i} className="p-4 rounded-xl border border-red-100 bg-red-50/40">
              <div className="flex items-start gap-4 mb-2">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type} · {formatNumber(post.reach)} reach · {post.er}% ER</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pl-11">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400"/>
                <p className="text-xs text-slate-600 leading-relaxed">{post.diagnosis}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audience quality signals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Audience Quality Signals" subtitle="6 key indicators of genuine audience health vs benchmark"/>
        <AudienceSignalsTable signals={d.audienceSignals}/>
      </div>

      {/* Competitor benchmarks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Competitor Benchmark" subtitle="Luxe Cosmetics vs category peers on Instagram"/>
        <CompetitorTable rows={d.competitors}/>
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">Note: Luxe Cosmetics ER of 6.8% exceeds all benchmarked competitors despite a smaller follower base — a pattern consistent with high content relevance and strong community fit. At current growth rate, the account will reach 100K followers by Q1 2027.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Evidence-based actions for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      {/* Action plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Action Plan — June 2026" subtitle="Prioritised actions with owners, deadlines, and expected outcomes"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Paid Ads Report ────────────────────────────────────────────────────────────

function PaidReport({ client }: { client: string }) {
  const d = PAID_DEMO
  const budgetPct = Math.round((d.spend / d.budget) * 100)
  return (
    <div className="space-y-5">
      <CoverPage
        title="Paid Media Performance Report"
        subtitle="Campaign efficiency, ROAS analysis, creative performance, and audience segmentation — full paid portfolio review"
        client={client} period={d.period}
        tag="Paid Media — Monthly"
      />
      <ReportHeader title="Paid Media Performance Report" subtitle="Campaign analytics, ROAS, and creative performance" client={client} period={d.period}/>

      {/* Budget hero row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Budget Utilisation</p>
            <p className="text-3xl font-bold text-slate-900">{budgetPct}%</p>
            <p className="text-xs text-slate-400 mt-1">${d.spend.toLocaleString()} of ${d.budget.toLocaleString()} spent</p>
          </div>
          <div className="mt-4">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${budgetPct}%`, background: B.primary }}/>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>$0</span><span>${d.budget.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="rounded-2xl border-2 p-5 flex flex-col justify-between" style={{ borderColor: B.accent, background: 'white' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: B.muted }}>Return on Ad Spend</p>
          <p className="text-5xl font-bold my-3" style={{ color: B.primary }}>{d.roas}×</p>
          <p className="text-xs text-slate-500">${d.revenue.toLocaleString()} revenue on ${d.spend.toLocaleString()} spend</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-2 gap-4">
          {[
            { label: 'CPM', value: `$${d.cpm}` },
            { label: 'CPC', value: `$${d.cpc}` },
            { label: 'CTR', value: `${d.ctr}%` },
            { label: 'CPA', value: `$${d.cpa}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly spend vs revenue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Weekly Spend vs Revenue" subtitle="Investment efficiency across the month"/>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={d.weeklySpend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v) / 1000}K`}/>
            <Tooltip formatter={(v, n) => [`$${Number(v).toLocaleString()}`, n === 'spend' ? 'Ad Spend' : 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Bar dataKey="spend" fill={B.accent} radius={[4, 4, 0, 0]} name="Ad Spend"/>
            <Line type="monotone" dataKey="revenue" stroke={B.primary} strokeWidth={2.5} dot={{ fill: B.primary, r: 4 }} name="Revenue"/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Campaign table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Campaign Performance" subtitle="All active and paused campaigns this period"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                <th className="text-left p-3 text-xs font-semibold" style={{ color: B.primary }}>Campaign</th>
                <th className="text-left p-3 text-xs font-semibold" style={{ color: B.primary }}>Platform</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Spend</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>ROAS</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Impressions</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>CTR</th>
                <th className="text-center p-3 text-xs font-semibold" style={{ color: B.primary }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.campaigns.map((c, i) => (
                <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                  <td className="p-3 font-medium text-slate-800">{c.name}</td>
                  <td className="p-3 text-slate-500">{c.platform}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">${c.spend.toLocaleString()}</td>
                  <td className="p-3 text-right font-bold" style={{ color: c.roas >= 3 ? B.primary : c.roas >= 2 ? '#d97706' : '#ef4444' }}>{c.roas}×</td>
                  <td className="p-3 text-right text-slate-600">{formatNumber(c.impressions)}</td>
                  <td className="p-3 text-right text-slate-600">{c.ctr}%</td>
                  <td className="p-3 text-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audience ROAS + Creative performance */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Audience Segment ROAS"/>
          <div className="space-y-3 mt-2">
            {d.audiences.map(a => (
              <div key={a.name} className="flex items-center gap-3">
                <p className="text-xs text-slate-600 w-36 shrink-0 break-words leading-tight">{a.name}</p>
                <div className="flex-1">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(a.roas / 6) * 100}%`, background: B.primary }}/>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-800 w-10 text-right">{a.roas}×</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Creative Performance" subtitle="CTR and CPA by ad creative"/>
          <div className="space-y-2 mt-2">
            {d.creatives.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 break-words">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.platform}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold" style={{ color: B.primary }}>{c.ctr}% CTR</p>
                  <p className="text-[10px] text-slate-400">${c.cpa} CPA</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Analyst interpretation of May 2026 paid results"/>
        <div className="space-y-4">
          <Paragraph>{d.narrative.executive}</Paragraph>
          <Paragraph>{d.narrative.efficiency}</Paragraph>
          <Paragraph>{d.narrative.creative}</Paragraph>
        </div>
      </div>

      {/* KPI comparison */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current period vs prior period vs industry benchmark — 12 paid metrics"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Priority optimisations for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Action Plan — June 2026" subtitle="Prioritised paid media actions with owners, deadlines, and expected outcomes"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Combined Report ────────────────────────────────────────────────────────────

function CombinedReport({ client }: { client: string }) {
  const d = COMBINED_DEMO
  const totalReach = d.organic.reach + d.paid.reach
  const organicPct = Math.round((d.organic.reach / totalReach) * 100)
  const paidPct = 100 - organicPct
  const pieData = [
    { name: 'Organic', value: d.organic.reach },
    { name: 'Paid',    value: d.paid.reach },
  ]
  return (
    <div className="space-y-5">
      <CoverPage
        title="Paid + Organic Combined Report"
        subtitle="Blended reach analysis, channel investment breakdown, paid-organic synergy, and cross-channel performance mix"
        client={client} period={d.period}
        tag="Paid + Organic — Monthly"
      />
      <ReportHeader title="Paid + Organic Combined Report" subtitle="Blended reach, investment breakdown, and channel mix" client={client} period={d.period}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Combined Reach',  value: formatNumber(totalReach),                             icon: Eye,        bg: 'bg-novax-light' },
          { label: 'Organic Reach',   value: `${formatNumber(d.organic.reach)} (${organicPct}%)`,  icon: TrendingUp, bg: 'bg-emerald-50' },
          { label: 'Paid Reach',      value: `${formatNumber(d.paid.reach)} (${paidPct}%)`,        icon: Target,     bg: 'bg-amber-50' },
          { label: 'Blended CPM',     value: `$${d.total.blendedCPM}`,                             icon: Activity,   bg: 'bg-slate-100' },
        ].map(({ label, value, icon: Icon, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon className="w-4 h-4" style={{ color: B.primary }}/>
            </div>
            <p className="text-lg font-bold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Paid vs Organic Reach Trend" subtitle="Monthly reach split — 5 months"/>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.trend}>
              <defs>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={B.primary} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.accent} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={B.accent} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
              <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n === 'paid' ? 'Paid Reach' : 'Organic Reach']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Area type="monotone" dataKey="paid"    stroke={B.primary} strokeWidth={2} fill="url(#paidGrad)" name="Paid"/>
              <Area type="monotone" dataKey="organic" stroke={B.accent}  strokeWidth={2} fill="url(#orgGrad)"  name="Organic"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
          <SectionHeader title="Reach Mix" subtitle="May 2026"/>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}>
                  <Cell fill={B.primary}/>
                  <Cell fill={B.accent}/>
                </Pie>
                <Tooltip formatter={(v) => formatNumber(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Channel Mix" subtitle="Paid and organic reach breakdown by platform"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                <th className="text-left p-3 text-xs font-semibold" style={{ color: B.primary }}>Platform</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Organic</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Paid</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Total</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Paid %</th>
              </tr>
            </thead>
            <tbody>
              {d.channels.map((c, i) => {
                const total = c.organic + c.paid
                const pPct  = total > 0 ? Math.round((c.paid / total) * 100) : 0
                return (
                  <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                    <td className="p-3 font-semibold text-slate-800">{c.platform}</td>
                    <td className="p-3 text-right text-slate-600">{formatNumber(c.organic)}</td>
                    <td className="p-3 text-right text-slate-600">{c.paid > 0 ? formatNumber(c.paid) : '—'}</td>
                    <td className="p-3 text-right font-bold text-slate-800">{formatNumber(total)}</td>
                    <td className="p-3 text-right font-semibold" style={{ color: B.primary }}>{pPct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Analyst interpretation of May 2026 blended results"/>
        <div className="space-y-4">
          <Paragraph>{d.narrative.executive}</Paragraph>
          <Paragraph>{d.narrative.synergy}</Paragraph>
          <Paragraph>{d.narrative.channel}</Paragraph>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Blended metrics — current vs prior vs benchmark"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Organic + paid optimisation priorities"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Action Plan — June 2026" subtitle="Cross-channel actions with owners, deadlines, and expected outcomes"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Platform Deep Dive ─────────────────────────────────────────────────────────

function PlatformReport({ client }: { client: string }) {
  const d = PLATFORM_DEMO
  const maxFormatReach = Math.max(...d.formats.map(f => f.reach))
  const maxHashReach   = Math.max(...d.topHashtags.map(h => h.reach))
  return (
    <div className="space-y-5">
      <CoverPage
        title="Instagram Deep Dive Report"
        subtitle="Follower growth, format performance, posting time analysis, hashtag strategy, and audience quality signals"
        client={client} period={d.period}
        tag="Platform Deep Dive — Instagram"
      />
      <ReportHeader title="Instagram Deep Dive Report" subtitle="Format performance, follower growth, best days and hashtag analysis" client={client} period={d.period}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Followers',  value: formatNumber(d.followers),          delta: `+${d.growthRate}%`,       positive: true as boolean | null, icon: Users,      bg: 'bg-novax-light' },
          { label: 'Net New Followers', value: `+${formatNumber(d.netGrowth)}`,   delta: 'this month',              positive: null as boolean | null, icon: TrendingUp, bg: 'bg-emerald-50' },
          { label: 'Organic Reach',    value: formatNumber(d.reach),              delta: 'organic only',            positive: null as boolean | null, icon: Eye,        bg: 'bg-blue-50' },
          { label: 'Avg Eng. Rate',    value: `${d.er}%`,                         delta: '+2.6% vs benchmark',      positive: true as boolean | null, icon: Activity,   bg: 'bg-amber-50' },
        ].map(({ label, value, delta, positive, icon: Icon, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon className="w-4 h-4" style={{ color: B.primary }}/>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
            <p className="text-[11px] text-slate-500 mb-2">{label}</p>
            <DeltaBadge delta={delta} positive={positive}/>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Follower Growth" subtitle="5-month trajectory"/>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.followerTrend}>
              <defs>
                <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={B.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={B.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}K`}/>
              <Tooltip formatter={v => [Number(v).toLocaleString(), 'Followers']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <Area type="monotone" dataKey="followers" stroke={B.primary} strokeWidth={2.5} fill="url(#follGrad)" dot={{ fill: B.primary, r: 3 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Engagement Rate by Day" subtitle="Best days to post — benchmark 5.0%"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.erByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip formatter={v => [`${v}%`, 'Avg ER']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
              <ReferenceLine y={5} stroke="#cbd5e1" strokeDasharray="4 4"/>
              <Bar dataKey="er" radius={[4, 4, 0, 0]} name="ER">
                {d.erByDay.map((entry, i) => (
                  <Cell key={i} fill={entry.er >= 7 ? B.primary : entry.er >= 5 ? B.muted : B.border}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Content Format Performance" subtitle="Reach, ER, and saves by post type"/>
        <div className="space-y-3">
          {d.formats.map((f) => (
            <div key={f.format} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-800">{f.format}</span>
                <div className="flex items-center gap-5 text-xs">
                  <span className="text-slate-500"><span className="font-bold text-slate-800">{f.posts}</span> posts</span>
                  <span className="text-slate-500"><span className="font-bold" style={{ color: B.primary }}>{f.er}%</span> ER</span>
                  {f.saves > 0 && <span className="text-slate-500"><span className="font-bold text-slate-800">{formatNumber(f.saves)}</span> saves</span>}
                </div>
              </div>
              <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-200">
                <div className="h-full rounded-full" style={{ width: `${(f.reach / maxFormatReach) * 100}%`, background: B.primary }}/>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{formatNumber(f.reach)} reach</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Hashtag Performance" subtitle="Top 5 hashtags by reach and engagement"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                <th className="text-left p-3 text-xs font-semibold" style={{ color: B.primary }}>Hashtag</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Posts</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Reach</th>
                <th className="text-right p-3 text-xs font-semibold" style={{ color: B.primary }}>Avg ER</th>
                <th className="p-3 text-xs font-semibold" style={{ color: B.primary }}>Reach Share</th>
              </tr>
            </thead>
            <tbody>
              {d.topHashtags.map((h, i) => (
                <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                  <td className="p-3 font-semibold" style={{ color: B.primary }}>{h.tag}</td>
                  <td className="p-3 text-right text-slate-600">{h.posts}</td>
                  <td className="p-3 text-right text-slate-600">{formatNumber(h.reach)}</td>
                  <td className="p-3 text-right font-bold text-slate-800">{h.er}%</td>
                  <td className="p-3 pr-5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(h.reach / maxHashReach) * 100}%`, background: B.accent }}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current month vs prior month and Instagram benchmarks"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Account health, format insights, and hashtag strategy"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.formats}</Paragraph>
        <Paragraph>{d.narrative.hashtags}</Paragraph>
      </div>

      {/* Audience Quality */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Audience Quality Signals" subtitle="Instagram-specific health indicators"/>
        <AudienceSignalsTable signals={d.audienceSignals}/>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="30-Day Instagram Action Plan" subtitle="Prioritised actions with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Quarterly Report ───────────────────────────────────────────────────────────

function QuarterlyReport({ client }: { client: string }) {
  const d = QUARTERLY_DEMO
  return (
    <div className="space-y-5">
      <CoverPage
        title="Quarterly Performance Report"
        subtitle="OKR achievement scorecard, campaign highlights, month-over-month trend analysis, and Q2 strategy priorities"
        client={client} period={d.quarter}
        tag="Quarterly Strategy — Q1 2026"
      />
      <ReportHeader title="Quarterly Performance Report" subtitle="OKR scorecard, campaign highlights, and next-quarter priorities" client={client} period={d.quarter}/>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Quarter OKR Scorecard" subtitle="Target vs actual for all key metrics"/>
        <div className="space-y-4">
          {d.objectives.map((obj) => {
            const pct      = Math.min(Math.round((obj.actual / obj.target) * 100), 120)
            const achieved = obj.actual >= obj.target
            const displayActual = obj.actual > 1000 ? formatNumber(obj.actual) : obj.actual
            const displayTarget = obj.target > 1000 ? formatNumber(obj.target) : obj.target
            return (
              <div key={obj.kpi} className="p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', achieved ? 'bg-emerald-100' : 'bg-amber-100')}>
                      {achieved ? <Check className="w-3 h-3 text-emerald-600"/> : <AlertCircle className="w-3 h-3 text-amber-600"/>}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{obj.kpi}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">Target: <span className="font-semibold text-slate-600">{displayTarget}{obj.unit}</span></span>
                    <span className={cn('font-bold', achieved ? 'text-emerald-600' : 'text-amber-600')}>
                      Actual: {displayActual}{obj.unit}
                    </span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', achieved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: achieved ? B.primary : '#f59e0b' }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Quarter Trend" subtitle="Reach and engagement across the quarter"/>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={d.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%"/>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Bar yAxisId="left" dataKey="reach" fill={B.light} stroke={B.border} radius={[4, 4, 0, 0]} name="Reach"/>
            <Line yAxisId="right" type="monotone" dataKey="er" stroke={B.primary} strokeWidth={2.5} dot={{ fill: B.primary, r: 4 }} name="ER (%)"/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Campaign Highlights" subtitle="Standout campaigns and key learnings"/>
        <div className="space-y-3">
          {d.campaigns.map((c, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ background: B.primary }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-words">{c.name}</p>
                <p className="text-xs mt-0.5 break-words" style={{ color: B.muted }}>{c.highlight}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-800">{formatNumber(c.reach)}</p>
                <p className="text-[10px] text-slate-400">reach · {c.er}% ER</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Quarterly Analysis" subtitle="Strategic interpretation of Q1 2026 results and Q2 outlook"/>
        <div className="space-y-4">
          <Paragraph>{d.narrative.executive}</Paragraph>
          <Paragraph>{d.narrative.trend}</Paragraph>
          <Paragraph>{d.narrative.priorities}</Paragraph>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Q1 2026 vs Q4 2025 vs annual benchmark"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Q2 2026 Action Plan" subtitle="Strategic priorities with owners, deadlines, and expected outcomes"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>

      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Q1 2026 vs Q4 2025 and annual benchmark"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Quarter Performance Analysis" subtitle="Executive commentary, momentum assessment, and campaign learnings"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.trend}</Paragraph>
        <Paragraph>{d.narrative.priorities}</Paragraph>
      </div>

      {/* Q2 Priorities */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Q2 Strategic Priorities" subtitle="Three focus areas for April–June 2026"/>
        <div className="space-y-3">
          {d.q2Priorities.map((p, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: B.primary }}>{i + 1}</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{p.priority}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.rationale}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Q2 Action Plan" subtitle="Key milestones with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Executive Summary ──────────────────────────────────────────────────────────

function ExecutiveReport({ client, liveStats }: { client: string; liveStats?: Record<string, number> | null }) {
  const d = EXECUTIVE_DEMO
  return (
    <div className="space-y-5">
      <CoverPage
        title="Executive Summary"
        subtitle="CEO-ready portfolio overview — key performance indicators, wins, strategic opportunities, and priority action for the next 30 days"
        client={client} period={d.period}
        tag="Executive Summary — May 2026"
      />
      <ReportHeader title="Executive Summary" subtitle="CEO-ready portfolio overview — all clients" client={client} period={d.period}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {d.kpis.map(({ label, value, delta, positive }, idx) => {
          let displayValue = value
          if (liveStats) {
            if (idx === 0 && liveStats.reach != null) displayValue = formatNumber(liveStats.reach)
            if (idx === 1 && liveStats.engagement_rate != null) displayValue = `${Number(liveStats.engagement_rate).toFixed(1)}%`
          }
          return (
          <div key={label} className="bg-white rounded-2xl border-2 border-slate-100 p-6 text-center hover:border-novax-border transition-colors">
            <p className="text-4xl font-bold mb-2" style={{ color: B.primary }}>{displayValue}</p>
            <p className="text-xs font-semibold text-slate-500 mb-3">{label}</p>
            <DeltaBadge delta={delta} positive={positive}/>
          </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="3-Month Reach Trend" subtitle="Portfolio-wide"/>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={d.trend}>
            <defs>
              <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={B.primary} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={B.primary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
            <Tooltip formatter={v => [formatNumber(Number(v)), 'Total Reach']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
            <Area type="monotone" dataKey="reach" stroke={B.primary} strokeWidth={2.5} fill="url(#execGrad)" dot={{ fill: B.primary, r: 4 }}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Wins This Month" subtitle="Results worth amplifying"/>
          <div className="space-y-3">
            {d.wins.map((win, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-600"/>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{win}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SectionHeader title="Opportunities" subtitle="Highest-return gaps to close"/>
          <div className="space-y-3">
            {d.opportunities.map((opp, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: B.light }}>
                  <ChevronRight className="w-3 h-3" style={{ color: B.primary }}/>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{opp}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client health table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Client Health Scorecard" subtitle="May 2026 — all active accounts"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                {['Client', 'Organic Reach', 'Avg ER', 'Paid ROAS', 'Status'].map((h, i) => (
                  <th key={h} className={cn('p-3 text-xs font-semibold', i < 4 ? 'text-left' : 'text-center')} style={{ color: B.primary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.clientBreakdown.map((c, i) => {
                const statusStyle = { ahead: 'bg-emerald-50 text-emerald-700', 'on-track': 'bg-blue-50 text-blue-700', 'at-risk': 'bg-red-50 text-red-700' }
                return (
                  <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                    <td className="p-3 font-semibold text-slate-800">{c.client}</td>
                    <td className="p-3 text-slate-700">{c.reach}</td>
                    <td className="p-3 font-bold" style={{ color: B.primary }}>{c.er}</td>
                    <td className="p-3 text-slate-700">{c.roas}</td>
                    <td className="p-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', statusStyle[c.status])}>{c.status.replace('-', ' ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Portfolio Analysis" subtitle="Month-in-review commentary"/>
        <Paragraph>{d.narrative.portfolio}</Paragraph>
        <Paragraph>{d.narrative.highlights}</Paragraph>
      </div>

      <div className="rounded-2xl p-6" style={{ background: B.primary }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Zap className="w-4 h-4 text-white"/>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: B.accent }}>Priority Action — Next 30 Days</p>
            <p className="text-white text-sm leading-relaxed">{d.action}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AI Builder ─────────────────────────────────────────────────────────────────

type ReportStructuredData = {
  kpis: { label: string; value: string; change: string }[]
  platforms: { name: string; reach: number; er: number }[]
  trend: { period: string; value: number }[]
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3"/>
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    )
    if (line.match(/^[-*] /)) {
      return (
        <div key={i} className="flex items-start gap-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: B.accent }}/>
          <p className="text-sm text-slate-700 leading-relaxed">{rendered.map((r, j) => r.props?.children?.toString?.().replace(/^[-*] /, '') ? <span key={j}>{r}</span> : r)}</p>
        </div>
      )
    }
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      return (
        <div key={i} className="flex items-start gap-3 py-1">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: B.primary }}>{num}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{rendered}</p>
        </div>
      )
    }
    if (line.startsWith('|')) {
      const cells = line.split('|').filter(Boolean).map(c => c.trim())
      if (cells.every(c => c.match(/^[-:]+$/))) return null
      return (
        <div key={i} className="grid gap-2 py-1 border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
          {cells.map((c, j) => <span key={j} className="text-xs text-slate-700 px-1">{c}</span>)}
        </div>
      )
    }
    return <p key={i} className="text-sm text-slate-700 leading-relaxed py-0.5">{rendered}</p>
  }).filter(Boolean) as React.ReactNode[]
}

function AIBuilder() {
  const { clients } = useClients()
  const { user } = useAuth()
  const [files, setFiles]           = useState<File[]>([])
  const [prompt, setPrompt]         = useState('')
  const [reportType, setReportType] = useState<Exclude<ReportTab, 'ai'>>('monthly')
  const [selectedClient, setSelectedClient] = useState('all')
  const [loading, setLoading]       = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [result, setResult]         = useState<string | null>(null)
  const [structuredData, setStructuredData] = useState<ReportStructuredData | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const clientName = selectedClient === 'all'
    ? 'Client'
    : (clients.find(c => c.id === selectedClient)?.name ?? 'Client')

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    setFiles(prev => [...prev, ...dropped].slice(0, 5))
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 5))
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const pullLiveData = async () => {
    if (selectedClient === 'all') return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    try {
      const res = await fetch(`/api/metricool/analytics?client_id=${selectedClient}&startDate=${start}&endDate=${end}`)
      const data = await res.json() as { stats?: Record<string, unknown>; error?: string }
      if (res.ok && data.stats) {
        const s = data.stats
        setPrompt(prev => `${prev}\n\nLive ${vendorName(user?.role, 'Metricool')} data (${start} to ${end}):\nReach: ${s.reach}\nImpressions: ${s.impressions}\nEngagement rate: ${s.engagement_rate}%\nLikes: ${s.likes}  Comments: ${s.comments}  Shares: ${s.shares}  Saves: ${s.saves}`.trim())
      }
    } catch { /* ignore */ }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && files.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    setStructuredData(null)
    try {
      const form = new FormData()
      form.append('prompt', prompt)
      form.append('reportType', reportType)
      files.forEach((f, i) => form.append(`file_${i}`, f))
      const res  = await fetch('/api/reports/analyze', { method: 'POST', body: form })
      const data = await res.json() as { text?: string; data?: ReportStructuredData; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult(data.text ?? '')
      setStructuredData(data.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintPDF = () => {
    const el = document.getElementById('ai-report-preview')
    if (el) {
      el.style.minWidth = '740px'
      window.dispatchEvent(new Event('resize'))
      setTimeout(() => { window.print(); setTimeout(() => { el.style.minWidth = '' }, 800) }, 350)
    } else {
      window.print()
    }
  }

  const handleExportPptx = async () => {
    if (!result) return
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result, data: structuredData ?? {}, client_name: clientName, report_type: TABS.find(t => t.id === reportType)?.label ?? reportType }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `NOVAX_${clientName}_${reportType}_report.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: B.light }}>
            <Sparkles className="w-4 h-4" style={{ color: B.primary }}/>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Report Builder</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload analytics screenshots or paste raw data — AI extracts and formats a branded report</p>
          </div>
        </div>

        {/* Client + Report type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Client</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white"
              >
                <option value="all">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={pullLiveData}
                disabled={selectedClient === 'all'}
                title={`Pull live ${vendorName(user?.role, 'Metricool')} data`}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors shrink-0"
              >
                <Activity className="w-3.5 h-3.5"/>
                Pull Live Data
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Report Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['monthly', 'paid', 'combined', 'platform', 'quarterly', 'executive'] as const).map(t => (
                <button key={t} onClick={() => setReportType(t)} className={cn(
                  'px-2 py-2 rounded-lg text-xs font-semibold border transition-colors text-left',
                  reportType === t ? 'text-white border-novax' : 'text-slate-600 border-slate-200 hover:border-novax-border',
                )} style={reportType === t ? { background: B.primary } : {}}>
                  {TABS.find(tab => tab.id === t)?.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-novax-border hover:bg-novax-light transition-all mb-4"
        >
          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2"/>
          <p className="text-sm font-medium text-slate-500">Drop analytics screenshots here</p>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF — up to 5 files</p>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFileChange}/>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-novax-border text-xs font-medium" style={{ background: B.light, color: B.primary }}>
                <FileText className="w-3 h-3"/>
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={e => { e.stopPropagation(); removeFile(i) }} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3"/>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-600 mb-2 block">Context & Instructions</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="E.g. This is May 2026 Instagram performance data for Luxe Cosmetics. Focus on Reels growth and follower trajectory. Compare ER against a 4% industry benchmark."
            rows={4}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none outline-none focus:border-novax-border transition-colors text-slate-700 placeholder:text-slate-300"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || (!prompt.trim() && files.length === 0)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: B.primary }}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
          {loading ? 'Analysing data…' : 'Analyse & Generate Report'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0"/>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div id="ai-report-preview" className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Report toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-emerald-600"/>
              </div>
              <h3 className="font-semibold text-slate-900">AI-Generated Report</h3>
              <span className="text-xs text-slate-400">— {clientName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5"/> Export PDF
              </button>
              <button
                onClick={handleExportPptx}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50"
                style={{ background: B.primary }}
              >
                {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Download className="w-3.5 h-3.5"/>}
                {exporting ? 'Exporting…' : 'Export PPTX'}
              </button>
            </div>
          </div>

          {/* KPI cards from structured data */}
          {structuredData?.kpis && structuredData.kpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-0">
              {structuredData.kpis.slice(0, 4).map(kpi => (
                <div key={kpi.label} className="rounded-xl border border-novax-border p-4" style={{ background: B.light }}>
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
                  {kpi.change && <p className="text-xs font-semibold mt-1" style={{ color: B.muted }}>{kpi.change}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Platform chart from structured data */}
          {structuredData?.platforms && structuredData.platforms.length > 0 && (
            <div className="px-6 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Platform Breakdown</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={structuredData.platforms} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(Number(v))}/>
                  <Tooltip formatter={(v, n) => [n === 'reach' ? formatNumber(Number(v)) : `${v}%`, n === 'reach' ? 'Reach' : 'ER']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}/>
                  <Bar dataKey="reach" fill={B.primary} radius={[3,3,0,0]} name="Reach"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Styled markdown report */}
          <div className="p-6 space-y-6">
            {result.split(/^### /m).filter(Boolean).map((section, i) => {
              const lines = section.trim().split('\n')
              const title = lines[0].trim()
              const body = lines.slice(1).join('\n').trim()
              return (
                <div key={i}>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3 pb-2 border-b" style={{ color: B.primary, borderColor: B.border }}>{title}</h3>
                  <div className="space-y-0.5">{renderMarkdown(body)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parsePeriodToRange(period: string): { startDate: string; endDate: string } | null {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const mMatch = period.match(/^(\w+)\s+(\d{4})$/)
  if (mMatch) {
    const mi = MONTHS.findIndex(m => m === mMatch[1])
    if (mi >= 0) {
      const y = mMatch[2]
      const last = new Date(Number(y), mi + 1, 0).getDate()
      return { startDate: `${y}-${String(mi + 1).padStart(2, '0')}-01`, endDate: `${y}-${String(mi + 1).padStart(2, '0')}-${last}` }
    }
  }
  const qMatch = period.match(/^Q(\d)\s+(\d{4})$/)
  if (qMatch) {
    const q = Number(qMatch[1]); const y = qMatch[2]
    const sm = (q - 1) * 3 + 1; const em = q * 3
    return { startDate: `${y}-${String(sm).padStart(2, '0')}-01`, endDate: `${y}-${String(em).padStart(2, '0')}-${new Date(Number(y), em, 0).getDate()}` }
  }
  return null
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { clients }                   = useClients()
  const [activeTab, setActiveTab]     = useState<ReportTab>('monthly')
  const [selectedClient, setSelectedClient] = useState('all')
  const [period, setPeriod]           = useState('May 2026')
  const [generating, setGenerating]   = useState(false)
  const [generated, setGenerated]     = useState(false)
  const [liveStats, setLiveStats]     = useState<Record<string, number> | null>(null)
  const [liveError, setLiveError]     = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const clientName = selectedClient === 'all'
    ? 'All Clients'
    : (clients.find(c => c.id === selectedClient)?.name ?? 'All Clients')

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerated(false)
    setLiveStats(null)
    setLiveError(null)
    if (selectedClient !== 'all') {
      const range = parsePeriodToRange(period)
      if (range) {
        try {
          const res = await fetch(`/api/metricool/analytics?client_id=${selectedClient}&startDate=${range.startDate}&endDate=${range.endDate}`)
          const data = await res.json()
          if (res.ok && data.stats) setLiveStats(data.stats)
          else setLiveError(data.error ?? 'Live data unavailable')
        } catch {
          setLiveError('Could not connect to analytics API')
        }
      }
    }
    await new Promise(r => setTimeout(r, 400))
    setGenerating(false)
    setGenerated(true)
  }

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab)
    setGenerated(false)
  }

  const handleExportPDF = async () => {
    setExportingPdf(true)
    try {
      const res = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: activeTab,
          clientName,
          period,
          data: {
            kpis: [
              { metric: 'Reach',           value: '284,500' },
              { metric: 'Impressions',     value: '412,000' },
              { metric: 'Engagement Rate', value: '5.8%' },
              { metric: 'New Followers',   value: '2,840' },
            ],
          },
        }),
      })
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tab bar + controls */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max border-b border-slate-100">
            {TABS.map(tab => {
              const Icon   = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors',
                    active
                      ? 'border-b-2 text-novax bg-novax-light'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                  )}
                  style={active ? { borderBottomColor: B.primary } : {}}
                >
                  <Icon className="w-4 h-4 shrink-0"/>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab !== 'ai' && (
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 max-w-lg">{TABS.find(t => t.id === activeTab)?.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClient}
                onChange={e => { setSelectedClient(e.target.value); setGenerated(false) }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white transition-all"
              >
                <option value="all">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={period}
                onChange={e => { setPeriod(e.target.value); setGenerated(false) }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-border bg-white transition-all"
              >
                {['May 2026', 'April 2026', 'March 2026', 'Q1 2026', 'Q4 2025'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
                style={{ background: generating ? B.muted : B.primary }}
              >
                {generating
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Generating…</>
                  : <><FileText className="w-3.5 h-3.5"/> {selectedClient !== 'all' ? 'Generate Report' : 'Generate Demo Report'}</>}
              </button>
              {generated && liveStats && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                  <Activity className="w-3 h-3"/> Live Data
                </span>
              )}
              {generated && liveError && selectedClient !== 'all' && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg" title={liveError}>
                  <AlertCircle className="w-3 h-3"/> Demo Data
                </span>
              )}
              {generated && (
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5"/>
                  {exportingPdf ? 'Preparing…' : 'Export PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      {activeTab === 'ai' ? (
        <AIBuilder/>
      ) : generated ? (
        <div id="printable-report" className="space-y-5">
          {activeTab === 'monthly'   && <MonthlyReport   client={clientName} liveStats={liveStats}/>}
          {activeTab === 'paid'      && <PaidReport       client={clientName}/>}
          {activeTab === 'combined'  && <CombinedReport   client={clientName}/>}
          {activeTab === 'platform'  && <PlatformReport   client={clientName}/>}
          {activeTab === 'quarterly' && <QuarterlyReport  client={clientName}/>}
          {activeTab === 'executive' && <ExecutiveReport  client={clientName} liveStats={liveStats}/>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: B.light }}>
            <BarChart2 className="w-8 h-8" style={{ color: B.primary }}/>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {TABS.find(t => t.id === activeTab)?.label}
          </h3>
          <p className="text-sm text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
            {TABS.find(t => t.id === activeTab)?.description}
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ background: B.primary }}
          >
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin"/> Generating…</>
              : <><FileText className="w-4 h-4"/> Generate Demo Report</>}
          </button>
        </div>
      )}
    </div>
  )
}
