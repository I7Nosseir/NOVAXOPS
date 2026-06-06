# PLAN: Peak Creative Format Generator
**Studio Tool — `/studio/formats`**
Version: 1.0 · Status: Planning

---

## What This Is

A standalone Studio tool that takes a **niche** as input and produces **5 complete viral content formats** — each a fully specified repeatable creative engine. Unlike the Hook Lab (scores individual hooks) or Content Studio (requires a client brief), this tool is **niche-first, format-first, client-agnostic**. It is the upstream creative strategy layer: you come here to discover what *type* of content wins in a space, before building individual pieces.

This tool is also the seed for a **platform-wide viral intelligence upgrade** — the hook taxonomy and format DNA developed here become a shared context layer injected into every AI content generation call across the app.

---

## The Viral Format DNA

Three laws that every generated format must satisfy. These laws derive from the user's definition of viral content.

### Law 1: The Repeatability Engine
Every format has two distinct components:
- **Fixed Scaffold** — the structure, game, or ritual that never changes (the show format)
- **Variable Slot** — what changes each episode (the subject, participant, flavor, challenge variant)

The format must be able to produce a third episode by just swapping the variable slot. If you need to redesign the format for episode 3, it is not a format — it is a one-off.

Examples from the user's reference set:
| Format | Fixed Scaffold | Variable Slot |
|---|---|---|
| Job Ladder | Interview → rejection → next rung | The job role being applied for |
| 60-Second Drum Gauntlet | Challenger goes → professional beats both | Who challenges + the instrument/skill |
| Coffee Alchemy | "What if X + Y?" → creation journey → reaction | The flavor combination |

### Law 2: The Curiosity Spine
Every moment in the video answers one question and **opens another**. There are three tension nodes:

1. **Hook Tension (0–5s):** Viewer asks "What's going to happen?" — the question is opened
2. **Mid Tension (5s–end-10s):** Viewer asks "Will it work / what will the result be?" — stakes are raised
3. **Payoff Tension (end):** Viewer asks "Was it worth watching?" — the prize is delivered

Curiosity must never be fully resolved until the final seconds. If the viewer can predict the ending from the hook, the format fails Law 2.

### Law 3: The Payoff Promise
The viewer must sense a **specific prize** waiting before they arrive at it. The hook plants the promise, the structure sustains the anticipation, the ending delivers it.

The payoff must be:
- **Concrete** — not "see what happens" but "see the professional drummer's score"
- **Earned** — payoff lands harder after the mid-tension build
- **Surprising or satisfying** — either exceeded expectations or perfectly fulfilled the promise

---

## The Hook Stack System

Every format's opening must deploy **2–3 hook types** from **at least 2 different tiers** below. Stacking two hooks from the same tier is a collision that cancels both — never allowed.

### Full Hook Taxonomy (17 types, 4 tiers)

#### Tier 1 — Visual Hooks (what the viewer sees before they process audio)
| ID | Name | Mechanic | Example |
|---|---|---|---|
| V1 | **Visual Pattern Interrupt** | First frame is jarring, unexpected, or visually incongruent | A chef cooking in a car. A musician in a library. Something is wrong. |
| V2 | **POV Drop** | First-person perspective — viewer becomes the subject | Camera is the drummer's eyes as the challenge begins |
| V3 | **End-State Tease** | Flash of the final result in the first 1–2 seconds, then cut back to start | Show the full coffee cup, then cut to empty ingredients |
| V4 | **Mid-Action Start** | Video begins with something already in motion — no setup, no context | Drum sticks already mid-hit, coffee already pouring |
| V5 | **Text Overlay Premise** | Bold on-screen text states the core question or stakes before any word is spoken | "I tried every job on LinkedIn" |

#### Tier 2 — Verbal/Auditory Hooks (first spoken or captioned words)
| ID | Name | Mechanic | Example |
|---|---|---|---|
| A1 | **Curiosity Gap** | State that something happened but withhold the key information | "I found out the real answer to this — and it changed everything" |
| A2 | **Counter-Intuitive Claim** | Open with something that contradicts received wisdom | "The more reps I did, the less muscle I built" |
| A3 | **Direct Identity Address** | Name the viewer's identity in the first line | "If you've ever tried to get a creative job, watch this" |
| A4 | **Stakes Announcement** | Declare a constraint, countdown, or consequence before the action starts | "I have 60 seconds. This is the rule. Let's go." |
| A5 | **Question Hook** | Open with a genuine question the viewer wants answered | "What does coffee with strawberry actually taste like?" |

#### Tier 3 — Structural Hooks (format-level devices embedded in the scenario design)
| ID | Name | Mechanic | Example |
|---|---|---|---|
| S1 | **Expert Reversal** | Amateur establishes a bar → expert shatters it → viewer thinks "by how much?" | Two regular players set a score. Professional enters. |
| S2 | **The Impossible Challenge** | Task appears genuinely undoable — viewer stays to see if it breaks | "Nobody has ever hit 400 bpm. I'm going to try." |
| S3 | **The Journey Promise** | "Watch me go from [bad] to [desired] in [timeframe]" | "This coffee tasted like soap. Then I fixed it." |
| S4 | **Social Stakes** | Other people are present, reacting, judging — their responses are part of the payoff | "I made 50 strangers taste my coffee experiment" |
| S5 | **The Experiment** | Unknown outcome — viewer is genuinely uncertain what will happen | "I mixed things that have never been mixed before" |

#### Tier 4 — Psychological Hooks (viewer's internal state)
| ID | Name | Mechanic | Example |
|---|---|---|---|
| P1 | **Identity Mirror** | Video reflects the viewer's own experience, desire, or frustration back at them | "Every creative knows this rejection" |
| P2 | **FOMO / Trend Anchor** | Something is happening everywhere and the viewer is late to it | "Everyone on LinkedIn is doing this but nobody explains why" |

### Hook Stack Rules
- Minimum: 2 hooks, from at least 2 different tiers
- Maximum: 4 hooks — at 4, the viewer is genuinely overwhelmed with curiosity signals; everything is pulling them forward simultaneously. This is intentional overload, not confusion.
- Never: 2 hooks from the same tier (they cancel — same register, same channel)
- Best-performing stacks: V + A (visual sets the scene, verbal delivers the question), V + S (mid-action drop + structural device revealed), A + S + P (gap + stakes + viewer gets permission to care), V + A + S + P (full 4-tier stack — maximum overload, use for highest-stakes formats only)

---

## Output Schema Per Format

Each of the 5 generated formats contains every field below:

```
FORMAT NAME:        [Memorable, brandable name — e.g. "The 60-Second Gauntlet"]
CORE MECHANIC:      [One sentence — the repeatable engine in plain language]
FIXED SCAFFOLD:     [Bullet list of the structural steps that never change]
VARIABLE SLOT:      [What changes each episode + how many distinct episodes are possible]

HOOK STACK:
  Hook 1: [Tier + ID + name] — [Exact opening line or visual action]
  Hook 2: [Tier + ID + name] — [Exact second hook, layered on #1]
  Hook 3: [Tier + ID + name, optional] — [Third hook if used]
  Hook 4: [Tier + ID + name, optional] — [Fourth hook — maximum overload mode]

3C SCORES (0–10 each):
  Clarity:  X/10  [Is the premise instantly understood?]
  Context:  X/10  [Does the viewer immediately know if this is for them?]
  Curiosity: X/10  [Is the pull to keep watching irresistible?]

EPISODE STRUCTURE (time breakdown):
  0–5s:    [Hook delivery — exact action + words]
  5–30s:   [Variable slot introduction — the subject of this episode]
  30–Xs:   [Mid-tension build — stakes raised, question deepened]
  Xs–end:  [Payoff delivery — the prize]

PAYOFF ARCHITECTURE:
  Promise planted:  [Exact moment + exact words/visual where payoff is promised]
  Anticipation built: [How the middle sustains the wait]
  Prize delivered:  [What the viewer receives in the final 5–10 seconds]

REPEATABILITY PROOF — 3 example episodes:
  Ep 1: [Title] — [Variable slot value]
  Ep 2: [Title] — [Variable slot value]
  Ep 3: [Title] — [Variable slot value]

PLATFORM FIT:       [TikTok / Reels / Shorts / YouTube — with reason]
OPTIMAL LENGTH:     [X–Y seconds — with reason]
POSTING CADENCE:    [How often this format can sustainably post before fatigue]
GROWTH MECHANIC:    [Why this format drives follows, not just views — the retention hook]
```

---

## Tool Architecture

### Location
`app/(app)/studio/formats/page.tsx` — new Studio tool, peer to content/hooks/strategy/campaign/inspiration

### Phase 1 — Input
- **Niche field** (free text, required): e.g. "personal finance for Gen Z", "handmade leather goods", "competitive chess"
- **Platform selector** (multi-select): TikTok / Instagram Reels / YouTube Shorts / LinkedIn
- **Language** (EN / AR / Both)
- **Tone constraint** (optional, single-select): Educational / Entertaining / Inspiring / Controversial / Behind-the-scenes
- **Creator type** (optional, single-select): Solo creator / Brand / Community challenge / Expert commentary
- **Generate 5 Formats** button

No client required. No brief required. Niche is the only mandatory input.

### Phase 2 — Generation (Claude Opus)
Multi-step loading using the existing `StudioLoading` component. Steps:
1. "Mapping the niche landscape"
2. "Mining viral format patterns"
3. "Designing hook stacks"
4. "Architecting payoff sequences"
5. "Stress-testing repeatability"
6. "Finalising 5 formats"

### Phase 3 — Results
5 format cards. Each card:
- **Header**: Format name + Core Mechanic (always visible)
- **Collapsed state**: Hook Stack type badges + 3C score bars + platform tags
- **Expanded state**: Full schema — episode structure, payoff architecture, 3 example episodes
- **Actions per card**:
  - "Send to Hook Lab" → navigates to `/studio/hooks` with format name pre-filled as brief context
  - "Build Script" → navigates to `/studio/content` with format mechanic injected as signal
  - "Save to Favorites" → writes a row to `format_favorites` (full `FormatResult` snapshot + niche, optional note)
- **Page-level actions**:
  - "Regenerate all" (new AI call, clears current results)
  - "Regenerate this format" (replaces single card without touching others)
  - "Export to Document" → creates a document with all 5 formats (uses `studio-export.ts` pattern)

### Phase 4 — Session Save
Saved to `studio_sessions` table:
- `tool = 'formats'` (added to `studio_sessions_tool_check` constraint in migration 019)
- `inputs` JSON: `{ niche, platform, language, tone, creator_type }`
- `outputs` JSON: `{ formats: FormatResult[] }`
- `name` = "Peak Formats: [niche]"
- Appears in Studio Hub recent sessions with correct label

### Favorites
Favorites are saved to the **`format_favorites` table** (created in migration 019), not inside the session. This means:
- They persist across sessions and survive session deletion
- They can be browsed independently (future: Favorites panel on the page)
- Each favorite row stores: `saved_by`, `session_id` (nullable), `niche`, `format_name`, `format_data` (full snapshot), `notes`, `tags`
- RLS: users see only their own favorites; admin/ceo/creative_director see all

---

## API Route

`POST /api/studio/formats/generate`

**Input:**
```ts
{
  niche: string          // required
  platform: string[]    // required
  language: string      // 'english' | 'arabic' | 'both'
  tone?: string
  creator_type?: string
}
```

**Model (live now):** `gemini-3-flash-preview` via `geminiJson()` from `lib/gemini.ts` — active model since `ANTHROPIC_API_KEY` is not set. The prompt and output schema are model-agnostic. When Claude is connected, swap to `claude-opus-4-7` for richer creative output.

**Caching:** Via `ai_responses` table. Hash key = `MD5(niche + platform.sort().join() + language + tone + creator_type)`

**Output:** `{ formats: FormatResult[] }` — array of 5 format objects matching the schema above

**Rate limit:** Existing 10-req/min middleware applies

---

## The Prompt Architecture

The system prompt is the engine of the tool. It must embed:

### 1. Viral DNA Context (preamble)
The three laws in full, with the user's examples (drummer, coffee, job ladder) as anchors for what "correct" looks like.

### 2. Full Hook Taxonomy (injected as reference)
All 17 hooks with tier labels, names, mechanics, and brief examples. Claude uses this as its selection palette when building hook stacks.

### 3. Hook Stack Rules
The 2–3 hook / multi-tier constraint stated explicitly as a hard rule, not a preference.

### 4. 3C Scoring Criteria (from Hook Lab — consistent definition)
- Clarity: Is the premise instantly understood with zero friction?
- Context: Does it establish WHO this is for within the first 3 seconds?
- Curiosity: Does it create an irresistible pull to keep watching to the end?

### 5. Output Schema (JSON — strictly enforced)
The full format schema above as a JSON template. Instruct Claude to validate each format against the three laws before including it:
- Does it have a clear, infinitely scalable variable slot?
- Is the payoff promised in the hook and delivered at the end?
- Does the hook stack span at least 2 tiers?
- Can episode 2 and 3 be described without redesigning the structure?

### 5b. Generation Architecture
Gemini's `geminiJson()` is a single blocking call — it returns all 5 formats in one response. The loading UI uses the existing `StudioLoading` component with timed step progression (same pattern as Campaign Igniter) to keep the screen alive during the wait. Expected latency: 6–12 seconds with Gemini. When Claude Opus is connected, streaming (`stream: true`) can be added to deliver cards one-by-one — but this is a Phase 2 upgrade, not a blocker.

**Gemini token budget:** Set `maxOutputTokens: 6000` — 5 fully-specified formats with all schema fields will push ~4,000–5,000 tokens. Gemini default (2000) will truncate.

### 6. Quality Gate Instructions
Instruct Claude to internally generate and discard any format that fails the laws before reaching the output. The user gets 5 validated formats, not 5 raw ideas.

### 7. Niche-specific pressure
Instruct Claude to research the niche's specific viral patterns, common content fatigue points, and underexploited angles. The format should not be generic — it should be the best possible format for this specific niche.

---

## Platform-Wide Integration (Phase 2 — After Tool is Live)

This is the larger strategic upgrade the user identified: viral format DNA injected into all AI content generation.

### New File: `lib/viral-format-constants.ts`
Exports:
- `HOOK_TAXONOMY` — the full 17-type reference object
- `VIRAL_FORMAT_LAWS` — the three laws as text blocks
- `HOOK_STACK_RULES` — the stacking constraints
- `getHookContext(hookIds: string[])` — returns formatted context block for injection

### Injection Points
Once `viral-format-constants.ts` exists, inject into:

| Route | What Gets Injected | Effect |
|---|---|---|
| `/api/ai` (copywriter agent) | Hook taxonomy + 3-act structure rule | Copy opens with hook stack, follows curiosity spine |
| `/api/publishing/compose` | Hook taxonomy for captions + payoff promise rule | Captions have structural tension, not flat descriptions |
| `/api/studio/content/[id]/script` | Full viral DNA as creative brief context | Scripts already use this but will now reference the taxonomy explicitly |
| `/api/studio/hooks/generate` | Already aligned — no change needed | |
| `/api/moderation/reply` | Not needed — moderation replies are different in nature | |

This is a **one-file change** (`lib/ai-client.ts` or each route individually) that propagates the viral intelligence layer across the entire platform.

---

## Type Definitions (additions to `lib/studio-types.ts`)

```ts
// Add to StudioTool union:
| 'formats'

// New types:
export interface HookStackItem {
  tier: 'visual' | 'verbal' | 'structural' | 'psychological'
  id: string         // e.g. 'V1', 'A3', 'S2'
  name: string
  hook_line: string  // the actual opening line or visual action
}

export interface FormatEpisodeAct {
  timecode: string   // e.g. '0–5s'
  description: string
}

export interface FormatResult {
  format_name: string
  core_mechanic: string
  fixed_scaffold: string[]
  variable_slot: string
  hook_stack: HookStackItem[]
  three_c: {
    clarity: number
    context: number
    curiosity: number
  }
  virality_tier: 'S' | 'A' | 'B' | 'C'
  episode_structure: FormatEpisodeAct[]
  payoff: {
    promise: string
    anticipation: string
    delivery: string
  }
  repeatability_proof: Array<{ title: string; variable: string }>
  platform_fit: string[]
  optimal_length_seconds: [number, number]
  posting_cadence: string
  growth_mechanic: string
}

export interface PeakFormatSession {
  niche: string
  platform: string[]
  language: string
  tone?: string
  creator_type?: string
  formats: FormatResult[]
  favorites: number[]  // indices into formats[]
}
```

---

## Database Migration

**File:** `sql/019_peak_format_generator.sql` — run once in Supabase SQL editor.

What it does:
1. **Expands `studio_sessions_tool_check`** constraint to include `'formats'` (drops old constraint, recreates with new value list)
2. **Creates `format_favorites` table** — stores individual saved formats across sessions with full `FormatResult` JSON snapshot, `niche`, `format_name`, optional `notes` and `tags`
3. **Indexes:** by `saved_by + created_at` (list view), `saved_by + niche` (filter), `session_id` (back-reference)
4. **RLS:** users own their favorites; admin/ceo/creative_director see all

---

## Files to Create / Modify

```
sql/019_peak_format_generator.sql                 [NEW] DB migration — run in Supabase
lib/viral-format-constants.ts                     [NEW] Hook taxonomy + viral DNA (shared layer)
lib/studio-types.ts                               [EDIT] +StudioTool 'formats', +FormatResult, +PeakFormatSession, +HookStackItem
app/(app)/studio/formats/page.tsx                 [NEW] Tool page (4 phases: input → loading → results → save)
app/api/studio/formats/generate/route.ts          [NEW] Gemini generation endpoint (swap to Opus when key is set)
app/api/studio/formats/favorites/route.ts         [NEW] GET (list favorites) + POST (save favorite) + DELETE (remove)
components/layout/sidebar.tsx                     [EDIT] Add "Formats" link in Studio section
```

Phase 2 (after tool is live):
```
lib/ai-client.ts (or individual routes)           [EDIT] Inject viral format context into content-generation prompts
```

---

## Build Order

1. Run `sql/019_peak_format_generator.sql` in Supabase
2. `lib/viral-format-constants.ts` — hook taxonomy + viral DNA laws (shared foundation used by both the route and the prompt)
3. Type additions in `lib/studio-types.ts`
4. API routes — `/api/studio/formats/generate` (Gemini, JSON mode, `maxOutputTokens: 6000`) + `/api/studio/formats/favorites` (CRUD)
5. Page UI — Phase 1 (input form) + Phase 2 (loading, timed steps) + Phase 3 (5 format cards) + Phase 4 (session save)
6. Sidebar link addition
7. Manual test: generate 5 formats for 3 different niches, validate all three laws in each
8. (Phase 2) `lib/viral-format-constants.ts` injected into `copywriter` agent and `publishing/compose`

---

## Effort Estimate

| Phase | Files | Hours |
|---|---|---|
| DB migration (run in Supabase) | 1 | 0.1h |
| Constants + types | 2 | 1h |
| Generate API route (Gemini, JSON mode) | 1 | 2h |
| Favorites API route (CRUD) | 1 | 1h |
| Page UI | 1 | 4h |
| Sidebar + session list | 2 | 0.5h |
| **Total (Phase 1)** | **8** | **~9h** |
| Platform-wide injection (Phase 2) | 3–5 routes | 2h |

---

## Resolved

- **Hook stack maximum: 4 types** (2 minimum, 4 maximum, each from a different tier). The rationale: at 4 simultaneous curiosity signals the viewer is in deliberate overload — every channel (visual, verbal, structural, psychological) is pulling them forward at once. This is intentional, not noise.
- Streaming delivery confirmed as the correct architecture for this tool.
- Plan status: **FINAL — ready to build.**
