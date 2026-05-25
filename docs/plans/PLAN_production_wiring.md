# NOVAX Ops — Production Wiring & Feature Completion Plan

**Created:** 2026-05-24  
**Scope:** Complete all broken wiring, replace mock data with live data, add CEO tooling, role tools, and deploy fixes.  
**Priority order:** P0 = blocking production | P1 = visible gaps | P2 = new capability | P3 = enhancement

---

## EXECUTIVE SUMMARY

The platform is ~75% complete. The shell, AI agents, publishing workflow, and approval portal are solid. The critical gaps are:

1. **Clients AI analysis** — calls the right route but silently falls back to generic mock output because client data is not passed from frontend; save fails without DB wiring per client
2. **Studio tools** — output exists in memory only; no persistence, no export, no session management
3. **Reports** — sophisticated template rendering pure demo data; zero Metricool API connection
4. **Performance page** — still imports `MOCK_CLIENTS` directly; API routes exist but page never calls them
5. **Approval** — changes_requested feedback/notes not surfaced back to internal team
6. **Role-based tools** — not built
7. **CEO intelligence hub** — not built
8. **Domain/email** — production config gaps causing server errors on perfumeexhibition.com client; invite emails not firing

---

## PHASE 1 — P0: Fix Clients AI Analysis & Save (1–2 days)

### Problem
`/api/clients/analyze` returns `MOCK_INTEL` whenever `!HAS_DB || !HAS_CLAUDE`. Even when Claude IS available, the frontend passes only `client_id` — the route then fetches from Supabase which may not have the client yet. The `updateClient.mutate()` call on the frontend is also a no-op until Supabase is connected.

### Fix Plan

**Step 1.1 — Change analyze route to accept inline client data**

Modify `POST /api/clients/analyze` to accept an optional `client_data` body field containing the full `brand_identity` object. If present, skip the DB fetch and use it directly. This makes analysis work immediately even without Supabase.

```
Body: { client_id: string, client_data?: BrandIdentityJson & { name: string } }
```

Route logic:
1. If `client_data` provided → use it directly
2. Else if `HAS_DB` → fetch from Supabase
3. Else → return error (not mock) — user should always pass client_data

**Step 1.2 — Update clients/page.tsx `runAnalysis()`**

Pass full client object in body:
```typescript
body: JSON.stringify({
  client_id: client.id,
  client_data: {
    name: client.name,
    ...client.brand_identity,
    competitor_context: client.competitor_context,
  }
})
```

**Step 1.3 — Fix the save path**

Current: `updateClient.mutate({ id, performance_intel })` silently fails without DB.

Fix: Add optimistic local storage save as fallback. Store intel in `localStorage` keyed by `client_${id}_intel`. On mount, `ClientDetail` checks localStorage before relying on `client.performance_intel`.

```typescript
// After successful AI response:
setLocalIntel(data.intel)
localStorage.setItem(`client_${client.id}_intel`, JSON.stringify(data.intel))
// Also try DB save if available:
updateClient.mutate(...)
```

On `ClientDetail` mount:
```typescript
const [localIntel, setLocalIntel] = useState(() => {
  const cached = localStorage.getItem(`client_${client.id}_intel`)
  return cached ? JSON.parse(cached) : (client.performance_intel ?? null)
})
```

**Step 1.4 — Show last-analyzed timestamp**

Add `analyzed_at` to the response. Display "Last analyzed: 3 days ago" below the Analyze button so the user knows if intel is fresh or stale.

**Step 1.5 — Remove MOCK_INTEL fallback entirely**

Replace the early mock return with a proper error: if neither Claude nor client_data is available, return `{ error: 'Claude API key not configured' }` so the UI can show an actionable message rather than silently showing fake data.

---

## PHASE 2 — P0: Studio Tools — Persistence, Sessions, Export (2–3 days)

### Current State
- `/studio/content/page.tsx` — 4-phase workflow (Define → Research → Hooks → Script). All state is local React state. Navigating away loses everything.
- `/studio/hooks/page.tsx` — Hook generator. Same problem.
- `/studio/strategy/page.tsx` — Strategy generator. Same problem.
- API routes exist: `/api/studio/content/`, `/api/studio/content/[id]/`, `/api/studio/hooks/library/`

### Fix Plan

**Step 2.1 — Session persistence via localStorage + DB**

Each studio tool maintains a "session" object. On every significant step completion, auto-save to:
1. `localStorage` (immediate, offline-safe)
2. `/api/studio/content/` via POST (persists to DB when available)

Session schema per tool:
```typescript
interface StudioSession {
  id: string           // uuid, generated client-side if no DB
  tool: 'content' | 'hooks' | 'strategy'
  client_id: string
  created_at: string
  updated_at: string
  title: string        // auto-generated from brief
  phase_data: {
    define?: Phase1Data
    research?: ResearchData
    hooks?: GeneratedHook[]
    script?: ScriptData
  }
  current_phase: Phase
  exported: boolean
}
```

**Step 2.2 — "Start New Session" button**

Add to the header of each studio tool:
- "New Session" button — clears current state, saves current as archived, starts fresh
- "Load Previous" dropdown — shows last 5 sessions for this client from localStorage/DB
- Each session shows: date, client name, brief summary (first 60 chars of brief)

UI placement: top-right of the studio page header, next to client selector.

**Step 2.3 — Auto-save indicator**

Small status indicator in the header: "Saved · 2 min ago" | "Saving..." | "Unsaved changes"  
Uses a debounced save on every state change (500ms delay).

**Step 2.4 — Export**

Add export button that appears after any phase produces output:

| Export type | Format | Tool |
|-------------|--------|------|
| Script → Text | `.txt` | `Blob` download |
| Script → Document | `.docx` | `docx` library (already planned in stack) |
| Hook list → Text | `.txt` | `Blob` download |
| Full session → PDF | `.pdf` | `window.print()` styled CSS or `jsPDF` |
| Strategy → PPT | `.pptx` | `pptxgenjs` (already installed) |

Export button is a split button: primary action is the most useful format (txt for hooks, pptx for strategy), dropdown for other formats.

**Step 2.5 — Session list page `/studio` hub**

The studio hub page (`/studio/page.tsx`) currently just has navigation cards. Add below the tool cards:

**Recent Sessions** section — table showing last 10 sessions across all tools:
| Date | Tool | Client | Brief preview | Status | Actions |
|------|------|--------|---------------|--------|---------|
| Resume | Export | Delete |

**Step 2.6 — Output feels "real"**

The core issue the user identified: outputs feel weak/ephemeral. Solutions:
1. Persist as above (sessions feel durable)
2. Show character/word count on all text outputs
3. Add "Copy to clipboard" with visual confirmation on every output block
4. Add "Send to Task" button — creates a new task in the pipeline pre-filled with the studio output as the task description
5. Add "Publish directly" shortcut from script → compose dialog in publishing page

---

## PHASE 3 — P0: Reports — Connect to Metricool (2–3 days)

### Current State
`/app/(app)/reports/page.tsx` renders `MONTHLY_DEMO`, `PAID_DEMO`, etc. hardcoded. It never calls any API. The route `/api/metricool/analytics/route.ts` exists but is never invoked from the reports page.

### Fix Plan

**Step 3.1 — Wire client + period selector to fetch real data**

The reports page has a client selector and tab system. Add a data-fetch layer:

```typescript
// In reports page
const [selectedClientId, setSelectedClientId] = useState<string>('')
const [period, setPeriod] = useState('last_30_days')

const { data: analyticsData, isLoading, refetch } = useQuery({
  queryKey: ['metricool-analytics', selectedClientId, period],
  queryFn: async () => {
    if (!selectedClientId) return null
    const r = await fetch(`/api/metricool/analytics?client_id=${selectedClientId}&period=${period}`)
    return r.json()
  },
  enabled: !!selectedClientId,
  staleTime: 5 * 60 * 1000, // 5 min cache
})
```

**Step 3.2 — Map Metricool API response to report template schema**

The Metricool API returns its own shape. Create a mapper `lib/metricool-mapper.ts`:
```typescript
export function mapMetricoolToMonthly(raw: MetricoolAnalytics): MonthlyReportData
export function mapMetricoolToPlatform(raw: MetricoolAnalytics, platform: string): PlatformReportData
```

The mapper populates the same shape as `MONTHLY_DEMO` so the existing chart components don't need to change — just the data source changes.

**Step 3.3 — Graceful loading and empty states**

- Loading: skeleton cards replacing chart areas
- No Metricool connected: show "Connect Metricool in Settings" CTA
- No posts in period: "No data for this period" with a "Change period" button
- API error: toast + "Retry" button

**Step 3.4 — Keep demo data as preview/onboarding only**

Move `MONTHLY_DEMO` etc. to a separate file `lib/report-demo-data.ts`. Show demo data only when:
- No client selected, OR
- Client has no Metricool `blog_id` configured

Add a banner: "Showing sample data — connect Metricool in Settings to see real analytics"

**Step 3.5 — AI Report Builder tab — make it functional**

The "AI Report Builder" tab currently has a UI but the AI call isn't wired. Wire it to `/api/reports/analyze`:
- User uploads screenshot or pastes raw metric data
- API extracts metrics using Claude vision/text
- Returns structured data that populates the monthly template
- User can then export as PDF or PPT

**Step 3.6 — Report export**

Wire the existing "Export PDF" and "Export PPT" buttons to:
- `/api/reports/export-pdf` — generates PDF via puppeteer or `jsPDF`
- `/api/reports/export-pptx` — generates PPTX via `pptxgenjs`

Both routes already exist. Ensure they receive the current report data as body and return a downloadable file.

---

## PHASE 4 — P0: Performance Page — Remove Mock Data, Connect APIs (1–2 days)

### Current State
`/app/(app)/performance/page.tsx` line 10: `import { CLIENTS as MOCK_CLIENTS } from '@/lib/mock-data'`  
This file uses `MOCK_CLIENTS` to seed the competitor list and performance data fallback.

### Fix Plan

**Step 4.1 — Remove mock import**

Delete line 10. Replace all `MOCK_CLIENTS` references with `useClients()` hook data.

**Step 4.2 — Wire post performance to Metricool**

The page has a "posts" section showing performance per post. Wire it to `/api/performance/posts`:
```typescript
const { data: posts } = useQuery({
  queryKey: ['performance-posts', clientId, platform, dateRange],
  queryFn: () => fetch(`/api/performance/posts?client_id=${clientId}&platform=${platform}&from=${from}&to=${to}`).then(r => r.json()),
  enabled: !!clientId,
})
```

**Step 4.3 — Wire competitor snapshots**

The page has a competitor section. Wire to `/api/performance/competitors`:
- On load: fetch stored competitor snapshots from DB
- "Refresh" button: calls Metricool for fresh data
- "Add competitor" form: save to DB via PATCH

**Step 4.4 — Wire performance intelligence**

Wire the "Intelligence" panel to `/api/performance/intelligence`:
- Triggered by "Analyze" button or auto on first load
- Shows viral patterns, failure patterns, optimal posting times
- Results saved to DB under client record

**Step 4.5 — Best times panel**

Wire "Best Times to Post" to `/api/performance/best-times`:
- Shows heat map or list by day/hour
- Data sourced from historical post performance in Metricool

---

## PHASE 5 — P0: Approval — Surface Client Feedback (1 day)

### Current State
When a client uses the public approval portal (`/approval/[token]`) and marks a post as "changes_requested" with a note, this is saved to Supabase. However, the internal approval page (`/approval/page.tsx`) shows only the overall status — it does NOT show:
- Which specific posts the client flagged
- What notes/feedback the client wrote

### Fix Plan

**Step 5.1 — Approval request detail panel**

In the internal `/approval` page, clicking an approval request should open a detail panel showing:
- Per-post status (approved / changes_requested / pending)
- Client's note for each flagged post (shown in a comment bubble)
- Timestamp of when client submitted feedback
- Direct link to compose a revised version of each flagged post

**Step 5.2 — Fetch per-post approval statuses**

The `approval_requests` table has a `approval_post_statuses` JSONB column: `[{ post_id, status, note, updated_at }]`. Fetch and display this in the detail panel.

**Step 5.3 — Notification on client submission**

When client submits the approval portal:
1. Trigger `/api/tasks/notify` to create an in-app notification for the account manager
2. If email is configured (Resend): fire email "Client has reviewed [batch name] — 2 posts approved, 1 needs changes"
3. Show unread badge on the approval nav item in the sidebar

**Step 5.4 — Internal comments thread**

Below the client feedback for each flagged post, add an internal comment thread for team discussion (stored in `audit_log` or a new `approval_comments` table). This is where the copywriter and account manager can coordinate on revisions.

---

## PHASE 6 — P1: Role-Based Specialized Tools (3–4 days)

### Philosophy
Studio tools are power tools (multi-step, deep AI, export). Role tools are **quick-assist panels** — one-click helpers that surface the most useful AI action for that role, inline with their workflow. They are NOT as powerful as studio but feel precise and native to the user's job.

### Implementation: Floating "My Tools" Panel

A role-aware panel accessible from any page via a keyboard shortcut (`Cmd+K` or a floating button). It shows 3–5 tools relevant to the current user's role.

**Copywriter Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Caption Rewriter | Select a post caption → rewrite | 3 variants: punchy / informative / story |
| Tone Checker | Paste copy → check against client brand voice | Score + specific corrections |
| Hook Generator (Quick) | Describe topic in 1 line → 5 hooks | Ranked by engagement tier |
| Length Optimizer | Paste copy → suggest platform-optimal cuts | Platform-by-platform character counts |
| Arabic Translator | Paste English copy → Arabic with dialect selector | Saudi Gulf / Egyptian |

**Designer Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Design Brief Summarizer | Client ID → brief in 5 bullet points | Key visual direction + don'ts |
| Color Palette Check | Describe design → check vs brand guidelines | Pass/fail with corrections |
| Asset Keyword Extractor | Post caption → image search keywords | Ranked keyword list for stock/Drive search |
| Format Recommender | Describe content type → recommended canvas | Dimensions, format, platform spec |
| Visual Hook Analyzer | Upload image → score as hook | Score + why it works or doesn't |

**Social Manager Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Posting Time Optimizer | Client + platform → best time | Specific day/hour with reasoning |
| Caption Hashtag Audit | Paste caption + hashtags → audit | Remove/keep/add suggestions |
| Moderation Reply Generator | Paste comment → generate reply | 2 tones: professional / friendly |
| Crisis Checklist | Activate when client in crisis | Step-by-step protocol checklist |
| Content Gap Identifier | Client ID → missing content types | Top 3 gaps with example briefs |

**Account Manager Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Client Health Summary | Client ID → status snapshot | Risks, wins, next 7-day priorities |
| Approval Email Drafter | Paste approval link → email body | Professional client email template |
| Report Narrative Generator | Paste KPIs → narrative text | Executive-ready paragraph summary |
| Meeting Prep Brief | Client ID + date → prep brief | Goals, talking points, risks |
| Escalation Drafter | Describe issue → email draft | Stakeholder escalation email |

**Strategist Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Content Calendar Generator (Quick) | Client + month + platform → calendar | 4-week posting plan |
| Campaign Brief Drafter | Objective + client → brief | Full campaign brief template |
| Competitor Content Analyzer | Competitor handle + platform → analysis | Posting patterns + content gaps |
| Trend Relevance Checker | Trending topic + client → relevance score | Use / avoid / adapt recommendation |
| Quarter OKR Drafter | Client goals → Q OKRs | 3 objectives × 3 KRs each |

**Creative Director Tools**
| Tool | Trigger | Output |
|------|---------|--------|
| Creative Brief Scorer | Paste brief → score | Quality score + 3 improvement points |
| Visual Direction Generator | Brand identity → visual brief | Mood direction, references, don'ts |
| Copy Quality Gate | Paste final copy → gate check | Brand voice / grammar / platform / clarity |
| Campaign Concept Generator | Goal + emotion + client → concept | 3 campaign concepts with hooks |
| Portfolio Story | Published posts → narrative | Agency portfolio summary paragraph |

### Implementation Details

- Route: `/api/tools/[role]/[tool]` — each tool is a small, focused Claude prompt
- UI: `components/tools/role-tools-panel.tsx` — drawer or modal, shows role-appropriate tools
- Trigger: floating button bottom-right of every page (respects role from `useAuth()`)
- Each tool shows: input area → "Run" button → output with copy button
- No saving required — these are ephemeral quick assists
- Response time target: < 3 seconds (use `claude-haiku-4-5` for fast tools, `claude-sonnet-4-6` for complex)

---

## PHASE 7 — P1: CEO Intelligence Hub (2–3 days)

### Concept
A dedicated page `/ceo` accessible only to `ceo` and `admin` roles. This is the most sophisticated feature — a permanent AI partner with marketing domain knowledge, not a chat interface.

The hub has four named modules:

---

### Module 1: Agency Health Dashboard

Real-time read of the agency state:
- Client health scores (at-risk / healthy / growing) — derived from task velocity + engagement trends
- Team utilization (from workload data)
- Pipeline velocity — avg days per stage across all active tasks
- Revenue-at-risk alerts — clients in crisis mode or overdue
- This week's publishing schedule — count by client, platform, status

No AI needed — pure data aggregation from existing hooks.

---

### Module 2: Strategy Intelligence

One-click deep analysis triggered per question:

**Market Position Analysis**
- Input: Select client(s)
- Output: Comparative positioning map, whitespace opportunities, threat assessment
- Uses: Client brand_identity + competitor_context + Metricool performance data

**Campaign Concept Generator (Executive)**
- Input: Brief text (objective + budget context + timeline)
- Output: 3 campaign concepts each with: hook, content mix, channel strategy, KPI targets, risk factors
- Uses: `claude-opus-4-7` for depth

**Content Strategy Audit**
- Input: Select client + period
- Output: What's working / what's failing / what's missing / recommended pivot
- Uses: Metricool post data + AI analysis

**Quarterly Narrative**
- Input: Select client + quarter
- Output: CEO-ready narrative paragraph for client report or board presentation
- Uses: Report data + AI synthesis

---

### Module 3: Crisis Management Center

Activated when any client has `is_in_crisis = true` (or manually by CEO).

**Protocol view:**
1. **Situation Assessment** — AI reads the client's recent posts, moderation items, and flags the likely trigger. "What caused this?" output.
2. **Recommended Protocol** — Step-by-step crisis comms plan: pause publishing → internal brief → client call agenda → public response draft → monitoring plan
3. **Holding Statement Generator** — Input: crisis type (PR scandal / product issue / social backlash / platform error) → output: 3 holding statement variants for the client to approve
4. **Recovery Content Plan** — After resolution: 2-week content recovery calendar with specific post briefs
5. **Post-mortem Template** — After 30 days: structured post-mortem with root cause, impact, learnings, prevention plan

Crisis log: every crisis event is logged with timeline, decisions made, and outcome. Searchable history.

---

### Module 4: Second Opinion Engine

The CEO's private AI sounding board — not visible to any other role.

**Conflict Resolution**
- Input: Describe the conflict (team, client, strategy)
- Output: Both sides fairly represented → recommended resolution path → communication script for the CEO

**Decision Validator**
- Input: Describe a decision you're about to make
- Output: Devil's advocate counter-argument → risk assessment → alternative options → recommendation

**Pitch Reviewer**
- Input: Paste a new business pitch or proposal
- Output: Strengths, gaps, objections a client would raise, suggested improvements, win probability estimate

**Difficult Conversation Preparer**
- Input: Who, what, context
- Output: How to open the conversation, what to avoid saying, how to close, follow-up plan

**Strategic Vision Check**
- Input: Describe a new direction or pivot
- Output: Market validation questions, execution risks, resource requirements, 90-day test plan

---

### CEO Hub Implementation

- Route: `/app/(app)/ceo/page.tsx` — role guard: `if (role !== 'ceo' && role !== 'admin') redirect('/dashboard')`
- Four modules as tab sections or collapsible panels
- Each AI call goes to `/api/ceo/[module]` routes (new routes)
- Uses `claude-opus-4-7` throughout — this user has no cost constraint
- All outputs are saved with timestamp to a `ceo_sessions` table (or localStorage fallback)
- No shared context with other roles — CEO sessions are isolated

---

## PHASE 8 — P0: Domain & Server Error Fixes (1 day)

### Identified Issues

The live site relates to `perfumeexhibition.com` — this appears to be a client the agency manages, not where the NOVAX ops platform is hosted. However, the ops platform may be calling Metricool APIs with this client's `blog_id`, and response shape issues could cascade.

**Likely server error sources:**
1. Metricool API calls failing with `blog_id` mismatch or missing — needs per-client `metricool_blog_id` validation
2. Missing environment variables in Vercel deployment causing 500s in API routes
3. Webhook endpoints (`/api/webhooks/metricool`, `/api/webhooks/respond-io`) receiving unexpected payloads
4. CORS headers missing on webhook routes

**Fix checklist:**
- [ ] Add runtime env var validation in all `/api/` routes: log which vars are missing and return 503 with clear message instead of cryptic 500
- [ ] Add `X-Content-Type-Options` and proper CORS headers to webhook routes
- [ ] Validate `blog_id` exists on client record before calling Metricool API — return `{ error: 'Client not configured for Metricool' }` not 500
- [ ] Add global error boundary in the app layout that catches and logs unhandled errors
- [ ] Add `/api/health` route returning env var status (masked) for deployment debugging
- [ ] Confirm Vercel env vars match `.env.local` variable names exactly

---

## PHASE 9 — P0: Email — Invitation System (1 day)

### Current State
`/api/auth/invite/route.ts` exists. The Settings page has "Invite Member" modal with email input. But invites likely aren't sending because Resend (email provider) is not configured.

### Fix Plan

**Step 9.1 — Add Resend**
```bash
npm install resend
```
Add env var: `RESEND_API_KEY`

**Step 9.2 — Invitation email template**

Create `lib/email-templates/invite.tsx` — a React Email template:
- Subject: "You've been invited to NOVAX Ops"
- Body: Name, role, agency name, accept link
- Branding: NOVAX teal, clean minimal layout

**Step 9.3 — Wire invite route**

`/api/auth/invite/route.ts` should:
1. Generate a signed invitation token (UUID stored in `invitations` table with expiry)
2. Send email via Resend with the token link
3. Return success

Invitation link: `https://[your-domain]/accept-invite?token=[token]`

**Step 9.4 — Accept invite page**

Create `/app/accept-invite/page.tsx`:
- Validate token
- Show "Set your password" form
- On submit: create Supabase auth user + user profile row
- Redirect to `/dashboard`

**Step 9.5 — Approval notification emails**

When a client submits the approval portal, send email to the account manager:
- "Perfume Exhibition has reviewed content batch 'May Week 2'"
- Shows: approved count / changes requested count
- Link back to the internal approval page

**Step 9.6 — Crisis mode email alert**

When crisis mode is toggled on for any client:
- Email CEO + account manager immediately
- Subject: "CRISIS ALERT — [Client name] publishing paused"
- Body: client name, who activated it, timestamp, link to crisis management center

---

## IMPLEMENTATION ORDER (by dependency)

```
Week 1:
  Day 1–2: Phase 1 (Clients AI analysis + save)
  Day 2–3: Phase 4 (Performance page mock cleanup)
  Day 3:   Phase 8 (Server error / domain fixes)
  Day 4:   Phase 9 (Email / invitations)
  Day 5:   Phase 5 (Approval feedback surfacing)

Week 2:
  Day 1–3: Phase 2 (Studio persistence + export + sessions)
  Day 4–5: Phase 3 (Reports → Metricool)

Week 3:
  Day 1–4: Phase 6 (Role-based tools)
  Day 5:   Integration testing

Week 4:
  Day 1–3: Phase 7 (CEO Intelligence Hub)
  Day 4–5: End-to-end QA + hardening
```

---

## NON-FUNCTIONAL REQUIREMENTS (apply to all phases)

**Error handling pattern (all API routes):**
```typescript
// Every route should follow this pattern
try {
  // ... logic
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Unknown error'
  console.error('[route-name]', msg, err)
  return NextResponse.json({ error: msg }, { status: 500 })
}
```

**Loading states:** Every async action needs a loading state. No silent waits.

**Empty states:** Every list/table needs an empty state with a CTA.

**Role guards:** Every page that has role restrictions must redirect on the server side (or in layout) — not just hide UI elements.

**No mock data in production:** After phase 4, the only acceptable use of `MOCK_DATA` imports is in `lib/report-demo-data.ts` for the onboarding preview banner.

**Consistent crisis property:** Standardize on `is_in_crisis: boolean` everywhere. Remove all `crisis_mode` references. Run a global find-replace.

---

## OPEN QUESTIONS (resolve before implementation)

1. **perfumeexhibition.com** — is this a client's website or is this the URL where NOVAX Ops is deployed? This changes the domain fix approach significantly.
2. **Resend account** — do you have a Resend account set up? What sending domain is verified?
3. **Supabase** — is the DB connected? If yes, what's causing the analyze route to still return mock data? Run: `SELECT * FROM clients LIMIT 1` in Supabase SQL editor to verify data exists.
4. **CEO page access** — should the CEO module be at `/ceo` (new nav item) or integrated into `/dashboard` as a special view?
5. **Role tools** — floating button or dedicated `/tools` page? Floating button is more workflow-native but may conflict with other UI.

---

## METRICS FOR SUCCESS

- [ ] Client AI analysis returns real Claude output for all 4 clients, persists across page refreshes
- [ ] Studio sessions survive navigation; can be exported to .txt and .pptx
- [ ] Reports page shows real Metricool data for at least one client (not demo banner)
- [ ] Performance page has zero `mock-data` imports
- [ ] Approval changes_requested notes visible to internal team within 1 click
- [ ] Team invitation email delivers within 60 seconds of sending
- [ ] Zero 500 errors in Vercel function logs for a 24-hour period
- [ ] CEO hub accessible, all 4 modules return AI output
- [ ] Role tools panel opens on keyboard shortcut for all roles
