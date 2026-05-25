# NOVAX Ops — Project State

> Last updated: 2026-05-25

---

## What the app does right now

NOVAX Ops is a fully functional internal operations platform for the NOVAX social media agency. It runs on Next.js 15, React 19, Tailwind v4, Supabase (connected), and the Anthropic Claude API.

**Authentication** — Real Supabase auth. Login page at `/login` (NOVAX-branded). Onboarding page at `/onboarding` (post-invite password set + name). Middleware protects all `/(app)/*` routes. Session persists across reloads. Admin account live (`ismailnosseir7@gmail.com`, role `admin`). Never create users via raw SQL — always use Supabase Dashboard UI (raw SQL breaks GoTrue password hashing).

**Pipeline** — 10-stage Kanban board (Strategy → Reporting) with drag-and-drop. Tasks read from Supabase. Task detail slide-over with AI agents (analyze, write copy, research, find assets, build deck) that call the real Claude API with caching, rate limiting, and cost tracking.

**Clients** — Client cards from real DB. Crisis Mode toggle persisted to Supabase — when activated, the Publishing page shows a red banner and pauses that client's posts. Client detail modal with Overview / Intelligence / Tasks tabs. New Client Wizard (9-step) exists in UI.

**Publishing** — Post grid + calendar view from real DB. Compose dialog with EN/AR/Both language toggle. Single image/video upload (Supabase Storage, XHR progress). Google Drive link → proxy URL conversion. Bulk schedule via Excel/CSV import. Carousel support. Draft save + "Push to Metricool" retry. Delete and edit scheduled posts. AI Content Calendar generator (Claude → 20–30 entries → export to Excel). Crisis Mode banner shows paused clients.

**Approval Portal** — Internal team creates approval requests with a 12-char hex token. Posts attached per-request with media display (image, video, carousel). Client gets a public link (`/approval/<token>`) to approve/request-changes per post with notes. Status syncs back to DB.

**Moderation** — Comment queue from Supabase `moderation_items` table. AI reply generation via Claude. Status tabs (Pending / Replied / Escalated). Save reply locally — Respond.io send route exists but not wired to a real account.

**Assets** — Asset library from Supabase. Google Drive full OAuth flow (auth, callback, files, disconnect, server-side proxy for streaming, import to Supabase Storage). Freepik tab returns mock results — no real API call.

**Performance & Intelligence** — `/performance` page: per-post stats, platform breakdown, AI trend analysis via Claude, best posting time recommendations, competitor tracking. Backed by Metricool analytics pull + DB queries.

**Creative Evaluation** — Upload image/video → Claude vision scoring across 7 dimensions with virality score, engagement prediction, strengths/improvements. Results in-session only (no persistence).

**Dashboard** — Real KPI queries from Supabase: active tasks, due today, posts scheduled, posts published, AI cost this month. Weekly activity chart. Pipeline distribution. Client health. Recent tasks and top posts.

**Reports** — Charts built. Report builder dialog (calls Claude + pptxgenjs). PDF export route at `/api/reports/export-pdf`. PPTX export at `/api/reports/export-pptx`. Metricool analytics pull partially wired — not fully connected.

**Studio** — `/studio` hub links to three AI-powered creation tools:
- `/studio/content` — End-to-end content pipeline: define brief → AI research → hooks → script → visual direction → schedule
- `/studio/hooks` — Hook Lab: generate 20 scored hooks (One Peak 3C framework), S/A/B/C tier scoring, save best to client library
- `/studio/strategy` — Strategy Command Center: 17-phase marketing strategy as living document per client; 5 meta-phases (Intelligence, Positioning, Execution, Scale, Optimize); PPTX export

**CEO Command Center** — `/ceo` page: market position analysis, campaign concept generator, content strategy audit, quarterly narrative, conflict resolution, decision validator, pitch reviewer, difficult conversation preparer — all Claude-powered.

**Documents** — `/docs` list view with create/search/delete. `/docs/[id]` full editor (docs + spreadsheets). Template support. Public sharing via token at `/docs/public/[token]`.

**My Tasks** — `/tasks` page shows all tasks assigned to the current user with search, status, and priority filters.

**AI Smart Resize** — `/tools/resize`: upload image → Claude Vision maps every element (logo, headline, subject, CTA) with bounding boxes → Gemini rebuilds layout natively for each social format. Background extension, element repositioning.

**AI Image Creation** — `/ai-image`: text layer editor (drag, resize, style), TOV injection, Flux/Ideogram style presets, AI text-placement via Claude Vision.

**Team / Settings** — Users table read from Supabase. Invite user modal with `useInviteUser()` hook and `/api/auth/invite` route. Invitation management routes (`/api/auth/invitations`). Integrations config tab built. Role enforcement not yet applied to UI visibility.

**Dark mode** — Global toggle persists to localStorage. Works via `html.dark` CSS class on `<html>`. Pages respond via global `:where()` overrides in globals.css (some pages still have hardcoded colors).

---

## Infrastructure

| Layer | Status |
|-------|--------|
| Supabase project | Connected — `jvilhgyatwhgcahmwzgd` |
| Auth | Real — login page, onboarding, signIn/signOut/session/middleware |
| Database | 13 core tables + RLS + additional via migrations 002–013 |
| Storage | `assets` bucket — public, 500MB per file, client-side direct upload |
| Claude API | Connected — `/api/ai` (agents), `/api/clients/analyze`, `/api/studio/*`, `/api/ceo/*`, `/api/performance/analyze`, `/api/ai-image/*` |
| Gemini API | Connected — `/api/reports/analyze`, `/api/tools/resize/generate` |
| Metricool API | Connected — schedule, delete, edit, sync, analytics, post-stats, webhooks |
| Rate limiting | In-memory 10 req/user/min |
| AI response cache | SHA-256 hash → `ai_responses` table |
| Cost tracking | Per-call write to `api_usage` table |
| Cron jobs | `sync-performance`, `sync-status`, `task-reminders`, `daily-digest` |
| Notifications | Task mention notifications (`/api/notifications/mention`) |
| Dark mode | CSS-var based, global `:where()` overrides |

---

## File Inventory

### Pages

| Page | Route | Data source |
|------|-------|-------------|
| Login | `/login` | Supabase auth |
| Onboarding | `/onboarding` | Supabase auth — post-invite password + name |
| Dashboard | `/dashboard` | Real Supabase queries via `use-dashboard.ts` |
| Pipeline | `/pipeline` | Real — `useTasks()` from Supabase |
| My Tasks | `/tasks` | Real — `useTasks()` filtered by user |
| Clients | `/clients` | Real — `useClients()` from Supabase |
| Projects | `/projects` | Real — `useProjects()` from Supabase |
| Publishing | `/publishing` | Real — `usePosts()` + `useClients()` from Supabase |
| Approval (internal) | `/approval` | Real — `useApprovalRequests()` from Supabase |
| Approval (public) | `/approval/[token]` | Real — `/api/approval?token=` fetch |
| Moderation | `/moderation` | Real — `useModerationItems()` from Supabase |
| Assets | `/assets` | Real — `useAssets()` from Supabase |
| Creative Eval | `/creative-eval` | Real — Claude API, no persistence |
| Performance | `/performance` | Real — Metricool + Supabase |
| Workload | `/workload` | Real — derived from `useTasks()` + `useUsers()` |
| Content Library | `/library` | Partial — `usePosts()` exists but still uses mock data |
| Reports | `/reports` | Partial — charts built, Metricool pull not fully wired |
| Settings | `/settings` | Real — `useUsers()`, invite route wired |
| Studio (hub) | `/studio` | Static links to creation tools |
| Studio — Content | `/studio/content` | Real — Claude API + Supabase |
| Studio — Hook Lab | `/studio/hooks` | Real — Claude API + Supabase hook library |
| Studio — Strategy | `/studio/strategy` | Real — Claude API + PPTX export |
| CEO Command Center | `/ceo` | Real — Claude API |
| Documents | `/docs` | Real — Supabase `documents` table |
| Document Editor | `/docs/[id]` | Real — Supabase |
| Document (public) | `/docs/public/[token]` | Real — `/api/docs/public/[token]` |
| AI Image Creation | `/ai-image` | Real — Claude Vision + Flux/Ideogram API |
| AI Smart Resize | `/tools/resize` | Real — Claude Vision + Gemini |

### API Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `POST /api/ai` | AI agents (analyze, copy, research, assets, caption) — rate limiting, caching, cost tracking | Done |
| `POST /api/clients/analyze` | Claude SWOT + market intelligence per client | Done |
| `GET/POST/PATCH /api/approval` | Approval token read/create/submit | Done |
| `POST /api/auth/invite` | Invite user via Supabase admin | Done |
| `GET /api/auth/invitations` | List pending invitations | Done |
| `PATCH/DELETE /api/auth/invitations/[id]` | Manage invitations | Done |
| `GET /api/drive/auth` | Start Google Drive OAuth | Done |
| `GET /api/drive/callback` | OAuth callback + token store | Done |
| `GET /api/drive/files` | List Drive files | Done |
| `POST /api/drive/disconnect` | Revoke Drive access | Done |
| `GET /api/proxy/drive` | Server-side Drive file proxy (bypass virus-scan, 1h cache) | Done |
| `POST /api/proxy/drive/import` | Import Drive file to Supabase Storage | Done |
| `POST /api/assets/import-from-drive` | Save imported Drive asset to DB | Done |
| `POST /api/metricool/schedule` | Schedule post in Metricool + save to DB | Done |
| `DELETE /api/metricool/schedule` | Cancel in Metricool + delete from DB | Done |
| `PATCH /api/metricool/schedule` | Push draft to Metricool | Done |
| `PATCH /api/metricool/schedule/edit` | Edit already-scheduled post (delete + reschedule) | Done |
| `GET /api/metricool/analytics` | Aggregate performance stats from Metricool | Done |
| `GET /api/metricool/post-stats` | Per-post performance stats | Done |
| `GET /api/metricool/sync` | Sync scheduled posts from Metricool into DB | Done |
| `POST /api/metricool/connection` | Test Metricool API connection | Done |
| `GET /api/metricool/overview` | Metricool account overview | Done |
| `POST /api/webhooks/metricool` | Mark posts published/failed on Metricool webhook | Done |
| `POST /api/webhooks/respond-io` | Receive comments/DMs (HMAC verified) | Route exists — not connected |
| `POST /api/respond-io/reply` | Send reply via Respond.io | Route exists — not connected |
| `GET /api/performance/posts` | Per-post performance data | Done |
| `POST /api/performance/analyze` | Claude AI analysis of performance trends | Done |
| `GET /api/performance/intelligence` | Platform-level intelligence aggregation | Done |
| `GET /api/performance/best-times` | Best posting time recommendations | Done |
| `GET /api/performance/competitors` | Competitor performance tracking | Done |
| `GET /api/performance/sync` | Sync performance data | Done |
| `GET /api/reports/analyze` | Gemini report analysis from text + screenshots | Done |
| `POST /api/reports/export-pptx` | Generate branded PPTX via pptxgenjs | Done |
| `POST /api/reports/export-pdf` | PDF export | Done |
| `POST /api/ai-image/generate` | AI image generation (Flux/Ideogram) | Done |
| `POST /api/ai-image/text-placement` | Claude Vision: suggest text placement | Done |
| `GET/POST /api/studio/content` | Content creation CRUD | Done |
| `GET /api/studio/content/[id]` | Get content item | Done |
| `POST /api/studio/content/[id]/research` | AI research for content | Done |
| `POST /api/studio/content/[id]/script` | AI script generation | Done |
| `GET/POST /api/studio/hooks/library` | Hook library CRUD | Done |
| `POST /api/studio/hooks/generate` | Generate 20 scored hooks | Done |
| `POST /api/studio/strategy` | 17-phase strategy generation | Done |
| `POST /api/ceo/strategy` | CEO strategy analysis | Done |
| `POST /api/ceo/crisis` | CEO crisis tools | Done |
| `POST /api/ceo/second-opinion` | CEO second opinion | Done |
| `GET/POST /api/docs` | Documents list + create | Done |
| `GET/PATCH/DELETE /api/docs/[id]` | Document CRUD | Done |
| `GET /api/docs/public/[token]` | Public shared document | Done |
| `POST /api/tools/resize/analyze` | Claude Vision — analyze image elements | Done |
| `POST /api/tools/resize/generate` | Gemini — rebuild layout for target format | Done |
| `POST /api/tasks/notify` | Task notification trigger | Done |
| `POST /api/notifications/mention` | Mention notification | Done |
| `GET /api/cron/sync-performance` | Cron: auto-sync performance data | Done |
| `GET /api/cron/sync-status` | Cron: sync scheduled post statuses | Done |
| `GET /api/cron/task-reminders` | Cron: send task due reminders | Done |
| `GET /api/cron/daily-digest` | Cron: daily digest | Done |
| `GET /api/pinterest` | Old stub — stale | Stale |

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
| `sql/001_initial_schema.sql` | Run — 13 core tables, RLS, triggers |
| `sql/002_crisis_mode_approvals.sql` | Run — `crisis_mode` on clients + `approval_requests` + `approval_post_statuses` |
| `sql/002_performance_tables.sql` | Run — performance analytics tables |
| `sql/002_new_clients_2026_05_21.sql` | Run — client seed data |
| `sql/003_approval_notes_notify.sql` | Run — approval notes + notification triggers |
| `sql/003_privea_dent.sql` | Run |
| `sql/003_remove_freepik.sql` | Run |
| `sql/004_metricool_blog_ids.sql` | Run — `metricool_blog_id` on clients |
| `sql/005_schema_patches.sql` | Run |
| `sql/006_storage_assets_bucket.sql` | Run — `assets` storage bucket (public, 500MB per file) |
| `sql/007_task_subtypes.sql` | Run — task sub-types and filtering |
| `sql/008_design_brief.sql` | Run — design brief form fields |
| `sql/009_documents.sql` | Run — `documents` table |
| `sql/010_task_comments_and_templates.sql` | Run — task comments + document templates |
| `sql/011_doc_type.sql` | Run — `doc_type` field on documents |
| `sql/012_studio.sql` | Run — studio content + hook library tables |
| `sql/013_onboarding.sql` | Run — onboarding state tracking |

---

## What is NOT yet built

### High priority (blocks real usage)
- `useCreateClient()` — New Client Wizard submit goes nowhere (wizard UI exists, hook missing)
- `useCreatePost()` — Compose dialog save does nothing (compose UI exists, hook missing)
- Role enforcement in UI — all roles see vendor names (Metricool/Respond.io/Higgsfield), Integrations tab, and AI cost data regardless of role

### Medium priority (integration gaps)
- Respond.io integration — webhook + reply routes exist but not connected (no API key configured)
- Higgsfield API route — AI video generation not built; mock UI only in Assets page
- Fix Freepik search — assets page returns `MOCK_FREEPIK_RESULTS`, no real API call
- AI Reflection agent — no post-generation brand/quality check
- Reports: Metricool analytics fully wired to charts

### Lower priority (enhancements)
- Client profile inline editor + enrichment tabs (Brand, Tone, Audience, Strategy, Goals, Competitors)
- Content Library: star/save persistence, "Use as template" action (still uses mock data)
- Approval Portal: email notification to client (Resend), expiry badge
- Creative Eval: result persistence + history view
- Drive file browser UI — OAuth routes fully built, UI wiring TBD
- AI Video Creation page (Higgsfield — prompt/image → cinematic video)
- Presentation Builder standalone UI (PPTX export route exists, no dedicated builder page)
- Islamic calendar data file for calendar generation
- Dark mode: remaining pages that still have hardcoded colors
- Per-client pipeline view (`/pipeline?client=id`)
