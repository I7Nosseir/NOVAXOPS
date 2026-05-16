# NOVAX Ops — Project State

> Last updated: 2026-05-17

---

## What the app does right now

NOVAX Ops is a fully functional internal operations platform for the NOVAX social media agency. It runs on Next.js 15, React 19, Tailwind v4, Supabase (connected), and the Anthropic Claude API.

**Authentication** — Real Supabase auth. Middleware redirects unauthenticated users. signIn / signOut wired. Session persists across reloads. Admin account live.

**Pipeline** — 10-stage Kanban board (Strategy → Reporting) with drag-and-drop. Tasks read from Supabase. Task detail slide-over with 5 AI agents (analyze, write copy, research, find assets, build deck) that call the real Claude API with caching, rate limiting, and cost tracking.

**Clients** — Client cards from real DB. Crisis Mode toggle persisted to Supabase — when activated, the Publishing page shows a red banner and pauses that client's posts. Client detail modal with Overview / Intelligence / Tasks tabs.

**Publishing** — Post grid + calendar view from real DB. Compose dialog with EN/AR/Both language toggle. AI Content Calendar generator (calls Claude, renders 20–30 entry calendar, lets you delete entries and export to Excel). Crisis Mode banner shows which clients are paused.

**Approval Portal** — Internal team creates approval requests with a 12-char hex token. Posts are attached per-request. Client gets a public link (`/approval/<token>`) where they can approve/request-changes per post and submit notes. Status syncs back to DB. No auth needed for the public page.

**Moderation** — Comment queue from Supabase `moderation_items` table. AI reply generation via Claude. Status tabs (Pending / Replied / Escalated). Save reply locally — does not yet send to Respond.io.

**Assets** — Asset library from Supabase. Google Drive OAuth routes are built (auth, callback, files, disconnect). Freepik search tab exists but still points to `/api/pinterest` (wrong endpoint — not yet fixed).

**Creative Evaluation** — Upload image/video → Claude vision scoring across 7 dimensions with virality score, engagement prediction, strengths/improvements. Results show in-session only (no persistence).

**Dashboard** — Real KPI queries from Supabase: active tasks, due today, posts scheduled, posts published, AI cost this month. Weekly activity chart. Pipeline distribution. Client health. Recent tasks and top posts from real data.

**Reports** — UI and charts built. Data is still mostly hardcoded — Metricool analytics pull not wired yet. Report builder dialog exists (calls Claude + pptxgenjs) but API route not built.

**Team / Settings** — Users table read from Supabase. Invite user modal exists with useInviteUser() hook and `/api/auth/invite` route. Integrations config tab built. Role enforcement not yet applied to UI visibility.

**Dark mode** — Global toggle persists to localStorage. Works via `html.dark` CSS class applied to `<html>`. All pages respond via global `:where()` overrides in globals.css.

---

## Infrastructure

| Layer | Status |
|-------|--------|
| Supabase project | Connected — `jvilhgyatwhgcahmwzgd` |
| Auth | Real — signIn/signOut/session/middleware |
| Database | 13 tables + RLS. `sql/001` run. `sql/002` needs to be run in SQL editor |
| Storage | `assets` bucket should exist (verify in dashboard) |
| Claude API | Connected — route at `/api/ai` with all 8 agents |
| Rate limiting | In-memory 10 req/user/min |
| AI response cache | SHA-256 hash → `ai_responses` table |
| Cost tracking | Per-call write to `api_usage` table |
| Dark mode | CSS-var based, global `:where()` overrides |

---

## File Inventory

### Pages (all built as frontend with real or near-real data)

| Page | Route | Data source |
|------|-------|-------------|
| Dashboard | `/dashboard` | Real Supabase queries via `use-dashboard.ts` |
| Pipeline | `/pipeline` | Real — `useTasks()` from Supabase |
| Clients | `/clients` | Real — `useClients()` from Supabase |
| Projects | `/projects` | Real — `useProjects()` from Supabase |
| Publishing | `/publishing` | Real — `usePosts()` + `useClients()` from Supabase |
| Approval (internal) | `/approval` | Real — `useApprovalRequests()` from Supabase |
| Approval (public) | `/approval/[token]` | Real — `/api/approval?token=` fetch |
| Moderation | `/moderation` | Real — `useModerationItems()` from Supabase |
| Assets | `/assets` | Real — `useAssets()` from Supabase |
| Creative Eval | `/creative-eval` | Real — Claude API, no persistence |
| Workload | `/workload` | Real — derived from `useTasks()` + `useUsers()` |
| Content Library | `/library` | Partial — `usePosts()` exists but library still uses mock |
| Reports | `/reports` | Partial — charts hardcoded, KPI hooks exist |
| Settings | `/settings` | Real — `useUsers()`, invite route wired |

### API Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `POST /api/ai` | All 8 AI agents — rate limiting, caching, cost tracking | Done |
| `GET/POST/PATCH /api/approval` | Approval token read/create/submit | Done |
| `POST /api/auth/invite` | Invite user via Supabase admin | Done |
| `GET /api/drive/auth` | Start Google Drive OAuth | Done |
| `GET /api/drive/callback` | OAuth callback + token store | Done |
| `GET /api/drive/files` | List Drive files | Done |
| `POST /api/drive/disconnect` | Revoke Drive access | Done |
| `GET /api/pinterest` | Old Freepik stub — needs replacing | Stale |

### Hooks (all in `lib/hooks/`)

| Hook | Status |
|------|--------|
| `useClients()` / `useClient()` / `useUpdateClient()` | Done |
| `useTasks()` / `useTask()` / `useUpdateTask()` / `useCreateTask()` | Done |
| `usePosts()` / `useUpdatePost()` | Done — `useCreatePost()` missing |
| `useUsers()` / `useInviteUser()` | Done |
| `useApprovalRequests()` / `useCreateApproval()` / `useSubmitApprovalReview()` | Done |
| `useModerationItems()` / `useUpdateModerationItem()` | Done |
| `useAssets()` | Done — `useCreateAsset()` missing |
| `useProjects()` | Done |
| `useDashboardStats()` / `useWeeklyActivity()` / `useClientHealth()` | Done |
| `useTaskComments()` | Done |

---

## SQL Migrations

| File | Status |
|------|--------|
| `sql/001_initial_schema.sql` | Run — 13 tables, RLS, triggers |
| `sql/002_crisis_mode_approvals.sql` | **Must be run manually** — adds `crisis_mode` to clients + creates `approval_requests` + `approval_post_statuses` tables |

---

## What is NOT yet built

### New planned feature
- **AI Image Creation** (`/ai-image`) — Imagen 3 generates visual background via Gemini API; Fabric.js canvas editor handles text layers (font, size, color, effects, Arabic RTL); Claude generates initial layout spec from brief; export as production PNG. Plan: `plans/AI_IMAGE_CREATION_PLAN.md`.

### High priority (blocks real usage)
- Login page (`/login`) — middleware redirects but no login UI yet
- `useCreateClient()` — New Client Wizard submit goes nowhere
- `useCreatePost()` — Compose dialog save does nothing
- Role enforcement in UI — all roles see everything (vendor names, Integrations tab, AI cost)

### Medium priority (integration gaps)
- Metricool scheduling (`/api/publishing/schedule`) — posts can't actually schedule
- Metricool webhook (`/api/webhooks/metricool`) — publish confirmation not received
- Respond.io webhook (`/api/webhooks/respond-io`) — comments not ingested
- Send reply to Respond.io (`/api/moderation/reply`) — "Send" only saves locally
- Fix Freepik endpoint — assets page uses `/api/pinterest` (wrong), needs `/api/assets/freepik`
- AI Reflection agent — no post-generation brand/quality check

### Lower priority (enhancements)
- Client profile enrichment tabs (Brand, Tone, Audience, Strategy, Goals, Competitors)
- Real Intelligence tab (SWOT generated by Claude, stored in DB)
- Reports: real Metricool analytics pull + pptxgenjs presentation generation
- Creative Eval: result persistence + history view
- Content Library: star/save persistence, "Use as template" action
- Approval Portal: email notification to client (Resend), expiry badge
- Islamic calendar data file for calendar generation
- Dark mode: remaining pages that still have hardcoded colors
