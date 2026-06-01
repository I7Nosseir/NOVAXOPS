# PLAN: Real Report Generation from Metricool + Gemini

## Status
**IN PROGRESS** — Implementation started 2026-06-01

---

## Goal
Enable AI-powered report generation for all 6 report templates. User selects a client and period, clicks **Generate Report**, and gets a fully populated report with real Metricool data in charts and Gemini-written narrative in every text section. **No recommendations anywhere in any report.**

---

## What was already built (before this plan)
- 6 template tabs with rich static demo data
- `handleGenerate` fetches Metricool stats/platforms/trend and overlays live numbers on KPIs
- Narrative text was still static demo text — Gemini was only used by the AI Builder tab
- `RecommendationsList` and `ActionPlanTable` components existed in every template

---

## Architecture

```
User: selects client + period + tab → clicks "Generate Report"
↓
ReportsPage.handleGenerate()
↓
POST /api/reports/generate
  ├─ Fetch Metricool: stats + platforms + trend (via getMetricoolData helper)
  ├─ Lookup client brand profile (mock data → Supabase when connected)
  ├─ Build type-specific Gemini prompt via lib/report-prompts.ts
  │    └─ Strictly forbids recommendations, suggestions, action items
  ├─ Call Gemini gemini-2.0-flash-exp
  ├─ Parse Gemini response into named sections (split on ### headers)
  └─ Return: { narrative, stats, platforms, trend, meta, _mock? }
↓
Page state update:
  setLiveStats(data.stats)
  setLivePlatforms(data.platforms)
  setLiveTrend(data.trend)
  setAiReport({ narrative: data.narrative, meta: data.meta })
  setGenerated(true)
↓
Template renders with:
  - Charts/tables: Metricool data (liveStats, livePlatforms, liveTrend — unchanged path)
  - Narrative text: Gemini sections (aiReport.narrative.*)
  - All 6 templates: RecommendationsList REMOVED, ActionPlanTable REMOVED
  - Quarterly: Q2Priorities section REMOVED
  - Executive: PriorityAction section REMOVED
```

---

## New Files

### `app/api/reports/generate/route.ts`
POST handler. Body: `{ clientId, reportType, startDate, endDate }`.

Steps:
1. Validate params — return 400 if missing
2. Fetch Metricool data via internal `getMetricoolData()` helper (same logic as analytics route, returns mock if not configured)
3. Look up client name/brand from mock data (Supabase query when connected)
4. Build prompt: `buildReportPrompt(reportType, metricoolData, clientContext)`
5. Call Gemini API (`gemini-2.0-flash-exp`, same as existing analyze route)
6. Parse Gemini text into sections via `parseSections(text)`: splits on `^### ` headers, maps to `{ executive, reach, engagement, platform, trend, audience, formats, hashtags, synergy, channel, efficiency, creative, quarterly_overview, monthly_breakdown, portfolio, clients }`
7. Return `{ narrative, stats, platforms, trend, meta, _mock? }`

### `lib/report-prompts.ts`
Exports `buildReportPrompt(type, data, clientName, period, brandContext?)`.

One prompt per report type. All share these hard rules:
- No recommendations, no suggestions, no action items, no "you should", no "consider", no "we recommend"
- No hashtags, no emojis
- Prose paragraphs, bold key numbers with `**`
- Senior analyst briefing a CEO

Sections per type:

| Type       | Sections |
|------------|----------|
| `monthly`  | Executive Summary / Reach & Impressions / Engagement / Platform Performance / Trend / Audience Insights |
| `paid`     | Executive Summary / Spend & Efficiency / Creative Performance / Campaign Analysis |
| `combined` | Executive Summary / Channel Mix Analysis / Paid vs Organic Synergy / Platform Distribution |
| `platform` | Executive Summary / Follower Growth / Format Performance / Engagement Quality |
| `quarterly`| Executive Summary / Quarterly Overview / Month-by-Month / Platform Performance |
| `executive`| Portfolio Overview / Client Performance / Platform Distribution / Highlights |

---

## Modified Files

### `app/(app)/reports/page.tsx`

**New type:**
```typescript
type AIReportNarrative = {
  executive?: string
  reach?: string
  engagement?: string
  platform?: string
  trend?: string
  audience?: string
  formats?: string
  hashtags?: string
  synergy?: string
  channel?: string
  efficiency?: string
  creative?: string
  quarterly_overview?: string
  monthly_breakdown?: string
  portfolio?: string
  clients?: string
}
type AIReport = {
  narrative: AIReportNarrative
  meta: { period: string; clientName: string; reportType: string; generatedAt: string; isMock: boolean }
}
```

**State additions:**
```typescript
const [aiReport, setAiReport] = useState<AIReport | null>(null)
```

**`handleGenerate` rewrite:**
- Calls `POST /api/reports/generate` instead of `GET /api/metricool/analytics`
- On success: sets `liveStats`, `livePlatforms`, `liveTrend`, `aiReport`
- On error: sets `liveError` with message
- Always sets `generated = true` (shows template even if AI failed — falls back to demo narrative)

**Template component prop additions:**
- `MonthlyReport`: + `aiReport?: AIReport | null`
- `PlatformReport`: + `aiReport?: AIReport | null`
- `QuarterlyReport`: + `aiReport?: AIReport | null`
- `ExecutiveReport`: + `aiReport?: AIReport | null`
- `PaidReport`: + `aiReport?: AIReport | null`
- `CombinedReport`: + `aiReport?: AIReport | null`

**Template narrative substitution pattern:**
```tsx
// Before
<Paragraph>{d.narrative.executive}</Paragraph>

// After
<Paragraph>{aiReport?.narrative?.executive ?? d.narrative.executive}</Paragraph>
```

**Sections removed from ALL templates (no exceptions):**
- `RecommendationsList` usage + its `SectionHeader` wrapper
- `ActionPlanTable` usage + its `SectionHeader` wrapper
- QuarterlyReport: `q2Priorities` section + its `SectionHeader` wrapper
- ExecutiveReport: `Priority Action — Next 30 Days` teal box

**Quarterly report — live data integration:**
The quarterly template also accepts `liveTrend` (already flows through `ReportsPage`).
When `liveTrend` is available, use the last 3 entries as the quarterly breakdown.

---

## Metricool Data for Each Report Type

| Template       | Metricool data used                          | Limitation |
|----------------|----------------------------------------------|------------|
| Monthly        | stats, platforms, trend (5-month)            | Full support |
| Paid Ads       | organic stats only (no campaign spend data)  | Gemini notes organic metrics; paid needs ad platform |
| Paid+Organic   | organic stats (paid side shown as unavailable)| Partial |
| Platform Dive  | platform-specific from platforms array       | Full for platforms with data |
| Quarterly      | trend (last 3 months), stats for period      | Full support |
| Executive      | stats + platforms for selected client        | Single client |

---

## No-Recommendations Rule
Every Gemini prompt contains this explicit block:

```
STRICT RULE: Do NOT include:
- Recommendations, suggestions, or action items
- "You should...", "We recommend...", "Consider...", "It would be beneficial..."
- Forward-looking advice of any kind
- "Next steps", "Action plan", "Strategic priorities"

Your report describes what happened. It does not prescribe what to do next.
```

---

## Fallback Behaviour
- If `GEMINI_API_KEY` is missing: skip Gemini call, return Metricool data only (templates render with live data + static narrative fallback)
- If Metricool not configured: return mock data + AI analysis of mock data
- If client not found: return 404
- If Gemini fails: return `{ narrative: {}, stats: mockStats, ... }` — templates gracefully fall back to demo narrative text

---

## Export (PDF/PPTX)
Existing export routes work unchanged. The PDF export uses the rendered DOM (window.print). PPTX export uses the AI text if passed through — no changes needed to export routes.

---

## Testing Checklist
- [ ] Select Luxe Cosmetics + May 2026 + Monthly → reports generates with Gemini narrative
- [ ] "Live Data" badge shows when Metricool returns real data
- [ ] "Demo Data" badge shows when mock fallback is used
- [ ] No recommendations section visible in any generated report
- [ ] No action plan section visible in any generated report
- [ ] QuarterlyReport: Q2 priorities section absent
- [ ] ExecutiveReport: Priority action box absent
- [ ] PDF export works after AI generation
- [ ] Selecting "All Clients" shows demo report (no AI generation without client selection)
- [ ] Changing client/period resets `aiReport` to null (narrative clears)
- [ ] Gemini API key missing → graceful fallback with Metricool data shown
