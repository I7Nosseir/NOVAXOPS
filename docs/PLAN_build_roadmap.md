# NOVAX Ops — Build Roadmap
**Last updated:** 2026-06-29  
**AI model throughout:** `gemini-3-flash-preview` via `lib/gemini.ts` (`geminiGenerate` / `geminiJson`)  
**Anthropic key:** Not set — all AI routes use Gemini until further notice. Do not add Claude fallback logic to new routes. Use `geminiGenerate` directly.

---

## Current State (Accurate as of 2026-06-29)

### What is confirmed working
- Pipeline Kanban — 10 stages, drag-and-drop, real Supabase data, realtime
- Task panel — AI agents (task_analyzer, copywriter, researcher, asset_finder, post_caption), comments, sub-types
- Clients — cards, detail modal (6 tabs), new client 9-step wizard, design brief, crisis mode
- Publishing — grid + calendar, Compose dialog (EN/AR), Metricool scheduling, carousel media, edit/delete/reschedule
- Approval — internal management, token links, public portal at `/approval/[token]`
  - **Client portal already has per-post comments** (MessageSquare button → textarea → stored in `approval_post_statuses.note` → emailed to team on submit)
- Moderation — queue, AI reply generation, chatwoot webhook receives items
- Assets — upload to Supabase Storage, Google Drive import
- Reports — charts, Metricool data, AI narrative, PPTX + PDF export
- Documents — Tiptap editor, templates, public token sharing
- Studio — all 11 tool pages exist (Content, Hooks, Strategy, Campaign, Copy Engine, Visual, Formats, Competitive, Post-Mortem, Inspiration, Media Buying)
- Client intelligence layer — context bank, AI feedback, competitor context injected into all prompts
- Work Diary, CEO Hub, AI Assistant, Creative Eval, Strategy Eval, Workload, Content Library

### What is broken or incomplete
- **ANTHROPIC_API_KEY not set** — all AI runs on Gemini (working, intentional for now)
- **Hook Lab prompt has corrupted Unicode** — mojibake throughout the scoring prompt and Arabic strings
- **Campaign generator returns placeholder text (HTTP 200) on any AI failure** — phases 1–6 silently substitute "Concept 1" etc.
- **Moderation marks "replied" even when Chatwoot call failed** — data integrity issue
- **Studio session saves fire-and-forget** — `.catch(() => {})` everywhere, users lose work silently
- **Boss Brief silently fails** — `catch { /* non-fatal */ }` means the exec summary never appears
- **AI Image page in sidebar returns 503 on every click** — FAL/Ideogram keys not set
- **`/performance` link in Studio hub quick nav and Dashboard** — page does not exist, goes to 404
- **Rate limiting non-functional on Vercel** — in-process Map, not global
- **Most AI routes have no authentication** — hooks/generate, strategy, campaign, visual, ai-image/ideate, etc.
- **Diary route reads user identity from HTTP headers** — forgeable, security hole
- **Credits system built but never called** — `lib/credits.ts` not imported anywhere in routes
- **Social scraper broken** — TikTok returns hardcoded 0, Instagram needs undocumented session cookie
- **Smart Resize** — page file exists, not in sidebar, routes exist but UI not wired

### Navigation (Sidebar — actual current state)
- **Workspace:** Dashboard, Pipeline, Tasks, My Diary, Clients, Projects, Publishing, Approval, Moderation
- **Studio:** Studio hub, Content Studio, Hook Lab, Strategy, Campaign Igniter, Visual Engine, Peak Formats, Copy Engine, Media Buying Plan
- **Creative:** Assets, AI Image, Creative Eval, Strategy & Content Eval, Documents
- **Intelligence:** AI Assistant, Workload, Content Library, Reports
- **Account:** My Profile, Settings
- **Admin only:** Team Activity
- **CEO/Admin:** CEO Hub

*Note: Competitive Intelligence, Post-Mortem, and Inspiration Library are accessible from the Studio hub page but not listed in the sidebar.*

---

## Phase 0 — Fix What's Broken (Do First)

These are not improvements. They are things that are actively wrong.

### 0.1 Fix Hook Lab Unicode Corruption
**File:** `app/api/studio/hooks/generate/route.ts`  
**Problem:** The entire HOOK_PROMPT and Arabic dialect instruction strings contain mojibake (`â€"`, `â€œ`, `â€™`, garbled Arabic). Every hook generation sends corrupted instructions to Gemini.  
**Fix:** Open the file in VS Code, ensure the file is saved as UTF-8. Replace all corrupted characters. Re-type the Arabic dialect strings directly.  
**Test:** Generate hooks for an Arabic client. The prompt logged to console should show clean Arabic characters.

### 0.2 Fix Campaign Generator Placeholder Fallback
**File:** `app/api/studio/campaign/generate/route.ts`  
**Problem:** When any of the 7 phases fails, the catch block substitutes hardcoded placeholder text and returns HTTP 200. Team sends clients "Concept 1" thinking it's real.  
**Fix:** Replace every `catch { /* silent fallback */ }` block in the phase pipeline with a proper error that returns `{ error: 'Phase X failed', phase: X }` with status 500. The frontend shows an error state rather than silently displaying placeholders.

### 0.3 Fix Moderation "Reply Sent" Lie
**File:** `app/(app)/moderation/page.tsx`  
**Problem:** The Chatwoot API call failure is swallowed. DB is marked "replied" regardless.  
**Fix:** Only update `moderation_items.status = 'replied'` after the API call returns 2xx. If it fails, show a toast error: "Reply failed to send. Try again." Do not update the DB status.

### 0.4 Fix Studio Session Save Failures
**Files:** `app/(app)/studio/content/page.tsx`, `hooks/page.tsx`, `campaign/page.tsx`, `strategy/page.tsx`  
**Problem:** All session saves use `.catch(() => {})` — silent failure, user loses work.  
**Fix:** Replace with:
```ts
fetch(`/api/studio/session/${sid}`, { method: 'PATCH', ... })
  .then(r => { if (!r.ok) toast.error('Session could not be saved. Copy your output now.') })
  .catch(() => toast.error('Session could not be saved. Copy your output now.'))
```

### 0.5 Fix Boss Brief Silence
**Files:** All Studio pages  
**Problem:** `catch { /* non-fatal */ }` means the 30-second exec summary never appears with no feedback.  
**Fix:** Retry once. If it fails twice, show: "Summary unavailable — generation failed."

### 0.6 Fix `/performance` Dead Link
**Files:** `app/(app)/studio/page.tsx` (line 129), `app/(app)/dashboard/page.tsx`  
**Fix:** Either remove both links, or replace with `/reports` which is the closest existing page.

### 0.7 Remove or Fix AI Image Sidebar Link
**File:** `components/layout/sidebar.tsx`  
**Problem:** AI Image is linked in Creative section but returns 503 on every click.  
**Options:** (A) Remove from sidebar until FAL/Ideogram keys are configured. (B) Keep but show a "Coming soon" placeholder page instead of a 503 error.  
**Recommended:** Remove from sidebar, add it back when the feature works.

### 0.8 Fix Diary Route Authentication
**File:** `app/api/diary/route.ts`  
**Problem:** Reads `x-user-id` and `x-user-role` from HTTP request headers. Anyone can forge these and write diary entries as any user.  
**Fix:** Replace header-based identity with session verification using `createServerClient` + `supabase.auth.getUser()` — same pattern used in `/api/approval` POST route.

---

## Phase 1 — High Impact, Fast Builds

### 1.1 Studio → Schedule One-Click
**Where:** Every Studio output card (Content Studio, Hook Lab, Copy Engine)  
**What:** A "Schedule This" button next to the copy icon on each output card. Clicking it:
1. Opens the Publishing Compose dialog
2. Pre-fills: caption from the output, client pre-selected (from the studio brief), platform inferred from the brief inputs
3. Puts the cursor in the scheduling time field

**Implementation:**
- Add `onSchedule?: (caption: string, clientId: string, platform?: string) => void` prop to `StudioDocument` and other output card components
- In the Studio pages, pass a handler that calls `router.push('/publishing?compose=1&caption=...&client=...')`
- In `app/(app)/publishing/page.tsx`, read these URL params on mount and open the Compose dialog pre-filled

**Estimated effort:** 1 day

### 1.2 Auto-Save Context on Approval Decisions
**Where:** `app/api/approval/route.ts` — PATCH handler (when client submits review)  
**What:** When a client submits decisions, automatically write to `client_context_bank`:
- For each `approved` decision: log a `voice_signal` entry — "Client approved: [first 100 chars of caption] | Format: [post type] | Platform: [platform]"
- For each `changes_requested` decision with a note: log a `rejection_signal` entry — "Client rejected: [note text verbatim]"

**Implementation:** Add after the existing `approval_post_statuses` update loop in the PATCH handler:
```ts
// Auto-log to client context bank
for (const [post_id, { status, note }] of Object.entries(decisions)) {
  const post = postsData?.find(p => p.id === post_id)
  if (!post) continue
  if (status === 'approved') {
    await db.from('client_context_bank').insert({
      client_id: request.client_id,
      category: 'voice_signal',
      summary: `Client approved: "${(post.caption ?? '').slice(0, 120)}"`,
      source: 'approval_auto',
      is_active: true,
    })
  } else if (status === 'changes_requested' && note?.trim()) {
    await db.from('client_context_bank').insert({
      client_id: request.client_id,
      category: 'rejection_signal',
      summary: `Client requested changes: "${note.trim().slice(0, 200)}"`,
      source: 'approval_auto',
      is_active: true,
    })
  }
}
```
**Estimated effort:** 2–3 hours

### 1.3 "Based On" Transparency Panel
**Where:** Every Studio output card  
**What:** A small collapsible section under each AI output that shows what client context was actually used. Format:
```
Based on: Brand voice: formal but warm | Avoid: 'luxurious' | 
Quarter goal: awareness | Competitor gap: question hooks underused
```
**Implementation:**
- `buildClientIntelligenceBlock()` in `lib/client-intelligence.ts` currently returns a plain string
- Add a second export `buildClientIntelligenceSummary()` that returns a structured object: `{ voice, avoid, goal, competitor_note, quarter_theme }`
- Pass this summary alongside the AI response in studio API routes
- Render as a collapsed `<details>` element in `StudioDocument` component

**Estimated effort:** 1 day

### 1.4 "What Worked This Week" Dashboard Card
**Where:** `app/(app)/dashboard/page.tsx`  
**What:** A new card that queries `post_performance_snapshots` for the last 7 days, finds posts with `er > 2 * client_avg_er`, and shows them grouped by client with: hook preview, platform, ER, format type.  
**No AI needed** — pure SQL + display.

**Query:**
```sql
SELECT 
  p.caption, p.platform, p.post_type, p.er, p.likes, p.reach,
  c.name as client_name, c.color as client_color,
  AVG(p2.er) OVER (PARTITION BY p.client_id) as client_avg_er
FROM post_performance_snapshots p
JOIN clients c ON p.client_id = c.id
JOIN post_performance_snapshots p2 ON p2.client_id = p.client_id
WHERE p.synced_at >= NOW() - INTERVAL '7 days'
  AND p.er > (SELECT AVG(er) * 2 FROM post_performance_snapshots WHERE client_id = p.client_id)
ORDER BY p.er DESC
LIMIT 10
```

**Estimated effort:** 1 day

---

## Phase 2 — The Learning Loop

The app currently collects performance data daily (Metricool sync) but never uses it to improve AI output. This phase closes that loop.

### 2.1 Nightly Performance Learning Cron
**New file:** `app/api/cron/learning-loop/route.ts`  
**Schedule:** Daily at 3am — add to `vercel.json`  
**What it does:**
1. For each active client, fetch all posts from `post_performance_snapshots` from the last 30 days
2. Calculate the client's average ER for the period
3. Find posts where `er > avg_er * 2` (high performers)
4. Find posts where `er < avg_er * 0.5` (underperformers)
5. For each high performer: write a `performance_win` entry to `client_context_bank`:
   - `summary`: "High performer: [hook_type] [format] on [platform] [day_of_week] — [er]% ER (avg: [avg_er]%)"
6. For each underperformer: write a `performance_loss` entry
7. Deduplicate: if 3+ entries say the same pattern, consolidate into one with `confidence_score` = count
8. Expire entries older than 90 days (set `is_active = false`)

**Schema additions needed:**
```sql
ALTER TABLE client_context_bank 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
```

**Estimated effort:** 2 days

### 2.2 Slot-Based Context Injection
**File:** `lib/client-intelligence.ts`  
**Problem:** Current 3000-char hard cap truncates randomly. Critical context gets cut.  
**Replace with slot system:**

| Slot | Max chars | Content | Always included? |
|------|-----------|---------|-----------------|
| 1 | 400 | Brand voice + tone + emoji/hashtag policy | Yes |
| 2 | 300 | Last 5 rejection signals (most recent first) | Yes |
| 3 | 400 | Agent-specific context (hooks → performance wins; captions → approved patterns; strategy → quarter goals) | Yes |
| 4 | 300 | Current quarter goal + active campaign theme | Yes |
| 5 | 400 | Top 3 high-performing post patterns this month | If available |
| 6 | 300 | Competitor brief (top competitor ER + hook gap) | If available |
| 7 | 900 | Remaining context bank entries by recency | Fill remaining space |

**Implementation:**
- Refactor `buildClientIntelligenceBlock(clientId, agentType, db)` to:
  1. Fetch all required data in parallel
  2. Fill slots 1–4 first (always)
  3. Fill slots 5–6 if data exists
  4. Fill slot 7 with remaining chars from the total 3000 cap
  5. Return the assembled string

**Estimated effort:** 1.5 days

### 2.3 Context Bank Lifecycle
**Add to the nightly learning loop cron:**
- Set `is_active = false` on `performance_win`/`performance_loss` entries older than 90 days
- Set `is_active = false` on `rejection_signal` entries older than 180 days  
- Voice/brand entries: never auto-expire (only expire if manually deactivated)
- When two entries of the same category say opposite things (e.g., "use question hooks" AND "avoid question hooks"), flag both as `needs_review = true` — surface in the client intelligence tab

---

## Phase 3 — Role-Aware Experience

### 3.1 Copywriter Morning View
**Where:** `app/(app)/dashboard/page.tsx` — role-conditional rendering  
**For role:** `copywriter`, `social_manager`  
**Show:**
- Tasks assigned to them due today (max 5, one-click to task panel)
- Approval requests waiting on their revision (changes_requested for posts they created)
- "What worked yesterday" — top post from last 24h for each of their assigned clients
- Quick launch: client selector → one click to Content Studio with that client pre-loaded

**Implementation:** Wrap in `{user?.role === 'copywriter' && <CopywriterView />}` — separate component that uses `useTasks({ assignedTo: user.id })` and `useApprovalRequests()` filtered to their items.

### 3.2 Account Manager View
**For role:** `account_manager`  
**Show:**
- Clients with no approved content scheduled in the next 5 days (risk flag)
- Approvals awaiting client response (sent but not yet reviewed) with days elapsed
- Yesterday's competitor activity (from `competitor_tracking` if populated)
- Top performing post per client this week

### 3.3 CEO/Admin View
**For roles:** `ceo`, `admin`  
**Show (traffic light per client):**
- Green: ER trending up, content approved, no flags
- Yellow: ER flat, approval pending >48h, or no content next week
- Red: ER dropping >20%, client hasn't approved anything in 7+ days, or pending changes not addressed

**Query:** Use `post_performance_snapshots` grouped by client for ER trend, `approval_requests` for pending status, `scheduled_posts` for next-week coverage.

---

## Phase 4 — Mid-Task AI Support (The New Direction)

**Core philosophy shift:** The AI should not only generate from scratch. It should be present while people are working — reviewing, opinionating, pushing back, and helping people think rather than just doing the thinking for them.

Every mid-task tool uses `geminiGenerate` directly. No caching. No sessions. Lightweight, fast, contextual.

---

### 4.1 Caption Reviewer (in Compose Window)
**Where:** `app/(app)/publishing/page.tsx` — `ComposeDialog` component  
**What:** A "Get feedback" button below the caption textarea. Sends the current caption draft + client context to Gemini and returns an honest review.

**New API route:** `app/api/ai/review-caption/route.ts`
```ts
// POST body: { caption: string, client_id: string, platform: string }
// Returns: { score: number, verdict: string, issues: string[], suggestions: string[] }
```

**Gemini prompt structure:**
```
You are a brutally honest social media editor. 
Review this caption for [client name] on [platform].

CLIENT CONTEXT:
[client intelligence block]

CAPTION TO REVIEW:
"[caption text]"

Be direct. Score it 1-10. List specific issues. Give 2 concrete rewrites for the weakest part.
Respond in JSON: { score, verdict, issues: [], rewrites: [] }
```

**UI:** A small panel slides in below the textarea showing the score (colored number), the verdict in one sentence, and expandable issues + rewrites. Not a modal — inline, stays open while editing.

**Estimated effort:** 1 day

---

### 4.2 Hook Strength Checker (in Hook Lab)
**Where:** `app/(app)/studio/hooks/page.tsx` — add an input field above the generated results  
**What:** User types their own hook. AI scores it against the same 3C framework used for generated hooks and compares it to the top generated hook.

**New API route:** `app/api/studio/hooks/score/route.ts`
```ts
// POST body: { hook: string, client_id: string, brief: string }
// Returns: { curiosity: number, clarity: number, compulsion: number, total: number, 
//             verdict: string, weakness: string, alternatives: string[] }
```

**UI:**
- Input field: "Score your own hook"
- Shows score alongside the generated hooks so user can compare
- Shows one-line honest verdict: "Strong curiosity but loses clarity by word 7. Try cutting everything after 'without'."
- 2 alternative rewrites of their hook

**Estimated effort:** half a day

---

### 4.3 "Does This Fit?" Client Fit Checker
**Where:** Floating button available on any page where content is being reviewed  
**What:** Paste any text → select a client → AI says whether this content fits that client's brand, what would make the client push back, and what changes would make it approvable.

**New API route:** `app/api/ai/client-fit/route.ts`
```ts
// POST body: { content: string, client_id: string }
// Returns: { fit_score: number, verdict: string, pushbacks: string[], fixes: string[] }
```

**Gemini prompt:**
```
You are a senior account manager who knows this client well.

CLIENT PROFILE:
[client intelligence block]

CONTENT TO EVALUATE:
"[content]"

Would this client approve this? Think like the client, not the agency.
Be specific about what they'd push back on and exactly how to fix each issue.
JSON: { fit_score (1-10), verdict, pushbacks: [], fixes: [] }
```

**UI:** Available as a small side panel triggered from:
- A "Does this fit [client]?" button in the task detail panel
- A "Check client fit" option in the compose window
- A standalone check on the client page

**Estimated effort:** 1 day

---

### 4.4 Revision Helper (in Approval Page)
**Where:** `app/(app)/approval/page.tsx` — on any approval request with status `changes_requested`  
**What:** When a client has requested changes with notes, an account manager or copywriter can click "Help me fix this." The AI reads the client's note + the original content + the client context and produces:
1. A plain-English interpretation of what the client actually wants
2. The specific lines/sections to change
3. A rewritten version addressing all the notes

**New API route:** `app/api/ai/revision-helper/route.ts`
```ts
// POST body: { original_caption: string, client_note: string, client_id: string }
// Returns: { interpretation: string, changes: string[], revised_caption: string }
```

**Gemini prompt:**
```
A client has reviewed content and requested changes. Your job is to:
1. Interpret what they actually mean (clients often write vague notes)
2. List the specific changes needed
3. Write the revised version

CLIENT CONTEXT:
[client intelligence block]

ORIGINAL CAPTION:
"[caption]"

CLIENT'S FEEDBACK:
"[client_note]"

Respond in JSON: { interpretation, changes: [], revised_caption }
```

**UI:** Below each `changes_requested` post in the approval detail view, a "Help me fix this" button that opens a panel with the three outputs. The revised caption has a "Use this" button that copies it to the clipboard or opens Compose pre-filled.

**Estimated effort:** 1 day

---

### 4.5 Brief Quality Checker (in Task Creation)
**Where:** `components/tasks/create-task-dialog.tsx` — before the user saves/assigns a task  
**What:** When a user finishes writing a task description and clicks to save, trigger a brief check first: "Is this brief good enough for a copywriter to work from?"

**New API route:** `app/api/ai/brief-check/route.ts`
```ts
// POST body: { title: string, description: string, task_type: string }
// Returns: { quality: 'good' | 'needs_work' | 'incomplete', gaps: string[], suggestions: string[] }
```

**Gemini prompt:**
```
You are a creative director reviewing a task brief before assigning it to a copywriter.

TASK: [title]
TYPE: [task_type]
BRIEF: [description]

Is this brief complete enough for someone to start working without asking questions?
What is missing? What would make it better?
JSON: { quality, gaps: [], suggestions: [] }
```

**UI:** After the user writes the description, a small "Check this brief" button. If quality is `needs_work` or `incomplete`, a gentle warning panel appears with the gaps listed — user can still save and assign, but they see what's missing. If `good`, a green tick appears.

**Estimated effort:** half a day

---

### 4.6 Thinking Partner Panel (in Task Detail)
**Where:** `components/tasks/task-detail-panel.tsx` — new tab alongside the existing AI agents  
**What:** A lightweight, conversational interface for thinking through a task. Not a full chat — just a quick-turn exchange. The team member types a thought or question, Gemini responds in context.

Different from the AI Assistant (`/assistant`) because:
- This is scoped to the specific task and client
- Responses are short and opinionated (not comprehensive)
- The context is pre-loaded with the task brief, client profile, and current pipeline stage
- It gives opinions, not just information

**Example exchanges:**
- "Is this the right angle for a luxury client?" → "Honest answer: no. This feels mass-market. What makes it luxury is X, not Y. Try..."
- "I'm stuck on the hook" → "The strongest element in this brief is [X]. Lead with that. Here are 3 hook angles that use it."
- "What would the client push back on?" → "Based on their history, they'll question the CTA. They've rejected 'Shop now' twice. Try 'Explore the collection'."
- "Should this be a reel or a carousel?" → "Carousel — this content has 4 distinct points. Reels work better when there's a single insight with visual proof."

**New API route:** `app/api/ai/task-thinking/route.ts`
```ts
// POST body: { question: string, task: TaskObject, client_id: string, messages: ChatMessage[] }
// Returns: { reply: string }  // short, max ~200 words
```

**Gemini system prompt:**
```
You are a senior creative strategist acting as a thinking partner on this task.
Be direct and opinionated. Give your actual view, not a balanced list of options.
Keep replies under 150 words. Ask one clarifying question if the query is vague.
Never hedge with "it depends" — pick a position and defend it.

TASK CONTEXT:
[task title, description, stage, assignee]

CLIENT CONTEXT:
[client intelligence block]
```

**UI:**
- New "Think" tab in the task detail panel (alongside Copy, Research, etc.)
- Simple input + response. Last 5 exchanges retained in component state (not persisted — this is scratchpad thinking, not a record)
- Responses styled differently from generated content — more conversational, no copy button

**Estimated effort:** 1.5 days

---

### 4.7 Pre-Approval Content Check
**Where:** `app/(app)/publishing/page.tsx` — on any post before it's included in an approval request  
**What:** Before sending content to a client for approval, a team member can run a "Ready to send?" check. AI reviews the post for:
- Client fit (based on context bank)
- Format appropriateness for the platform
- Whether the hook is strong enough
- Any brand voice violations
- Whether the CTA is appropriate

Returns a go/no-go with specific reasons.

**New API route:** `app/api/ai/pre-approval-check/route.ts`
```ts
// POST body: { caption: string, platform: string, client_id: string, post_type: string }
// Returns: { ready: boolean, score: number, issues: string[], verdict: string }
```

**UI:** On the Approval creation dialog, next to each post a small "Check" button. Shows a colored badge: green (ready), amber (minor issues), red (not ready — fix first). Expandable to see specific issues.

**Estimated effort:** 1 day

---

### 4.8 Strategy Gap Finder (in Strategy Tool)
**Where:** `app/(app)/studio/strategy/page.tsx` — after strategy is generated  
**What:** After the full strategy document is generated, a "What's missing?" button runs a second pass that identifies:
- Topics the strategy doesn't address
- Months or quarters where the tactic density is thin
- Risks not mentioned
- Competitor moves the strategy doesn't account for

**New API route:** `app/api/studio/strategy-gaps/route.ts`
```ts
// POST body: { strategy_text: string, client_id: string }
// Returns: { gaps: string[], risks: string[], thin_periods: string[], quick_fixes: string[] }
```

**UI:** A panel below the strategy document: "Gaps found (3)" → expandable list. Each gap has a "Add to strategy" button that appends a section via the studio chat mechanism.

**Estimated effort:** 1 day

---

## Phase 5 — Performance Intelligence

### 5.1 "Create More Like This" Button
**Where:** `app/(app)/reports/page.tsx` and `app/(app)/library/page.tsx`  
**What:** On any post card that shows performance data, a "Create more like this" button that opens Content Studio pre-filled with:
- Client pre-selected
- Format type matching the high-performing post
- A note injected into the brief: "Reference: this [format] got [X]% ER on [platform] on [date]. Generate variations with the same structural approach."
- The hook type from the reference post pre-selected

**Implementation:** Pass as URL params to `/studio/content?client=X&format=reel&reference_er=4.2&reference_hook=question&reference_caption=...`

**Estimated effort:** half a day

### 5.2 Creative Fatigue Widget
**Where:** Client detail modal → new "Content Health" section  
**What:** Shows for the last 30 days:
- Hook types used: question hook × 6, statement hook × 2, statistic hook × 1
- Formats used: reel × 8, carousel × 2, static × 1
- A warning if any single hook type or format exceeds 40% of content for that period: "Question hooks used 67% of the time — audience may be fatigued. Vary the format."

**No AI needed** — SQL aggregation on `scheduled_posts` and `post_performance_snapshots`.

**Estimated effort:** 1 day

---

## Phase 6 — Arabic Quality

### 6.1 Fix Arabic Encoding in Hook Lab
**File:** `app/api/studio/hooks/generate/route.ts`  
**Fix:** As part of Phase 0.1 — re-type Arabic dialect instruction strings directly. Verify the file encoding is UTF-8 BOM-free. The strings should read: `اللهجة السعودية` not `Ø§Ù„Ù„Ù‡Ø¬Ø©`.

### 6.2 Arabic Naturalness Validation Pass
**Where:** Any API route that generates Arabic content (hooks, copy engine, captions)  
**What:** After the main generation, run a second lightweight Gemini call:
```
Does this sound like how a real [Saudi/Egyptian/Gulf] person would write on social media, 
or does it sound translated from English? 
Answer: "natural" or "translated" and if translated, rewrite the most unnatural line.
```
If the response is "translated", substitute the rewritten line and flag it in the API response.

**New utility:** `lib/arabic-validator.ts` — a 20-line function wrapping `geminiGenerate` for this check.

**Estimated effort:** half a day

### 6.3 Platform-Specific Hook Briefs
**File:** `app/api/studio/hooks/generate/route.ts`  
**What:** Currently the hook prompt doesn't specify platform context. Add a platform-aware instruction:
- TikTok: "First 3 words must be a direct address or pattern-interrupt. Under 8 words total. No emojis."
- Instagram: "Works as both a caption opener and as text overlay. Under 12 words. Creates visual tension."
- LinkedIn: "Opens with a data point or professional stakes. Under 15 words. Respects professional context."
- YouTube: "Works as a title. States the promise clearly. Under 10 words."

Inject the appropriate instruction when `platform` is provided in the request body.

---

## Technical Decisions

### AI — Gemini Only (for now)
All new routes use `geminiGenerate` or `geminiJson` from `lib/gemini.ts` directly.  
Model: `gemini-3-flash-preview` (hardcoded in `lib/gemini.ts` — do not change this string).  
For mid-task support tools (reviewer, checker, thinking partner): use `temperature: 0.4` and `maxOutputTokens: 1024` — fast and direct.  
For generation tools (content, hooks, strategy): use `temperature: 0.7` and `maxOutputTokens: 4096`.

### New Route Pattern
Every new API route should follow:
```ts
export async function POST(req: NextRequest) {
  // 1. Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, { cookies: ... })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse body
  let body: ExpectedType
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // 3. Validate required fields
  const { caption, client_id } = body
  if (!caption || !client_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // 4. Call Gemini
  try {
    const result = await geminiJson<OutputType>(prompt, systemInstruction, { temperature: 0.4 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[route-name]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
```

### Database — No New Tables Needed for Phase 4
All mid-task support tools (reviewer, fit checker, revision helper, thinking partner) are **stateless** — they call Gemini and return results without persisting anything. This keeps them fast and simple. No migrations needed.

The one schema change needed for Phase 2:
```sql
-- Add to client_context_bank
ALTER TABLE client_context_bank 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
```

---

## Build Order Summary

| Phase | What | Effort | Value |
|-------|------|--------|-------|
| 0 | Fix 8 broken things | 2 days total | Stops active harm |
| 1.1 | Studio → Schedule button | 1 day | Daily use, removes friction |
| 1.2 | Auto-save context on approval | 3 hours | Context bank self-fills |
| 1.3 | "Based on" transparency panel | 1 day | Trust in AI output |
| 1.4 | "What worked this week" card | 1 day | AM daily value |
| 4.1 | Caption Reviewer in Compose | 1 day | Mid-task support |
| 4.3 | "Does this fit?" client checker | 1 day | Mid-task support |
| 4.4 | Revision Helper in Approval | 1 day | High-friction moment relieved |
| 4.6 | Thinking Partner in Task Panel | 1.5 days | Daily creative support |
| 4.5 | Brief Quality Checker | half day | Upstream quality control |
| 2.1 | Nightly learning loop cron | 2 days | Closes analytics → AI gap |
| 2.2 | Slot-based context injection | 1.5 days | AI gets better context |
| 4.2 | Hook Strength Checker | half day | Mid-task in Hook Lab |
| 4.7 | Pre-Approval Content Check | 1 day | Quality gate |
| 3.x | Role-aware dashboards | 3 days | Right info for right person |
| 5.1 | "Create more like this" | half day | Analytics → creation loop |
| 5.2 | Creative fatigue widget | 1 day | Visibility into repetition |
| 4.8 | Strategy Gap Finder | 1 day | Strategy tool deeper |
| 6.x | Arabic quality pass | 1 day | MENA differentiation |

**Total estimated:** ~22–24 working days

---

## What "Mid-Task Support" Means in Practice

The shift from "generate for me" to "work with me" looks like this across the app:

| Moment | Old way | New way |
|--------|---------|---------|
| Writing a caption | Generate → edit → publish | Write draft → "Get feedback" → see specific issues → fix → publish |
| Assigning a task | Write brief → assign | Write brief → "Check quality" → see gaps → fill them → assign |
| Client requests changes | Read note → guess what they mean → rewrite | Read note → "Help me fix this" → see interpretation + revised version |
| Building a hook | Generate 20 → pick one | Generate 20 → also score your own idea → compare → pick best |
| Stuck mid-strategy | Open AI Assistant in new tab | Type question in "Think" tab → get direct opinion in context |
| Before sending to client | Send and hope | "Ready to send?" → see fit score + issues → fix or proceed |

The tools don't replace judgment. They make judgment faster by surfacing the right question at the right moment.
