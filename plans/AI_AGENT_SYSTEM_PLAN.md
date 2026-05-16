# AI Agent System — Action Plan

> **Goal:** Build the entire backend for AI agents: the `/api/ai` route, system prompt builder, per-agent prompt templates, response caching, cost tracking, rate limiting, and reflection agent.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| `lib/ai-client.ts` | Exports `anthropic` client + model name constants only. No logic. |
| `AI_MODELS.primary` = `claude-sonnet-4-6` | Defined |
| `AI_MODELS.advanced` = `claude-opus-4-7` | Defined |
| Agent call in `task-detail-panel.tsx` | Calls `POST /api/ai` — route does not exist |
| Agent call in `moderation/page.tsx` | Same — 404 on every click |
| Agent call in `creative-eval/page.tsx` | Same |
| Agent call in `publishing/page.tsx` | Same |
| `ai_responses` table | In SQL schema — exists in Supabase |
| `api_usage` table | In SQL schema — exists in Supabase |

### What is missing
| Piece | Status |
|-------|--------|
| `app/api/ai/route.ts` | Does not exist |
| System prompt builder | Not built |
| Any agent prompt template | Not built |
| Response caching (check `ai_responses` before calling) | Not built |
| Cost tracking write to `api_usage` | Not built |
| Rate limiting | Not built |
| Reflection agent | Not built |

### Request shape (what the frontend sends)

From `task-detail-panel.tsx`:
```json
{
  "agent": "task_analyzer",
  "task": { "id", "title", "description", "pipeline_stage" },
  "client": { "id", "name", "brand_identity", "competitor_context" },
  "project": { "name" }
}
```

From `moderation/page.tsx`:
```json
{
  "agent": "moderation_reply",
  "client": { "id", "name", "brand_identity" },
  "commentText": "...",
  "commenterName": "...",
  "postCaption": "...",
  "platform": "instagram"
}
```

From `creative-eval/page.tsx`:
```json
{
  "agent": "creative_eval",
  "client": { ... },
  "imageBase64": "data:image/jpeg;base64,...",
  "mediaType": "image/jpeg"
}
```

### Expected response shape (what the frontend reads)

```json
{ "text": "..." }
```

For `copywriter` agent specifically:
```json
{ "text": "[{ \"id\": \"v1\", \"label\": \"...\", \"tone\": \"...\", \"framework\": \"...\", \"hook\": \"...\", \"text\": \"...\" }, ...]" }
```

For `creative_eval` agent — the scoring UI expects JSON inside `text`:
```json
{
  "overallScore": 82,
  "viralityScore": 74,
  "engagementPrediction": "high",
  "dimensions": [
    { "name": "Thumb-Stop Rate", "score": 85, "description": "..." },
    ...
  ],
  "psychologicalTriggers": [...],
  "viralElements": [...],
  "missingForVirality": [...],
  "strengths": [...],
  "improvements": [...],
  "bestPlatforms": [...],
  "abTestSuggestion": "..."
}
```

---

## Phase 1 — Route Handler & Agent Router

**File to create:** `app/api/ai/route.ts`

### Logic

```
POST /api/ai
1. Parse request body → extract agent type + payload
2. Validate agent type is one of the 8 known types
3. Check rate limit (Phase 4)
4. Check cache (Phase 3)
5. Build system prompt (Phase 2)
6. Call Claude API
7. Save to cache (Phase 3)
8. Track cost (Phase 3)
9. Return { text: "..." }
```

### Route skeleton

```ts
import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { buildSystemPrompt } from '@/lib/agents/prompt-builder'
import { checkCache, saveToCache } from '@/lib/agents/cache'
import { trackCost } from '@/lib/agents/cost-tracker'
import { checkRateLimit } from '@/lib/agents/rate-limit'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { agent, ...context } = body

  // Phase 4: rate limit
  const userId = /* from session */ 'user_id'
  const limited = await checkRateLimit(userId)
  if (limited) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  // Phase 3: cache check
  const cached = await checkCache(agent, context)
  if (cached) return NextResponse.json({ text: cached.response_text })

  // Phase 2: build prompt
  const { systemPrompt, userPrompt, model } = buildSystemPrompt(agent, context)

  // Call Claude
  const message = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Phase 3: save cache + track cost
  await saveToCache(agent, context, text)
  await trackCost(agent, message.usage, model, userId, context.task?.id)

  return NextResponse.json({ text })
}
```

### Files to create

| File | Purpose |
|------|---------|
| `app/api/ai/route.ts` | Main route handler |
| `lib/agents/prompt-builder.ts` | System prompt + user prompt construction |
| `lib/agents/cache.ts` | Cache check + save |
| `lib/agents/cost-tracker.ts` | Write to `api_usage` table |
| `lib/agents/rate-limit.ts` | 10 req/user/min enforcement |

---

## Phase 2 — System Prompt Builder

**File:** `lib/agents/prompt-builder.ts`

### Context injected into every prompt

Every agent receives:
```
You are an AI assistant for NOVAX, a social media agency.
No hashtags or emojis in any output unless the task description explicitly requests them.
No vague filler. Be direct, specific, and actionable.

CLIENT CONTEXT:
- Client: {client.name}
- Industry: {client.brand_identity.industry}
- Tone of voice: {client.brand_identity.tone_of_voice}
- Key messages: {client.brand_identity.key_messages.join(', ')}
- Target audience: {client.brand_identity.target_audience}
- Competitors: {client.competitor_context.join(', ')}
- Do: {tone_dos.join(' | ')}
- Don't: {tone_donts.join(' | ')}

TASK CONTEXT:
- Title: {task.title}
- Description: {task.description}
- Pipeline stage: {task.pipeline_stage}
- Project: {project.name}

OUTPUT LANGUAGE: {language}
```

### Per-agent model selection

| Agent | Model |
|-------|-------|
| `task_analyzer` | `claude-sonnet-4-6` |
| `copywriter` | `claude-sonnet-4-6` |
| `researcher` | `claude-opus-4-7` |
| `asset_finder` | `claude-sonnet-4-6` |
| `presentation_builder` | `claude-opus-4-7` |
| `content_calendar` | `claude-sonnet-4-6` |
| `creative_eval` | `claude-sonnet-4-6` (vision-capable) |
| `moderation_reply` | `claude-sonnet-4-6` |

---

## Phase 3 — Per-Agent Prompt Templates

**File:** `lib/agents/prompt-builder.ts` — one exported function per agent

### `task_analyzer`

```
User prompt:
Analyze this task brief. Return:
1. Completeness score (0-100) with reasoning
2. Missing information (list each item)
3. Recommended approach for the {stage} stage
4. Estimated complexity (Simple / Medium / Complex)
5. Suggested next steps

Be concise. No padding.
```

### `copywriter`

```
User prompt:
Generate 3 distinct copy variants for this {stage}-stage task.
Return as JSON array exactly:
[
  { "id": "v1", "label": "AIDA — Aspirational", "tone": "...", "framework": "AIDA", "hook": "...", "text": "..." },
  { "id": "v2", "label": "PAS — Problem-led", "tone": "...", "framework": "PAS", "hook": "...", "text": "..." },
  { "id": "v3", "label": "Social Currency", "tone": "...", "framework": "STEPPS", "hook": "...", "text": "..." }
]
Return only the JSON. No wrapper text.
Max 150 words per variant. Match brand voice exactly.
```

### `researcher`

```
User prompt:
Research this topic for the client. Return:
1. Market context (2-3 key trends relevant to this task)
2. Competitor gap analysis (what competitors are NOT doing)
3. Content opportunity (what this client could own)
4. 5 relevant content angles for this brief
5. Cultural/seasonal context relevant to {client.country}
```

### `asset_finder`

```
User prompt:
Extract 8-10 Freepik search queries for this task.
Also suggest 3 Google Drive search terms to find existing client assets.
Return as JSON:
{ "freepik_queries": [...], "drive_terms": [...], "style_direction": "..." }
Return only the JSON.
```

### `presentation_builder`

```
User prompt:
Generate a 12-slide presentation structure for this campaign.
Return as JSON array:
[{ "slide": 1, "title": "...", "layout": "cover|text|chart|image+text|table", "content": "...", "notes": "..." }]
Be specific. Include real numbers from the task context where available.
Return only the JSON.
```

### `content_calendar`

```
User prompt:
Generate a {month} {year} content calendar for {client.name}.
Platforms: {platforms}. Frequency: {frequency} posts/week.
Brief: {brief}
Language: {language}

Return as JSON array (20-30 entries):
[{ "date": "YYYY-MM-DD", "time": "HH:MM", "platform": "...", "type": "Reel|Post|Story|Carousel", "title": "...", "anchorEvent": "..." | null, "eventType": "islamic|global|regular" }]
Return only the JSON. Respect Islamic calendar events for the month.
```

### `creative_eval`

```
System: You are a creative performance analyst. Evaluate the uploaded creative asset.
User prompt:
Evaluate this creative asset for {client.name} targeting {target_audience} on {platforms}.
Brand: {brand_identity.tone_of_voice}. Colors: {brand_identity.primary_color}.

Return as JSON:
{
  "overallScore": 0-100,
  "viralityScore": 0-100,
  "engagementPrediction": "low|medium|high|viral",
  "dimensions": [
    { "name": "Thumb-Stop Rate", "score": 0-100, "description": "..." },
    { "name": "Emotional Resonance", "score": 0-100, "description": "..." },
    { "name": "Brand Coherence", "score": 0-100, "description": "..." },
    { "name": "Message Clarity", "score": 0-100, "description": "..." },
    { "name": "Visual Quality", "score": 0-100, "description": "..." },
    { "name": "Share & Save Potential", "score": 0-100, "description": "..." },
    { "name": "Platform Fit", "score": 0-100, "description": "..." }
  ],
  "psychologicalTriggers": ["..."],
  "viralElements": ["..."],
  "missingForVirality": ["..."],
  "strengths": ["...","...","..."],
  "improvements": ["...","...","..."],
  "bestPlatforms": ["..."],
  "abTestSuggestion": "..."
}
Return only the JSON.
```

### `moderation_reply`

```
User prompt:
Write a reply to this {platform} comment on behalf of {client.name}.
Commenter: {commenterName} says: "{commentText}"
Post context: "{postCaption}"

Brand voice: {brand_identity.tone_of_voice}
Rules: No emojis. Keep under 100 words. Stay on-brand. Do not start with "Hi" or "Hey".
Be warm, direct, and helpful. If the comment is negative, acknowledge and offer resolution.

Return only the reply text. Nothing else.
```

---

## Phase 4 — Response Caching

**File:** `lib/agents/cache.ts`

### Cache key

```
prompt_hash = SHA256(agent_type + task_id + client_id + stable_context_snapshot)
```

The "stable context snapshot" excludes timestamps and mutable fields. Only task description + client brand identity + agent type are hashed. This ensures the same brief + same client always returns cached output.

### Check cache

```ts
export async function checkCache(agent: string, context: Record<string, unknown>) {
  const hash = computeHash(agent, context)
  const { data } = await supabase
    .from('ai_responses')
    .select('response_text')
    .eq('prompt_hash', hash)
    .eq('is_cached', true)
    .single()
  return data ?? null
}
```

### Save to cache

```ts
export async function saveToCache(agent: string, context: Record<string, unknown>, text: string) {
  const hash = computeHash(agent, context)
  await supabase.from('ai_responses').insert({
    task_id: context.task?.id ?? null,
    agent_type: agent,
    prompt_hash: hash,
    response_text: text,
    is_cached: true,
    model_used: /* model selected */,
    created_at: new Date().toISOString(),
  })
}
```

---

## Phase 5 — Cost Tracking

**File:** `lib/agents/cost-tracker.ts`

```ts
const COST_PER_MILLION_TOKENS = {
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
}

export async function trackCost(
  agent: string,
  usage: { input_tokens: number; output_tokens: number },
  model: string,
  userId: string,
  taskId?: string,
) {
  const rates = COST_PER_MILLION_TOKENS[model]
  const cost = (usage.input_tokens / 1_000_000) * rates.input
           + (usage.output_tokens / 1_000_000) * rates.output

  await supabase.from('api_usage').insert({
    user_id: userId,
    task_id: taskId ?? null,
    agent_type: agent,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: cost,
    created_at: new Date().toISOString(),
  })
}
```

---

## Phase 6 — Rate Limiting

**File:** `lib/agents/rate-limit.ts`

Simple in-memory map per user (sufficient for this deployment scale):

```ts
const WINDOW_MS = 60_000   // 1 minute
const MAX_REQUESTS = 10

const store = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = store.get(userId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(userId, { count: 1, windowStart: now })
    return false // not limited
  }

  if (entry.count >= MAX_REQUESTS) return true // limited

  entry.count++
  return false
}
```

> For multi-instance production deployments, replace with a Redis-backed counter. For single-instance Vercel, the in-memory map is sufficient.

---

## Phase 7 — Reflection Agent

**Runs after every successful generation. Not a separate API call — append to the same route.**

### What it checks

After receiving the Claude response, before returning to the client:

1. **No hashtags** in output (fail if `#word` pattern found and agent is not `content_calendar`)
2. **No emojis** in output (fail if emoji unicode range detected)
3. **Brand voice alignment** — re-read the brand identity tone and check the output doesn't contradict a known "Don't"
4. **JSON validity** — for agents that return JSON (`copywriter`, `creative_eval`, `asset_finder`, `presentation_builder`, `content_calendar`): attempt `JSON.parse()`, catch and regenerate once

### Implementation

Add a `reflect()` function called after generation:

```ts
function reflect(agent: string, text: string, context: Record<string, unknown>): { pass: boolean; issues: string[] }
```

If `pass === false` and issues include JSON parse error: regenerate once, then return regardless of second result.

---

## Build Order

```
Phase 1a  Create app/api/ai/route.ts (skeleton, no agents yet)
Phase 1b  Create lib/agents/prompt-builder.ts (empty exports)
Phase 1c  Test route returns 200 with stub text

Phase 2a  Build buildSystemPrompt() with context injection
Phase 2b  Wire client + task context into every prompt

Phase 3a  task_analyzer prompt
Phase 3b  copywriter prompt + JSON response handling
Phase 3c  moderation_reply prompt
Phase 3d  creative_eval prompt (with vision/image support)
Phase 3e  content_calendar prompt
Phase 3f  researcher prompt
Phase 3g  asset_finder prompt
Phase 3h  presentation_builder prompt

Phase 4a  Create lib/agents/cache.ts
Phase 4b  Wire cache check into route (before Claude call)
Phase 4c  Wire cache save into route (after Claude call)

Phase 5a  Create lib/agents/cost-tracker.ts
Phase 5b  Wire into route after each call

Phase 6a  Create lib/agents/rate-limit.ts
Phase 6b  Wire into route before agent execution

Phase 7a  Add reflect() function
Phase 7b  Wire into route before response return
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `app/api/ai/route.ts` | 1 | Create |
| `lib/agents/prompt-builder.ts` | 2, 3 | Create |
| `lib/agents/cache.ts` | 4 | Create |
| `lib/agents/cost-tracker.ts` | 5 | Create |
| `lib/agents/rate-limit.ts` | 6 | Create |

---

## Scope Boundary

- **No streaming** — return full response at once. Streaming adds complexity without clear UX benefit at current scale.
- **No multi-turn conversations** — each agent call is stateless (context is injected, not conversational).
- **No Gemini fallback in production** — the `dev` model constant exists but production always uses Anthropic.
- **No function/tool use** — all agents return text or JSON text. No structured tool calls.
