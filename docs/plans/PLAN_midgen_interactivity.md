# Mid-Generation Interactivity — Plan

**Status:** Parked — do after evaluation enhancement is live  
**Estimated effort:** ~21h across all studio tools  
**API cost impact:** Negligible (~$2.50/month extra at 20 sessions/day)

---

## The Problem

Studio tools currently make every decision on behalf of the user — tone, angle, hook style, strategic posture — because the brief rarely specifies them. The AI guesses. Sometimes it guesses right. When it guesses wrong, the user regenerates and loses 30–90 seconds.

The fix is a **two-phase generation pattern**: a fast pre-generation question step where the AI surfaces the 2–3 decisions that most affect the output, user picks, then full generation runs with those locked in.

This is NOT streaming interrupts (where the AI pauses mid-stream and waits for input). That pattern requires WebSocket + resumable generation state and costs ~40–60h. Two-phase is 80% of the value at 30% the complexity.

---

## What It Looks Like

User fills brief → clicks Generate → instead of going straight to the loading screen, a **Preference Panel** appears:

```
Before I generate — a few quick choices:

Content angle        [Problem → Solution]  [Trend hijack]  [Social proof]

Tone register        [Elevated / aspirational]  [Direct / benefit-led]  [Conversational]

Hook style           [Curiosity gap]  [Pattern interrupt]  [Bold claim]

                                                          [Continue →]
```

User picks (or skips), hits Continue → full generation runs with those preferences injected as locked constraints in the prompt. The AI stops guessing on the decisions that matter most.

---

## Architecture

### Phase 1: Question generation call (fast, ~500 tokens)

`POST /api/studio/questions` already exists but currently only returns informational text during the loading screen. It needs to be upgraded to return structured choice objects before generation starts.

**New request shape:**
```typescript
{ brief: string; client_id: string; tool: StudioTool; platforms: string[] }
```

**New response shape:**
```typescript
interface PreferenceQuestion {
  id: string                           // "tone_register" | "content_angle" | "hook_style" | custom
  label: string                        // "Tone register"
  options: Array<{
    value: string                      // "aspirational"
    label: string                      // "Elevated / aspirational"
    description?: string               // Optional 1-line explanation
  }>
}

{ questions: PreferenceQuestion[] }    // 2-3 max, never more
```

### Phase 2: Full generation (existing)

Preferences are passed as a new `preferences: Record<string, string>` param to the generation route. The prompt builder injects:

```
LOCKED PREFERENCES (user-selected — do not deviate):
- Content angle: Problem → Solution
- Tone register: Elevated / aspirational
- Hook style: Curiosity gap
```

### Shared component: `StudioPreferenceCollector`

`components/studio/studio-preference-collector.tsx`

- Shows between brief submission and loading screen
- Option cards (not dropdown, not free text — visual selection)
- "Skip / use AI judgment" link at bottom
- Mobile-first: wraps to vertical stack on small screens
- Stateless: parent passes `questions` + `onConfirm(answers)` + `onSkip()`

---

## Per-Tool Rollout

| Tool | Priority | Key questions | Notes |
|---|---|---|---|
| Strategy | P0 | Posture (growth/retention/defence), Content philosophy (education/entertainment/authority), Time horizon (sprint/quarter/year) | Highest stakes, most subjective |
| Campaign Igniter | P0 | Cultural tension angle, Campaign register (provocative/inspiring/informative), Budget tier (organic/paid-hybrid/full-paid) | Wrong angle = wasted session |
| Content Studio | P1 | Content angle, Tone register, Hook style | 3 variants already cover tone — question step trims the space |
| Hook Lab | P2 | Hook archetype cluster | Optional — diversity is the point; narrowing may hurt |
| Visual Engine | Skip | Already interactive (visual approach selection IS the preference step) | — |
| Post-Mortem | Skip | Inputs are already highly specific (post URL + metrics) | — |

---

## Implementation Order

1. **Shared component** `StudioPreferenceCollector` — stateless, reusable — 3h
2. **Upgrade `/api/studio/questions`** — add structured question mode — 3h
3. **Strategy** — highest ROI — 4h
4. **Campaign Igniter** — 3h
5. **Content Studio** — 3h
6. **Hook Lab** (optional) — 2h
7. **Polish, mobile, skip handling** — 3h

**Total: ~21h**

---

## What Makes This Feel Like Claude Code

Claude Code's clarification questions feel different because:
- They're 2–3 maximum (never 5)
- Each question is about a **fork in the road** — not a preference, a structural decision
- The options are written to be obviously different, not subtly variant
- There's always an escape hatch ("skip / let AI decide")

Apply the same rules here. If a question doesn't change the output meaningfully, don't ask it.

---

## Risks

**Risk:** Users skip every time → no value delivered  
**Mitigation:** Make the default selection the AI's best guess (pre-selected), so clicking Continue without changing anything is frictionless

**Risk:** Slows down power users who just want to generate  
**Mitigation:** The Skip link must be prominent, not hidden

**Risk:** Questions feel generic or annoying  
**Mitigation:** Questions are generated per-brief by the AI, not hardcoded — they reflect the actual ambiguity in the brief
