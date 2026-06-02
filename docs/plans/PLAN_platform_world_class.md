# NOVAX Platform — World-Class Upgrade Plan

> Elevating every feature to the intelligence standard set by Studio.
> The Studio is not a design reference — it's a proof of what this platform is capable of.
> This plan applies those same principles, rigorously, to every other surface.

---

## 0. The Standard We're Matching

The Studio is world-class because of **six things**. Every other page in this platform
must be rebuilt around the same six:

| Principle | What it means |
|---|---|
| **Invisible pipeline** | The user states intent. The system does the work. No steps, no phases. |
| **Real data or it doesn't count** | Every output is grounded in Metricool history + Signal Network. No generic assumptions. |
| **Structured intelligence, not free text** | AI generates options. User picks one. The pick becomes a hard constraint. |
| **Two-output rule** | Every AI generation produces: (1) a premium formatted document + (2) a Boss Brief (5-block simplified card). |
| **Nothing is lost. Everything compounds.** | Every session, analysis, and decision is saved. The system gets smarter with use. |
| **Evidence-based everything** | No recommendation without a cited source. "Reels ER 6.8% · 30 days · Instagram." |

These are not aesthetic choices. They are the product decisions that separate
"another dashboard" from a production intelligence system.

---

## 1. Cross-Cutting Infrastructure (applies to all pages)

These are the shared systems every upgraded feature will call into.
Build these once. All feature upgrades depend on them.

### 1A. Intelligence Layer (`lib/intelligence/`)

```typescript
// lib/intelligence/daily-brief.ts
// Generated once per day per user at first login.
// Cached in ai_responses with key: `daily_brief_{user_id}_{YYYY-MM-DD}`
interface DailyBrief {
  generated_at: string
  priority_actions: {
    id: string
    urgency: 'critical' | 'high' | 'medium'
    surface: 'pipeline' | 'publishing' | 'moderation' | 'approval' | 'client'
    title: string
    evidence: string          // "3 posts scheduled for today have no media attached"
    action_label: string
    action_href: string
  }[]
  clients_needing_attention: {
    client_id: string
    reason: string
    signal: 'overdue_tasks' | 'low_engagement' | 'crisis_mode' | 'approval_stalled'
  }[]
  performance_pulse: {
    total_reach_mtd: number
    avg_er_mtd: number
    delta_vs_prev: string     // "+18.4% vs last month"
    top_performing_platform: string
    anomalies: string[]       // "Luxe Cosmetics ER dropped 2.1% this week"
  }
  boss_brief: BossBrief       // 5-block summary for the day
}
```

```typescript
// lib/intelligence/anomaly-detector.ts
// Runs on every Metricool sync. Flags outliers.
interface Anomaly {
  client_id: string
  client_name: string
  type: 'er_drop' | 'er_spike' | 'post_failed' | 'reach_collapse' | 'engagement_surge'
  severity: 'critical' | 'warning' | 'info'
  evidence: string
  detected_at: string
  resolved: boolean
}
```

### 1B. Evidence Chip Component (`components/ui/evidence-chip.tsx`)

Every AI recommendation anywhere in the platform must display its evidence.
Standardise the display component once:

```
┌─────────────────────────────────────────────────┐
│  [BarChart2] Reels ER 6.8% · 30 days · Instagram │
└─────────────────────────────────────────────────┘
bg-novax-light border border-novax-border rounded-lg
px-2.5 py-1 text-xs font-medium text-novax-muted
```

### 1C. Boss Brief Component (`components/ui/boss-brief.tsx`)

Reusable across Dashboard, Clients, Reports, Moderation.
Identical structure everywhere — 5 blocks, same formatting:

```
┌──────────────────────────────────────────────────────────────┐
│  BOSS BRIEF                                                   │
├──────────────────────────────────────────────────────────────┤
│  WHAT'S HAPPENING    [one-line momentum statement]            │
│  WHY IT MATTERS      [one-line impact statement]              │
│  THE ONE THING       [the single most important decision]     │
│  DO THIS NOW         [one specific, immediate action]         │
│  WATCH FOR           [one risk or signal to monitor]          │
└──────────────────────────────────────────────────────────────┘
```

Styling matches Studio: `bg-novax text-white rounded-2xl p-6`
Labels: `text-[10px] tracking-widest text-novax-accent`
Content: `text-sm text-white font-medium`

### 1D. Intelligence Loading Pattern (`components/ui/intelligence-loading.tsx`)

Any page that does AI work uses this pattern. Not spinners — the same 3-phase
Studio loading screen, parameterised with the steps relevant to each feature.

```typescript
interface IntelligenceLoadingProps {
  steps: LoadingStep[]
  insights: string[]  // revealed as each step completes
  title: string
}
```

### 1E. Action Surface Routing

Every anomaly, every priority action, every "do this now" item links to the exact
page and context where that action is taken. Not a notification with a homepage link —
a direct deep-link to the specific task / post / client / moderation item.

---

## 2. Dashboard — Intelligence Command Center

### Current State
Standard stats grid. Area charts. Pie chart. Activity feed. Client health cards.
It is a metrics viewer. It does not tell you what to do.

### What It Becomes
The operational brain of the platform. The first thing seen every morning.
It answers: **"What is happening, what is failing, and what do I do first?"**

### Upgrade Spec

#### Morning Intelligence Card (top of page, always)
Replaces the generic stat header.

```
┌──────────────────────────────────────────────────────────────┐
│  TUESDAY · 3 JUNE 2026                                        │
│  Morning Brief · Refreshed 6:04 AM                           │
│                                                               │
│  4 things need your attention today.                          │
│  2 clients trending up. 1 client needs a check.              │
│                                                               │
│  [Open Priority Actions]                                      │
└──────────────────────────────────────────────────────────────┘
```

`bg-novax text-white rounded-2xl p-6`
Brief generated by Claude at first page load if none exists for today.
AI model: `claude-haiku-4-5` (fast, <2s, low cost)
Cached in `ai_responses` for the day.

#### Priority Action Feed (replaces generic activity feed)

Not "what happened" — "what needs to happen."

```
┌──────────────────────────────────────────────────────────────┐
│  PRIORITY ACTIONS                          [3 critical · 2 high]│
├──────────────────────────────────────────────────────────────┤
│  [Red] CRITICAL                                               │
│  TechNova has 2 posts scheduled for 2:00 PM with no media    │
│  → Go to Publishing                                          │
│                                                               │
│  [Amber] HIGH                                                 │
│  Luxe Cosmetics approval request overdue by 3 days           │
│  → Review Approval                                           │
│                                                               │
│  [Amber] HIGH                                                 │
│  FitForge: 5 tasks in Copy stage, 0 assigned                 │
│  → Open Pipeline                                             │
└──────────────────────────────────────────────────────────────┘
```

Each action: `flex items-start gap-3 p-4 rounded-xl border` — styled by severity.
Severity colors: critical = red-50/border-red-200, high = amber-50/border-amber-200,
medium = slate-50/border-slate-200.
Direct link to the context (task ID, post ID, client ID).

#### Anomaly Feed (live, right column)

```
┌─────────────────────────────────────────┐
│  ANOMALIES        [Updated 15 min ago]  │
├─────────────────────────────────────────┤
│  Luxe Cosmetics — ER dropped 2.1%       │
│  vs. 7-day avg · Instagram · Today      │
│  [Investigate]                          │
│                                         │
│  FitForge — Post failed on Metricool    │
│  Scheduled 10:00 AM · Retry available   │
│  [Retry]                                │
└─────────────────────────────────────────┘
```

Populated from the anomaly detector on every Metricool sync.

#### Client Health — Explained

Each client health card upgraded:

```
┌──────────────────────────────────────────┐
│  [Color swatch] Luxe Cosmetics    82/100  │
│                                           │
│  ER Trend      +0.8%   ↑                 │
│  Post Cadence  On Track ✓                │
│  Open Tasks    4                         │
│  Approval Lag  1.2 days avg              │
│                                           │
│  "Reels performing 3.1× static this week"│
│  [View Intelligence →]                   │
└──────────────────────────────────────────┘
```

Score is computed, not hardcoded. Formula:
- Post cadence score (25%) — scheduled posts vs. agreed frequency
- Engagement trend (30%) — current ER vs. 30-day avg
- Pipeline health (20%) — tasks overdue / total
- Approval cycle (15%) — avg days from sent to approved
- Crisis events (10%) — -10 per active crisis event

Score explained on hover: a tooltip with the breakdown.

#### Boss Brief (bottom of dashboard)
Auto-generated daily. Same 5-block structure.
"What happened today. Why it matters. The one thing. Do this now. Watch for."

### New API Routes
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `GET /api/intelligence/daily-brief` | Generate or return cached daily brief | haiku-4-5 | 1.5h |
| `GET /api/intelligence/anomalies` | Return unresolved anomalies across all clients | — | 1h |
| `PATCH /api/intelligence/anomalies/[id]/resolve` | Mark anomaly resolved | — | 30m |
| `GET /api/intelligence/client-health/[id]` | Computed health score breakdown | — | 1h |

**Estimated implementation: 6h**

---

## 3. Pipeline — Intelligent Work Surface

### Current State
Kanban drag-drop with 10 stages. Task cards with priority/client/due date.
Tasks sit in the board. The board does not think.

### What It Becomes
A work surface that understands where work is stuck, what is at risk,
and what a task needs to move forward.

### Upgrade Spec

#### Pipeline Health Banner (top of board)

```
┌──────────────────────────────────────────────────────────────┐
│  PIPELINE HEALTH   74/100                                     │
│                                                               │
│  Bottleneck: Copy stage (7 tasks waiting)                    │
│  At risk: 3 tasks due this week have no assignee             │
│  Overdue: 2 tasks in Review past deadline                    │
│                                                               │
│  [Resolve Bottleneck]                                        │
└──────────────────────────────────────────────────────────────┘
```

Computed server-side on page load. Not AI — pure logic:
- Bottleneck = stage with task count > 2× avg
- At risk = tasks due within 7 days with no assignee
- Overdue = due date passed, still in active stage

`bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4` when health < 80.
`bg-novax-light border border-novax-border rounded-2xl px-6 py-4` when health ≥ 80.

#### Stage Column Upgrade

Stage column headers styled to match Studio phase card pattern:

```
┌──────────────────────────────────────────────────────────────┐
│  03              ← decorative number: text-5xl font-black     │
│                    text-slate-100 (large, behind header)      │
│  COPY            ← stage name: text-xs font-bold text-slate-700│
│  7 tasks  · 2 overdue                                         │
└──────────────────────────────────────────────────────────────┘
```

Overdue count in red badge. Overdue threshold: due date passed by > 0 days.

#### Task Card — Intelligence Summary

When a task enters a stage and has an AI analysis (from `task_analyzer` agent),
the card shows a 2-line AI summary below the title:

```
┌──────────────────────────────────────────────────────────────┐
│  Luxe — Ramadan Campaign Copy                                 │
│  Missing: brand voice reference. Recommend pulling last       │
│  Ramadan post as tone anchor before writing.                  │
│                                                               │
│  [Copywriter] [Copy] [Due: Tue]        [Avatar]              │
└──────────────────────────────────────────────────────────────┘
```

AI summary shown only if `ai_responses` has a `task_analyzer` record for this task.
Otherwise card looks the same as today.

#### Smart Stage Gate (on drag to advance)

When dragging a task to the next stage, a modal fires if conditions are unmet:

```
┌──────────────────────────────────────────────────────────────┐
│  Before moving to APPROVAL                                    │
│                                                               │
│  [Warning] No media file attached                            │
│  [Warning] Caption not finalized (still a draft)             │
│  [OK] Brand voice check passed                               │
│                                                               │
│  [Move Anyway]    [Fix First]                                │
└──────────────────────────────────────────────────────────────┘
```

Gate rules per stage transition (configurable, hardcoded first iteration):
- → approval: requires media + finalised caption + at least one AI agent run
- → scheduled: requires approval_status = 'approved'
- → published: auto-only (set by Metricool webhook)

#### Pipeline Intelligence Side Panel

A collapsible right panel (desktop only):

```
┌─────────────────────────────────┐
│  PIPELINE INTEL                 │
│                                 │
│  Velocity (7d avg)              │
│  Strategy → Ideas    1.2 days   │
│  Ideas → Calendar    2.8 days   │  ← highlight slowest
│  Copy → Design       4.1 days   │  ← slowest: amber
│                                 │
│  Team Load                      │
│  Sara H.     87% capacity       │
│  Adam K.     43% capacity       │
│  Layla M.    92% ← overloaded   │
└─────────────────────────────────┘
```

Stage velocity = avg days between stage entry timestamps (from `tasks` created_at history).
Team load pulled from workload logic.

**Estimated implementation: 5h**

---

## 4. Publishing — Intelligence-Driven Content Queue

### Current State
Grid/Calendar view of posts. Compose dialog. Generate Calendar dialog.
The compose flow is a blank form.

### What It Becomes
A publishing surface where every scheduling decision is informed by what
actually worked for this client — and every compose action starts with a brief,
not a cursor.

### Upgrade Spec

#### Post Compose — Studio-Style Mini Flow

The current compose dialog is replaced with a 3-step mini flow:

**Step 1 — Brief (same as today)**
Platform, client, date/time, media upload, caption draft.

**Step 2 — AI Brief Confirmation (new)**
After filling the brief, before generating:

```
┌──────────────────────────────────────────────────────────────┐
│  UNDERSTOOD                                                   │
│                                                               │
│  Client:       Luxe Cosmetics                                 │
│  Platform:     Instagram                                      │
│  Goal:         Ramadan campaign — drive saves                 │
│  Timing:       Tuesday 7PM (best window for this client)      │
│                                                               │
│  Performance context: Reels ER 6.8% vs static 2.1%           │
│  Recommendation: Use Reel format if media is video            │
│                                                               │
│  [Looks right → Generate]    [Adjust]                        │
└──────────────────────────────────────────────────────────────┘
```

Haiku call pulls Metricool context for this client. Cached 4h.

**Step 3 — Generated Output**
Three caption variants in the Studio style (Aspirational / Benefit-led / Direct).
Each variant shows:
- Caption text
- Hook strength indicator (3C score bars: Clarity / Context / Curiosity)
- CTA type badge
- Evidence chip: "Based on top 5 Luxe Cosmetics posts · Last 30 days"

Below variants: Boss Brief card.
```
│  WHAT THIS POST DOES      Drive saves via emotional hook      │
│  WHY THIS HOOK            Highest 3C score for this audience  │
│  THE ONE THING            The first line is the only line that│
│                           matters — do not cut it             │
│  DO THIS NOW              Add text overlay: "Save this"       │
│  WATCH FOR                Instagram will cap reach on posts   │
│                           with external links in caption      │
```

#### Calendar View — Performance Overlay

When in Calendar view, published posts show performance badges:

```
┌──────────────────────────────────┐
│  Luxe — Ramadan Story            │
│  [ER: 7.2%] [+1.4% vs avg]     │
│  Published · Tue 7PM            │
└──────────────────────────────────┘
```

ER badge color-coded:
- green: > client's 30-day avg ER
- amber: within 10% below avg
- red: > 20% below avg

"Best Window" chips on empty time slots:

```
┌──────────────────────────────────┐
│  Tuesday 7PM                     │
│  [Best window · Luxe · Instagram]│
│  + Schedule here                 │
└──────────────────────────────────┘
```

Best window computed from Metricool historical performance.

#### Generate Calendar Dialog — Upgraded Output

The output of "Generate Calendar" is reformatted as a Studio document:

```
CONTENT CALENDAR — LUXE COSMETICS — JUNE 2026
────────────────────────────────────────────────

SIGNAL INTELLIGENCE
  bg-novax-light border-l-4 border-novax rounded-r-xl p-4
  "Top format this month: Reels. ER 3.1× static. Use for all anchor posts."

WEEK 1 (2–8 June)
  Day/Platform/Format/Hook preview/Goal badge
  Each post as a card: bg-white border border-slate-200 rounded-xl p-4
  Ordered by publish datetime

WEEK 2 (9–15 June)
  ...

STRATEGIC NOTES
  bg-slate-50 border border-slate-200 rounded-xl p-4
  AI-generated rationale: why this calendar structure, what it's optimised for
```

Export to PDF: print CSS, NOVAX-branded header/footer.

#### Post-Mortem Bridge

On published posts that performed below avg ER threshold (-20%):
A badge on the post card: `[Investigate →]`
Clicking opens Studio → Post-Mortem with this post pre-loaded.

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `GET /api/publishing/best-windows/[clientId]` | Compute best times per platform from Metricool | — | 1.5h |
| `POST /api/publishing/compose-confirm` | Brief confirmation + context pull (Haiku) | haiku-4-5 | 1h |
| `POST /api/ai/caption` | Enhanced: return 3 variants with 3C scores | sonnet-4-6 | upgrade 1h |

**Estimated implementation: 7h**

---

## 5. Clients — Client Intelligence Center

### Current State
Client cards + detail modal (Overview / Intelligence / Tasks tabs).
Intelligence tab shows hardcoded mock SWOT data.
Client cards show no performance direction.

### What It Becomes
Every client has a living intelligence document — updated on demand,
grounded in real Metricool data, formatted as a premium artifact.

### Upgrade Spec

#### Client Card — Momentum Indicator

Add a momentum direction chip to each card:

```
┌──────────────────────────────────────────┐
│  [LC] Luxe Cosmetics                     │
│       [Trending Up ↑]                    │  ← new chip
│                                           │
│  ER Avg: 6.2%    Posts: 18    Tasks: 4   │
│  Health: 82/100  · [View Intelligence →] │
└──────────────────────────────────────────┘
```

Momentum = 7-day ER delta vs. 30-day avg:
- ↑ Trending Up: +5% or more
- → Stable: within ±5%
- ↓ Slowing: -5% to -15%
- ↓↓ Declining: -15% or worse

Chip colors match direction severity.

#### Intelligence Tab — Real AI Document

Replaces the mock SWOT. Triggered by "Generate Intelligence" button.
Full Studio loading screen. Generates a structured document:

```
CLIENT INTELLIGENCE — LUXE COSMETICS — 3 JUNE 2026
(Generated from 30 days Metricool data + industry signals)
────────────────────────────────────────────────────────

MOMENTUM SNAPSHOT
  bg-novax rounded-2xl p-6
  What is working right now: [evidence-cited, 3-4 lines]
  "Reels: ER 6.8% vs industry 3.2% · Instagram · May 2026"

RISK RADAR
  bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4
  Top 3 risks with evidence
  "Posting frequency dropped to 4/week (was 6/week) — reach typically drops 3 weeks after"

COMPETITIVE POSITION
  bg-white border border-slate-200 rounded-2xl p-5
  3 competitors · what they're doing this month · gap analysis

GROWTH OPPORTUNITIES
  3-column grid
  Each: opportunity title + evidence + specific action
  bg-slate-50 rounded-xl p-4

BOSS BRIEF
  5-block card in standard format
```

Intelligence document saved to `ai_responses` with key `client_intel_{client_id}_{YYYY-MM-DD}`.
"Refresh" button forces regeneration.
Previous versions accessible — "View history" link.

#### New Client Wizard — Backend Completion

When the wizard completes (step 9 of 9):
1. Claude analyzes submitted data (social links, brand, competitors)
2. Generates initial Intelligence document
3. Auto-fills `brand_identity_json` fields
4. Triggers a cold-start SWOT using industry benchmarks
5. Shows completion state: "Intelligence document ready."

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `POST /api/clients/[id]/generate-intelligence` | Full intelligence doc generation | sonnet-4-6 | 2h |
| `GET /api/clients/[id]/intelligence-history` | List past intelligence docs | — | 30m |
| `GET /api/clients/[id]/momentum` | Compute momentum direction from Metricool | — | 1h |

**Estimated implementation: 6h**

---

## 6. Moderation — Smart Comment Intelligence

### Current State
Comment queue with AI reply generation. Send / Ignore / Escalate.
Each comment treated equally. No priority sorting. One reply variant.

### What It Becomes
A triage system. Priority queue. Evidence-backed sentiment tracking.
Three reply tones. Reply quality check before sending.

### Upgrade Spec

#### Priority Queue (replaces flat list)

Comments sorted by AI-computed urgency score:

```
CRITICAL (respond within 1h)
  ┌──────────────────────────────────────────────────────────────┐
  │  [Red pill] CRISIS LANGUAGE DETECTED                         │
  │  "This product burned my skin, I'm going to report this"    │
  │  Luxe Cosmetics · Instagram · 3 min ago                     │
  │                                                              │
  │  [Generate Reply]   [Escalate]   [Mark Monitored]           │
  └──────────────────────────────────────────────────────────────┘

HIGH (respond within 4h)
  ...complaint / question

MEDIUM (respond within 24h)
  ...general comment

LOW (respond when convenient)
  ...positive / filler
```

Priority computed by Haiku on new moderation items received via webhook.
Urgency signals: crisis keywords, question marks, complaint language, repeat commenter.

#### Three Reply Variants

Replace single AI reply with three tone options:

```
┌──────────────────────────────────────────────────────────────┐
│  GENERATED REPLIES                                            │
│                                                               │
│  [EMPATHETIC]  Selected variant shown first                  │
│  "We hear you and we're so sorry to hear this happened..."   │
│                                                               │
│  [PROFESSIONAL]                                              │
│  "Thank you for bringing this to our attention. We take..."  │
│                                                               │
│  [DIRECT]                                                    │
│  "Please DM us your order number so we can resolve this."   │
└──────────────────────────────────────────────────────────────┘
```

Selected variant shown in the edit box. User can freely edit.
Three variants = one Sonnet call that returns structured JSON with all three.

#### Reply Quality Check

Before sending, a fast Haiku check:

```
┌──────────────────────────────────────────────────────────────┐
│  REPLY CHECK                                                  │
│                                                               │
│  Brand voice match    ████████░░  82%                        │
│  De-escalation        ██████████  96%                        │
│  Clarity              ████████░░  78%                        │
│                                                               │
│  Note: Consider adding the client's name to personalise.     │
│                                                               │
│  [Send Anyway]    [Edit]                                     │
└──────────────────────────────────────────────────────────────┘
```

Shown as a slide-up panel above the Send button.
Check runs in <1s on button press. Cached for the reply text until edited.

#### Sentiment Dashboard (top of page)

```
┌──────────────────────────────────────────────────────────────┐
│  SENTIMENT · ALL CLIENTS · LAST 7 DAYS                        │
│                                                               │
│  Positive  68%   ████████████████████░░░░░░░                │
│  Neutral   22%   ██████░░░░░░░░░░░░░░░░░░░░░                │
│  Negative  10%   ███░░░░░░░░░░░░░░░░░░░░░░░                 │
│                                                               │
│  Top issue this week: Delivery complaints (Coastal Eats)     │
└──────────────────────────────────────────────────────────────┘
```

Client filter pill switches the sentiment view per-client.

#### Weekly Digest

Auto-generated every Monday 9AM (cron):
Boss Brief format — 5 blocks for the moderation week.
Stored and accessible from the moderation page header.

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `POST /api/moderation/prioritise` | Score incoming items by urgency | haiku-4-5 | 1h |
| `POST /api/moderation/reply-variants` | Generate 3 tone variants | sonnet-4-6 | 1.5h |
| `POST /api/moderation/reply-check` | Quality check before send | haiku-4-5 | 1h |
| `GET /api/moderation/sentiment` | Aggregate sentiment per client/period | — | 1h |
| `POST /api/moderation/weekly-digest` | Generate weekly Boss Brief | sonnet-4-6 | 1h |

**Estimated implementation: 6h**

---

## 7. Reports — Intelligence Reports

### Current State
7 tab types with chart templates. AI Report Builder for raw text → formatted report.
Charts use demo data. Narratives are absent.

### What It Becomes
A report is not a chart collection. It is a document with a point of view —
every chart has a narrative, every metric has a "why", every section ends
with a specific recommendation backed by cited evidence.

### Upgrade Spec

#### Report Generation — Studio-Style Flow

Replace the "pick a tab, see a template" model with a flow:

**Step 1 — What do you need?**
```
┌──────────────────────────────────────────────────────────────┐
│  BUILD A REPORT                                               │
│                                                               │
│  Client:      [Dropdown]                                     │
│  Period:      [May 2026]                                     │
│  Report for:  [Dropdown — Team / Client / CEO / Investor]    │
│  Focus areas: [Multi-select chips]                           │
│               Organic  Paid  Platforms  Audience  Quarterly  │
│                                                               │
│  [Generate Report →]                                         │
└──────────────────────────────────────────────────────────────┘
```

**Step 2 — Brief Confirmation (Haiku, <1s)**
```
┌──────────────────────────────────────────────────────────────┐
│  UNDERSTOOD                                                   │
│                                                               │
│  Audience: CEO — expects business outcomes, not platform jargon│
│  Period: May 2026 vs April 2026                               │
│  Key angle: Organic performance + platform breakdown          │
│  Data available: 30 days Metricool · 4 platforms             │
│                                                               │
│  [Looks right → Continue]   [Adjust]                        │
└──────────────────────────────────────────────────────────────┘
```

**Step 3 — Generation (Studio loading screen)**
Phase-by-phase with step insights:
- "Pulling Metricool data" → "34 posts analysed"
- "Computing ER benchmarks" → "Industry avg: 3.2% · Client avg: 5.8%"
- "Drafting narrative sections" → "4 sections ready"
- "Building Boss Brief" → "Done"

**Step 4 — Document Output**

Every section: narrative text + chart + insight callout + recommendation.
No standalone charts. Every chart has a paragraph that explains it.

```
REACH & IMPRESSIONS
  Chart (AreaChart, branded colors)

  INSIGHT
  bg-novax-light border-l-4 border-novax rounded-r-xl p-4
  "May reach grew 18.4% vs April — primarily driven by Reel format
   adoption (7 new Reels in May vs 2 in April). Pattern is clear:
   Reels account for 68% of total reach despite being 21% of posts."

  RECOMMENDATION
  bg-white border border-slate-200 rounded-xl p-4
  "Increase Reel frequency from 2/week to 4/week for June.
   Evidence: 3.1× reach multiplier · 5 consecutive months of data."
  [Evidence chip: ER 6.8% · May 2026 · Instagram]
```

Boss Brief at the top of every report (auto-generated with same data):
```
WHAT HAPPENED     Reach +18.4% — best month in 5 months
WHY IT MATTERS    Format shift to Reels is compounding
THE ONE THING     Approve Reel frequency increase for June
DO THIS NOW       Brief the content team on the June calendar
WATCH FOR         Audience fatigue at 4 Reels/week — monitor week 3
```

#### Export
- Print PDF (CSS `@media print`, `@page` with NOVAX header/footer)
- Download as `.pptx` (pptxgenjs, one slide per section, chart recreated as image)

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `POST /api/reports/brief-confirm` | Report brief confirmation | haiku-4-5 | 30m |
| `POST /api/reports/generate` | Full report generation with narrative | sonnet-4-6 | 3h |
| `GET /api/reports/[id]` | Fetch saved report | — | 30m |
| `GET /api/reports/[id]/export/pdf` | Print-ready HTML version | — | 1h |
| `POST /api/reports/[id]/export/pptx` | Generate .pptx | — | 1.5h |

**Estimated implementation: 8h**

---

## 8. Approval Portal — Intelligent Approval Packages

### Current State
Internal approval management. Shareable public portal for client review.
Approval packages are lists of posts.

### What It Becomes
A curated, branded package that reads like a document —
not a list of posts to scroll through, but a structured review experience
with context per post, decision clarity, and turnaround tracking.

### Upgrade Spec

#### Internal Approval — Package Builder

When creating an approval request, a brief step:

```
┌──────────────────────────────────────────────────────────────┐
│  CREATE APPROVAL PACKAGE                                      │
│                                                               │
│  Client:      Luxe Cosmetics                                  │
│  Posts:       [Post selector — 5 selected]                   │
│  Context:     [Brief — what is this campaign about?]         │
│  Decision by: [Date picker]                                  │
│                                                               │
│  AI will draft a client-facing summary for the package.      │
│                                                               │
│  [Create Package]                                            │
└──────────────────────────────────────────────────────────────┘
```

AI generates a 3-line intro paragraph for the package (Haiku, <1s):
"This package contains your Ramadan campaign posts — 5 pieces across
Instagram and TikTok. The campaign runs June 10–25. Please review and
mark each post Approved or Request Changes by June 7."

#### Public Approval Portal — Document Style

The current approval portal shows a list of posts.
Upgraded to a document-style layout:

```
APPROVAL PACKAGE
LUXE COSMETICS · RAMADAN 2026
────────────────────────────────────────────

[AI-generated context paragraph]

────────────────────────────────────────────
POST 1 OF 5 — INSTAGRAM REEL
[Large media preview]
[Caption preview]
[Platform badge] [Format badge] [Date badge]

[Approve] [Request Changes — enter notes]

────────────────────────────────────────────
POST 2 OF 5 — TIKTOK VIDEO
...
```

Progress bar at the top: "3 of 5 reviewed."
Sticky submit button: only activates when all 5 are reviewed.

#### Approval Analytics (internal, admin view)

```
┌──────────────────────────────────────────────────────────────┐
│  APPROVAL PERFORMANCE                                         │
│                                                               │
│  Avg turnaround        2.1 days                              │
│  Change request rate   28%                                   │
│  Fastest approver      Luxe Cosmetics (1.2 days avg)         │
│  Slowest approver      TechNova (4.8 days avg)               │
│                                                               │
│  Top change request reason: Caption too long                 │
└──────────────────────────────────────────────────────────────┘
```

Computed from approval request history.

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `POST /api/approval/package-intro` | Generate client context paragraph | haiku-4-5 | 30m |
| `GET /api/approval/analytics` | Approval turnaround + change rate stats | — | 1h |

**Estimated implementation: 4h**

---

## 9. Assets — Performance-Linked Asset Library

### Current State
Asset grid. Upload. Higgsfield mock UI.
Assets are files. They have no context.

### What It Becomes
Assets that are linked to post performance.
A library that tells you which assets performed, which didn't,
and what to create next.

### Upgrade Spec

#### Performance Linking

Assets used in scheduled posts are automatically linked via `scheduled_posts.media_urls`.
When a post publishes and performance data syncs:

Each asset card gains a performance badge:
```
┌────────────────────────────────┐
│  [Asset thumbnail]             │
│                                │
│  ramadan-hero.mp4              │
│  Used in 3 posts               │
│  Avg ER: 7.2%  ↑ +1.4% vs avg│
└────────────────────────────────┘
```

"Top Performing Assets" section at top of library:
The 5 assets with highest avg ER across their associated posts.

#### AI Asset Intelligence

"What to Create Next" panel:

```
┌──────────────────────────────────────────────────────────────┐
│  WHAT TO CREATE NEXT                                          │
│                                                               │
│  Pattern detected: Your top 5 posts all used vertical        │
│  video with a person in frame. You have 3 unused assets in   │
│  this format.                                                 │
│                                                               │
│  Unused high-potential assets: [thumbnail × 3]               │
│                                                               │
│  Gap: No carousel content in last 30 days.                   │
│  Carousels avg 4.1% ER for this industry.                    │
│                                                               │
│  [Create in Studio]                                          │
└──────────────────────────────────────────────────────────────┘
```

Generated on-demand by Sonnet. Cached 24h.

#### Semantic Search

Search bar with AI-powered semantic matching:
Type "luxury skincare with natural lighting" → returns semantically matched assets
via Claude vision description index (computed once per asset on upload).

**New API Routes**
| Route | Purpose | Model | Est. |
|---|---|---|---|
| `POST /api/assets/[id]/describe` | Generate semantic description via vision | haiku-4-5 | 30m per call |
| `GET /api/assets/intelligence` | "What to create next" analysis | sonnet-4-6 | 1.5h |
| `GET /api/assets/search` | Semantic search via pre-computed descriptions | — | 1h |

**Estimated implementation: 5h**

---

## 10. Creative Evaluation — Scoring with Evidence

### Current State
Upload image/video → AI scoring (brand fit, hook, visual quality, CTA).
Scores displayed as numbers. No comparative context.

### What It Becomes
A diagnostic tool that compares against the client's own performance record
and produces a Boss Brief for the creative team.

### Upgrade Spec

#### Scoring — Evidence-Backed

Each score now has a comparative benchmark:

```
┌──────────────────────────────────────────────────────────────┐
│  HOOK STRENGTH      82/100                                    │
│                                                               │
│  ████████████████░░░░  82                                    │
│                                                               │
│  This client's published avg: 64/100                         │
│  Industry top quartile:       85/100                         │
│                                                               │
│  "Strong visual hook. The brand color dominance in the first │
│   frame creates immediate recognition — a pattern seen in    │
│   your 3 highest-performing posts this month."              │
│                                                               │
│  [Evidence: Top 3 Luxe Cosmetics posts · May 2026]          │
└──────────────────────────────────────────────────────────────┘
```

#### Boss Brief Output

After scoring, a Boss Brief card:
```
WHAT THIS CREATIVE DOES   Strong first-frame hook, weak CTA
WHY IT MATTERS            Hook captures 3s attention; CTA loses it
THE ONE THING             Rewrite the CTA — current one is generic
DO THIS NOW               Add "Save this" text overlay to last 2s
WATCH FOR                 If caption is also weak, ER will suffer
```

#### Format Recommendation

Based on the media and the client's performance history:
"This asset performs best as a Reel (vertical). Your Reels avg 3.1× the ER
of static posts. Recommend: cut to 15s for TikTok, 30s for Instagram."

**Estimated implementation: 3h (upgrade to existing routes)**

---

## 11. Workload — Team Intelligence View

### Current State
Per-member load bars, overloaded/at-capacity/healthy badges, task list preview.

### What It Becomes
A capacity planning tool that flags risk, suggests rebalancing, and predicts
next-week load from pipeline task due dates.

### Upgrade Spec

#### Capacity Forecast

```
┌──────────────────────────────────────────────────────────────┐
│  NEXT WEEK FORECAST                                           │
│                                                               │
│  Sara H.     12 tasks due → Projected: Overloaded            │
│  Adam K.     3 tasks due  → Projected: Under capacity        │
│  Layla M.    8 tasks due  → Projected: At capacity           │
│                                                               │
│  Recommendation: Move 4 tasks from Sara to Adam              │
│  [View Tasks to Reassign]                                    │
└──────────────────────────────────────────────────────────────┘
```

Forecast based on tasks with due dates in the next 7 days.
Recommendation computed from current load delta — no AI, pure math.

#### Skill-to-Task Match Warning

If a task of type "Motion Graphics" is assigned to a "Copywriter" role:
A badge on the task in the workload view: `[Skill Mismatch]`

**Estimated implementation: 2h**

---

## 12. Formatting Standard — All Pages

Every page must conform to one visual language. The Studio proved the standard.
Apply it everywhere:

### Card Hierarchy

```
Level 1 — Hero / document header
  bg-novax text-white rounded-2xl p-6
  Used for: morning brief, boss brief, top insight, document headers

Level 2 — Callout / key insight
  bg-novax-light border-l-4 border-novax-border rounded-r-xl p-4
  Used for: key insight callouts, evidence blocks, recommendations

Level 3 — Standard card
  bg-white border border-slate-200 rounded-xl p-5
  Used for: content cards, list items, stat cards

Level 4 — Muted / secondary
  bg-slate-50 border border-slate-100 rounded-xl p-4
  Used for: secondary info, supporting context
```

### Stat Display

```
Large stat:   text-4xl font-black text-slate-900
Label below:  text-xs text-slate-500 uppercase tracking-wide
Delta chip:   text-xs font-semibold (green for positive, red for negative)
Evidence:     text-[10px] text-slate-400 italic below the chip
```

### Action Buttons — Priority Language

```
Primary action:   bg-novax text-white hover:bg-novax-hover
Secondary action: bg-novax-light text-novax hover:bg-novax-light-hover border border-novax-border
Destructive:      bg-red-50 text-red-700 border border-red-200
```

---

## 13. Implementation Order

### Phase 1 — Infrastructure (build once, unlock everything) · 5h
1. `lib/intelligence/daily-brief.ts` + API route — 1.5h
2. `lib/intelligence/anomaly-detector.ts` + API route — 1h
3. `components/ui/evidence-chip.tsx` — 30m
4. `components/ui/boss-brief.tsx` — 1h
5. `components/ui/intelligence-loading.tsx` (extract from Studio) — 30m
6. Formatting standard audit + global CSS card tokens — 30m

### Phase 2 — Dashboard upgrade · 6h
Most visible. Sets the daily tone. Do second.

### Phase 3 — Clients Intelligence upgrade · 6h
Intelligence tab is the most-used feature after pipeline.
Connect to real Claude analysis.

### Phase 4 — Reports upgrade · 8h
Studio-style report generation flow.
Replaces the current template-tab approach.

### Phase 5 — Publishing upgrade · 7h
Compose mini-flow + calendar performance overlay + best windows.

### Phase 6 — Moderation upgrade · 6h
Priority queue + 3 reply variants + reply quality check.

### Phase 7 — Pipeline upgrade · 5h
Health banner + smart stage gates + bottleneck detection.

### Phase 8 — Approval, Assets, Creative Eval, Workload · 14h total
Smaller surfaces. High-impact per hour.

**Total estimated: ~57h · ~8 focused sessions**

---

## 14. Priority Table

| Priority | Feature | Est. | Unlock |
|---|---|---|---|
| P0 | Infrastructure layer (evidence chip, boss brief, anomaly, daily brief) | 5h | Everything else |
| P0 | Dashboard Intelligence Command Center | 6h | Daily operational value |
| P1 | Client Intelligence — real AI document | 6h | Core sales/strategy value |
| P1 | Reports — Studio-style flow | 8h | Client deliverable quality |
| P1 | Publishing — mini compose flow + calendar overlay | 7h | Daily publishing intelligence |
| P2 | Moderation — priority queue + 3 variants + quality check | 6h | Reply quality + response time |
| P2 | Pipeline — health banner + stage gates + bottleneck | 5h | Operations clarity |
| P3 | Approval — package builder + analytics | 4h | Client experience polish |
| P3 | Assets — performance linking + intelligence | 5h | Creative direction value |
| P3 | Creative Eval — evidence scoring + boss brief | 3h | Pre-publish QA |
| P3 | Workload — capacity forecast + skill match | 2h | Team planning |

---

## 15. Market Position (after this plan)

| What this platform does | What agency tools do |
|---|---|
| Morning intelligence brief — priority actions ranked by urgency | Notification inbox |
| Every AI recommendation cited with evidence | Generic AI output |
| Boss Brief on every intelligence surface | Raw data only |
| Report generation: brief → confirm → narrative document with charts | Chart templates |
| Compose flow: brief confirmation + 3 variants with 3C scores | Caption text box |
| Client intelligence: real Metricool data + Signal Network + SWOT | Static client profile |
| Comment priority scoring with crisis detection | Flat comment queue |
| Reply quality check before sending | No quality gate |
| Asset performance linking — "which assets worked?" | File storage |
| Pipeline bottleneck detection + smart stage gates | Manual Kanban |
| Approval packages as formatted documents | Link to a list |
| Capacity forecast for next week | Current load bars |

This platform does not sell features. It sells leverage.
Every person using it operates above their individual capability.
The output is better than what the team would produce without it —
not marginally better. Measurably, demonstrably better.

That is what world-class means here.
