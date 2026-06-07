# PLAN: Competitor Intelligence System + Onboarding Simplification

**Status:** Draft — 2026-06-07  
**Scope:** Competitor discovery, analysis, learning loop; simplified client onboarding wizard; competitors integrated into every client profile  
**Excludes:** Metricool additions (no post-sync, no scheduling features)  
**Estimate:** ~28h across 3 phases

---

## Problem Statement

1. **Competitors are an afterthought.** They can only be added manually in the Performance tab after client creation. There is no discovery, no scraping, no AI analysis of what competitors are actually doing.  
2. **Client onboarding is 3 steps that mix identity with operational config.** The Metricool blog ID lives in the wizard next to brand color — these belong in Settings, not onboarding.  
3. **Every studio tool operates blind to competition.** The Hook Lab, Campaign Igniter, and Strategy tools don't know what competitors are publishing, what hooks they use, or what formats dominate the niche.  
4. **No learning loop.** Competitor patterns aren't fed back into content generation.

---

## What We're Building

### A — Simplified Client Onboarding (2 steps instead of 3)
Remove Metricool ID and posts_per_week from the wizard. Add competitors as a first-class onboarding field. Make the wizard faster and cleaner.

### B — Competitors on Every Client Profile
Each client card and detail modal shows a live competitors section: handles, platforms, key metrics, last synced. One-click access to deep analysis.

### C — Competitor Intelligence Studio Tool
New studio page `/studio/competitive`. AI-powered competitive landscape: discover, scrape (via Apify), analyze gaps, extract hook/format patterns, and inject those patterns into every content tool.

### D — AI Learning Loop
Competitor patterns (best hooks, content formats, posting cadence, growth signals) are injected as context into Hook Lab, Campaign Igniter, Strategy, and Content Studio — so every output is already differentiated from competition.

---

## Phase 1 — Onboarding Simplification (4h)

### 1.1 New 2-Step Wizard Flow

**Step 1: Brand Identity**
- Logo upload (drag-and-drop, optional)
- Brand name (required)
- Industry (required)
- Brand color
- Content language (EN / AR / Both)
- Website URL (optional)
- Active platforms (checkbox grid)

**Step 2: Voice, Audience & Competitors**
- Formality slider (Casual ↔ Formal)
- Energy slider (Serious ↔ Playful)
- Arabic dialect (if AR selected)
- Target audience (required)
- Key messages (up to 3, optional)
- **Competitors — NEW:** Add 2–4 competitor Instagram/TikTok/LinkedIn handles during onboarding. Simple tag-style inputs: type handle → Enter → chip appears. Platform dropdown next to each.

**Removed from wizard:**
- `metricool_blog_id` — moves to Settings > Integrations (admin only, where it belongs)
- `posts_per_week` — moves to the client detail > Settings tab
- The Publishing step disappears entirely

### 1.2 Competitor Data Saved on Create

On wizard submit, for each competitor handle entered:
1. Insert into `competitor_snapshots` (client_id, handle, platform) with empty metrics
2. Queue a background scrape (fire `/api/competitors/scrape` for each, non-blocking)
3. `competitor_context_json` in clients table updated with the handles list

### 1.3 Files Changed

| File | Change |
|------|--------|
| `components/clients/new-client-wizard.tsx` | Rewrite: collapse 3 steps → 2. Remove metricool/posts fields. Add competitor handle inputs in Step 2. |
| `app/api/clients/route.ts` | On POST: trigger scrape for each competitor handle provided |
| `app/(app)/settings/page.tsx` | Add metricool_blog_id field per client in the Integrations tab (admin) |

---

## Phase 2 — Competitors on Every Client Profile (6h)

### 2.1 Competitors Tab in Client Detail Modal

The client detail modal currently has: Overview / Intelligence / Tasks tabs.

Add a **Competitors** tab.

**Competitors tab layout:**
```
[ + Add Competitor ]  [ Discover with AI ]

┌─────────────────────────────────────────────┐
│ @competitor_handle  [Instagram]             │
│ 84K followers · 3.2% ER · Posts 5x/week    │
│ Last synced: 3 days ago  [ Sync ]  [ Delete]│
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ @another_brand  [TikTok]                    │
│ 210K followers · 6.1% ER · Posts 12x/week  │
│ Last synced: 1 week ago  [ Sync ]  [ Delete]│
└─────────────────────────────────────────────┘

[ Run Competitive Analysis ]  → opens studio/competitive
```

**"Discover with AI" button:**
- Calls `/api/competitors/discover` with client industry + niche
- Claude returns 5–8 suggested competitor handles with platform
- User checks which ones to add → click Add Selected

### 2.2 Competitor Quick-View on Client Card

On the client grid card (clients page), add a subtle competitor count badge:
- `3 competitors tracked` in small text below the client name
- Clicking the badge jumps directly to the Competitors tab in the detail modal

### 2.3 Sync Architecture

Each competitor scrape:
1. Calls Apify actor for the platform (Instagram public profile scraper / TikTok profile scraper)
2. Extracts: follower count, avg ER (from recent 12 posts), post frequency, top content types
3. Upserts into `competitor_snapshots` — updates metrics, sets `captured_at = now()`
4. Optionally: saves top 5 posts into `competitor_post_samples` table (new — see DB section)

Manual sync = user clicks [ Sync ] on a competitor card → POST `/api/competitors/scrape`
Auto sync = daily cron (`/api/cron/sync-competitors`) runs for all tracked competitors

### 2.4 New SQL Migration: 023_competitor_posts.sql

```sql
CREATE TABLE competitor_post_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competitor_handle TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_url TEXT,
  content_type TEXT CHECK (content_type IN ('reel', 'carousel', 'static', 'story')),
  caption TEXT,
  hook_text TEXT,          -- first line / first 10 words of caption
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  views INT DEFAULT 0,
  shares INT DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comp_posts_client ON competitor_post_samples(client_id);
CREATE INDEX idx_comp_posts_handle ON competitor_post_samples(client_id, competitor_handle);

ALTER TABLE competitor_post_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON competitor_post_samples FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read" ON competitor_post_samples FOR SELECT TO authenticated USING (true);
```

### 2.5 New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/competitors/discover` | POST | Claude suggests 5–8 competitor handles for client's industry |
| `/api/competitors/scrape` | POST | Apify scrape: profile metrics + top 5 posts for one handle |
| `/api/competitors/analyze` | POST | AI gap analysis across all client competitors → returns structured report |
| `/api/competitors/posts` | GET | Fetch `competitor_post_samples` for a client (filterable by handle) |
| `/api/cron/sync-competitors` | GET | Daily: scrape all tracked competitors across all clients |

### 2.6 Files

| File | Change |
|------|--------|
| `components/clients/competitor-card.tsx` | NEW: compact card showing handle, platform, follower count, ER%, sync button |
| `components/clients/add-competitor-dialog.tsx` | NEW: dialog — handle input + platform selector + optional manual metrics |
| `components/clients/competitors-panel.tsx` | NEW: panel rendering competitor cards + Discover AI + Run Analysis |
| `app/(app)/clients/page.tsx` | Add Competitors tab to client detail modal. Add competitor badge on client cards. |
| `app/api/competitors/discover/route.ts` | NEW: Claude suggests handles from industry context |
| `app/api/competitors/scrape/route.ts` | NEW: Apify call per handle, upsert to competitor_snapshots + competitor_post_samples |
| `app/api/competitors/analyze/route.ts` | NEW: Claude gap analysis using all competitor data |
| `app/api/competitors/posts/route.ts` | NEW: read competitor_post_samples |
| `app/api/cron/sync-competitors/route.ts` | NEW: daily batch scrape |
| `vercel.json` | Add cron entry for sync-competitors (daily 03:00) |

---

## Phase 3 — Competitor Intelligence Studio Tool (12h)

### 3.1 New Page: `/studio/competitive`

A dedicated competitive intelligence workspace. Linked from the Studio Hub and from the client detail Competitors tab (Run Analysis button).

**Page URL:** `/studio/competitive?client=<client_id>`

**Layout:** 4 sections rendered sequentially after running analysis.

---

#### Section 1 — Landscape Overview

A ranked table of all tracked competitors for this client:

```
Rank  Handle          Platform    Followers   ER%    Posts/wk   Growth Signal
 1    @competitor_a   Instagram   210K        6.1%    12         Accelerating
 2    @competitor_b   TikTok       84K        3.2%     5         Stable
 3    @competitor_c   Instagram    41K        8.8%     3         Declining
```

Rendered as a sortable table. Growth signal is AI-assessed from follower delta between scrapes (if 2+ snapshots exist) or labelled "Not enough data".

---

#### Section 2 — Content Gap Map

AI analyses what each competitor posts (from `competitor_post_samples.content_type` and hook patterns) versus what the client posts (from `scheduled_posts` + `post_performance_snapshots`).

Output: a visual matrix

```
                     | Reels | Carousel | Static | Long-form
---------------------|-------|----------|--------|----------
Your client          |  40%  |   35%    |  25%   |    0%
@competitor_a        |  70%  |   20%    |  10%   |    0%
@competitor_b        |  15%  |   10%    |  75%   |    0%
@competitor_c        |  50%  |   40%    |  10%   |    0%

Opportunity: Carousel is underused by competitors — high differentiation potential
```

AI also surfaces hook pattern gaps:
- "Competitors rely heavily on Question hooks. Story hooks are underused. Consider leading with Personal Story format."
- "No competitor is using educational '3 things about X' carousels in this niche."

---

#### Section 3 — Threat Assessment

Claude ranks each competitor on 3 axes:
- **Engagement Quality** — is their ER real or inflated? (comment-to-like ratio check)
- **Content Velocity** — are they accelerating their posting cadence?
- **Audience Overlap** — industry + language + region match score (assessed from client brief)

Output: a threat card per competitor:
```
@competitor_a — HIGH THREAT
- Fastest-growing account in niche (+12K followers this month)
- ER 6.1% — well above industry average
- Posts daily Reels with strong hook patterns
- Recommended response: match posting frequency, differentiate via longer Carousels
```

---

#### Section 4 — Intelligence Report + Injection

**"Export to Strategy" button:**  
Generates a `StrategyDocument`-compatible JSON block and opens it in the Strategy Studio with competitor context pre-loaded.

**"Inject into Hook Lab" button:**  
Opens Hook Lab with a pre-filled brief that includes:
- Competitor hook samples pulled from `competitor_post_samples.hook_text`
- The instruction: "Generate 20 hooks that are differentiated from these competitor hooks: [list]"

**"Inject into Campaign Igniter" button:**  
Opens Campaign Igniter with competitor context pre-loaded in the brief.

**AI summary block** (Claude):
A 5-bullet "What to do this month" list derived from the full competitive analysis. Saved to `ai_responses` with `agent_type = 'competitor_intelligence'`.

---

### 3.2 Analysis API: `/api/competitors/analyze`

**Input:**
```json
{
  "client_id": "uuid",
  "mode": "full | gap | threat"
}
```

**What Claude receives:**
- Client brand identity (industry, audience, tone, platforms, key messages)
- All competitor snapshots for this client (handle, platform, followers, ER, frequency, top_content_types)
- All `competitor_post_samples` for this client (content_type, hook_text, ER per post)
- Client's own recent post performance (`post_performance_snapshots` — last 30 days)
- Client context bank via `buildClientIntelligenceBlock()`

**Output schema:**
```typescript
interface CompetitorAnalysis {
  landscape: CompetitorRanking[]
  content_gap_matrix: ContentGapRow[]
  opportunities: string[]          // 3–5 actionable gap opportunities
  threats: CompetitorThreat[]
  hooks_to_avoid: string[]         // hooks competitors use heavily
  hooks_to_try: string[]           // hook types underused in this niche
  recommended_formats: string[]    // formats client should prioritize
  monthly_actions: string[]        // 5 prioritized actions
  generated_at: string
}
```

**Cached:** stored in `ai_generation_cache` with key = `competitor_analysis_{client_id}`. Invalidated whenever a competitor is synced (i.e. `captured_at` changes).

---

### 3.3 Studio Hub Integration

Add "Competitive Intelligence" to the Studio Hub page:

```
┌─────────────────────────────────┐
│  Competitive Intel              │
│  Discover what competitors are  │
│  doing — and how to beat them   │
└─────────────────────────────────┘
```

Sidebar link: add under Studio section (admin + creative_director visibility).

---

## Phase 4 — AI Learning Loop (6h)

Competitor patterns become context in every studio tool. This is configuration / prompt changes, not new UI.

### 4.1 What Gets Injected

For any studio tool call where `client_id` is set:
1. Fetch the most recent `competitor_analysis` from `ai_generation_cache`
2. If found and < 7 days old, inject a "COMPETITIVE CONTEXT" block into the system prompt:

```
COMPETITIVE CONTEXT (as of {date}):
- Top competitor: @{handle} on {platform} — {followers}K followers, {ER}% ER
- They post {frequency}x/week, primarily {content_type} content
- Overused hooks in this niche: {hooks_to_avoid}
- Underused formats in this niche: {recommended_formats}
- Key differentiation opportunities: {opportunities}

Your output must be clearly differentiated from competitor patterns above.
```

### 4.2 Tools That Receive Competitor Context

| Tool | Injection Point |
|------|-----------------|
| Hook Lab (`/api/studio/hooks/generate`) | Injected into system prompt. Also passed as `hooks_to_avoid[]` — the model must not generate variations of these. |
| Campaign Igniter (`/api/studio/campaign/generate`) | Injected. Competitor content formats used as constraints to invert. |
| Strategy (`/api/studio/strategy`) | Full competitive landscape injected. Strategy must address each named threat. |
| Content Studio (`/api/studio/content/[id]/script`) | Injected into brief. Model told to differentiate hook and format from competitor norms. |
| Post-Mortem (`/api/studio/postmortem`) | Competitor benchmarks injected — "Did competitor posting habits affect your performance window?" |

### 4.3 `lib/client-intelligence.ts` Extension

Add `buildCompetitorContextBlock(client_id)`:
```typescript
async function buildCompetitorContextBlock(clientId: string): Promise<string>
```
- Reads latest competitor analysis from cache
- Returns formatted string or empty string if no data
- Called alongside `buildClientIntelligenceBlock()` in all studio routes

---

## Phase 5 — Pipeline View Simplification (2h — no DB changes)

The 10-stage pipeline is correct as data, but the board feels wide. Add a grouped view.

### 5.1 Phase Groups

```
Pre-Production   →  strategy, ideas, calendar
Production       →  copy, design
Quality          →  review, approval
Live             →  scheduled, published
Analytics        →  reporting
```

### 5.2 UI Change: View Toggle

On the Pipeline page toolbar (next to Board/List toggle):
- Add: **[ Grouped | Full ]** toggle (default: Full, persisted in localStorage)

**Grouped view:**
- 5 columns instead of 10
- Each column shows total task count + stacked task cards from all stages in that group
- Click a grouped column → expands to show sub-stage breakdown inline
- Drag-and-drop still works (task dropped into group goes to the first stage in that group)

**Full view:**
- Existing 10-column board (unchanged)

### 5.3 Files

| File | Change |
|------|--------|
| `app/(app)/pipeline/page.tsx` | Add view toggle state. Pass `viewMode` to PipelineBoard. |
| `components/pipeline/pipeline-board.tsx` | Support `viewMode: 'full' | 'grouped'`. When grouped, merge stages into 5 DndContexts. |
| `lib/utils.ts` | Add `PIPELINE_GROUPS` constant mapping group names to stage arrays. |

---

## Summary: New Files

```
sql/
  023_competitor_posts.sql

app/api/competitors/
  discover/route.ts
  scrape/route.ts
  analyze/route.ts
  posts/route.ts

app/api/cron/
  sync-competitors/route.ts

app/(app)/studio/
  competitive/page.tsx

components/clients/
  competitor-card.tsx
  add-competitor-dialog.tsx
  competitors-panel.tsx
```

## Summary: Modified Files

```
components/clients/new-client-wizard.tsx     ← 2 steps, add competitors
app/(app)/clients/page.tsx                   ← Competitors tab + badge
app/(app)/settings/page.tsx                  ← Move metricool_blog_id here
app/(app)/studio/page.tsx                    ← Add Competitive Intel card
app/(app)/pipeline/page.tsx                  ← Grouped/Full toggle
components/pipeline/pipeline-board.tsx       ← Support grouped view
lib/utils.ts                                 ← PIPELINE_GROUPS
lib/client-intelligence.ts                   ← buildCompetitorContextBlock
app/api/studio/hooks/generate/route.ts       ← Inject competitor context
app/api/studio/campaign/generate/route.ts    ← Inject competitor context
app/api/studio/strategy/route.ts             ← Inject competitor context
app/api/studio/content/[id]/script/route.ts  ← Inject competitor context
vercel.json                                  ← Add sync-competitors cron
```

---

## Build Order

1. **Phase 1 first** — wizard simplification is small, standalone, no new dependencies
2. **Phase 2 next** — DB migration + scrape API + client profile UI
3. **Phase 3** — intelligence page (depends on Phase 2 data)
4. **Phase 4** — learning loop (depends on Phase 3 analysis schema)
5. **Phase 5** — pipeline UI (fully independent, do anytime)

---

## Apify Actors to Use

| Platform | Apify Actor | What it returns |
|----------|-------------|-----------------|
| Instagram | `apify/instagram-profile-scraper` | followers, bio, post count, avg ER, top posts |
| TikTok | `clockworks/tiktok-profile-scraper` | followers, ER, video count, top videos |
| LinkedIn | `apify/linkedin-company-scraper` | followers, posts (limited) |
| YouTube | YouTube Data API (already integrated) | subscriber count, video stats |

Rate limit: scrape max 10 competitors per client per day to stay within Apify free tier.

---

## What NOT in This Plan

- Metricool post sync or analytics (excluded per user instruction)
- Scheduling-related competitor features
- Respond.io changes
- Any billing or SaaS transformation items
