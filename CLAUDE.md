# NOVAX Ops — Project Context

## What this is

A unified operations platform for a social media/creative agency called **NOVAX**. Replaces ClickUp. Centralises the full content pipeline (Strategy → Publishing → Reporting) with AI assistance at every stage, client management, social publishing via Metricool, comment moderation via Respond.io, and asset management.

The system is **fully owned and self-hosted** by the agency. There is no white-labelling concern — this is an internal tool.

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
| TanStack Query | v5.100+ | v4 is legacy, do not use |
| @dnd-kit/core | ^6.3.1 | Pipeline drag-and-drop |
| @dnd-kit/sortable | ^10.0.0 | |
| Recharts | ^3.8.1 | Charts on dashboard + reports |
| Zod | ^4.4.1 | Validation. v4 is ~14x faster than v3 |
| lucide-react | ^1.14.0 | **Icons are Client Components in v1 — cannot use in Server Components. Brand icons (Instagram, LinkedIn, YouTube) were removed in v1 — use `<PlatformIcon>` instead** |
| date-fns | ^4.1.0 | v4 adds timezone support |
| pptxgenjs | ^4.0.1 | Presentation generation |
| clsx + tailwind-merge | latest | Use `cn()` from lib/utils.ts |

**Planned additions (not yet installed):**
- `@supabase/supabase-js` v2 — when database is connected
- `fal-ai/client` — Flux 2 image generation ($0.03/image)
- `@ideogram/api` or fetch — Ideogram 3.0 image generation ($0.03/image, best for text-in-image)
- `googleapis` — Google Drive OAuth + file browser
- `docx` or `jsPDF` — if document export is added alongside pptxgenjs
- Higgsfield SDK / fetch — AI video generation (cinematic, character-consistent)

**Do NOT add (production):**
- react-beautiful-dnd (deprecated, use @dnd-kit)
- Vercel Edge Functions (`export const runtime = 'edge'`) — deprecated, use Node.js Vercel Functions

**AI model strategy:**
- Development/testing: Gemini (cost) via `@google/generative-ai` or REST — env var: `GEMINI_API_KEY`
- Production: Switch all AI routes to Claude (`claude-sonnet-4-6` / `claude-opus-4-7`) — env var: `ANTHROPIC_API_KEY`
- Keep model provider abstracted behind a single `lib/ai-client.ts` so the swap is one config change

## Database (Supabase — not yet connected)

SQL migrations are written and ready at `sql/001_initial_schema.sql`. Run this in the Supabase SQL editor when connecting the database. Do not run it again — it is a one-time migration.

**13 tables:**
```
users               Core user profiles (mirrors auth.users)
clients             Client brands with brand_identity_json
projects            Campaigns per client
tasks               The core unit — lives in one pipeline_stage
ai_responses        Cached AI outputs (keyed by prompt_hash)
assets              Higgsfield + uploaded + Drive-imported files
scheduled_posts     Content scheduled via Metricool
moderation_items    Comments/DMs from Respond.io
presentations       Generated .pptx files
integrations        Encrypted third-party credentials
api_usage           Per-call cost tracking (Claude, Higgsfield, etc.)
reports             Generated performance reports
audit_log           Every action logged with user + timestamp
```

**RLS is enabled on all tables.** Policies are role-based. See `sql/001_initial_schema.sql` for full policy definitions.

**Realtime** is enabled for: `tasks`, `moderation_items`, `scheduled_posts`, `ai_responses`

## Project File Structure

```
agency-ops/
├── app/
│   ├── layout.tsx                  Root layout (Geist font, globals.css, title: "NOVAX Ops")
│   ├── page.tsx                    Redirects to /dashboard
│   ├── globals.css                 Tailwind v4 + shadcn CSS vars + NOVAX palette + sidebar vars
│   ├── approval/
│   │   └── [token]/page.tsx        PUBLIC client-facing approval portal (no auth, no sidebar)
│   └── (app)/                      Route group — all authenticated pages
│       ├── layout.tsx              App shell: ThemeProvider + Sidebar + Header + main wrapper
│       ├── dashboard/page.tsx      Stats, charts, recent tasks, client health
│       ├── pipeline/page.tsx       10-stage Kanban board (drag-and-drop)
│       ├── clients/page.tsx        Client cards + detail modal (Overview/Intelligence/Tasks tabs) + Crisis Mode
│       ├── projects/page.tsx       Project cards with progress
│       ├── publishing/page.tsx     Post grid + Calendar view + Compose dialog + Generate Calendar dialog
│       ├── approval/page.tsx       Internal approval portal — manage + share approval requests
│       ├── moderation/page.tsx     Comment queue with AI reply
│       ├── assets/page.tsx         Asset library + Higgsfield video generation
│       ├── creative-eval/page.tsx  Upload image/video → AI scoring + suggestions
│       ├── workload/page.tsx       Team workload view — per-member load bars + task lists
│       ├── library/page.tsx        Content library — published posts as reusable templates
│       ├── reports/page.tsx        KPI charts + report builder
│       └── settings/page.tsx       Integrations (admin only) + Team + Notifications + Security
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx             Dark sidebar, nav items, NOVAX logo mark SVG, user profile
│   │   ├── header.tsx              Search, New Task, notifications bell (→ NotificationsPanel), theme toggle
│   │   └── notifications-panel.tsx Bell dropdown — 7 mock notifications, unread count, click-outside-close
│   ├── pipeline/
│   │   ├── pipeline-board.tsx      DndContext wrapper, state management
│   │   ├── pipeline-column.tsx     useDroppable, SortableContext
│   │   └── task-card.tsx           useSortable, priority/client/due date display
│   ├── tasks/
│   │   └── task-detail-panel.tsx   Slide-over: task meta + 5 AI agents + Copy Versioning (3 variants)
│   ├── clients/
│   │   └── new-client-wizard.tsx   9-step client onboarding modal (Identity→Social→Competitors→Brand→Tone→Audience→Strategy→Goals→Resources)
│   ├── settings/
│   │   └── invite-user-modal.tsx   Invite team member modal — role grid + email + success state
│   └── ui/
│       └── platform-icon.tsx       Custom branded platform icon (replaces missing lucide brand icons)
├── lib/
│   ├── types.ts                    All TypeScript interfaces and union types
│   ├── mock-data.ts                4 clients, 6 users, 5 projects, 21 tasks, 12 posts, 5 moderation items
│   ├── utils.ts                    cn(), STAGE_CONFIG, PRIORITY_CONFIG, PLATFORM_CONFIG, formatters
│   └── theme-context.tsx           ThemeProvider — dark/light toggle, localStorage persistence
├── sql/
│   └── 001_initial_schema.sql      Full schema + RLS + triggers + indexes — ready to run
└── next.config.ts                  Turbopack root set to resolve workspace warning
```

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

**UI visibility rules by role:**
- Integrations tab in Settings: `admin` only
- Metricool/Respond.io/Higgsfield labels: `admin` + `ceo` only. Everyone else sees "Scheduling Platform", "Messaging Platform", "Video Studio"
- Audit log: `admin` + `ceo` only
- API cost data: `admin` + `ceo` + `creative_director`
- Team management: `admin` only
- Client edit/create: `admin` + `creative_director` + `account_manager`

## Pipeline Stages (fixed — do not add or rename without updating DB enum)

```
strategy → ideas → calendar → copy → design → review → approval → scheduled → published → reporting
```

Each stage has a fixed color scheme defined in `lib/utils.ts` → `STAGE_CONFIG`. When adding new UI that references stages, always use `STAGE_CONFIG[stage].label/color/bg/border` — never hardcode stage display values.

## AI Architecture

**No open chat.** All AI calls are triggered by specific UI buttons per task/stage.

**Every AI call follows this sequence:**
1. Compute `prompt_hash = MD5(task_id + agent_type + stable_context_snapshot)`
2. Check `ai_responses` table for a matching hash with `is_cached = true`
3. If cache hit → return saved response instantly, zero API cost
4. If miss → build context-injected prompt → call Claude API → save response → return
5. After generation → run Reflection Agent (checks brand compliance, flags hallucinations)

**Context injected into every prompt:**
- Task title + description
- Pipeline stage
- Client brand identity (tone, audience, key messages, colors)
- Last 3 relevant AI outputs for this client
- Current user role (affects output formality)

**Agent types:**
- `task_analyzer` — Breaks down brief, flags missing info, suggests approach
- `copywriter` — Stage-aware copy generation with brand voice. Returns 3 variants (Aspirational / Benefit-led / Conversational) for user to select
- `researcher` — Market context, competitor gaps, trending hashtags
- `asset_finder` — Extracts keywords → prepares Higgsfield/Drive query
- `presentation_builder` — Generates slide structure → passes to pptxgenjs

**Output rules:**
- No hashtags or emojis in any AI output by default
- Only include hashtags/emojis when the task description explicitly requests them

**Claude models:**
- Primary: `claude-sonnet-4-6` (most tasks)
- Complex/strategy: `claude-opus-4-7` (quarterly planning, research)
- Always use versioned model strings — never aliases

**Rate limit:** 10 AI requests per user per minute (enforced in API route middleware)

## Integrations Map

| Integration | Purpose | Auth method | Who configures |
|---|---|---|---|
| Metricool | Publish + schedule + fetch performance | API token + blogId per client | Admin only |
| Respond.io | Receive comments/DMs, send replies | API key + webhook secret | Admin only |
| Higgsfield | AI video generation (cinematic, character-consistent) | API key | Admin only |
| Claude API (Anthropic) | All AI agents | API key | Admin only |
| Google Drive | Asset browser (planned) | OAuth 2.0 per user | Admin only |
| Flux 2 via fal.ai | AI image generation (planned) | API key | Admin only |
| Ideogram 3.0 | AI image gen with text (planned) | API key | Admin only |

**Webhook endpoints (configure in vendor dashboards):**
- Respond.io → `/api/webhooks/respond-io`
- Metricool publish confirmation → `/api/webhooks/metricool`

**Important Metricool constraint:** No OAuth flow — token only. Each client is a `blogId` under one agency Metricool account. Store the mapping in `clients.metricool_blog_id`.

**Important Respond.io constraint:** Instagram public comment replies are NOT supported via API (Instagram restriction) — only DM replies to commenters. Facebook public comment replies work fine. Respond.io does NOT support Google Reviews replies.

## Currently Built (Supabase connected — `.env.local` has URL + anon + service role keys)

### Core Shell
- [x] Full app shell (sidebar, header, layout) with ThemeProvider (dark/light mode, localStorage)
- [x] NOVAX branding: dark teal `#1B3D38`, NOVAX logo mark SVG in sidebar, `/public/icon.svg` favicon
- [x] Notifications bell dropdown — 7 mock notifications, 5 types, unread count, click-outside-close

### Main Pages
- [x] Dashboard (stats, charts, activity, client health)
- [x] Pipeline Kanban board (drag-and-drop, all 10 stages)
- [x] Task detail slide-over (5 AI agents, mock generation, cache indicator, **copy versioning — 3 selectable variants**)
- [x] Clients page (cards + **Crisis Mode per-client toggle**, detail modal with **Overview/Intelligence/Tasks tabs**, **SWOT analysis + market position + key insights**)
- [x] New Client Wizard — 9-step modal (Identity, Social profiles, Competitors, Brand, Tone/Voice, Audience, Content Strategy, Goals/KPIs, Resources)
- [x] Projects page (progress bars, stage distribution, quarter strategy)
- [x] Publishing page (**Grid view + Calendar view toggle**, Compose dialog with **EN/AR/Both language toggle**, **Generate Calendar dialog** — brief → AI content calendar)
- [x] Approval Portal — internal (`/approval`) approval request management + shareable links
- [x] Public Approval Portal (`/approval/[token]`) — client-facing review page, per-post approve/request-changes, notes, submit
- [x] Moderation page (comment queue, AI reply, send/escalate/ignore)
- [x] Assets page (library + Higgsfield video generation + AI keyword extraction)
- [x] Creative Evaluation page (`/creative-eval`) — upload image/video, AI scoring (brand fit, hook strength, visual quality, CTA clarity), engagement prediction, strengths/improvements/suggestions
- [x] Team Workload page (`/workload`) — per-member load bars, overloaded/at-capacity/healthy badges, overdue + high-priority counts, task list preview
- [x] Content Library page (`/library`) — published posts as reusable templates, filter by client/tag, star-save, one-click copy
- [x] Reports page (KPI charts, platform breakdown, report builder)
- [x] Settings page (integrations config, **team table + Invite Member modal**, notifications toggles, security)
- [x] SQL migrations file (all 13 tables, RLS, triggers, indexes)

### Mock Data
- 4 clients (Luxe Cosmetics, TechNova, Coastal Eats, FitForge)
- 6 users across all roles
- 5 projects
- 21 tasks across all pipeline stages
- 12 scheduled posts (updated to 2026 dates, May 2026 for calendar demo)
- 5 moderation items

## Planned (not yet built)

- [ ] Per-client pipeline view (`/pipeline?client=id` or `/clients/:id/pipeline`)
- [ ] Client profile inline editor + Knowledge Base (notes + file uploads per client)
- [ ] Role-based vendor name masking (`admin`/`ceo` only see real names — currently all roles see vendor names)
- [ ] Integrations tab hidden from all roles except `admin` (currently always visible)
- [ ] Reference document upload per client (feeds into report generation context)
- [ ] Report template upload + matching
- [ ] Google Drive OAuth + file browser in assets tab
- [ ] "Import from Drive" → Supabase Storage
- [ ] AI Image Creation page (Flux 2 for photos, Ideogram 3.0 for text-graphics)
- [ ] AI Video Creation page (Higgsfield — prompt/image → cinematic video)
- [ ] Studio / Gamma-style Presentation Builder (text → Claude → pptxgenjs → .pptx)
- [ ] Supabase client setup + replace mock data with real queries
- [ ] Auth flow (login, session management)
- [ ] Real AI API route handlers (Vercel Functions, Node.js runtime)
- [ ] Metricool API routes (schedule post, fetch analytics)
- [ ] Respond.io webhook handler + reply sender
- [ ] Higgsfield API route (generate video, poll job status, download to Storage)
- [ ] Crisis Mode persistence (currently local state in ClientsPage — needs to propagate to publishing queue)
- [ ] Approval Portal real link generation + email notification to client

## Key Conventions

**Client Components:** Any file using hooks, event handlers, browser APIs, or lucide-react icons must have `'use client'` at the top. lucide-react v1 icons are Client Components and cannot be used in Server Components.

**Styling:** Use `cn()` from `@/lib/utils` for conditional classes. Never use inline style for colors that are in the design system — use Tailwind classes. Use inline style only for dynamic values (like `client.color`).

**Stage config:** Always reference `STAGE_CONFIG[stage]` from `lib/utils.ts`. Never hardcode stage display strings.

**Platform icons:** Use `<PlatformIcon platform={p} size="xs|sm"/>` from `@/components/ui/platform-icon.tsx`. Do not import Instagram/Facebook/Linkedin/Youtube from lucide-react — they were removed in v1.

**Mock data:** All data lives in `lib/mock-data.ts`. When connecting to Supabase, replace imports from mock-data with TanStack Query hooks. Do not mix mock and real data in the same component.

**API routes:** All routes go in `app/api/`. Use Node.js runtime (no `export const runtime = 'edge'` — deprecated). AI routes must check rate limit before calling Claude.

**Type safety:** Import types with `import type { ... }` when the import is only used as a type. This enables better tree-shaking.

**No emojis:** Never add emojis to any UI text, labels, buttons, or AI output. Icons only.

## Supabase Setup (when ready)

1. Create project at supabase.com
2. Run `sql/001_initial_schema.sql` in the SQL editor
3. Create storage buckets: `assets` (public), `presentations` (private), `uploads` (private)
4. Enable Realtime for: tasks, moderation_items, scheduled_posts, ai_responses
5. Install: `npm install @supabase/supabase-js`
6. Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
7. Create `lib/supabase.ts` with client + server client setup
8. Replace mock data imports with real queries using TanStack Query v5

## Environment Variables (to be set in Vercel + .env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
METRICOOL_API_TOKEN=
RESPOND_IO_API_KEY=
RESPOND_IO_WEBHOOK_SECRET=
HIGGSFIELD_API_KEY=

FAL_API_KEY=
IDEOGRAM_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Deployment

- Platform: Vercel
- Runtime: Node.js (NOT Edge Functions — deprecated)
- Environment: Production env vars set in Vercel dashboard
- Auth: Supabase Auth (handles sessions, tokens, RLS automatically)

## Dev Commands

```bash
cd agency-ops
npm run dev       # Start dev server with Turbopack (localhost:3000)
npm run build     # Production build check
npx tsc --noEmit  # TypeScript check without building
```
