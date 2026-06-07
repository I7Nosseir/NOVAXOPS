# NOVAX Ops — Project Context

## What this is

A unified operations platform for a social media/creative agency called **NOVAX**. Replaces ClickUp. Centralises the full content pipeline (Strategy → Publishing → Reporting) with AI assistance at every stage, client management, social publishing via Metricool, comment moderation via Respond.io, and asset management.

The system is **fully owned and self-hosted** by the agency. There is no white-labelling concern — this is an internal tool. Live at **https://perfumeexhibition.com** (Vercel).

## Owner / Developer

The person running this Claude session is simultaneously:
- The **developer** building and maintaining the platform
- The **admin** user with the highest permission level in the system
- The person **solely responsible** for all third-party integrations (Metricool, Respond.io, Higgsfield, Claude API, Google Drive)

This means:
- Integrations configuration UI is only ever shown to the admin role
- Third-party vendor names (Metricool, Respond.io, Higgsfield) are masked from all other roles as "Scheduling Platform", "Messaging Platform", "Video Studio"
- Only `admin` and `ceo` roles can see real vendor names anywhere in the UI

## Branding

- Agency name: **NOVAX**
- Primary brand color: `#1B3D38` (dark forest teal green)
- Full CSS custom property palette registered in `globals.css` under `@theme inline`:
  - `--novax: #1B3D38` → `bg-novax`, `text-novax`
  - `--novax-hover: #163330` → `bg-novax-hover`
  - `--novax-muted: #2A6B62` → `text-novax-muted`
  - `--novax-accent: #5BB4AE` → `text-novax-accent`
  - `--novax-light: #EBF4F3` → `bg-novax-light`
  - `--novax-light-hover: #D6ECEA` → `bg-novax-light-hover`
  - `--novax-border: #9DCCC8` → `border-novax-border`
  - `--novax-border-active: #5BB4AE` → `border-novax-border-active`
- **No emojis anywhere in the UI** — use lucide-react icons only
- **No hashtags or emojis in AI-generated content** by default (only when a task explicitly requests them)

## Tech Stack (exact versions — do not upgrade without checking)

| Package | Version | Notes |
|---|---|---|
| Next.js | 15.5.15 | App Router, Turbopack enabled |
| React | 19.1.0 | |
| TypeScript | ^5 | Strict mode |
| Tailwind CSS | ^4 | New CSS-native config, no tailwind.config.ts |
| shadcn/ui | CLI v4 | Tailwind v4 compatible |
| TanStack Query | ^5.100.7 | v4 is legacy, do not use |
| @dnd-kit/core | ^6.3.1 | Pipeline drag-and-drop |
| @dnd-kit/sortable | ^10.0.0 | |
| Recharts | ^3.8.1 | Charts on dashboard + reports |
| Zod | ^4.4.1 | Validation. v4 is ~14x faster than v3 |
| lucide-react | ^1.14.0 | **Icons are Client Components in v1 — cannot use in Server Components. Brand icons (Instagram, LinkedIn, YouTube) were removed in v1 — use `<PlatformIcon>` instead** |
| date-fns | ^4.1.0 | v4 adds timezone support |
| pptxgenjs | ^4.0.1 | Presentation generation |
| clsx + tailwind-merge | latest | Use `cn()` from lib/utils.ts |
| @anthropic-ai/sdk | ^0.96.0 | Claude API (primary AI) |
| @supabase/supabase-js | ^2.105.1 | Database + Auth |
| @supabase/ssr | ^0.10.2 | SSR-compatible Supabase client |
| @tiptap/react | ^3.23.6 | Rich text editor (Documents page) |
| @react-pdf/renderer | ^4.5.1 | PDF export |
| resend | ^6.12.3 | Email (invites, digests, reminders) |
| sonner | ^2.0.7 | Toast notifications |
| sharp | ^0.34.5 | Server-side image processing |
| xlsx | ^0.18.5 | Spreadsheet import/export |
| @googleapis/drive | ^20.1.0 | Google Drive OAuth + file browser |
| react-markdown | ^10.1.0 | Markdown rendering (assistant, docs) |
| remark-gfm | ^4.0.1 | GitHub-flavoured markdown |
| google-auth-library | ^10.6.2 | Google OAuth token handling |

**Not yet installed (planned):**
- `fal-ai/client` — Flux 2 image generation ($0.03/image)
- `@ideogram/api` — Ideogram 3.0 image generation (best for text-in-image)
- Higgsfield SDK / fetch — AI video generation (cinematic, character-consistent)

**Do NOT add (production):**
- react-beautiful-dnd (deprecated, use @dnd-kit)
- Vercel Edge Functions (`export const runtime = 'edge'`) — deprecated, use Node.js Vercel Functions

**AI model strategy:**
- Primary: Claude via `@anthropic-ai/sdk` — `claude-sonnet-4-6` (standard), `claude-opus-4-7` (complex/strategy)
- Fallback: Gemini via REST — `gemini-3-flash-preview` (always use this exact string — never change)
- `ANTHROPIC_API_KEY` is currently **empty in .env.local** — system falls back to Gemini. Set this for production.
- Model provider abstracted in `lib/ai-client.ts` — one config change to swap

## Database (Supabase — fully connected)

**Project:** `jvilhgyatwhgcahmwzgd.supabase.co`
Keys are set in `.env.local` and Vercel. `lib/supabase.ts` has browser + admin clients.

**SQL migrations** — all files in `sql/`. Run in sequence in Supabase SQL editor:

```
001_initial_schema.sql          Core schema (users, clients, projects, tasks, etc.)
002_crisis_mode_approvals.sql   Crisis mode + approval_requests tables
002_new_clients_2026_05_21.sql  Seed client data
002_page_permissions.sql        page_permissions column on users
002_performance_tables.sql      post_performance_snapshots, competitor_tracking tables
003_remove_freepik.sql          Drop Freepik integration
003_approval_notes_notify.sql   Approval notes + notifications column
003_privea_dent.sql             Client-specific schema patch
004_metricool_blog_ids.sql      metricool_blog_id per client
005_schema_patches.sql          General patches
006_storage_assets_bucket.sql   Supabase Storage bucket (assets — public, 500MB limit)
007_task_subtypes.sql           Task sub_type column (copy_variant, design_brief, etc.)
008_design_brief.sql            Per-client design brief JSON
009_documents.sql               Documents table (Tiptap-backed)
010_task_comments_and_templates Task comments + content templates
011_doc_type.sql                Document type column
012_studio.sql                  Studio sessions table v1
013_onboarding.sql              Onboarding checklist
014_arabic_knowledge_base.sql   Arabic dialect rules + banned phrases
015_omranion_client.sql         Omranion client (id: b4d2340e, blogId: 6329305)
015_studio_sessions.sql         Studio sessions v2
016_inspiration_board.sql       Inspiration board table
016_studio_sessions_v4.sql      Studio sessions v4 schema upgrade
017_studio_unified.sql          Unified studio + inspiration (idempotent — safe to re-run)
018_ai_generation_cache.sql     AI generation cache table (prompt_hash keyed)
018_chatwoot_migration.sql      Chatwoot integration schema
019_peak_format_generator.sql   format_favorites table (Peak Format Generator)
020_ceo_context.sql             CEO context + cross-client briefing tables
021_client_context_bank.sql     Per-client context bank (wins, voice, objections, signals)
022_ai_feedback.sql             ai_feedback table (per-client, per-agent taste profiles)
```

**Key tables:**
```
users                       Core profiles (mirrors auth.users)
clients                     Client brands with brand_identity_json + metricool_blog_id
projects                    Campaigns per client
tasks                       Core work unit — lives in one pipeline_stage
scheduled_posts             Content scheduled via Metricool
moderation_items            Comments/DMs from Respond.io
approval_requests           Client approval workflows
approval_post_statuses      Per-post approval decisions
assets                      Uploaded + Drive-imported files
documents                   Rich-text docs (Tiptap)
studio_sessions             All studio tool sessions (unified)
inspiration_board           Per-client saved inspiration items
post_performance_snapshots  Synced Metricool analytics per post
competitor_tracking         Competitor account performance data
arabic_knowledge_base       Dialect rules + banned phrases per client
ai_responses                Cached AI outputs (keyed by prompt_hash)
ai_generation_cache         Second-level AI cache (broader key)
ai_feedback                 Team thumbs-up/down on AI outputs (feeds back into prompts)
client_context_bank         Per-client wins, brand voice, objections, signals (built by team)
ceo_context                 Cross-client strategy context for CEO briefings
format_favorites            Saved viral content formats (Peak Format Generator)
api_usage                   Per-call cost tracking
audit_log                   Every action with user + timestamp
task_comments               Comment threads on tasks
```

**Storage buckets:** `assets` (public, 500MB/file)

**RLS is enabled on all tables.** Policies are role-based.

## Project File Structure

```
agency-ops/
├── app/
│   ├── layout.tsx                      Root layout (Geist font, globals.css)
│   ├── page.tsx                        Redirects to /dashboard
│   ├── globals.css                     Tailwind v4 + shadcn CSS vars + NOVAX palette
│   ├── approval/[token]/page.tsx       PUBLIC client-facing approval portal (no auth)
│   ├── (auth)/
│   │   ├── login/page.tsx              Email/password login with intro animation
│   │   └── onboarding/page.tsx         First-login: set name, phone, password
│   └── (app)/                          Authenticated route group
│       ├── layout.tsx                  App shell: AuthGuard + Sidebar + Header
│       ├── dashboard/page.tsx          Live KPI summaries, activity, Metricool widget
│       ├── pipeline/page.tsx           10-stage Kanban (drag-and-drop, real Supabase)
│       ├── tasks/page.tsx              My Tasks — assigned to current user
│       ├── clients/page.tsx            Client cards + detail modal + Crisis Mode
│       ├── projects/page.tsx           Project cards with real progress
│       ├── publishing/page.tsx         Grid + Calendar, Compose (EN/AR), Generate Calendar
│       ├── approval/page.tsx           Internal approval management + shareable tokens
│       ├── moderation/page.tsx         Comment queue + AI reply (Claude/Gemini)
│       ├── assets/page.tsx             Asset library + Drive import + Higgsfield (stub)
│       ├── creative-eval/page.tsx      Upload → Claude AI scoring (brand/hook/CTA/visual)
│       ├── workload/page.tsx           Per-member load bars + task lists
│       ├── library/page.tsx            Published posts as reusable templates
│       ├── reports/page.tsx            KPI charts + Claude narrative + PPTX/PDF export
│       ├── settings/page.tsx           Integrations (admin) + Team + Permissions
│       ├── performance/page.tsx        Post analytics, competitor tracking, AI intelligence
│       ├── ceo/page.tsx                CEO Hub: strategy, crisis override, second opinion
│       ├── ai-image/page.tsx           AI Image Creation (UI shell — FAL/Ideogram pending)
│       ├── assistant/page.tsx          AI Chat Assistant — context-aware, client/task scoped
│       ├── docs/page.tsx               Document list (create, search, delete)
│       ├── docs/[id]/page.tsx          Tiptap rich text editor + share + templates
│       ├── tools/resize/page.tsx       Smart Resize tool (partial)
│       └── studio/
│           ├── layout.tsx              Studio layout wrapper
│           ├── page.tsx                Studio hub — recent sessions, tool links
│           ├── content/page.tsx        Content type (reel/carousel/static) + 1-3 pieces
│           ├── hooks/page.tsx          Hook Lab: 20 divergent → 3C scoring → convergent
│           ├── strategy/page.tsx       Strategy Command Center (Esplanade format, Claude)
│           ├── campaign/page.tsx       Campaign Igniter: tensions → 5 execution briefs
│           ├── inspiration/page.tsx    Live trends (Apify) → per-client boards
│           ├── postmortem/page.tsx     Post-Mortem: why didn't this perform? (Claude)
│           └── visual/page.tsx         Visual Content Engine: approach → scene prompts
├── app/api/                            100+ API routes — see AI Architecture section
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                 Dark sidebar, live badge counts from Supabase
│   │   ├── header.tsx                  Search, New Task, notifications bell, theme toggle
│   │   ├── notifications-panel.tsx     Real notifications from audit_log (useNotifications)
│   │   ├── auth-guard.tsx              Route protection by page_permissions
│   │   ├── role-preview-banner.tsx     Admin role-preview mode indicator
│   │   ├── mobile-nav.tsx              Mobile navigation
│   │   └── preview-aware-main.tsx      Main wrapper for preview mode
│   ├── pipeline/
│   │   ├── pipeline-board.tsx          DndContext wrapper + state
│   │   ├── pipeline-column.tsx         useDroppable, SortableContext
│   │   ├── task-card.tsx               useSortable, priority/client/due date
│   │   ├── task-list.tsx               List view of tasks
│   │   ├── filter-chips.tsx            Quick filter toggles
│   │   └── filter-panel.tsx            Advanced filter UI
│   ├── tasks/
│   │   ├── task-detail-panel.tsx       Slide-over: meta + 5 AI agents + copy versioning
│   │   ├── create-task-dialog.tsx      New task modal
│   │   ├── task-comments.tsx           Comment thread on tasks
│   │   └── my-tasks-float.tsx          Floating My Tasks panel
│   ├── studio/
│   │   ├── studio-session-list.tsx     Recent session cards
│   │   ├── studio-brief-confirm.tsx    Brief confirmation + AI questions
│   │   ├── studio-document.tsx         Expandable output cards (hook → full content on expand)
│   │   ├── studio-chatbot.tsx          In-studio chat interface
│   │   ├── studio-loading.tsx          Multi-step loading indicator
│   │   ├── studio-save-actions.tsx     Save output to task / doc / client context bank
│   │   ├── inspiration-board-panel.tsx Inspiration side panel
│   │   └── inspiration-card.tsx        Individual trend card
│   ├── shared/
│   │   └── ai-feedback-buttons.tsx     Thumbs up/down on any AI output (feeds ai_feedback)
│   ├── clients/
│   │   ├── new-client-wizard.tsx       9-step onboarding modal
│   │   └── design-brief-form.tsx       Canvas sizes, fonts, colors, motion, AI video notes
│   ├── docs/
│   │   ├── doc-editor.tsx              Tiptap rich text editor
│   │   ├── doc-share-dialog.tsx        Share dialog
│   │   └── sheet-editor.tsx            Spreadsheet-like editor
│   ├── settings/
│   │   └── invite-user-modal.tsx       Invite modal (role grid + email + page permissions)
│   ├── tools/
│   │   └── role-tools-panel.tsx        Role-specific tool shortcuts
│   └── ui/
│       └── platform-icon.tsx           Custom branded platform icon. Handles unknown keys
│                                       gracefully (fallback badge). Never import IG/FB/etc
│                                       from lucide-react — removed in v1.
├── lib/
│   ├── types.ts                        All TypeScript interfaces + union types
│   ├── utils.ts                        cn(), STAGE_CONFIG, PRIORITY_CONFIG, PLATFORM_CONFIG
│   ├── supabase.ts                     Browser client + createAdminClient()
│   ├── auth-context.tsx                Supabase Auth provider + role preview mode
│   ├── query-provider.tsx              TanStack Query v5 provider wrapper
│   ├── theme-context.tsx               Dark/light theme provider
│   ├── sidebar-context.tsx             Mobile sidebar open/close state
│   ├── ai-client.ts                    Claude + Gemini abstraction layer
│   ├── client-intelligence.ts          Client context bank builder + AI feedback injector
│   ├── metricool.ts                    Metricool API client (mFetch, schedule, analytics)
│   ├── google-drive.ts                 Google Drive OAuth + file browser
│   ├── email.ts                        Resend email templates
│   ├── gemini.ts                       Gemini REST client (fallback AI)
│   ├── arabic-dialect.ts               Arabic tone rules + banned phrases
│   ├── report-prompts.ts               Report generation prompt templates
│   ├── page-permissions.ts             Page ACL (role → visible pages)
│   ├── studio-types.ts                 All studio types — see Studio Types section
│   ├── studio-campaign-domains.ts      Campaign niche definitions
│   ├── studio-export.ts                Export session to document
│   ├── strategy-export.ts              Export strategy to PPTX
│   └── hooks/
│       ├── use-tasks.ts                CRUD + filters (client, stage, priority, assignee)
│       ├── use-clients.ts              CRUD clients
│       ├── use-projects.ts             CRUD projects
│       ├── use-users.ts                Query users + invite/cancel/permissions mutations
│       ├── use-posts.ts                Query + mutate scheduled posts
│       ├── use-moderation.ts           Query items + send reply + usePendingModerationCount
│       ├── use-approvals.ts            Query requests + create + usePendingApprovalCount
│       ├── use-assets.ts               Query + upload + delete assets
│       ├── use-notifications.ts        Real notifications from audit_log (refetch 60s)
│       ├── use-task-comments.ts        Comment threads per task
│       └── use-dashboard.ts            Weekly activity + AI cost + Metricool overview
├── sql/                                30 migration files (001–022, see Database section)
├── middleware.ts                       Supabase session refresh + auth redirect
└── next.config.ts                      Turbopack root + image domains
```

## Studio Types (lib/studio-types.ts)

All studio modules import from here. Key exports:

**Type aliases:** `StudioTool`, `SessionStatus`, `PerformanceVerdict`, `HookTier`, `ContentFormat` (`reel | carousel | static`), `VideoFormat`, `NarrativePurpose`

**Core interfaces:** `LoadingStep`, `SignalReport`, `SessionPerformance`, `BossBrief`, `ChatMessage`, `EditPayload`, `StructuredQuestion`, `BriefConfirmation`, `StudioSession`

**Content:** `ContentInputs`, `ContentPiece` (reel/carousel/static — has `slides[]`, `script_sections[]`, `visual_direction`, `text_overlay`), `ContentDocument` (supports `pieces?: ContentPiece[]` for multi-piece output + `content_type`, `piece_count`), `ScriptSection`, `HookItem`, `HookDocument`

**Strategy:** `StrategyContentPillar`, `StrategyArcPhase`, `StrategyPlatformRole`, `StrategyMonthTactic`, `StrategyFormatRoles`, `StrategyFlowBeat`, `StrategyDocument`

**Other:** `CampaignConcept`, `CampaignDocument`, `PostMortemAnalysis`, `PostMortemDiagnosis`, `MetricoolContext`, `VisualApproach`, `VisualAnchor`, `ScenePrompt`, `VisualProductionNotes`, `VisualDocument`, `VisualInputs`

## Role System

```typescript
type UserRole =
  | 'admin'               // Full access. Only role that sees integration vendor names + Integrations tab
  | 'ceo'                 // Full access. Sees vendor names. Does NOT see Integrations tab config
  | 'creative_director'   // Manages creative team, full task/client access
  | 'account_manager'     // Client-facing, manages approvals and reporting
  | 'strategist'          // Can create/manage strategy-stage tasks and projects
  | 'copywriter'          // Assigned copy tasks, uses AI agents
  | 'designer'            // Assigned design tasks
  | 'social_manager'      // Publishing + moderation access
```

**Page-level permissions:** Admin can restrict which optional pages each user sees via `users.page_permissions TEXT[]`. `NULL` = all pages visible (default). Empty array = only required pages. Enforced in `components/layout/auth-guard.tsx`.

**UI visibility rules by role:**
- Integrations tab in Settings: `admin` only
- Metricool/Respond.io/Higgsfield labels: `admin` + `ceo` only. Everyone else sees masked vendor names
- Audit log: `admin` + `ceo` only
- API cost data: `admin` + `ceo` + `creative_director`
- Team management: `admin` only
- Studio tools: `admin` only (others via page_permissions)

## Pipeline Stages (fixed — do not add or rename without updating DB enum)

```
strategy → ideas → calendar → copy → design → review → approval → scheduled → published → reporting
```

Each stage has a fixed color scheme in `lib/utils.ts` → `STAGE_CONFIG`. Always use `STAGE_CONFIG[stage].label/color/bg/border` — never hardcode stage display values.

## AI Architecture

**No open chat.** All AI calls are triggered by specific UI buttons per task/stage.

**Every AI call follows this sequence:**
1. Compute `prompt_hash = MD5(task_id + agent_type + stable_context_snapshot)`
2. Check `ai_responses` table for a matching hash with `is_cached = true`
3. If cache hit → return saved response instantly, zero API cost
4. If miss → build context-injected prompt → call Claude API → save response → return

**Context injected into every prompt:**
- Task title + description + pipeline stage
- Client brand identity (tone, audience, key messages, colors)
- Client context bank (wins, objections, signals, recent feedback) via `lib/client-intelligence.ts`
- Last 3 relevant AI outputs for this client
- Current user role (affects output formality)
- Arabic dialect rules if client uses Arabic (from `arabic_knowledge_base` table)

**Agent types (`/api/ai`):**
- `task_analyzer` — Breaks down brief, flags missing info, suggests approach
- `copywriter` — Stage-aware copy. Returns 3 variants (Aspirational / Benefit-led / Conversational)
- `researcher` — Market context, competitor gaps, trending angles
- `asset_finder` — Extracts keywords → prepares Drive query
- `post_caption` — Image-aware caption via Claude Vision
- `presentation_builder` — Generates slide structure → pptxgenjs

**Studio AI routes:**
- `/api/studio/content/[id]/script` — Reel script / Carousel slides / Static image brief (content_type-aware)
- `/api/studio/hooks/generate` — 20 hooks → 3C scoring → SCAMPER filtering
- `/api/studio/strategy` — Esplanade-format quarterly strategy (17 phases, Claude)
- `/api/studio/campaign/generate` — Cultural tensions → 5 execution briefs
- `/api/studio/chat` — In-session chat + content editing (Claude Sonnet)
- `/api/studio/postmortem` — Post-mortem diagnosis (Claude)
- `/api/studio/brief-confirm` — Two modes: (1) `BriefConfirmation` for UI confirmation, (2) `mode:'boss_brief'` → generates `BossBrief` (30-second exec summary)
- `/api/studio/signal-report/[industry]` — Pre-computed daily signal report (trends, tensions)
- `/api/studio/questions` — AI-generated inline question during loading
- `/api/studio/visual` — Visual content engine: approach selection → scene prompts (Higgsfield-ready)
- `/api/studio/inspiration-analysis` — Trend analysis + save to client board
- `/api/studio/strategy-export` — Export strategy to PPTX
- `/api/studio/metricool-context` — Per-client performance snapshot for studio

**Other key routes:**
- `/api/ai-feedback` — Save team thumbs-up/down on AI outputs → feeds `ai_feedback` table
- `/api/clients/[id]/context-bank` — Read/write client context bank entries
- `/api/assistant/chat` — Context-aware AI chat assistant (scoped to client or task)
- `/api/ceo/strategy`, `/api/ceo/second-opinion`, `/api/ceo/crisis` — CEO Hub AI calls

**Output rules:**
- No hashtags or emojis in any AI output by default
- Only include when task description explicitly requests them

**Claude models:**
- Primary: `claude-sonnet-4-6` (most tasks)
- Complex/strategy: `claude-opus-4-7` (strategy, Boss Brief, research)
- Always use versioned model strings — never aliases
- Gemini fallback: `gemini-3-flash-preview` — always this exact string

**Rate limit:** 10 AI requests per user per minute (enforced in API route middleware)

## Integrations Map

| Integration | Purpose | Status | Auth method |
|---|---|---|---|
| Metricool | Publish + schedule + fetch analytics | **Live** | API token + blogId per client |
| Respond.io | Receive comments/DMs, send replies | Webhook only (reply sender incomplete) | API key + webhook secret |
| Apify | Instagram, TikTok, YouTube, Reddit scraping | **Live** | API key |
| YouTube Data API | Video trends + analytics | **Live** | API key |
| Google Drive | Asset browser + file import | **Live** (OAuth) | OAuth 2.0 per user |
| Resend | Email (invites, digests, reminders) | **Live** | API key |
| Claude API | All AI agents (primary) | **ANTHROPIC_API_KEY not set** | API key |
| Gemini | AI fallback | **Live** | API key |
| Higgsfield | AI video generation | Stub only | API key (missing) |
| Flux 2 / fal.ai | AI image generation | Stub only | API key (missing) |
| Ideogram 3.0 | Text-in-image generation | Stub only | API key (missing) |

**Webhook endpoints (configure in vendor dashboards):**
- Respond.io → `POST /api/webhooks/respond-io`
- Metricool publish confirmation → `POST /api/webhooks/metricool`

**Important Metricool constraint:** No OAuth — token only. Each client is a `blogId` under one agency account. Map stored in `clients.metricool_blog_id`.

**Important Respond.io constraint:** Instagram public comment replies not supported via API — DM only. Facebook public comment replies work. Google Reviews not supported.

## Currently Built & Live

### Auth
- [x] Login page — NOVAX-branded, email/password, Supabase Auth
- [x] Onboarding — first-login: set name, phone, password; clears `needs_onboarding` flag
- [x] `middleware.ts` — protects all `/(app)/*` routes, redirects unauthenticated to `/login`
- [x] `lib/auth-context.tsx` — AuthProvider, `onAuthStateChange`, fetches profile from `public.users`
- [x] Role preview mode (admin only) — impersonate any role without switching accounts

### Core Shell
- [x] Full app shell (sidebar, header, layout) with dark/light ThemeProvider
- [x] NOVAX branding: dark teal `#1B3D38`, NOVAX logo mark SVG
- [x] Sidebar live badge counts — pending approvals + moderation from Supabase (not hardcoded)
- [x] Notifications panel — real data from `audit_log` via `useNotifications()` hook
- [x] Page permissions system — admin restricts pages per user, enforced at route level
- [x] Mobile sidebar + responsive layout

### Main Pages (all on real Supabase data)
- [x] **Dashboard** — live KPI stats, weekly activity chart, Metricool overview widget
- [x] **Pipeline** — 10-stage Kanban, drag-and-drop, real task CRUD
- [x] **Tasks** — My Tasks: assigned to current user, search + filter
- [x] **Clients** — cards + detail modal (Overview/Intelligence/Tasks tabs) + Crisis Mode + Design Brief
- [x] **New Client Wizard** — 9-step modal (Identity → Social → Competitors → Brand → Tone → Audience → Strategy → Goals → Resources)
- [x] **Projects** — progress bars, stage distribution, real data
- [x] **Publishing** — Grid + Calendar view, Compose (EN/AR/Both), Generate Calendar, Metricool scheduling
- [x] **Approval** — internal management + shareable token links + client email notification
- [x] **Public Approval Portal** (`/approval/[token]`) — per-post approve/request-changes/notes, submit
- [x] **Moderation** — comment queue, AI reply (Claude/Gemini), send/escalate/ignore
- [x] **Assets** — library + Google Drive import + Supabase Storage upload
- [x] **Creative Eval** — upload image/video → Claude AI scoring (brand fit, hook, visual, CTA, engagement prediction)
- [x] **Workload** — per-member load bars, overloaded/healthy badges, task list preview
- [x] **Content Library** — published posts as reusable templates, filter, save
- [x] **Reports** — KPI charts, Claude narrative, Metricool data, PPTX + PDF export
- [x] **Settings** — integrations config (admin), team + invite, page permissions per user
- [x] **Performance** — post analytics, competitor tracking, AI pattern intelligence, best posting times
- [x] **CEO Hub** — strategy analysis, crisis override, second opinion (Claude)
- [x] **AI Assistant** (`/assistant`) — context-aware chat, scoped to client or task
- [x] **Documents** — Tiptap rich text editor, templates, public sharing via token
- [x] **Studio Hub** — links to all studio tools, recent session list

### Studio Tools (all on real Supabase + Claude)
- [x] **Content Studio** (`/studio/content`) — Content type selector (Reel/Carousel/Static) + 1–3 pieces, each with a different hook. Output as expandable cards (hook collapsed → full content on expand). Boss Brief generated after output.
- [x] **Hook Lab** (`/studio/hooks`) — 20 divergent hooks → 3C scoring + SCAMPER → convergent top 3. Expandable cards per hook.
- [x] **Strategy** (`/studio/strategy`) — Esplanade-format quarterly strategy, PPTX export (Claude)
- [x] **Campaign Igniter** (`/studio/campaign`) — Cultural tensions + constraint inversion → 5 execution briefs
- [x] **Inspiration Board** (`/studio/inspiration`) — Live YouTube/TikTok/Reddit trends (Apify), save to client boards
- [x] **Post-Mortem** (`/studio/postmortem`) — Why didn't this perform? Hook/format/timing/caption diagnosis (Claude)
- [x] **Visual Content Engine** (`/studio/visual`) — Choose approach → visual anchor → scene-by-scene prompts (Higgsfield/image-gen ready)
- [x] **Peak Format Generator** (`/studio/formats`) — Enter niche → 5 viral formats each with hook stack, 3-law validation, episode structure, payoff architecture. Claude Opus when key set, Gemini fallback.

### Client Intelligence Layer (fully built — migration 021+022)
- [x] `client_context_bank` table — per-client wins, brand voice captures, objections, signals
- [x] `ai_feedback` table — team thumbs-up/down on outputs feeds back into future prompts
- [x] `/api/clients/[id]/context-bank` — CRUD for context entries
- [x] `/api/ai-feedback` — Save feedback, retrieve taste profile
- [x] `lib/client-intelligence.ts` — `buildClientIntelligenceBlock()` injected into studio + task AI calls
- [x] `components/shared/ai-feedback-buttons.tsx` — Feedback UI on all studio outputs
- [x] `components/studio/studio-save-actions.tsx` — Save output to task / document / context bank

### API Routes (100+ total)
All routes use Node.js runtime. No edge functions.

### Background Jobs (Cron)
- `GET /api/cron/sync-performance` — Daily Metricool analytics sync to DB
- `GET /api/cron/sync-status` — Sync scheduled post statuses from Metricool
- `GET /api/cron/task-reminders` — Email reminders for overdue tasks
- `GET /api/cron/daily-digest` — Daily digest email via Resend
- `GET /api/cron/cleanup-storage` — Remove old assets from Supabase Storage
All cron routes are protected by `CRON_SECRET` header.

### Data Layer
- **Realtime subscriptions** — `lib/hooks/use-realtime.ts` provides `useRealtime(table, queryKey)` and `useRealtimeMulti()`. Wired to: pipeline (`tasks`), approval (`approval_requests`, `approval_post_statuses`), moderation (`moderation_items`), notifications (`audit_log`). Pattern: hook calls `queryClient.invalidateQueries()` on any Postgres change — no changes to existing data-fetching hooks needed.
- **Zero mock data** — `lib/mock-data.ts` deleted. `lib/studio-session-store.ts` deleted.
- All pages query Supabase via TanStack Query v5 hooks
- All `_mock: true` fallbacks removed from API routes — misconfiguration now surfaces as explicit `503`

## Still Incomplete / Pending

| Feature | Status | Notes |
|---|---|---|
| **ANTHROPIC_API_KEY** | **CRITICAL** | Not set in `.env.local`. All AI falls back to Gemini. Set this for production. |
| Respond.io reply sender | Partial | Webhook receives items. `/api/respond-io/reply` route exists but not fully wired. |
| AI Image page (`/ai-image`) | UI shell | FAL_API_KEY + IDEOGRAM_API_KEY not set. Routes return 503. |
| Higgsfield video generation | Stub | HIGGSFIELD_API_KEY not set. Asset page shows UI but no generation. Visual Studio generates prompts but can't submit to Higgsfield yet. |
| Smart Resize (`/tools/resize`) | Partial | Routes exist; UI not fully wired end-to-end. |
| Error handling sweep | In progress | Silent catch blocks across API routes need `console.error` + proper error returns. |
| Real-time subscriptions | Not built | No Supabase `realtime().on()` subscriptions. Updates require page refresh. |
| Crisis Mode → Publishing queue | Partial | Crisis state persists in DB but doesn't block scheduled posts in all flows. |
| Per-client pipeline view | Not built | `/pipeline?client=id` filter works but no dedicated page. |
| Peak Format Generator favorites persistence | Planned | Page + API built. Saving favorites to `format_favorites` table not yet wired. |

## Key Conventions

**Client Components:** Any file using hooks, event handlers, browser APIs, or lucide-react icons must have `'use client'` at the top. lucide-react v1 icons cannot be used in Server Components.

**Styling:** Use `cn()` from `@/lib/utils` for conditional classes. Never inline style for design-system colors. Inline style only for dynamic values (e.g. `client.color`).

**Stage config:** Always use `STAGE_CONFIG[stage]` from `lib/utils.ts`. Never hardcode stage strings.

**Platform icons:** Use `<PlatformIcon platform={key} size="xs|sm"/>` from `@/components/ui/platform-icon.tsx`. Always pass a lowercase `SocialPlatform` key (`'instagram'`, `'twitter'`, etc.) — not the display name (`'X (Twitter)'`). Use the `toPlatformKey()` helper (in `studio-document.tsx`) to normalise display names before passing to `PlatformIcon`. `PlatformIcon` handles unknown keys with a fallback badge — it will not crash.

**No mock data:** `lib/mock-data.ts` is deleted. If you need test data, seed the real Supabase DB. Never recreate a mock-data file.

**API routes:** All in `app/api/`. Node.js runtime only. AI routes must check rate limit. Use `createAdminClient()` from `lib/supabase.ts` for server-side Supabase access. Always destructure `{ data, error }` from Supabase calls and check `error` before proceeding.

**Error handling pattern:**
```ts
// Always do this:
const { data, error } = await supabase.from('table').select(...)
if (error) {
  console.error('[route-name] Context:', error.message)
  return NextResponse.json({ error: error.message }, { status: 500 })
}
// Never do this:
catch { } // silent swallow
```

**Type safety:** Import types with `import type { ... }` when import is type-only.

**No emojis:** Never add emojis to UI text, labels, buttons, or AI output. Icons only.

**User creation:** Never create users via raw SQL — always use Supabase Dashboard UI. Raw SQL breaks GoTrue password hashing → 500 on login.

**brief-confirm route:** Has two modes. Default mode returns `BriefConfirmation` (requires `platforms`, `goal`, `audience`). `mode: 'boss_brief'` returns `{ boss_brief: BossBrief }` — only requires `brief`. Both content and strategy pages use boss_brief mode.

**ContentDocument multi-piece:** `doc.pieces?: ContentPiece[]` holds multiple generated pieces. Each `ContentPiece` has `type` (reel/carousel/static), `hook`, `script_sections` (reel), `slides` (carousel), `visual_direction`/`text_overlay` (static). Backward-compat: root-level fields (`hook`, `script_sections`, etc.) always mirror the first piece.

## Environment Variables

```
# Supabase (configured)
NEXT_PUBLIC_SUPABASE_URL=https://jvilhgyatwhgcahmwzgd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# AI — CRITICAL: ANTHROPIC_API_KEY is empty, falls back to Gemini
ANTHROPIC_API_KEY=          ← SET THIS FOR PRODUCTION
GEMINI_API_KEY=...          (configured)

# Metricool (configured)
METRICOOL_API_TOKEN=...
METRICOOL_USER_ID=4837620

# Email (configured)
RESEND_API_KEY=...
RESEND_FROM_ADDRESS=NOVAX Ops <noreply@perfumeexhibition.com>

# Google Drive (configured)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Apify / trends (configured)
APIFY_API_KEY=...
YOUTUBE_API_KEY=...
TRENDSMCP_API_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://perfumeexhibition.com
CEO_EMAIL=novaaxone@gmail.com
CRON_SECRET=novax-cron-2026

# Not configured (stubs only)
RESPOND_IO_API_KEY=
RESPOND_IO_WEBHOOK_SECRET=
HIGGSFIELD_API_KEY=
FAL_API_KEY=
IDEOGRAM_API_KEY=
```

## Deployment

- **Platform:** Vercel
- **URL:** https://perfumeexhibition.com
- **Runtime:** Node.js (NOT Edge Functions)
- **Auth:** Supabase Auth (handles sessions, tokens, RLS automatically)
- **Cron:** Vercel Cron Jobs configured in `vercel.json` — use `CRON_SECRET` for auth

## Dev Commands

```bash
cd agency-ops
npm run dev       # Start dev server with Turbopack (localhost:3000)
npm run build     # Production build check
npx tsc --noEmit  # TypeScript check without building
```
