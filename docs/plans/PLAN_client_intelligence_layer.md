# PLAN — Client Intelligence Layer
**Status:** Planning  
**Estimated effort:** ~22 hours across 6 sessions  
**Priority:** High — foundational upgrade before SaaS transformation

---

## Is It Worth Building?

Short answer: **yes, and it is one of the highest-leverage builds remaining in this platform.**

Here is the honest case for and against.

### Why it matters

Right now NOVAX Ops is a well-built task and publishing management tool. It has a good pipeline, solid AI agents, a powerful studio. But every AI call starts from scratch. The system has no memory of what the client cares about, what has been tried, what failed, what the team has learned. Every generation is stateless.

This plan changes that. It transforms the platform from a tool that manages work into a system that **accumulates intelligence**. The longer the team uses it, the smarter it gets about each client. That is a compounding advantage — not a one-time improvement.

Concretely, here is what each piece unlocks:

| Feature | What it actually does |
|---|---|
| Context Bank | AI stops needing to be briefed. It already knows the client's history, quirks, and standing instructions. Every generation improves without extra user effort. |
| AI Feedback | The agency builds a per-client taste profile over time. Copywriters stop re-explaining the same corrections. The AI stops making the same mistakes. |
| Quarter Strategy + Content Plan on client | The strategy is no longer locked in a doc somewhere. It is attached to the client, visible before any AI call, and injected into every generation automatically. |
| Studio → Doc / Context / Task bridges | Work that currently disappears into studio sessions can now flow into the real pipeline. Nothing is lost. |
| CEO Agent | The CEO can get a full cross-client intelligence briefing in one message instead of opening 6 tabs and reading reports manually. |
| Task ↔ Studio bridge | A brief in a task can open directly in studio. A studio output can become a task. The two parts of the workflow that are currently disconnected are joined. |

### What it is NOT

This is not AI for its own sake. It does not add complexity the team has to manage. The context bank, the feedback system, and the strategy layer all run silently in the background. Users do not need to think about them. They just notice the AI gets better.

### Honest risks

- **Context Bank quality depends on what the team puts in.** If no one adds updates, it stays empty and the benefit is zero. This needs a light habit from the team — one entry after a client call is enough.
- **Feedback injection adds ~300–600 tokens to every AI call** for a client with active feedback history. This increases cost marginally. At scale this is manageable and worth it.
- **CEO Agent is only as good as the data.** If Metricool is not synced and performance snapshots are thin, it cannot give meaningful cross-client analysis. The existing cron jobs cover this.

---

## How This Empowers the App

### Before this build
- AI is a feature inside tasks. It does what you tell it, once, then forgets.
- Client knowledge lives in a brand identity JSON field and in peoples' heads.
- Studio outputs exist in isolation. You cannot act on them without copy-pasting.
- Every new generation for a client is as good (or bad) as the first one ever was.

### After this build
- AI knows the client before you type anything.
- Corrections made today improve every generation made tomorrow, automatically.
- Strategy and plans are attached to the client, not floating in a folder.
- Studio flows into documents, tasks, and client memory with one click.
- The CEO can get a full agency briefing in 30 seconds.
- The platform compounds value over time. The longer an agency uses it, the harder it is to replace with a generic tool.

This is the difference between a tool and a **system**. Tools do things. Systems learn.

---

## Architecture Overview

```
EVERYTHING FLOWS INTO THE CLIENT

Studio output ──────────────┐
Meeting notes (text) ───────┤
Uploaded documents (→text)──┤──► CLIENT CONTEXT BANK
AI feedback (corrections) ──┤       (injected into every AI call for this client)
Quarter strategy ───────────┘

BEFORE EVERY AI CALL FOR A CLIENT
  1. Pull context bank entries (last 10 active)
  2. Pull feedback history for this agent type (last 8)
  3. Pull quarter strategy excerpt
  4. Inject all of it into the system prompt
  → AI has full client memory every single time

STUDIO OUTPUTS CAN GO THREE PLACES
  → Save as Document  (Tiptap editor, shareable)
  → Add to Context Bank  (key insight remembered forever)
  → Create Task  (move work into the pipeline)

CEO AGENT SEES EVERYTHING
  → All clients, all context banks, all performance data
  → Proactive risk flags, conflict resolution, second opinions
```

---

## Feature Breakdown

---

### 1. Client Context Bank

**What it is:** A per-client living text memory. Not a document, not a note — a structured store of extracted intelligence that the AI reads silently before every generation.

**User flow:**
1. Open a client profile → Context Bank tab
2. Click "Add Update"
3. Choose: write free text OR upload a file
4. For text: AI categorizes it and writes a 2-sentence summary. Stored immediately.
5. For files (PDF, Word, TXT): AI extracts and summarizes the content. Text stored. File discarded. No storage cost.
6. Entry appears in the list under its auto-assigned category.
7. User can archive old entries. Archived entries no longer inject into prompts.

**Categories (AI-assigned):**
- Client Instructions
- Brand Update
- Campaign Feedback
- Market Intel
- Meeting Notes
- Competitor Intel

**AI injection:** Before every AI call for a client, the route pulls the 10 most recent active entries, formats them as a short block, and appends to the system prompt under `── CLIENT MEMORY ──`. No user action required after the entry is added.

**DB — new table `client_context_bank`:**
```sql
id            uuid  PRIMARY KEY
client_id     uuid  REFERENCES clients(id) ON DELETE CASCADE
category      text
summary       text        -- 2-3 sentence AI summary (shown in list)
full_text     text        -- full extracted content (max 6000 chars)
source_type   text        -- 'manual' | 'document' | 'studio' | 'feedback'
created_by    uuid  REFERENCES users(id)
created_at    timestamptz DEFAULT now()
is_active     bool  DEFAULT true
```

---

### 2. AI Feedback System

**What it is:** A per-client, per-agent-type taste profile built from corrections made by the team. Every thumbs-down + note the team gives gets stored and injected into future calls for that client.

**Where it appears:** Under every AI-generated output in the app:
- Task panel AI agents (copywriter, researcher, task_analyzer, etc.)
- Studio outputs (boss brief, hooks, script, campaign brief)
- Moderation reply suggestions
- Report narrative
- Chat assistant responses

**UI pattern:**
- Two small icon buttons (thumbs up / thumbs down) below each output
- Thumbs up: silent positive log
- Thumbs down: opens a small overlay
  - Quick tag chips: Too formal · Too casual · Off-brand · Too long · Too short · Wrong tone · Wrong language · Off-topic
  - Text field: "What should it have done?" (optional)
  - Text field: "Write the corrected version" (optional)
  - Optional: "Create revision task" checkbox

**Injection:** Before every AI call, the route queries the last 8 `ai_feedback` rows for `(client_id, agent_type)` and formats them as:
```
── LEARNED FROM PAST CORRECTIONS FOR THIS CLIENT ──
- Copywriter: avoid formal language. Client prefers warm, direct Gulf Arabic.
- Copywriter: rejected 'innovative solutions' — too generic. Use specific outcomes.
- Copywriter: corrected to start with a question rather than a statement.
```

**DB — new table `ai_feedback`:**
```sql
id                uuid  PRIMARY KEY
client_id         uuid  REFERENCES clients(id) ON DELETE CASCADE
agent_type        text        -- 'copywriter' | 'hook_lab' | 'studio_content' | 'chat' | etc.
content_snapshot  text        -- first 500 chars of what was generated (for reference)
rating            text        -- 'positive' | 'negative'
tags              text[]      -- quick tag chips selected
correction_text   text        -- what should it have done
edited_version    text        -- the corrected version if written
created_by        uuid  REFERENCES users(id)
created_at        timestamptz DEFAULT now()
```

---

### 3. Strategy Tab in Client Profile

**What it is:** Quarter strategy and monthly content plans attached directly to the client profile — not floating documents in a list.

**Uses the existing `documents` table.** No new table. No new API routes.

Filter: `doc_type = 'quarter_strategy'` or `doc_type = 'content_plan'` + `client_id`.

**Quarter Strategy section:**
- Shows the current quarter's strategy document in the Tiptap editor (read mode by default, edit mode on click)
- Dropdown to switch between quarters (Q1 2025, Q2 2025, etc.)
- "New Quarter Strategy" button — creates a blank document, pre-fills a structured template

**Monthly Content Plan section:**
- Month selector (dropdown: Jan 2026, Feb 2026, etc.)
- Shows the plan for the selected month
- "Generate with AI" button — uses the client's context bank + quarter strategy to draft a content plan automatically
- "Save as Monthly Plan" button also appears in studio after generating a content calendar

**AI injection:** The active quarter strategy excerpt (first 800 chars) is injected into every AI call for that client alongside the context bank.

---

### 4. Studio → App Bridges

**What it is:** Three action buttons added to the output stage of every studio tool. Currently studio outputs are isolated — these three buttons connect them to the rest of the platform.

**"Save as Document"**
- Available on: Content Studio (boss brief + script), Hook Lab (top 3 hooks), Campaign Igniter (execution briefs)
- Action: Creates a new document in the `documents` table. Client is pre-filled from the studio session. User can rename before saving.
- Result: Appears in Documents section, searchable, shareable via token.

**"Add to Context Bank"**
- Available on: All studio tool outputs
- Action: Extracts key outputs (brief summary, hook stack, campaign tensions) into a single context bank entry for the client. Category auto-set to "Campaign Feedback" or "Brand Update" depending on tool.
- Result: Future AI calls for this client remember what was produced.

**"Create Task"**
- Available on: All studio tool outputs
- Action: Opens a pre-filled "Create Task" dialog. Title and description pulled from the studio output. Client and project pre-selected. Stage defaults to "Copy" or "Design" depending on output type.
- Result: The work moves into the pipeline immediately.

**"Open in Studio" (from task panel)**
- A button added to the task detail panel
- Action: Opens Content Studio with the task's title, brief, client, and platform pre-filled as the signal input
- Result: The team can go from task → studio → back to task in one flow

---

### 5. CEO Agent

**What it is:** A separate, more powerful AI mode accessible from the `/ceo` page. Uses Claude Opus. Has cross-client visibility. Frames responses as a board-level advisor, not an assistant.

**Capabilities beyond the standard assistant:**

**Agency Health Briefing**
Type "brief me" → returns: active client count, overdue tasks, pending approvals, any crisis-mode clients, team overload warnings, performance summary across all clients. One structured paragraph. Fully current.

**Cross-client Intelligence**
Can ask "which client had the best content month?" or "which clients haven't had a strategy session in 60 days?" — queries across all clients simultaneously.

**Conflict Resolution Mode**
User pastes two competing options (two creative directions, two campaign strategies, two team opinions). Agent analyzes both sides, names the real tension, and gives a concrete recommendation with reasoning.

**Risk Scoring**
"Which clients are at risk?" — pulls engagement trends, approval delays, task backlogs, days since last context bank update, and crisis history. Returns a ranked list with the reason for each flag.

**Strategic Second Opinion**
User pastes any strategy document. Agent runs it through: What assumptions are being made? What is the weakest point? What is a competitor doing that this ignores? What would you regret not asking before launching?

**Resource Arbitration**
Given current team workload data: "We have 5 urgent tasks and 3 people. What do we do?" Returns a prioritized allocation recommendation.

**Technical implementation:**
- Same `/api/assistant/chat` route, `is_ceo: true` flag
- Data fetch expands to: all clients' context bank summaries (not full text), agency-wide performance snapshots, team workload, pending counts
- System prompt restructured: "You are a board-level strategic advisor reviewing the full state of a social media agency. Challenge assumptions. Surface what is not being asked."
- Model: `claude-opus-4-7` always, no fallback to Sonnet

---

## File Changes Required

### New DB migrations

**`sql/018_client_context_bank.sql`**
```sql
CREATE TABLE IF NOT EXISTS client_context_bank (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category     text NOT NULL DEFAULT 'Meeting Notes',
  summary      text NOT NULL,
  full_text    text NOT NULL,
  source_type  text NOT NULL DEFAULT 'manual'
               CHECK (source_type IN ('manual','document','studio','feedback')),
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  is_active    bool DEFAULT true
);
CREATE INDEX IF NOT EXISTS context_bank_client_idx ON client_context_bank (client_id, is_active, created_at DESC);
ALTER TABLE client_context_bank ENABLE ROW LEVEL SECURITY;
-- policies: users can read all for their org, write own, admin reads all
```

**`sql/019_ai_feedback.sql`**
```sql
CREATE TABLE IF NOT EXISTS ai_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,
  agent_type        text NOT NULL,
  content_snapshot  text,
  rating            text NOT NULL CHECK (rating IN ('positive','negative')),
  tags              text[] DEFAULT '{}',
  correction_text   text,
  edited_version    text,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_feedback_lookup_idx ON ai_feedback (client_id, agent_type, created_at DESC);
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
```

### New API routes

| Route | Purpose |
|---|---|
| `GET/POST/DELETE /api/clients/[id]/context-bank` | CRUD context bank entries |
| `POST /api/clients/[id]/context-bank/process` | AI processes uploaded document → text |
| `POST /api/ai-feedback` | Save thumbs up/down + correction |
| `GET /api/ai-feedback?client_id=&agent_type=` | Fetch recent feedback for injection |

### Modified API routes

| Route | Change |
|---|---|
| `/api/ai` | Before building prompt: query context bank + feedback for client and inject |
| `/api/studio/*/` (all studio routes) | Same — inject context bank before generation |
| `/api/assistant/chat` | Same — already has client context; add feedback layer |
| `/api/assistant/chat` (CEO path) | Expand data fetch to cross-client |

### New UI components

| Component | Location |
|---|---|
| `components/clients/context-bank-panel.tsx` | Context Bank tab in client modal |
| `components/clients/strategy-tab.tsx` | Strategy tab in client modal |
| `components/shared/ai-feedback-buttons.tsx` | Reusable thumbs up/down overlay — placed under every AI output |
| `components/studio/studio-save-actions.tsx` | Three action buttons (Save Doc / Add Context / Create Task) |

### Modified pages

| File | Change |
|---|---|
| `app/(app)/clients/page.tsx` | Add Strategy and Context Bank tabs to `ClientDetail` |
| `app/(app)/studio/content/page.tsx` | Add save action buttons after generation |
| `app/(app)/studio/hooks/page.tsx` | Same |
| `app/(app)/studio/campaign/page.tsx` | Same |
| `app/(app)/ceo/page.tsx` | Add CEO Agent section with expanded briefing UI |
| `components/tasks/task-detail-panel.tsx` | Add "Open in Studio" button |

---

## Build Order

Build in this exact sequence. Each phase is independently shippable.

### Phase 1 — Foundation (3h)
1. Run migrations 018 and 019
2. Build `/api/clients/[id]/context-bank` CRUD routes
3. Build context bank injection into `/api/ai` and studio routes
4. No UI yet — but injection is live

*Why first: everything downstream depends on context bank being available in the DB and in prompts.*

### Phase 2 — Context Bank UI (4h)
1. `context-bank-panel.tsx` — add/view/archive entries
2. File upload → AI text extraction flow
3. Context Bank tab wired into client detail modal

*Deliverable: team can start filling client memories immediately.*

### Phase 3 — AI Feedback (3.5h)
1. Build `ai-feedback-buttons.tsx` component
2. Wire into task panel AI agents
3. Wire into studio outputs
4. Build feedback injection into all AI routes

*Deliverable: team starts teaching the AI.*

### Phase 4 — Strategy Tab (2.5h)
1. Quarter strategy section in client modal
2. Monthly content plan section
3. "Generate plan with AI" button (uses context bank + quarter strategy)

*Deliverable: strategy is attached to clients, not floating.*

### Phase 5 — Studio Bridges (2.5h)
1. `studio-save-actions.tsx` — three buttons
2. Wire into content studio, hook lab, campaign igniter
3. "Open in Studio" on task detail panel

*Deliverable: studio and pipeline are connected.*

### Phase 6 — CEO Agent (3h)
1. Expand CEO data fetch in `/api/assistant/chat`
2. CEO system prompt restructure
3. Agency health briefing UI on `/ceo` page
4. Risk scoring + conflict resolution UI

*Deliverable: CEO has full cross-client intelligence.*

---

## Effort Summary

| Phase | Hours |
|---|---|
| Foundation + DB | 3h |
| Context Bank UI | 4h |
| AI Feedback | 3.5h |
| Strategy Tab | 2.5h |
| Studio Bridges | 2.5h |
| CEO Agent | 3h |
| **Total** | **18.5h** |

---

## What the App Becomes After This Build

Before: A well-built operations platform where the AI is a helpful but stateless feature.

After: A platform where:
- The AI knows every client's history, preferences, and standing instructions without being told
- Every correction the team makes improves the next generation automatically
- Strategy, plans, and context are attached to clients — not scattered in files
- Studio work flows directly into the pipeline — nothing is produced and then lost
- The CEO can read the full state of the agency in one message
- The longer the team uses it, the better it gets — at the rate of actual usage, not periodic updates

That last point is the real value. This is not a feature list. It is a **compounding system**. An agency that has been using NOVAX Ops for 6 months with active context banks and feedback loops will produce noticeably better client work than one starting fresh — because the platform has absorbed 6 months of taste, corrections, and institutional knowledge.

That is what separates a tool from a platform.
