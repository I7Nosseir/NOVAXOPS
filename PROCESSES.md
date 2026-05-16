# NOVAX Ops — Platform Process Reference

> **Purpose:** Every process the platform runs, how each step works, what data flows through it, and where friction points exist. Use this document to audit, redesign, and improve flows.

---

## Table of Contents

1. [Client Initiation (Onboarding Wizard)](#1-client-initiation-onboarding-wizard)
2. [Task Lifecycle (Pipeline)](#2-task-lifecycle-pipeline)
3. [AI Agent Calls](#3-ai-agent-calls)
4. [Content Composition & Scheduling](#4-content-composition--scheduling)
5. [Content Calendar Generation](#5-content-calendar-generation)
6. [Approval Portal Flow](#6-approval-portal-flow)
7. [Moderation & Community Management](#7-moderation--community-management)
8. [Asset Management](#8-asset-management)
9. [Creative Evaluation](#9-creative-evaluation)
10. [Reports & Presentations](#10-reports--presentations)
11. [Team Management & Invites](#11-team-management--invites)
12. [Dashboard Aggregation](#12-dashboard-aggregation)
13. [Content Library](#13-content-library)
14. [Workload Monitoring](#14-workload-monitoring)
15. [Settings & Integrations Config](#15-settings--integrations-config)
16. [Data Layer & Auth](#16-data-layer--auth)
17. [Webhook Ingestion (Respond.io + Metricool)](#17-webhook-ingestion-respondio--metricool)

---

## 1. Client Initiation (Onboarding Wizard)

**File:** `components/clients/new-client-wizard.tsx`  
**Trigger:** "Add Client" button on the Clients page  
**Current state:** 9 steps, modal wizard

### Steps breakdown

| Step | Name | Fields | Purpose |
|------|------|--------|---------|
| 1 | Identity | Brand name, industry, website, country, timezone, contact name, email, contract start, package | Core identity — used as label on every UI card |
| 2 | Social Profiles | Instagram, Facebook, TikTok, LinkedIn, Twitter, YouTube, Pinterest links + primary platform selector | Feeds `PLATFORM_CONFIG` + Metricool `blogId` mapping |
| 3 | Competitors | Up to 5 entries — website, handle, type (direct/aspirational) | Injected into AI researcher + SWOT context |
| 4 | Brand Identity | Primary hex color, up to 3 secondary colors, visual style tags (8 options) | Color used on client cards + injected into copywriter prompts |
| 5 | Voice & Tone | 4 sliders (Formal↔Casual, Serious↔Playful, Informative↔Entertaining, Reserved↔Bold) + dos/don'ts lists | Direct input to `copywriter` and `researcher` agent system prompts |
| 6 | Target Audience | Age range, gender split %, locations (cities/countries), interests list, pain points list | Injected into all AI agent context blocks |
| 7 | Content Strategy | Content pillars (up to 6 with % allocation), preferred formats, posting frequency per platform | Feeds calendar generator + strategist AI |
| 8 | Goals & KPIs | Primary goal selection, KPI checkboxes (8 options), monthly post volume (4–120 slider) | Used in reports + project goal display |
| 9 | Resources | Language (EN/AR/Both), Google Drive folder URL, internal notes | Language setting controls caption composer + AI output language |

### Data output

All 9 steps merge into one `FormData` object that maps to the `clients` table in Supabase:
- `brand_identity_json` — stores steps 4–8 as a JSON column
- Core columns — name, industry, website, country, timezone, contact, contract_start, package

### Current friction points

- **9 steps is too long for a single session.** The wizard asks for information the agency may not have ready (competitor handles, tone sliders, KPI targets) before a client relationship is even established.
- Steps 5–8 require deep brand knowledge that usually comes from a discovery call — not available at the moment of system entry.
- No save-and-resume: closing the modal loses all progress.
- No AI-assist on any step (e.g., auto-filling brand color from website, suggesting audience based on industry).

### Proposed shorter flow

A redesigned flow separates **registration** (what you need now) from **enrichment** (what you complete over time):

**Phase 1 — Register (3 steps, takes 2 min):**
1. Identity — name, industry, website, primary platform, package
2. Social links — only the active platforms (not all 7)
3. Language + internal notes — the two most operationally urgent fields

**Phase 2 — Enrich (inline on client profile, done over time):**
- Brand tab: colors, visual style
- Tone tab: sliders, dos/don'ts
- Audience tab: demographics, interests
- Strategy tab: pillars, formats, frequency
- Competitors tab: competitor entries
- Goals tab: KPIs, monthly volume

This turns a 9-step barrier into a 3-step entry + an always-editable profile that gets richer over time.

---

## 2. Task Lifecycle (Pipeline)

**Files:** `components/pipeline/pipeline-board.tsx`, `components/pipeline/pipeline-column.tsx`, `components/pipeline/task-card.tsx`, `components/tasks/task-detail-panel.tsx`

### Stages (fixed order)

```
strategy → ideas → calendar → copy → design → review → approval → scheduled → published → reporting
```

Each stage has a fixed color defined in `lib/utils.ts → STAGE_CONFIG`. Never hardcode these.

### Task creation

1. User clicks "New Task" in the header.
2. Dialog opens: title, description, client, project, assignee, due date, priority, tags.
3. On submit → `INSERT` into `tasks` table with `pipeline_stage = 'strategy'` (default).
4. Task appears in the **Strategy** column.

### Task movement (drag-and-drop)

1. User drags a task card between columns using `@dnd-kit`.
2. `onDragEnd` fires → `useUpdateTaskStage()` mutation called.
3. Optimistic update: card visually moves immediately.
4. API call persists the new `pipeline_stage` to Supabase.
5. If the call fails → rollback to original position.
6. Realtime subscription (Supabase channel on `tasks`) broadcasts the change to other connected users.

### Task detail panel

Opens as a slide-over from the right. Contains:

| Section | Contents |
|---------|----------|
| Header | Title, stage badge, priority badge, client tag |
| Meta | Assignee avatar, due date, tags, project link |
| Description | Full brief text |
| AI Agents | 5 agent buttons (Task Analyzer, Copywriter, Researcher, Asset Finder, Presentation Builder) |
| Output area | Latest AI response for this task, cache indicator, copy button |
| Copy Versioning | 3 selectable variants (Aspirational / Benefit-led / Conversational) when copywriter agent has run |

### Pipeline velocity tracking

The dashboard reads `created_at` vs `updated_at` per stage to compute average days a task spends in each stage. This is displayed as "Pipeline Velocity" on the dashboard KPI strip.

---

## 3. AI Agent Calls

**File:** `lib/ai-client.ts`  
**Route:** `app/api/ai/route.ts`

### Call sequence (every agent follows this)

```
1. User clicks an agent button in the task panel
2. Frontend computes prompt_hash = MD5(task_id + agent_type + stable_context_snapshot)
3. Check ai_responses table: SELECT WHERE prompt_hash = ? AND is_cached = true
4. If HIT → return saved response immediately (zero cost, instant)
5. If MISS → build context-injected prompt (see below)
6. POST /api/ai → rate limit check (10 req/user/min)
7. Call Claude API (claude-sonnet-4-6 or claude-opus-4-7)
8. Save response to ai_responses table with is_cached = true, cost_usd recorded
9. Run Reflection Agent: checks brand compliance, flags hallucinations
10. Return response to frontend
```

### Context injected into every prompt

- Task title + full description
- Current pipeline stage
- Client brand identity (tone sliders, dos/don'ts, visual style, key messages)
- Competitor context (names, handles, type)
- Target audience (age, gender, interests, pain points)
- Last 3 AI outputs for this client (continuity memory)
- Current user role (affects output formality)
- Language setting (EN/AR/Both)

### Agent types

| Agent | Model | Input | Output |
|-------|-------|-------|--------|
| `task_analyzer` | sonnet-4-6 | Brief text | Completeness score, missing info flags, suggested approach |
| `copywriter` | sonnet-4-6 | Stage + brand context | 3 copy variants with framework tags (AIDA, PAS, STEPPS) |
| `researcher` | opus-4-7 | Client + competitor context | Market trends, content gaps, competitor weaknesses |
| `asset_finder` | sonnet-4-6 | Task keywords | Freepik search queries, keyword list for Drive search |
| `presentation_builder` | opus-4-7 | Task outputs + strategy | 12-slide structure → passed to pptxgenjs |
| `content_calendar` | sonnet-4-6 | Brief + month + frequency | 20–30 post schedule with dates, times, platforms, event anchors |
| `creative_eval` | sonnet-4-6 | Image/video (base64) + brand | 7-dimension score + suggestions |
| `moderation_reply` | sonnet-4-6 | Comment text + brand voice | Draft reply, 2 alternative tones |

### Output rules (enforced in system prompt)

- No hashtags or emojis by default
- Only include hashtags/emojis when the task description explicitly requests them
- Arabic output when `language = 'ar'`, bilingual when `language = 'both'`

### Cost tracking

Every call writes to `api_usage` table: `model`, `input_tokens`, `output_tokens`, `cost_usd`, `user_id`, `task_id`, `agent_type`. Dashboard reads this to show "AI Cost (Month)".

---

## 4. Content Composition & Scheduling

**File:** `app/(app)/publishing/page.tsx`

### Compose dialog flow

1. Click "Compose" button.
2. Select client from dropdown.
3. Select platforms (Instagram, Facebook, LinkedIn, TikTok, Twitter — multi-select).
4. Select language toggle: EN / AR / Both.
5. Upload media: drag-drop or click (PNG, JPG, MP4, max 50MB).
6. Write caption(s):
   - EN only: one text area (2200 char max)
   - AR only: one RTL text area
   - Both: two text areas side by side
7. Set schedule date + time (datetime picker).
8. Action: "Save Draft" → `status = 'draft'` | "Schedule" → `status = 'scheduled'` + Metricool API call.

### Metricool scheduling call

```
POST https://app.metricool.com/api/v2/post
Headers: X-Mc-Auth: {token}
Body: { blogId, content, platforms[], scheduledAt, mediaUrl[] }
```

On success → `scheduled_posts.metricool_post_id` saved. On webhook confirmation → `status = 'published'`.

### Publishing status lifecycle

```
draft → scheduled → published
              ↓
           failed (retry or manual reschedule)
```

### Grid vs Calendar view

| View | Shows | Filter options |
|------|-------|---------------|
| Grid | All posts as cards with status pill, platform icons, thumbnail | All / Scheduled / Published / Draft |
| Calendar | Month grid, posts as colored dots on dates | Navigate by month, click date to see posts |

---

## 5. Content Calendar Generation

**File:** `app/(app)/publishing/page.tsx` → "Generate Calendar" dialog

### Flow

1. Click "Generate Calendar".
2. Fill brief:
   - Client selector
   - Month + year
   - Brief description (campaign focus, events to cover)
   - Language (EN/AR/Both)
   - Posting frequency (per platform)
3. Click "Generate" → calls `content_calendar` agent.
4. Agent returns structured JSON: `[{ date, time, platform, type, title, anchorEvent, language }]`
5. Calendar renders as interactive list grouped by week.
6. Color coding:
   - Green dot = Islamic calendar event anchor
   - Blue dot = Global event anchor
   - Gray dot = Regular planned post
7. User can delete individual entries or regenerate.
8. Export options:
   - "Export to Excel" → `xlsx` generates RTL-aware spreadsheet
   - "Save to Publishing" → bulk-inserts all entries as `draft` `ScheduledPost` records

---

## 6. Approval Portal Flow

**Files:** `app/(app)/approval/page.tsx` (internal) · `app/approval/[token]/page.tsx` (client-facing, no auth)

### Internal side (agency)

1. Click "New Request".
2. Select client.
3. Select posts to include (from published or scheduled pool).
4. Set expiry (3 / 7 / 14 days).
5. Click "Create" → generates a unique token, inserts into `approvals` table.
6. "Copy Link" copies `https://yourdomain.com/approval/{token}` to clipboard.
7. Agency sends link to client via email/WhatsApp (manual step — no auto-email yet).
8. Request card shows status: **Pending** / **Approved** / **Changes Requested**.
9. Per-post status dots shown in card body.
10. Client notes displayed inline.

### Client side (public, no auth required)

1. Client opens link in browser.
2. Page loads posts for that token (read-only, no sidebar, no nav).
3. For each post: thumbnail, caption, platform, schedule date.
4. Client actions per post:
   - Approve (green check)
   - Request Changes (opens notes textarea)
5. Optional overall notes field.
6. Submit button → PATCH request updates `approvals` table with statuses + notes.
7. Agency sees updated status in internal portal.

### Data model

```
approvals
  token (uuid, public)
  client_id
  expires_at
  overall_status: pending | approved | changes_requested
  posts: [{ scheduled_post_id, status, client_notes }]
  created_by (user_id)
```

---

## 7. Moderation & Community Management

**File:** `app/(app)/moderation/page.tsx`  
**Data source:** Respond.io webhook → `moderation_items` table

### Ingestion flow

1. Comment or DM arrives on Instagram / Facebook / LinkedIn.
2. Respond.io receives it via platform API.
3. Respond.io fires POST to `/api/webhooks/respond-io` with payload.
4. Webhook handler validates secret, inserts `ModerationItem` into Supabase.
5. Supabase Realtime broadcasts to all connected sessions → moderation page updates live.

### Moderation queue flow

1. Item appears in queue with: platform icon, commenter handle, original comment, post context, timestamp.
2. Agent triggers available per item:
   - Click "Generate Reply" → `moderation_reply` agent builds brand-aware draft reply.
   - User edits draft in textarea.
3. Action buttons:
   - **Send** → POST to Respond.io API → reply published → `status = 'replied'`
   - **Escalate** → `status = 'escalated'` (flagged for manager review)
   - **Ignore** → `status = 'ignored'` (archived)

### Platform limitations

| Platform | DM Reply | Public Comment Reply |
|----------|----------|---------------------|
| Instagram | Yes | No (Instagram API restriction) |
| Facebook | Yes | Yes |
| LinkedIn | Yes | Yes |

Respond.io does NOT support Google Reviews replies.

### Filter tabs

All · Pending · Replied · Escalated

---

## 8. Asset Management

**File:** `app/(app)/assets/page.tsx`

### Asset library tab

Displays all saved assets with: thumbnail, source badge (Freepik Premium / Freepik Free / Client Upload), license indicator, tags, download button.

Filter by: client, type (image/illustration/video), source.

### Freepik search tab

1. Enter search query OR click "Extract from Tasks" → `asset_finder` agent reads active tasks and suggests keywords.
2. Results grid loads (via `/api/freepik?q={query}`).
3. Each result: thumbnail, license type, resolution, save button.
4. "Save to Library" → downloads file to Supabase Storage (`assets` bucket) + inserts `Asset` record.

### Asset record structure

```
assets
  client_id
  title
  type: image | illustration | video
  source: freepik | uploaded | drive
  license: premium | free | client_owned
  url (Supabase Storage path)
  tags[]
  created_by
```

---

## 9. Creative Evaluation

**File:** `app/(app)/creative-eval/page.tsx`

### Flow

1. Select client.
2. Upload file (drag-drop or click): PNG, JPG, MP4, max 50MB.
3. Click "Evaluate".
4. File converted to base64, POST to `/api/ai` with `agent_type = 'creative_eval'`.
5. Agent receives: file bytes, client brand identity, platform targets.
6. Response returns structured JSON with:

| Dimension | Description |
|-----------|-------------|
| Thumb-Stop Rate | Probability of halting scroll (0–100) |
| Emotional Resonance | Arousal intensity score |
| Brand Coherence | Visual + tonal alignment to brand guidelines |
| Message Clarity | Can the message be extracted in 3 seconds? |
| Visual Quality | Technical excellence (sharpness, composition, color) |
| Share & Save Potential | STEPPS framework score |
| Platform Fit | Optimization for target platform native format |

7. Additional outputs:
   - Overall score (weighted average)
   - Virality score ring (animated)
   - Engagement prediction: Low / Medium / High / Viral
   - Psychological triggers present
   - Viral elements detected
   - Missing elements for virality
   - Top 3 strengths
   - Top 3 improvements
   - Best platforms for this asset
   - A/B test suggestion (what variant to test)

---

## 10. Reports & Presentations

**File:** `app/(app)/reports/page.tsx`

### Report builder flow

1. Select client.
2. Select date range (start → end, presets: last 30d / last quarter / custom).
3. Click "Generate Report".
4. `presentation_builder` agent receives: client identity, performance metrics (from `reports` table), date range.
5. Agent outputs slide structure JSON (12+ slides).
6. `pptxgenjs` renders structure to `.pptx` binary.
7. File saved to Supabase Storage (`presentations` bucket) + `presentations` record inserted.
8. Download button appears.

### Live KPI charts (always visible)

| Chart | Type | Data source |
|-------|------|------------|
| Reach Growth | Line | `reports` table, aggregated by month |
| Engagement Rate by Month | Bar | Same |
| Platform Breakdown | Table | Per platform reach, posts, ER |
| Client Performance | Table | Per client reach, ER |

### KPI cards

Total Reach · Total Impressions · Avg Engagement Rate · Total Likes (read from `reports` table for current period)

---

## 11. Team Management & Invites

**File:** `app/(app)/settings/page.tsx` → Team tab · `components/settings/invite-user-modal.tsx`

### Invite flow

1. Admin clicks "Invite Member".
2. Modal: enter email, select role (radio grid with 8 roles), select department.
3. Click "Send Invite" → POST to `/api/team/invite`.
4. Backend: Supabase Auth `inviteUserByEmail()` → sends magic link to email.
5. User clicks link → sets password → lands in app with assigned role.
6. `users` table row created with `role`, `department`, `invited_by`.

### Role visibility rules (enforced in UI)

| Feature | Roles with access |
|---------|------------------|
| Integrations tab | admin only |
| Real vendor names (Metricool, Respond.io, Higgsfield) | admin + ceo |
| Audit log | admin + ceo |
| API cost data | admin + ceo + creative_director |
| Team management | admin only |
| Client create/edit | admin + creative_director + account_manager |

---

## 12. Dashboard Aggregation

**File:** `app/(app)/dashboard/page.tsx`

### KPI strip (8 metrics)

| Metric | Query |
|--------|-------|
| Active Tasks | COUNT tasks WHERE status != 'done' |
| Due Today | COUNT tasks WHERE due_date = today |
| Pending Approvals | COUNT approvals WHERE overall_status = 'pending' |
| Pending Moderation | COUNT moderation_items WHERE status = 'pending' |
| AI Cost (Month) | SUM api_usage.cost_usd WHERE month = current |
| Posts Scheduled | COUNT scheduled_posts WHERE status = 'scheduled' |
| Posts Published | COUNT scheduled_posts WHERE status = 'published' AND month = current |
| Pipeline Velocity | AVG days per stage across tasks moved this month |

### Charts

| Chart | Type | Data |
|-------|------|------|
| Weekly Activity | Line + Bar combo | Tasks completed vs posts published per day (7 days) |
| Pipeline Distribution | Pie | Task count per stage |

### Lists

- **Recent Tasks** — 6 most recently updated tasks (title, stage, client, due date, priority)
- **Top Performing Posts** — 4 posts sorted by engagement rate descending (thumbnail, client, ER, reach)
- **Client Health** — All clients: completion % (tasks done / total), scheduled post count, health color

---

## 13. Content Library

**File:** `app/(app)/library/page.tsx`

### Tabs

**Templates tab:**
- Source: `scheduled_posts WHERE status = 'published'`
- Each card: thumbnail, caption preview, client, platform icons, performance tags (e.g., "High ER"), copy framework tag
- Actions: Star to save · Copy caption · Use as template (duplicates as new draft)
- Filters: client dropdown, tag multi-select, search

**Google Drive tab:**
- Source: `/api/drive/files?folderId={id}&q={query}`
- Browse folder tree, navigate into subfolders, search within Drive
- Actions: Preview, Download to Assets library
- Auth state: connected (shows files) / disconnected (shows OAuth prompt)

---

## 14. Workload Monitoring

**File:** `app/(app)/workload/page.tsx`

### Data per team member

```
tasks WHERE assignee_id = member.id AND status != 'done'
```

- **Active task count** vs capacity (hardcoded: 8 tasks = 100%)
- **Load bar** — color coded: 0–62% green, 63–87% amber, 88–100%+ red
- **Status badge** — Healthy / At Capacity / Overloaded
- **Overdue count** — tasks where `due_date < today`
- **High-priority count** — tasks where `priority = 'high' OR 'urgent'`
- **Task list** — first 4 tasks shown as mini-cards (stage pill, title, due date, priority dot)

### Summary row

Team size · Total active tasks · Overloaded members count · At-capacity members count

---

## 15. Settings & Integrations Config

**File:** `app/(app)/settings/page.tsx`  
**Access:** Integrations tab — admin role only

### Integrations tab (4 integrations)

| Integration | Fields | Action |
|-------------|--------|--------|
| Metricool | API Token (password field) | Save · Test Connection |
| Respond.io | API Key, Webhook Secret | Save · Test Connection |
| Freepik | API Key | Save · Test Connection |
| Claude API | API Key | Save · Test Connection |

All values stored in `integrations` table with encryption at rest. "Test Connection" hits a `/api/integrations/test?provider={name}` endpoint.

### Other tabs

| Tab | Contents | Access |
|-----|----------|--------|
| Team | Member table (name, role, dept, access), Invite button | admin only |
| Notifications | 6 toggle switches for notification types | all roles |
| Security | System status checks (RLS, Vault, rate limiting, audit, 2FA) | all roles |

---

## 16. Data Layer & Auth

**Database:** Supabase (PostgreSQL + RLS + Realtime)

### Tables and their purpose

| Table | Key columns | Notes |
|-------|------------|-------|
| `users` | id, role, department, invited_by | Mirrors `auth.users` |
| `clients` | name, industry, brand_identity_json, metricool_blog_id | `brand_identity_json` holds steps 4–8 of wizard |
| `projects` | client_id, title, quarter_strategy, goals, themes, kpis | Groups tasks into campaigns |
| `tasks` | client_id, project_id, pipeline_stage, priority, assignee_id, due_date | Core work unit |
| `ai_responses` | task_id, agent_type, prompt_hash, response_text, cost_usd, is_cached | AI output cache |
| `assets` | client_id, type, source, license, url | Asset library |
| `scheduled_posts` | client_id, platforms[], status, scheduled_at, metricool_post_id | Publishing queue |
| `moderation_items` | client_id, platform, commenter, comment, status, reply | Comment queue |
| `presentations` | client_id, url, slide_count, generated_at | .pptx files |
| `integrations` | provider, encrypted_credentials | Third-party API keys |
| `api_usage` | user_id, model, input_tokens, output_tokens, cost_usd, agent_type | Cost tracking |
| `reports` | client_id, period_start, period_end, metrics_json | Performance data |
| `audit_log` | user_id, action, entity_type, entity_id, timestamp | Every action logged |

### RLS rules (summary)

- All `SELECT` requires authenticated session (JWT from Supabase Auth)
- `admin` + `ceo` can read everything
- Other roles scoped to clients they are assigned to
- `integrations` table: admin read/write only
- `audit_log`: admin + ceo read only

### Auth flow

1. User visits app → `middleware.ts` checks Supabase session cookie
2. No session → redirect to `/login`
3. Login page → Supabase Auth `signInWithPassword()` or magic link
4. Session cookie set → redirect to `/dashboard`
5. All API routes validate session via `supabase.auth.getUser()`

### Realtime subscriptions

Active on: `tasks` · `moderation_items` · `scheduled_posts` · `ai_responses`

Channels fire `INSERT` / `UPDATE` / `DELETE` events → TanStack Query `invalidateQueries()` called → UI updates without page refresh.

---

## 17. Webhook Ingestion (Respond.io + Metricool)

### Respond.io → `/api/webhooks/respond-io`

```
POST /api/webhooks/respond-io
Headers: X-Respond-Signature: {HMAC-SHA256 of body with RESPOND_IO_WEBHOOK_SECRET}

Payload (example):
{
  "event": "message.created",
  "platform": "instagram",
  "contactHandle": "@user123",
  "contactName": "User Name",
  "message": "Love this product!",
  "conversationId": "abc123",
  "postUrl": "https://instagram.com/p/xyz"
}
```

Handler:
1. Validate HMAC signature → 401 if invalid
2. Map `platform` + `contactHandle` + `message` → `ModerationItem` schema
3. Find matching `client_id` from platform handle mapping
4. INSERT into `moderation_items` with `status = 'pending'`
5. Realtime broadcasts → moderation page updates

### Metricool → `/api/webhooks/metricool`

```
POST /api/webhooks/metricool
Headers: X-Mc-Auth: {METRICOOL_API_TOKEN}

Payload:
{
  "event": "post.published",
  "postId": "mc_post_id",
  "publishedAt": "2026-05-16T10:00:00Z",
  "metrics": { "reach": 0, "impressions": 0 }
}
```

Handler:
1. Validate auth token
2. Find `scheduled_posts WHERE metricool_post_id = postId`
3. UPDATE `status = 'published'`, `published_at = publishedAt`
4. Store initial metrics in `reports` table (updated later by Metricool analytics pull)

---

## Process Inventory (Quick Reference)

| Process | Steps | File |
|---------|-------|------|
| Client initiation | 9 steps | `components/clients/new-client-wizard.tsx` |
| Task creation | 1 dialog | `app/(app)/pipeline/page.tsx` |
| Task movement | Drag → API | `components/pipeline/pipeline-board.tsx` |
| AI agent call | 10-step sequence | `lib/ai-client.ts` |
| Content compose | 7 steps | `app/(app)/publishing/page.tsx` |
| Calendar generation | 4 steps → export | `app/(app)/publishing/page.tsx` |
| Approval creation | 4 steps | `app/(app)/approval/page.tsx` |
| Client approval | Per-post review | `app/approval/[token]/page.tsx` |
| Moderation reply | Generate → edit → send | `app/(app)/moderation/page.tsx` |
| Asset search | Query → save | `app/(app)/assets/page.tsx` |
| Creative evaluation | Upload → score | `app/(app)/creative-eval/page.tsx` |
| Report generation | Select → generate → download | `app/(app)/reports/page.tsx` |
| Team invite | Email → magic link | `components/settings/invite-user-modal.tsx` |
| Integration config | Key → test → save | `app/(app)/settings/page.tsx` |
| Webhook: comment | Respond.io → DB | `app/api/webhooks/respond-io/route.ts` |
| Webhook: publish confirm | Metricool → DB | `app/api/webhooks/metricool/route.ts` |

---

## Improvement Notes

### Client Initiation — primary target

**Problem:** 9-step wizard requires brand knowledge the agency may not have until after onboarding calls. Steps 5–8 are enrichment data, not registration data.

**Fix:** Split into Register (3 steps) + Enrich (profile tabs). See section 1 for details.

### AI agent UX

**Problem:** User must open a task detail panel, find the agent section, click a button, wait. No way to run multiple agents at once.

**Possible fix:** Batch agent trigger ("Run all agents") for tasks entering a new stage.

### Approval link sharing

**Problem:** No automated email. Agency manually copies link and sends it.

**Possible fix:** Add email field to approval request form + trigger Supabase Edge Function to send a transactional email when the link is created.

### Crisis Mode persistence

**Problem:** Crisis mode toggle lives in local React state in `ClientsPage`. If the page reloads or another user is logged in, the toggle resets.

**Fix:** Add `crisis_mode: boolean` column to `clients` table + persist toggle via PATCH call.

### Calendar export

**Problem:** Export to Excel exists but no direct "push to publishing queue" with confirmation of each entry.

**Possible fix:** Export dialog with a preview list + checkboxes to deselect individual entries before saving as drafts.
