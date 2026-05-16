# Reports & Presentations — Action Plan

> **Goal:** Replace hardcoded chart data with real Supabase queries, pull performance metrics from Metricool, wire pptxgenjs to generate real .pptx files, and build a report download history.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| KPI cards UI | Done — shows hardcoded numbers |
| Reach Growth line chart | Done — uses static `MONTH_DATA` array |
| Engagement Rate bar chart | Done — same |
| Platform breakdown table | Done — static |
| Client performance table | Done — static |
| Report builder dialog (client + date range) | Done |
| `presentation_builder` agent call | Done — calls `/api/ai` (doesn't exist) |
| `pptxgenjs` installed | Yes |

### What is missing
| Piece | Status |
|-------|--------|
| Real KPI queries | Not built — all numbers are hardcoded |
| Metricool analytics pull | Not built — no `/api/analytics/metricool` route |
| `reports` table data | Table exists in schema but is empty |
| `api_usage` cost aggregation | Not built |
| `/api/ai` with `presentation_builder` | Does not exist (AI_AGENT_SYSTEM_PLAN) |
| pptxgenjs rendering in API route | Not built |
| Download history (past reports) | Not built |

---

## Phase 1 — Real KPI Queries

**Replace hardcoded stats with Supabase aggregations.**

### New hooks

**File to create:** `lib/hooks/use-reports.ts`

```ts
// Monthly KPIs (from reports table if populated, fallback to scheduled_posts + api_usage)
export function useMonthlyKpis(clientId?: string, month?: string) {
  // SELECT SUM(reach), SUM(impressions), AVG(engagement_rate), SUM(likes)
  // FROM reports WHERE client_id = ? AND period_month = ?
}

// AI cost for current month
export function useAiCostMonth() {
  // SELECT SUM(cost_usd) FROM api_usage
  // WHERE created_at >= start_of_month AND created_at <= now()
}

// Post counts
export function usePostStats(clientId?: string) {
  // SELECT COUNT(*) FROM scheduled_posts
  // GROUP BY status
  // WHERE (client_id = ?)
  //   AND scheduled_at >= start_of_month
}

// Client performance summary (all clients, current period)
export function useClientPerformance() {
  // JOIN clients + reports for the current period
}

// Platform breakdown (reach/impressions/ER per platform)
export function usePlatformBreakdown(clientId?: string) {
  // From reports.metrics_json which stores per-platform data
}
```

### Dashboard dependency

The dashboard page also uses hardcoded stats. Once these hooks exist, dashboard migrates to them too (covered in DASHBOARD_PLAN).

---

## Phase 2 — Metricool Analytics Pull

**Pull real performance data from Metricool into the `reports` table.**

**File to create:** `app/api/analytics/metricool/route.ts`

### Metricool API

```
GET https://app.metricool.com/api/v2/analytics/posts
Headers: X-Mc-Auth: {METRICOOL_API_TOKEN}
Query: ?blogId={blog_id}&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Response:
```json
{
  "data": [
    {
      "postId": "mc_post_id",
      "platform": "instagram",
      "publishedAt": "2026-05-01T10:00:00Z",
      "reach": 4200,
      "impressions": 6100,
      "engagementRate": 4.2,
      "likes": 320,
      "comments": 18,
      "shares": 12,
      "saves": 45
    }
  ]
}
```

### Route logic

```
POST /api/analytics/metricool
Body: { clientId, from, to }

1. Lookup client.metricool_blog_id from Supabase
2. GET Metricool analytics for that blogId + date range
3. For each post in response:
   a. Find matching scheduled_posts WHERE metricool_post_id = post.postId
   b. UPDATE scheduled_posts SET performance_data = { reach, impressions, ... }
4. Aggregate totals per period:
   { total_reach, total_impressions, avg_er, total_likes, by_platform: {...} }
5. UPSERT into reports:
   { client_id, period_start: from, period_end: to, metrics_json: aggregated }
6. Return aggregated metrics
```

### When to trigger

- Manual: "Refresh Analytics" button in Reports page
- Scheduled (future): Supabase Edge Function on cron (`0 6 * * *` — daily at 6am)

### Files to create

| File | Purpose |
|------|---------|
| `app/api/analytics/metricool/route.ts` | Analytics pull |

---

## Phase 3 — Real Charts

**Replace static arrays with real data from hooks.**

### Current hardcoded data in `reports/page.tsx`

```ts
const MONTH_DATA = [
  { month: 'Jan', reach: 42000, er: 3.8 },
  { month: 'Feb', reach: 48000, er: 4.1 },
  // ...
]
```

### Replacement

```ts
const { monthlyData, isLoading } = useMonthlyKpis(selectedClient, selectedPeriod)
// monthlyData: [{ month: 'Jan 2026', reach: number, er: number }]
```

Wire each chart to the real hook. Show a loading skeleton while data fetches.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/reports/page.tsx` | Replace all hardcoded arrays with hook data |
| `lib/hooks/use-reports.ts` | Build `useMonthlyKpis()` |

---

## Phase 4 — Presentation Builder (pptxgenjs)

**File to create:** `app/api/reports/generate/route.ts`

### Flow

```
POST /api/reports/generate
Body: { clientId, from, to }

1. Fetch client data (brand identity, KPIs) from Supabase
2. Fetch metrics for period from reports table
3. Call presentation_builder agent via anthropic.messages.create():
   - Returns JSON: [{ slide, title, layout, content, notes }]
4. Pass slide structure to pptxgenjs:
   a. Create PptxGenJS instance
   b. Set theme (client brand colors)
   c. For each slide: add slide, layout content (text, chart, table, image)
   d. Generate .pptx buffer
5. Upload .pptx to Supabase Storage (presentations bucket)
6. INSERT into presentations table
7. Return { downloadUrl }
```

### pptxgenjs integration

```ts
import PptxGenJS from 'pptxgenjs'

function buildPresentation(slides: SlideSpec[], client: Client, metrics: Metrics): Buffer {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = `${client.name} — Performance Report`

  for (const spec of slides) {
    const slide = pptx.addSlide()

    if (spec.layout === 'cover') {
      slide.addText(spec.title, { x: 0.5, y: 2, fontSize: 32, bold: true, color: client.brand_identity.primary_color })
      slide.addText(spec.content, { x: 0.5, y: 3.5, fontSize: 16 })
    } else if (spec.layout === 'chart') {
      // Add recharts-compatible data as pptxgenjs bar/line chart
    }
    // ... other layouts
  }

  return pptx.stream() as unknown as Buffer
}
```

### Slide layouts handled

| Layout | pptxgenjs elements |
|--------|-------------------|
| `cover` | Big title text + subtitle + client color background |
| `text` | Bullet point list |
| `chart` | Bar or line chart from metrics |
| `table` | Data table (platform breakdown, post performance) |
| `image+text` | Left image column + right text |
| `kpi` | Large numbers with labels (reach, ER, impressions) |

### Files to create

| File | Purpose |
|------|---------|
| `app/api/reports/generate/route.ts` | Orchestrates AI + pptxgenjs |

---

## Phase 5 — Report Download History

**Store past generated reports and show them in the UI.**

### `presentations` table (already in schema)

```
presentations
  id, client_id, url, slide_count, generated_at, created_by
```

### UI

Add a "Past Reports" section below the report builder:

| Column | Content |
|--------|---------|
| Client | Color dot + name |
| Period | "Jan 2026 – Mar 2026" |
| Slides | Count |
| Generated | Date |
| Actions | Download button |

### Hook

**Add to `lib/hooks/use-reports.ts`:**

```ts
export function usePresentations(clientId?: string)
  // SELECT * FROM presentations ORDER BY generated_at DESC
```

---

## Build Order

```
Phase 1a  Create lib/hooks/use-reports.ts
Phase 1b  useMonthlyKpis() query
Phase 1c  usePostStats() query
Phase 1d  useAiCostMonth() query

Phase 2a  Create /api/analytics/metricool/route.ts
Phase 2b  Add "Refresh Analytics" button to reports page
Phase 2c  Wire button to POST this route

Phase 3a  Replace MONTH_DATA with useMonthlyKpis() in reports page
Phase 3b  Replace platform breakdown static data
Phase 3c  Replace client performance table static data
Phase 3d  Add loading skeletons

Phase 4a  Create /api/reports/generate/route.ts
Phase 4b  presentation_builder agent prompt (AI_AGENT_SYSTEM_PLAN Phase 3h)
Phase 4c  pptxgenjs slide builder function
Phase 4d  Upload .pptx to Storage + INSERT presentations record
Phase 4e  Wire "Generate Report" button to this route

Phase 5a  usePresentations() hook
Phase 5b  Add past reports section to reports page
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/hooks/use-reports.ts` | 1, 5 | Create |
| `app/api/analytics/metricool/route.ts` | 2 | Create |
| `app/(app)/reports/page.tsx` | 3, 4, 5 | Edit |
| `app/api/reports/generate/route.ts` | 4 | Create |

---

## Scope Boundary

- **No real-time analytics** — pull-on-demand only (no background sync job in this phase).
- **No PDF export** — `.pptx` only. If PDF is needed later, add a headless chromium conversion step.
- **No custom slide templates** — fixed layout set defined in code.
- **No multi-client combined report** — one client per report.
