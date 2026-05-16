# Client Onboarding — Action Plan

> **Goal:** Replace the 9-step modal-only wizard with a 3-step Register flow + a persistent, always-editable client profile. Wire all saves to Supabase. Make crisis mode persistent.

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Wire wizard to Supabase | PENDING | `useCreateClient()` does not exist — wizard submit goes nowhere |
| Phase 2 — Trim wizard to 3 steps | PENDING | Still 9 steps |
| Phase 3 — Client profile enrichment tabs | PENDING | Not built |
| Phase 4 — Real Intelligence tab | PENDING | SWOT still hardcoded per client ID |
| Phase 5 — Crisis mode persistence | **DONE** | `crisis_mode` col in DB, `mapClient()` includes it, toggle calls `useUpdateClient()`, publishing page reads it |

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| 9-step wizard modal UI | Done — `components/clients/new-client-wizard.tsx` (545 lines) |
| `useClients()` — reads from Supabase | Done |
| `useClient(id)` — single client | Done |
| `useUpdateClient()` mutation | Done — wired to Supabase |
| Client cards page with search/filter | Done |
| Client detail modal (Overview / Intelligence / Tasks tabs) | Done |
| Crisis mode toggle | Done — **local state only, not persisted** |

### What is missing
| Piece | Status |
|-------|--------|
| `useCreateClient()` mutation | Does not exist — wizard submit goes nowhere |
| Wizard save on submit | No INSERT call anywhere |
| Client profile edit page / inline editing | Not built |
| Enrichment tabs (Brand, Tone, Audience, Strategy, Goals, Competitors) | Not built |
| SWOT / Intelligence as real data | Hardcoded per client ID in `clients/page.tsx` |
| Crisis mode DB column | Not in schema — toggle resets on reload |
| `BrandIdentity` type vs. wizard form data | Type mismatch — wizard collects much more than the current `BrandIdentity` interface stores |

### Type gap (critical)
The current `BrandIdentity` interface only has 6 fields. The wizard collects ~40 fields across 9 steps. Those fields have nowhere to go in the current schema. The `brand_identity_json` column in Supabase must store an expanded shape.

---

## Phase 1 — Wire Existing Wizard to Supabase

**Smallest change. Make the wizard actually save.**

### New hook: `useCreateClient()`

**File:** `lib/hooks/use-clients.ts` — add to existing file

```ts
export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Client, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
```

### Expand `BrandIdentity` type

**File:** `lib/types.ts` — replace the existing `BrandIdentity` interface:

```ts
export interface BrandIdentity {
  // Step 4 — Brand Identity
  primary_color: string
  secondary_colors: string[]
  visual_styles: string[]         // e.g. ['Minimal', 'Editorial']

  // Step 5 — Voice & Tone
  tone_of_voice: string           // legacy single-string kept for AI prompts
  tone_sliders: {
    formal_casual: number         // 0-100
    serious_playful: number
    informative_entertaining: number
    reserved_bold: number
  }
  tone_dos: string[]
  tone_donts: string[]

  // Step 6 — Audience
  target_audience: string         // legacy string kept for AI prompts
  audience_age_min: number
  audience_age_max: number
  audience_gender_split: { male: number; female: number; other: number }
  audience_locations: string[]
  audience_interests: string[]
  audience_pain_points: string[]

  // Step 7 — Strategy
  content_pillars: { name: string; percentage: number }[]
  preferred_formats: string[]
  posting_frequency: Record<string, number>   // platform → posts per week

  // Step 8 — Goals
  primary_goal: string
  kpis: string[]
  monthly_post_volume: number

  // Legacy kept for AI prompts
  industry: string
  key_messages: string[]
  secondary_color: string         // first secondary color, for backwards compat
}
```

### Files to edit

| File | Change |
|------|--------|
| `lib/types.ts` | Expand `BrandIdentity` |
| `lib/hooks/use-clients.ts` | Add `useCreateClient()` |
| `components/clients/new-client-wizard.tsx` | Call `useCreateClient()` on final step submit |

---

## Phase 2 — Trim the Wizard to 3 Steps (Register Phase)

**Reduce the entry barrier. Steps 4–8 move to the client profile.**

### New 3-step wizard

| Step | Fields | Why required at entry |
|------|--------|-----------------------|
| 1 — Identity | Brand name, industry, website, country, timezone, contact name, email, contract start, package | Needed to create the record |
| 2 — Social & Platforms | Active platform links, primary platform, `metricool_blog_id` | Needed before any publishing work starts |
| 3 — Language & Notes | Language (EN/AR/Both), Google Drive folder URL, internal notes | Operationally urgent — affects all AI output from day one |

Steps 4–9 of the old wizard become **profile tabs** (Phase 3).

### Files to edit

| File | Change |
|------|--------|
| `components/clients/new-client-wizard.tsx` | Reduce to 3 steps, remove steps 4–9 content |

---

## Phase 3 — Client Profile Enrichment Tabs

**All the data that was in steps 4–9 lives here now, always editable.**

### Where to put it

Extend the existing **client detail modal** in `app/(app)/clients/page.tsx`. It already has 3 tabs (Overview / Intelligence / Tasks). Add a 4th: **Profile**.

The Profile tab contains 6 sub-sections (accordion or inner tab row):

| Section | Fields |
|---------|--------|
| Brand Identity | Primary color picker, secondary colors (up to 3), visual style multi-select |
| Voice & Tone | 4 sliders, dos list, don'ts list |
| Audience | Age range, gender split, locations, interests, pain points |
| Content Strategy | Pillars with % allocation, preferred formats, posting frequency per platform |
| Goals & KPIs | Primary goal, KPI checkboxes, monthly volume slider |
| Competitors | Up to 5 entries (website, handle, type: direct/aspirational) |

Each section has a **Save** button that fires `useUpdateClient()` with the updated `brand_identity_json`.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/clients/page.tsx` | Add Profile tab to client detail modal |
| `lib/hooks/use-clients.ts` | `useUpdateClient()` already exists — confirm it handles `brand_identity_json` |

---

## Phase 4 — Real Intelligence Tab (SWOT from AI)

**Replace hardcoded SWOT with AI-generated analysis stored in DB.**

### Current problem

`MOCK_INTEL` in `clients/page.tsx` is a hardcoded object keyed by client ID. If client IDs change or new clients are added, they get no intelligence data.

### Solution

1. Add a "Generate Intelligence Report" button in the Intelligence tab.
2. Button calls `/api/ai` with `agent = 'researcher'` + full client context (brand identity, competitors, goals).
3. Response returns structured JSON: `{ strengths, weaknesses, opportunities, threats, market_position, growth_score, content_gaps, key_insights }`.
4. Store in `clients.brand_identity_json.intelligence` (or a separate `intelligence_json` column).
5. Intelligence tab reads from DB — not from a hardcoded constant.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/clients/page.tsx` | Remove `MOCK_INTEL`, read from `client.brand_identity.intelligence` |
| `lib/types.ts` | Add `intelligence?` field to `BrandIdentity` |

---

## Phase 5 — Crisis Mode Persistence

**The toggle currently resets on refresh. Fix it.**

### DB change

Run in Supabase SQL editor:
```sql
ALTER TABLE clients ADD COLUMN crisis_mode boolean DEFAULT false;
```

### Code change

1. `useUpdateClient()` already handles partial updates — just pass `{ id, crisis_mode: true/false }`.
2. In `clients/page.tsx`: replace `useState` crisis tracking with a direct read from `client.crisis_mode` and a `useUpdateClient()` call on toggle.
3. Publishing page: filter out posts for clients where `crisis_mode = true`.

### Files to edit

| File | Change |
|------|--------|
| `lib/types.ts` | Add `crisis_mode: boolean` to `Client` interface |
| `lib/hooks/use-clients.ts` | `mapClient()` — include `crisis_mode` field |
| `app/(app)/clients/page.tsx` | Replace `useState` with DB-backed toggle |
| `app/(app)/publishing/page.tsx` | Filter posts by `!client.crisis_mode` |

---

## Build Order

```
Phase 1a  Expand BrandIdentity type in lib/types.ts
Phase 1b  Add useCreateClient() to use-clients.ts
Phase 1c  Wire wizard submit to useCreateClient()

Phase 2a  Trim wizard to 3 steps

Phase 3a  Add Profile tab to client detail modal
Phase 3b  Brand Identity section (editable)
Phase 3c  Voice & Tone section
Phase 3d  Audience section
Phase 3e  Content Strategy section
Phase 3f  Goals section
Phase 3g  Competitors section

Phase 4a  Remove MOCK_INTEL constant
Phase 4b  Add Generate Intelligence button
Phase 4c  Store intelligence result in client record

Phase 5a  SQL: ALTER TABLE clients ADD COLUMN crisis_mode
Phase 5b  Update mapClient() to include crisis_mode
Phase 5c  Replace useState with DB toggle in clients page
Phase 5d  Filter publishing queue by crisis_mode
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/types.ts` | 1, 5 | Edit |
| `lib/hooks/use-clients.ts` | 1, 5 | Edit |
| `components/clients/new-client-wizard.tsx` | 1, 2 | Edit |
| `app/(app)/clients/page.tsx` | 3, 4, 5 | Edit |
| `app/(app)/publishing/page.tsx` | 5 | Edit |
| Supabase SQL editor | 5 | SQL |

---

## Scope Boundary

- **No AI auto-fill from website scraping** — out of scope (requires a scraping service).
- **No competitor data enrichment** — out of scope.
- **No multi-contact per client** — schema supports one contact. Keep it.
- **No client archiving UI** — `status: 'inactive'` field exists; don't build a separate archive flow.
