# NOVAX Ops — Final Build Plan
_Written: 2026-09-29 · Single source of truth for finishing the platform_

---

## Section 1 — Current State Summary

Everything listed here is built, wired to real Supabase data, and deployed to production.

### Auth & Core Shell
- ✅ Login page — NOVAX-branded, email/password, Supabase Auth
- ✅ Onboarding — first-login: set name, phone, password; clears `needs_onboarding`
- ✅ `middleware.ts` — protects all `/(app)/*` routes, redirects unauthenticated to `/login`
- ✅ `lib/auth-context.tsx` — AuthProvider, `onAuthStateChange`, fetches profile from `public.users`
- ✅ Role preview mode (admin only)
- ✅ Full app shell — sidebar, header, dark/light ThemeProvider
- ✅ NOVAX branding — dark teal `#1B3D38`, logo mark SVG
- ✅ Sidebar live badge counts — pending approvals + moderation from Supabase
- ✅ Notifications panel — real data from `audit_log` via `useNotifications()`
- ✅ Page permissions system — admin restricts pages per user, enforced at route level
- ✅ Mobile sidebar + responsive layout

### Main Pages (all on real Supabase data)
- ✅ Dashboard — live KPI stats, weekly activity chart, Metricool overview widget
- ✅ Pipeline — 10-stage Kanban, drag-and-drop, real task CRUD
- ✅ Tasks — My Tasks: assigned to current user, search + filter
- ✅ Clients — cards + detail modal (Overview/Intelligence/Tasks tabs)
- ✅ New Client Wizard — 9-step modal
- ✅ Projects — progress bars, stage distribution
- ✅ Publishing — Grid + Calendar view, Compose (EN/AR/Both), Generate Calendar
- ✅ Approval — internal management + shareable token links + client email notification
- ✅ Public Approval Portal (`/approval/[token]`) — per-post approve/request-changes/notes
- ✅ Moderation — comment queue, AI reply (Claude/Gemini)
- ✅ Assets — library + Google Drive import + Supabase Storage upload
- ✅ Creative Eval — upload image/video → Claude AI scoring
- ✅ Workload — per-member load bars, overloaded/healthy badges
- ✅ Content Library — published posts as reusable templates
- ✅ Reports — KPI charts, Claude narrative, Metricool data, PPTX + PDF export
- ✅ Settings — integrations config (admin), team + bulk-invite, bulk page-permissions
- ✅ CEO Hub — strategy analysis, crisis override, second opinion (Claude)
- ✅ AI Assistant (`/assistant`) — context-aware chat, scoped to client or task
- ✅ Documents — Tiptap rich text editor, templates, public sharing via token
- ✅ Studio Hub — links to all studio tools, recent session list

### Studio Tools
- ✅ Content Studio (`/studio/content`) — Reel/Carousel/Static, 1–3 pieces, expandable cards, Boss Brief
- ✅ Hook Lab (`/studio/hooks`) — 20 divergent hooks → 3C scoring → top 3
- ✅ Strategy (`/studio/strategy`) — Esplanade-format quarterly strategy, PPTX export
- ✅ Campaign Igniter (`/studio/campaign`) — cultural tensions → 5 execution briefs
- ✅ Inspiration Board (`/studio/inspiration`) — live trends (Apify), save to client boards
- ✅ Post-Mortem (`/studio/postmortem`) — performance diagnosis (Claude)
- ✅ Visual Content Engine (`/studio/visual`) — approach → scene prompts (Higgsfield-ready)
- ✅ Peak Format Generator (`/studio/formats`) — 5 viral formats per niche, hook stacks

### Client Intelligence Layer
- ✅ `client_context_bank` table — wins, brand voice, objections, signals per client
- ✅ `ai_feedback` table — thumbs-up/down on outputs feeds future prompts
- ✅ `lib/client-intelligence.ts` — `buildClientIntelligenceBlock()` injected into all AI calls
- ✅ AI feedback buttons on all studio outputs
- ✅ Save output to task / document / context bank

### Fixes Applied This Session
- ✅ Crisis toggle — now reads and writes `is_in_crisis` correctly
- ✅ Client delete — added with confirmation modal
- ✅ Client "Paused" status — added alongside Active/Inactive/Prospect
- ✅ URL deep links — `/clients?id=xxx` opens correct client on reload
- ✅ Canvas overflow — buttons no longer clipped on smaller screens
- ✅ AI Image page — replaced with explicit stub (returns 503 with clear message)
- ✅ Gemini model string — normalized to `gemini-3-flash-preview` everywhere
- ✅ Loading states — `retry: 1` added to all key TanStack Query hooks
- ✅ Pinterest inspiration — Apify gate removed, now unblocked

---

## Section 2 — Remaining Build (4 Weeks)

### Week 1 — Stability & Monitoring (current sprint)

**Employee controls (Settings > Team):**
- Add "Remove from platform" action per user row
  - Sets `users.status = 'inactive'`
  - Calls Supabase Admin API: `supabase.auth.admin.deleteUser(user.id)` to revoke their session
  - Confirmation modal: "This will immediately sign [name] out and block all access."
  - Route: `DELETE /api/users/[id]`
- Add "Force password reset" action per user row
  - Calls Resend: sends branded "Your password has been reset" email with a Supabase magic link
  - Route: `POST /api/users/[id]/force-reset`
  - Uses `supabase.auth.admin.generateLink({ type: 'recovery', email })`
- Both actions: admin-only, require confirmation, write to `audit_log`

**Sentry error logging:**
- Install: `npm install @sentry/nextjs`
- Wire into `app/layout.tsx` — client-side error boundary
- Wire into every API route — structured `captureException` with user ID + route context
- `sentry.server.config.ts` and `sentry.client.config.ts` at repo root
- DSN stored in `.env.local` as `SENTRY_DSN`
- User context: `Sentry.setUser({ id: user.id, email: user.email, role: user.role })`

**Microsoft Clarity:**
- Add script tag in `app/layout.tsx` inside a `<Script>` component (Next.js `Script` with `strategy="afterInteractive"`)
- Gate behind env var `NEXT_PUBLIC_CLARITY_ID` — if unset, no script loads
- Track as admin analytics only — does not change user experience

**Migration 038:**
- Run `sql/038_enhanced_cost_tracking.sql` in Supabase SQL editor
- This adds `ai_model_pricing` table and enhanced columns to `api_usage`

---

### Week 2 — Cost Tracking + Email Notifications

**Token-level cost tracking (wire into all AI routes):**

All AI routes currently call Claude or Gemini but do not log costs. Fix this universally:

```typescript
// After every AI call, insert into api_usage:
await supabase.from('api_usage').insert({
  user_id: userId,
  client_id: clientId,         // null if not client-scoped
  route: '/api/studio/content',
  agent_type: 'content',
  ai_model: model,
  input_tokens: usage.input_tokens,
  output_tokens: usage.output_tokens,
  cost_usd: calculateCost(model, usage.input_tokens, usage.output_tokens),
  cost_egp: costUsd * EGP_RATE,  // EGP_RATE from env or fixed at 50
  created_at: new Date().toISOString(),
})
```

Pricing constants in `lib/ai-client.ts`:
```typescript
export const MODEL_PRICING_USD = {
  'claude-sonnet-4-6':  { input: 0.003, output: 0.015 },  // per 1K tokens
  'claude-opus-4-7':    { input: 0.015, output: 0.075 },
  'gemini-3-flash-preview': { input: 0.000075, output: 0.0003 },
}
```

**Cost dashboard (Settings > Activity tab):**
- Filter by: user, client, date range, model
- Chart: EGP spend by day (Recharts `AreaChart`)
- Table: top 10 most expensive routes this month
- Total EGP spend for current month (large KPI card)
- Visible to: admin, ceo, creative_director

**Email notifications — expand beyond task.assigned:**

All notifications via Resend. New triggers to wire:

| Event | Recipient | Template |
|---|---|---|
| `task.overdue` | Assignee | "Task overdue: [title] — was due [date]" |
| `stage.changed` | Assignee + task creator | "[Task] moved to [Stage] by [User]" |
| `approval.submitted` | Account manager + CEO | "[Client] submitted approval for [# posts]" |
| `crisis.activated` | CEO + all account managers | "CRISIS MODE activated for [Client] by [User]" |
| `user.invited` | Invited email | Branded invite with onboarding link (already partially built — polish only) |

CEO weekly digest (already in cron at `GET /api/cron/daily-digest`):
- Upgrade content: include top 5 tasks at risk, AI cost this week, pending approvals count, new clients added
- Send every Sunday at 8am (update `vercel.json` cron schedule)

---

### Week 3 — Agent System + Arabic

#### Named Agent System

Five agents replace the Studio sidebar. Each agent is a named character with a distinct prompt, not just a renamed route.

**Architecture:**
- New page: `/agents` — agent selection hub showing all 5 with brief descriptions
- Each agent links to a dedicated session page: `/agents/[slug]` (e.g. `/agents/zara`)
- Session is backed by the existing `studio_sessions` table — add `agent_slug TEXT` column (migration 039)
- All agent routes call existing backend routes — agents are a prompt + personality layer on top

**Agent 1 — Zara (Copywriting)**
- Slug: `zara`
- Color: `#C47FA8` (warm rose)
- Backed by: `/api/studio/content` + `/api/ai` (agent_type: `copywriter`)
- Specializes in: captions, CTAs, copy variants, email subject lines
- UI entry: also accessible from task detail panel as "Ask Zara" button (replaces current copywriter agent button)

**Agent 2 — Nexus (Strategy)**
- Slug: `nexus`
- Color: `#4A90D9` (confident blue)
- Backed by: `/api/studio/strategy` + `/api/studio/campaign`
- Specializes in: quarterly strategy, campaign planning, trend analysis

**Agent 3 — Canvas (Content Creation)**
- Slug: `canvas`
- Color: `#7B68EE` (creative purple)
- Backed by: `/api/studio/hooks` + `/api/studio/content`
- Specializes in: reels, carousels, hooks, format selection

**Agent 4 — Pulse (Media Buying)**
- Slug: `pulse`
- Color: `#F5A623` (data amber)
- Backed by: `/api/studio/postmortem` + competitor analysis routes
- Specializes in: performance analysis, best posting times, competitor gaps, ROI framing

**Agent 5 — Director (Creative Evaluator)**
- Slug: `director`
- Color: `#E84B3A` (critical red)
- Backed by: `/api/creative-eval`
- Specializes in: scoring work, giving harsh honest feedback, identifying what to cut or redo

**Agent session page structure (`/agents/[slug]/page.tsx`):**
1. Agent header — name, color stripe, tagline, current client selector
2. Context panel — shows injected client intelligence (collapsible)
3. Chat interface — same as `/assistant` but with agent-specific system prompt
4. Output panel — structured results per agent type (not just raw text)
5. Save controls — save to task / document / context bank (reuse `studio-save-actions.tsx`)

#### Arabic/English Language Toggle

Store preference in `users` table — add column via migration 039:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'ar', 'auto'));
```

`auto` = detect from client's primary language in `brand_identity_json`.

Inject into every AI system prompt:
```
LANGUAGE: Respond in [Arabic / English]. [If Arabic: use Modern Standard Arabic unless the client's dialect rules specify otherwise. Apply all rules from the arabic_knowledge_base for this client.]
```

UI: Toggle in header (globe icon → EN/AR/Auto dropdown). Preference saved via `PATCH /api/users/me`.

#### Anti-AI Output Layer

Injected into every agent and studio system prompt as a non-negotiable RULES block:

```
BANNED PHRASES — never use any of these words or phrases:
delve, certainly, I'd be happy to, as an AI, as a language model, game-changer, leverage (as a verb), unlock your potential, in today's fast-paced world, seamlessly, revolutionize, transformative, elevate your brand, take your [X] to the next level, it's important to note, please note that, at the end of the day, move the needle, synergy, holistic approach, cutting-edge, innovative solution, stay ahead of the curve

WRITING STANDARD: Write like a senior human professional at a world-class creative agency. Be direct. Be specific. Use concrete language. Give opinions, not hedges. Never start a sentence with "I".
```

#### Saudi Arabia + Egypt Events Calendar

Static JSON at `lib/data/regional-events.json`. Format:

```json
[
  {
    "name": "Ramadan",
    "type": "islamic",
    "markets": ["sa", "eg", "ae"],
    "start_approx": "month-03",
    "notes": "Content shifts to family, reflection, generosity. Avoid hard-sell. Iftar moment is prime engagement window."
  },
  {
    "name": "Saudi National Day",
    "type": "national",
    "markets": ["sa"],
    "date": "09-23",
    "notes": "Pride, identity, heritage. Green and white palette. Campaign window: 2 weeks before."
  }
  ...
]
```

Full list to populate: Ramadan, Eid al-Fitr, Eid al-Adha, Saudi National Day (Sep 23), Egypt Revolution Day (Jul 23), UAE National Day (Dec 2), Back-to-School (Aug/Sep), Summer season start (Jun), White Friday / Black Friday, Cairo International Book Fair (Jan/Feb), Saudi Founding Day (Feb 22), Mother's Day (Mar 21 — Egypt/KSA), Valentine's Day.

Injection function in `lib/regional-events.ts`:
```typescript
export function getUpcomingEvents(markets: string[], weeksAhead = 6): RegionalEvent[]
```

Called inside `buildClientIntelligenceBlock()` — appended as:
```
UPCOMING RELEVANT EVENTS (next 6 weeks):
- [Event name] in [X days]: [notes]
```

---

### Week 4 — Polish + Handoff

**Mobile layout audit:**
- Walk every page at 375px width (iPhone SE viewport)
- Fix: tables that overflow horizontally → use card layout on mobile
- Fix: modals that are too tall → add `overflow-y-auto max-h-[90vh]` to all modal bodies
- Fix: sidebar in mobile — verify hamburger menu opens correctly on all pages
- Priority pages to check: Pipeline (Kanban), Publishing (Calendar), Settings (tabs)

**Dark mode gap fixes:**
- Audit all components added in the last sprint for missing `dark:` variants
- Common gaps: `bg-white` without `dark:bg-zinc-900`, `text-gray-900` without `dark:text-gray-100`, borders without dark counterparts
- Tool: search for `bg-white` and `text-gray-900` across all new components

**End-to-end test suite (Playwright):**

5 critical flows to cover:

```typescript
// tests/e2e/
1. auth.spec.ts       — Login → verify dashboard loads → logout
2. pipeline.spec.ts   — Create task → drag to next stage → verify DB update
3. publishing.spec.ts — Compose post → select client → schedule → verify in calendar
4. approval.spec.ts   — Create approval request → open public portal → approve a post
5. studio.spec.ts     — Open Content Studio → enter brief → generate → verify output cards
```

**Handoff documentation:**
- Update `CLAUDE.md` — reflect all new routes, agents, migrations, environment variables
- Update `docs/TODO.md` — mark completed items, add new known issues found in mobile audit
- Environment variable checklist: document every required variable and where to set it in Vercel

**Final Vercel deployment check:**
- Run `npm run build` locally — fix all TypeScript errors
- Run `npx tsc --noEmit` — zero errors required before deploy
- Verify all environment variables are set in Vercel production settings
- Confirm `ANTHROPIC_API_KEY` is set (currently missing — critical for agents)
- Test cron jobs: manually call each cron endpoint with `CRON_SECRET` header and verify 200 response

---

## Section 3 — Architecture Decisions (Locked)

These are final decisions. Do not re-evaluate without a specific technical reason.

### AI Stack

**Primary:** Claude via `@anthropic-ai/sdk`
- Standard tasks: `claude-sonnet-4-6`
- Complex / strategy / Boss Brief: `claude-opus-4-7`
- Always use versioned model strings — never aliases like `claude-3-sonnet`

**Fallback:** Gemini via `lib/gemini.ts`
- Model: `gemini-3-flash-preview` — this exact string, never changed, never updated without explicit decision
- Used when `ANTHROPIC_API_KEY` is not set

**Voice (when built):** Gemini Live API via `@google/genai`
- Model: `gemini-2.0-flash-live-001`
- Not `@google-generative-ai` (old SDK) — the new `@google/genai` SDK only

**Cost tracking:** All AI calls must write to `api_usage` with input_tokens, output_tokens, cost_usd, cost_egp. No exceptions. This is not optional instrumentation — it is a billing prerequisite for SaaS.

### Error Monitoring
**Tool:** `@sentry/nextjs`
- Not Highlight.io, not Datadog, not custom logging
- Free tier: 5K errors/month — sufficient until SaaS launch
- Every API route and every client-side error boundary wires to Sentry

### Analytics
**Tool:** Microsoft Clarity (free, no data limits)
- Script tag only — no SDK
- Admin-only insight, invisible to all other roles

### Rate Limiting
**Current:** In-memory (not production-safe — resets on cold start)
**Replace with:** `@upstash/ratelimit` + `@upstash/redis`
- Upstash Redis free tier: 10K requests/day — sufficient for internal use
- One global config in `lib/rate-limit.ts`
- Applied to all `/api/ai*` and `/api/studio/*` routes

### PDF Export (Phase 2)
**Current:** `@react-pdf/renderer` — acceptable for now
**Replace with (Week 4 or post-launch):** Puppeteer + `@sparticuz/chromium-min`
- Pixel-perfect output, real CSS rendering, charts as SVG
- Deploy as a separate Vercel Function with 60s timeout
- Arabic RTL support via `dir="rtl"` HTML attribute (not supported in @react-pdf)

### Testing
**E2E:** `@playwright/test`
- Tests in `tests/e2e/`
- Run with `npx playwright test`
- CI: add to GitHub Actions workflow

**Unit:** `vitest`
- Tests in `__tests__/`
- Focus: utility functions, prompt builders, cost calculators
- Run with `npx vitest`

### Immovable Constraints
- **No edge functions — ever.** `export const runtime = 'edge'` is banned. All Vercel Functions use Node.js runtime.
- **No mock data — ever.** `lib/mock-data.ts` is permanently deleted. Never recreate it.
- **No react-beautiful-dnd.** Use `@dnd-kit` only.
- **No Tailwind config file.** Tailwind v4 uses CSS-native config in `globals.css` only.

---

## Section 4 — Agent System Prompt Template

All 5 agents use this structure. Fill in the bracketed fields per agent.

```
You are [NAME], [ROLE] at NOVAX — a social media agency based in the Gulf and Egypt markets.

PERSONALITY:
[2–3 sentences. Describe how this agent speaks: formal/informal, confident/collaborative, direct/exploratory. What makes their voice distinctive from the others.]

YOUR JOB:
[1–2 sentences. What this agent does specifically. What it does NOT do (clear boundary with other agents).]

CLIENT CONTEXT:
Client: [client.name]
Industry: [client.industry]
Tone of voice: [client.brand_identity.tone_of_voice]
Target audience: [client.brand_identity.target_audience]
Platform presence: [client.social_platforms joined]
Recent wins: [from client_context_bank where type='win', last 3]
Recent objections: [from client_context_bank where type='objection', last 2]
Past AI feedback: [from ai_feedback where rating='positive', last 3 outputs for this client]

UPCOMING EVENTS:
[Injected from getUpcomingEvents(client.markets, 6)]

LANGUAGE:
[Injected per user preference: "Respond in Arabic." or "Respond in English."]
[If Arabic: use Modern Standard Arabic unless client dialect rules override. Apply all entries from arabic_knowledge_base for this client.]

RULES:
- Never use: delve, certainly, I'd be happy to, as an AI, as a language model, game-changer, leverage (verb), unlock your potential, in today's fast-paced world, seamlessly, revolutionize, transformative, elevate your brand, synergy, holistic approach, cutting-edge, innovative solution
- Write like a senior human professional. Be direct. Be specific. Use concrete language.
- No hashtags unless explicitly requested in the task.
- No emojis unless explicitly requested in the task.
- No generic advice. Every recommendation must be specific to this client, their audience, and their market.
- Do not start any sentence with "I".
[AGENT-SPECIFIC RULES — add 2–4 rules unique to this agent's domain]

OUTPUT FORMAT:
[Agent-specific. Examples:]
[Zara: structured variants with label + copy + CTA for each]
[Nexus: numbered strategic recommendations with rationale]
[Canvas: hook + format spec + visual notes per piece]
[Pulse: table of findings + recommended action per insight]
[Director: score (1–10) per dimension + specific redline notes + one-line verdict]
```

### Per-Agent Rules Additions

**Zara (Copywriter):**
- Every copy output must have 3 variants: Aspirational, Benefit-led, Conversational
- Always include a CTA for each variant
- If the client is Arabic-language primary, provide Arabic copy alongside English

**Nexus (Strategist):**
- Always connect strategy to platform-specific behavior, not generic best practices
- Reference at least one regional market insight per recommendation
- Strategy outputs must include a "What could go wrong" section

**Canvas (Content Creator):**
- Always specify content format (Reel / Carousel / Static) before describing content
- Hooks must be under 7 words for Reels
- Carousel outputs must include a slide-by-slide breakdown

**Pulse (Media Buyer):**
- Every insight must be backed by a metric, not an opinion
- Performance recommendations must include a test hypothesis ("If we [change X], we expect [metric Y] to improve by [estimate Z]")
- Never suggest a platform without citing a reason based on the client's current data

**Director (Creative Director):**
- Score work on 5 dimensions: Brand Fit, Hook Strength, Visual Direction, CTA Clarity, Engagement Prediction
- Each score 1–10 with one sentence explaining the score
- Give one "Fix This First" action — the single highest-leverage change
- Be direct. Do not soften feedback. "This doesn't work because X" not "This could potentially be improved by considering Y"

---

## Section 5 — Open Questions / CEO Decisions Needed

These items are blocked on a decision. Nothing below can be built until the decision is made.

**1. Voice mode timing**
Build in Week 3 alongside agents, or defer until after launch?
- Week 3 option: adds ElevenLabs TTS + browser Web Speech API + streaming to `/agents/[slug]`
- Deferral option: agents launch text-only; voice is a post-launch feature
- Recommendation: defer. Voice adds significant complexity and the text agents already provide the core value. Revisit at Q1 2027.
- Decision needed from: CEO

**2. Upstash Redis account**
Who creates the Upstash account for production rate limiting?
- Free tier URL + token must go into Vercel environment variables as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Takes 5 minutes to create at console.upstash.com
- Decision needed from: Admin (can be done by developer)

**3. ANTHROPIC_API_KEY**
Must be set in Vercel before Week 3 agent work begins. Without it, all agents fall back to Gemini, which produces noticeably lower quality output and lacks vision capabilities.
- Set in: Vercel Dashboard → Project Settings → Environment Variables → Production
- Decision needed from: Admin (has the key)

**4. Notification email domain**
Current `RESEND_FROM_ADDRESS` is `noreply@perfumeexhibition.com` — this is the wrong brand for a social media ops platform.
- Option A: Change to `noreply@novaxops.com` (requires domain DNS setup in Resend)
- Option B: Keep perfumeexhibition.com temporarily (no action needed)
- For SaaS, it must be novaxops.com before external agencies are onboarded
- Decision needed from: CEO — timeline preference

**5. Sentry plan**
Free tier covers 5,000 errors/month. For production with active team use, this is likely sufficient for 6 months.
- Free tier: sign up at sentry.io, copy DSN into `SENTRY_DSN` env var
- Decision needed from: Admin (5-minute setup, no cost)

**6. EGP exchange rate**
Cost tracking in EGP requires a rate. Options:
- Option A: Fixed rate hardcoded in env var `EGP_RATE=50` — simple, no external dependency
- Option B: Fetch live rate from a free currency API daily — more accurate, adds complexity
- Recommendation: Option A. The absolute precision of EGP cost matters less than having the data at all.
- Decision needed from: CEO preference

---

_End of document. This file is the single source of truth. Update it when decisions are made or work is completed._
