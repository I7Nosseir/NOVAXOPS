# PLAN: AI Generation Persistence & Control

**Status:** Ready for implementation  
**Priority:** P0 — affects every user on every AI-heavy page  
**Scope:** All 14 API routes, 40+ agent types, 10+ UI surfaces

---

## Problem

Right now only 5 agents (the task panel agents) have any caching — everything else fires a fresh API call every time a user visits a page, opens a dialog, or revisits a result. This means:

- Content calendars are regenerated every time the dialog opens
- Creative eval scores vanish when the user navigates away
- CEO strategy analyses are re-run on each tab switch
- Moderation AI replies disappear after the component unmounts
- Studio scripts and research are lost if the user refreshes
- Report analyses have no memory between sessions

**Cost impact:** Every uncached call burns API budget. The same analysis runs dozens of times per day for the same client with the same data.

---

## Current Caching State

| Route / Agent | Cached? | Where? | Scope |
|---|---|---|---|
| `/api/ai` → `task_analyzer` | Yes | `ai_responses` table | Per task |
| `/api/ai` → `copywriter` | Yes | `ai_responses` table | Per task |
| `/api/ai` → `researcher` | Yes | `ai_responses` table | Per task |
| `/api/ai` → `asset_finder` | Yes | `ai_responses` table | Per task |
| `/api/ai` → `presentation_builder` | Yes | `ai_responses` table | Per task |
| `/api/clients/analyze` | Partial | `clients.performance_intel` | Per client, no TTL |
| `/api/performance/analyze` | Partial | `clients.performance_intel` | Per client, no TTL |
| `/api/ai` → `content_calendar` | **No** | — | — |
| `/api/ai` → `creative_eval` | **No** | — | — |
| `/api/ai` → `moderation_reply` | **No** | — | — |
| `/api/ai` → `post_caption` | **No** | — | — |
| `/api/ai` → `humanizer` | **No** | — | — |
| `/api/ceo/crisis` | **No** | — | — |
| `/api/ceo/strategy` | **No** | — | — |
| `/api/ceo/second-opinion` | **No** | — | — |
| `/api/studio/content/[id]/research` | **No** | — | — |
| `/api/studio/content/[id]/script` | **No** | — | — |
| `/api/studio/hooks/generate` | **No** | — | — |
| `/api/studio/strategy` | **No** | — | — |
| `/api/tools/role` | **No** | — | — |
| `/api/ai-image/generate` | **No** | — | — |
| `/api/tools/resize/analyze` | **No** | — | — |
| `/api/tools/resize/generate` | **No** | — | — |
| `/api/reports/analyze` | **No** | — | — |

**19 out of 24 route/agent combinations have zero persistence.**

---

## Architecture: Two-Tier Persistence

### Tier 1 — Server cache (Supabase)
Persists AI outputs to the database so they survive page refreshes, browser closes, and new sessions. Each output is keyed by a SHA-256 hash of the inputs that produced it — if the inputs haven't changed, the saved result is returned instantly.

### Tier 2 — Client cache (TanStack Query)
On page/component mount, the UI fetches the latest saved output from Supabase before showing an empty state or a generate button. If a saved result exists, it displays immediately. No API call is made unless the user explicitly clicks "Regenerate".

This gives users a seamless experience: results are always there when they return, and regeneration is opt-in.

---

## Phase 1 — Universal Persistence Table

### New SQL migration: `015_ai_generations.sql`

The existing `ai_responses` table is task-scoped. We need a general-purpose store.

```sql
CREATE TABLE ai_generations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What entity owns this generation
  entity_type   text        NOT NULL CHECK (entity_type IN (
                              'task', 'client', 'content_item', 
                              'moderation_item', 'report', 'studio_content',
                              'global'
                            )),
  entity_id     text        NOT NULL,   -- uuid cast to text (or slug for global)
  -- What was generated
  agent_type    text        NOT NULL,   -- 'content_calendar', 'creative_eval', etc.
  prompt_hash   text        NOT NULL,   -- SHA-256 of (agent + inputs that affect output)
  response_json jsonb       NOT NULL,   -- raw structured output
  -- Meta
  model_used    text,
  cost_usd      numeric(10,6) DEFAULT 0,
  is_stale      boolean     DEFAULT false,  -- user clicked Regenerate
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE (entity_type, entity_id, agent_type)  -- one live result per entity+agent
);

-- Fast lookup: "do we have a saved result for this entity+agent?"
CREATE INDEX ai_gen_entity_idx ON ai_generations (entity_type, entity_id, agent_type);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ceo_manage_generations" ON ai_generations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'ceo'))
  );

CREATE POLICY "authenticated_read_generations" ON ai_generations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_generations" ON ai_generations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

**Design decisions:**
- `UNIQUE (entity_type, entity_id, agent_type)` — one live result per entity per agent. An upsert replaces it. No unbounded row growth.
- `is_stale = true` — set when user hits Regenerate; tells the UI to re-fetch while showing the old result in a dimmed state.
- `prompt_hash` — still stored so we can detect if inputs changed (e.g. brief was edited) and auto-mark stale.

---

## Phase 2 — Server-Side Cache Utility

### New file: `lib/ai-cache.ts`

Single utility used by every API route. Replaces the ad-hoc hash logic currently scattered across routes.

```typescript
import crypto from 'crypto'

export type EntityType = 
  | 'task' | 'client' | 'content_item' 
  | 'moderation_item' | 'report' | 'studio_content' | 'global'

export interface CacheResult<T> {
  data: T | null
  hit: boolean
  id?: string
}

/** Hash any set of inputs into a stable cache key */
export function hashInputs(...parts: unknown[]): string {
  return crypto
    .createHash('sha256')
    .update(parts.map(p => JSON.stringify(p ?? '')).join('|'))
    .digest('hex')
}

/** Check cache. Returns { data, hit: true } or { data: null, hit: false } */
export async function getCached<T>(
  db: SupabaseClient,
  entityType: EntityType,
  entityId: string,
  agentType: string,
  promptHash: string
): Promise<CacheResult<T>> {
  const { data } = await db
    .from('ai_generations')
    .select('id, response_json, is_stale')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('agent_type', agentType)
    .eq('is_stale', false)
    .single()

  if (!data) return { data: null, hit: false }
  // If hash changed (inputs updated), treat as miss
  if (data.prompt_hash !== promptHash) return { data: null, hit: false }
  return { data: data.response_json as T, hit: true, id: data.id }
}

/** Save or update a generation result */
export async function saveGeneration(
  db: SupabaseClient,
  entityType: EntityType,
  entityId: string,
  agentType: string,
  promptHash: string,
  responseJson: unknown,
  meta?: { model_used?: string; cost_usd?: number }
): Promise<void> {
  await db.from('ai_generations').upsert({
    entity_type: entityType,
    entity_id: entityId,
    agent_type: agentType,
    prompt_hash: promptHash,
    response_json: responseJson,
    is_stale: false,
    updated_at: new Date().toISOString(),
    ...meta,
  }, { onConflict: 'entity_type,entity_id,agent_type' })
}
```

---

## Phase 3 — Route-by-Route Implementation

For each uncached route, add three things:
1. A `GET` endpoint (or add to existing `GET`) that returns the saved result
2. Cache check at the top of the `POST` handler
3. Save call after successful generation

### 3A. `/api/ai` — Extend to cover all agents

**Agents to add to `CACHEABLE_AGENTS`:**
- `content_calendar` — keyed by `(client_id, month, frequency, brief_hash)`
- `creative_eval` — keyed by `(file_hash_or_url, client_id)`
- `moderation_reply` — keyed by `(moderation_item_id, agent_type)` — saved to `moderation_items.ai_suggested_reply` AND `ai_generations`
- `post_caption` — keyed by `(post_id or brief_hash, client_id)`
- `humanizer` — keyed by `(input_text_hash)`

**New query param:** `force=true` → skip cache check, regenerate, overwrite save.

### 3B. `/api/ceo/crisis`, `/api/ceo/strategy`, `/api/ceo/second-opinion`

- `entity_type = 'client'`, `entity_id = client_id`
- `agent_type = 'ceo_crisis' | 'ceo_strategy' | 'ceo_second_opinion'`
- Add `GET /api/ceo/crisis?client_id=X` to return saved result
- Stale TTL: 24 hours (crisis situations change; auto-set `is_stale = true` after 24h via cron or on-read)

### 3C. `/api/studio/content/[id]/research`, `script`, `/api/studio/hooks/generate`, `/api/studio/strategy`

- `entity_type = 'studio_content'`, `entity_id = content_item_id`
- `agent_type = 'studio_research' | 'studio_script' | 'studio_hooks' | 'studio_strategy'`
- Studio pages load saved outputs on mount via `GET /api/studio/content/[id]/research`
- Research, hooks, script, strategy each independently cached — user can regenerate one without losing others

### 3D. `/api/tools/role`

- `entity_type = 'global'`, `entity_id = tool_name + ':' + user_id`
- Most role tools are one-shot (not tied to a specific entity) — cache per user per tool per input hash
- TTL: 1 hour (short — role tools are exploratory)

### 3E. `/api/ai-image/generate`

- `entity_type = 'global'`, `entity_id = hash(prompt + style + ratio)`
- Cache as base64 string in `response_json.imageData`
- **Important:** base64 images are large. Consider moving to Supabase Storage and saving only the URL.
  - On generate: upload to `storage/ai-images/[hash].png` → save URL to `ai_generations`
  - On cache hit: return `{ imageUrl: '...', cached: true }`

### 3F. `/api/tools/resize/analyze` + `/api/tools/resize/generate`

- `entity_type = 'global'`, `entity_id = hash(imageBase64)`
- Cache the layout schema from `analyze` (cheap, pure analysis)
- Cache the output URLs from `generate` (expensive, image outpainting)
- Same Storage strategy as images above

### 3G. `/api/reports/analyze`

- `entity_type = 'report'`, `entity_id = report_id` (or hash of uploaded files + prompt)
- Cache the markdown + JSON output
- Add `GET /api/reports/[id]/analysis` to load saved result on reports page mount

---

## Phase 4 — New GET Endpoints (Load on Mount)

Every page that shows AI-generated content needs a `GET` endpoint to load saved results. Without this, the UI can only get results from a fresh `POST`.

| Page | New GET endpoint | What it returns |
|---|---|---|
| Publishing (calendar) | `GET /api/ai/saved?entity=client&id=X&agent=content_calendar` | Calendar JSON or null |
| Creative Eval | `GET /api/ai/saved?entity=client&id=X&agent=creative_eval` | Scores JSON or null |
| Moderation | `GET /api/ai/saved?entity=moderation_item&id=X&agent=moderation_reply` | Reply text or null |
| CEO page | `GET /api/ceo/saved?client_id=X&tool=crisis` | Saved analysis or null |
| Studio pages | `GET /api/studio/content/[id]/saved` | All saved stages or null |
| Reports | `GET /api/reports/[id]/analysis` | Saved report or null |

**Or:** Create a single unified endpoint:
```
GET /api/ai/saved?entity_type=client&entity_id=X&agent_type=content_calendar
```
Returns `{ data: {...} | null, generated_at: ISO | null, is_stale: boolean }`.

---

## Phase 5 — Frontend Changes

### 5A. Load saved results on mount

Every component that triggers AI generation should:

```typescript
// On mount: fetch saved result before showing empty state
const { data: savedResult } = useQuery({
  queryKey: ['ai-result', entityType, entityId, agentType],
  queryFn: () => fetch(`/api/ai/saved?entity_type=${entityType}&entity_id=${entityId}&agent_type=${agentType}`)
    .then(r => r.json()),
  staleTime: 5 * 60 * 1000,  // 5 min — don't refetch on every focus
})
```

If `savedResult.data` is not null → show results immediately, show "Regenerate" button.  
If `savedResult.data` is null → show generate button as primary action.

### 5B. Cached indicator

Show a subtle badge/line next to any displayed AI result:

```
Generated [time ago]  [Regenerate]
```

- "Generated 2 hours ago" in muted text
- "Regenerate" button in ghost/outline variant
- When user clicks Regenerate → POST with `force=true` → update cache → update UI
- While regenerating → dim existing result (don't hide it), show spinner inline

### 5C. Stale detection

If the inputs that generated the cached result have changed (e.g. task description was edited, brief was updated), automatically surface a warning:

```
Brief has changed since this was generated.  [Update]
```

Detected by comparing current input hash against stored `prompt_hash`.

### 5D. "Clear generation" action

In settings or per-entity, allow admin to bulk-clear cached generations for a client. This forces fresh regeneration on next visit. Use the `is_stale` flag — no data deletion.

---

## Phase 6 — Rate Limiting & Cost Controls

### Current issues
- Rate limit is per-IP, not per-user — a single user behind a proxy can exhaust the limit for everyone
- No monthly budget cap per client
- No visibility into what's costing the most

### Changes

**6A. Per-user rate limiting (when Supabase auth is live)**
```typescript
// Replace IP-based limiter with user-based
const userId = await getUserIdFromSession(req)
const key = `rate:${userId}`
```

**6B. Per-client monthly budget**
- Add `ai_budget_usd` column to `clients` table (default: 50.00)
- Add `ai_spent_this_month_usd` computed from `api_usage` grouped by client + month
- If `ai_spent >= ai_budget` → block generation, return 402 with message "Client budget reached for this month. Admin can increase limit in client settings."
- Show budget gauge in client detail modal (admin/ceo only)

**6C. Cost visibility in UI**
- Task detail panel: show cumulative cost for this task's generations (from `api_usage`)
- Client detail modal: show month-to-date AI cost
- Dashboard: AI cost widget for admin/ceo — today vs 30d average, top spending clients

**6D. Queue for expensive operations**
- Studio strategy + CEO strategy + report analysis = expensive multi-agent calls
- Add `is_processing` state to `ai_generations` before the call starts
- If user navigates away and comes back, they see "Your analysis is being prepared..." and it resolves when the row updates
- Prevents duplicate calls if user clicks Generate twice

---

## Implementation Order

### Sprint 1 — Foundation (2–3 days)
1. Write and run `sql/015_ai_generations.sql`
2. Create `lib/ai-cache.ts` with `hashInputs`, `getCached`, `saveGeneration`
3. Create `GET /api/ai/saved` unified endpoint
4. Extend `/api/ai` POST handler: add `content_calendar`, `creative_eval`, `moderation_reply`, `post_caption`, `humanizer` to `CACHEABLE_AGENTS` using new utility
5. Verify existing 5 task agents still work (regression check)

### Sprint 2 — CEO & Client routes (1 day)
6. Add cache to `/api/ceo/crisis`, `/api/ceo/strategy`, `/api/ceo/second-opinion`
7. Add `GET` endpoints for each CEO route
8. Add 24h auto-stale logic for crisis analyses

### Sprint 3 — Studio routes (1–2 days)
9. Add cache to all 4 studio routes (`research`, `script`, `hooks`, `strategy`)
10. Each stage independently cached and independently regeneratable
11. `GET /api/studio/content/[id]/saved` returns all saved stages

### Sprint 4 — Images & Reports (1–2 days)
12. Add Supabase Storage bucket `ai-image-cache`
13. Update `/api/ai-image/generate` to save to Storage, cache URL
14. Update `/api/tools/resize` to cache layout schema + output URLs
15. Add cache to `/api/reports/analyze`, create `GET /api/reports/[id]/analysis`

### Sprint 5 — Frontend (2–3 days)
16. Publishing page: load saved calendar on mount, Regenerate button
17. Creative Eval page: load saved scores on mount, Regenerate button
18. Moderation page: load saved reply on mount (already shown in mock, make it real)
19. CEO page: load saved analysis on tab switch
20. Studio pages: load all saved stages on mount
21. Task detail panel: add "Generated X ago" + Regenerate to existing agents
22. Add cached/stale indicator component (reusable)

### Sprint 6 — Cost controls (1 day)
23. Add `ai_budget_usd` to clients table (SQL migration `016_client_ai_budget.sql`)
24. Budget check middleware in `/api/ai` POST handler
25. AI cost widget on dashboard (admin/ceo only)
26. Per-user rate limiting (after auth is live)

---

## Files to Create / Modify

### New files
- `sql/015_ai_generations.sql`
- `sql/016_client_ai_budget.sql`
- `lib/ai-cache.ts`
- `app/api/ai/saved/route.ts`

### Modified files
- `app/api/ai/route.ts` — add new agents to CACHEABLE_AGENTS, use ai-cache utility, add `force` param
- `app/api/ceo/crisis/route.ts` — add cache check + save
- `app/api/ceo/strategy/route.ts` — add cache check + save
- `app/api/ceo/second-opinion/route.ts` — add cache check + save
- `app/api/studio/content/[id]/research/route.ts` — add cache
- `app/api/studio/content/[id]/script/route.ts` — add cache
- `app/api/studio/hooks/generate/route.ts` — add cache
- `app/api/studio/strategy/route.ts` — add cache
- `app/api/tools/role/route.ts` — add cache (short TTL)
- `app/api/ai-image/generate/route.ts` — add Storage + URL cache
- `app/api/tools/resize/analyze/route.ts` — add cache
- `app/api/tools/resize/generate/route.ts` — add Storage + URL cache
- `app/api/reports/analyze/route.ts` — add cache
- `app/(app)/publishing/page.tsx` — load on mount, Regenerate
- `app/(app)/creative-eval/page.tsx` — load on mount, Regenerate
- `app/(app)/moderation/page.tsx` — load on mount, Regenerate
- `app/(app)/ceo/page.tsx` — load on mount per tab, Regenerate
- `components/tasks/task-detail-panel.tsx` — add "Generated X ago" + Regenerate

---

## Key Invariants (never break these)

1. **Cache is a speed optimisation, not a source of truth.** The AI route still validates inputs before serving a cached result — it never serves a cached result for different inputs.
2. **`force=true` always regenerates.** The user is always in control. No generation is ever permanently locked.
3. **Stale results are never deleted.** `is_stale = true` marks the result as outdated; the data stays for audit purposes. New generation creates a fresh row via upsert.
4. **Images go to Storage, not DB.** Base64 in jsonb is an anti-pattern for images — always save to Supabase Storage and cache the URL.
5. **Rate limiting protects the AI budget.** Even with caching, a forced regeneration counts against rate limits.
6. **Cost tracking is fire-and-forget.** Never await `api_usage` inserts in the response path.
