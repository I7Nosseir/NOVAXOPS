# Content Calendar Generation — Action Plan

> **Goal:** Wire the AI calendar generation dialog to the real Claude agent, make "Save to Publishing" bulk-insert real posts, refine the Excel export, and embed Islamic calendar event data for accurate regional anchoring.

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — AI agent | **DONE** | `/api/ai` exists with `content_calendar` agent — dialog generates real calendar from Claude |
| Phase 2 — Islamic calendar data | PENDING | No `lib/islamic-calendar.ts` — Claude may hallucinate event dates |
| Phase 3 — "Save to Publishing" bulk insert | PENDING | Button exists but no INSERT — needs `useCreatePost()` first |
| Phase 4 — Excel export RTL | PENDING | Export works but no RTL direction for Arabic |

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| "Generate Calendar" dialog UI | Done — fully built |
| Brief form (client, month, year, description, language, frequency) | Done |
| Calendar result rendering (week grouping, color-coded event dots) | Done |
| Individual entry delete | Done |
| Excel export (xlsx) | Done — `xlsx` library is installed and used |
| "Save to Publishing" button | Done — calls a handler, but no INSERT behind it |
| Pinterest search integration | Done — visual reference pins per day |

### What is missing
| Piece | Status |
|-------|--------|
| `content_calendar` AI agent | Calls `/api/ai` which doesn't exist |
| Response parser for calendar JSON | Not built — needs to parse the 20-30 entry array from Claude |
| "Save to Publishing" bulk insert | No `useCreatePost()` yet (PUBLISHING_PLAN Phase 1) |
| Islamic calendar data | No data file — agent is expected to know, but hallucination risk is high |
| Arabic RTL in Excel export | Partially implemented — needs column direction setting |

---

## Phase 1 — AI Agent (depends on AI_AGENT_SYSTEM_PLAN)

**The dialog already sends the correct payload to `/api/ai`. Once that route exists, the call works.**

### What the dialog sends

```ts
fetch('/api/ai', {
  method: 'POST',
  body: JSON.stringify({
    agent: 'content_calendar',
    client: { id, name, brand_identity, competitor_context },
    month: selectedMonth,    // 0-indexed (0 = January)
    year: selectedYear,
    brief: briefText,
    language: selectedLanguage,
    platforms: selectedPlatforms,
    frequency: postsPerWeek,
  })
})
```

### Response parsing

Claude returns a JSON array. The parsing step:

```ts
const raw = data.text  // string returned from /api/ai
let entries: CalendarEntry[]
try {
  entries = JSON.parse(raw)
} catch {
  // Claude occasionally wraps JSON in markdown fences
  const match = raw.match(/```(?:json)?\n?([\s\S]+?)\n?```/)
  if (match) entries = JSON.parse(match[1])
  else throw new Error('Failed to parse calendar response')
}
```

### CalendarEntry type (add to `lib/types.ts`)

```ts
export interface CalendarEntry {
  date: string           // 'YYYY-MM-DD'
  time: string           // 'HH:MM'
  platform: SocialPlatform
  type: 'Reel' | 'Post' | 'Story' | 'Carousel' | 'Thread'
  title: string
  anchorEvent: string | null
  eventType: 'islamic' | 'global' | 'regular'
  language?: 'en' | 'ar' | 'both'
}
```

### Files to edit

| File | Change |
|------|--------|
| `lib/types.ts` | Add `CalendarEntry` type |
| `app/(app)/publishing/page.tsx` | Add JSON parsing logic for calendar response |

---

## Phase 2 — Islamic Calendar Data

**The agent prompt tells Claude to respect Islamic calendar events, but LLMs can hallucinate dates. Embed a static data file for the year.**

### File to create: `lib/islamic-calendar.ts`

```ts
// Key Islamic dates for 2026 (approximate — Islamic calendar is lunar, dates shift yearly)
// Source: Islamic Finder / timeanddate.com
export const ISLAMIC_EVENTS_2026: Record<string, string> = {
  '2026-01-01': 'Rabi al-Awwal 10',
  '2026-01-10': 'Mawlid al-Nabi (Prophet\'s Birthday)',
  '2026-03-21': 'Nowruz (New Year)',
  '2026-04-17': 'Ramadan begins',
  '2026-05-16': 'Eid al-Fitr',
  '2026-07-23': 'Eid al-Adha',
  '2026-08-12': 'Islamic New Year',
  '2026-08-21': 'Day of Ashura',
  '2026-10-21': 'Mawlid al-Nabi',
}

export function getIslamicEventsForMonth(year: number, month: number): Record<string, string> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  return Object.fromEntries(
    Object.entries(ISLAMIC_EVENTS_2026).filter(([date]) => date.startsWith(prefix))
  )
}
```

### Inject into the prompt

In `lib/agents/prompt-builder.ts`, for the `content_calendar` agent:

```ts
const islamicEvents = getIslamicEventsForMonth(context.year, context.month)
const islamicContext = Object.entries(islamicEvents)
  .map(([date, name]) => `${date}: ${name}`)
  .join('\n')
// Append to system prompt: "Islamic events this month:\n{islamicContext}"
```

This eliminates hallucinated Islamic event dates.

### Files to create / edit

| File | Change |
|------|--------|
| `lib/islamic-calendar.ts` | Create — 2026 events |
| `lib/agents/prompt-builder.ts` | Inject Islamic events into calendar agent context |

---

## Phase 3 — "Save to Publishing" Bulk Insert

**Depends on PUBLISHING_PLAN Phase 1 (useCreatePost must exist first).**

### Current

"Save to Publishing" button exists but has no INSERT behind it.

### Implementation

```ts
async function saveCalendarToPublishing(entries: CalendarEntry[], clientId: string) {
  await Promise.all(entries.map(entry =>
    createPost.mutateAsync({
      client_id: clientId,
      task_id: '',             // no task associated
      platforms: [entry.platform],
      caption: entry.title,    // title becomes draft caption placeholder
      scheduled_at: `${entry.date}T${entry.time}:00`,
      status: 'draft',
      language: entry.language ?? 'en',
    })
  ))
}
```

All entries are created as `draft` — they need real captions before scheduling.

### UI improvement

Before bulk-saving, show a confirmation dialog:
- "You're about to save {n} posts as drafts to the publishing queue."
- Checkboxes per entry to deselect any before saving
- "Save {n} posts" button

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/publishing/page.tsx` | Wire "Save to Publishing" + add confirmation step |

---

## Phase 4 — Excel Export Refinement

**Current export works but needs RTL column direction for Arabic content.**

### Current

`xlsx` generates a spreadsheet. Arabic captions are included but the spreadsheet is LTR.

### RTL fix

```ts
// In the export function:
const ws = XLSX.utils.json_to_sheet(calendarData)

// Set RTL if language includes Arabic
if (language === 'ar' || language === 'both') {
  if (!ws['!sheetViews']) ws['!sheetViews'] = [{}]
  ws['!sheetViews'][0].rightToLeft = true
}
```

### Column headers (bilingual)

For `language === 'both'`:

| Column | EN | AR |
|--------|----|----|
| Date | Date | التاريخ |
| Time | Time | الوقت |
| Platform | Platform | المنصة |
| Type | Type | النوع |
| Title (EN) | English Title | — |
| Title (AR) | Arabic Title | العنوان بالعربية |
| Event | Anchor Event | المناسبة |

---

## Build Order

```
Phase 1a  Ensure /api/ai route exists (AI_AGENT_SYSTEM_PLAN Phase 1)
Phase 1b  content_calendar agent prompt in prompt-builder.ts
Phase 1c  Add CalendarEntry type to lib/types.ts
Phase 1d  Add JSON parsing (with markdown fence fallback) to publishing page
Phase 1e  Test end-to-end: fill brief → generate → see calendar

Phase 2a  Create lib/islamic-calendar.ts with 2026 events
Phase 2b  Inject Islamic events into content_calendar prompt

Phase 3a  Ensure useCreatePost() exists (PUBLISHING_PLAN Phase 1)
Phase 3b  Add confirmation dialog before bulk save
Phase 3c  Wire "Save to Publishing" to bulk useCreatePost() calls

Phase 4a  Add RTL sheet view for Arabic
Phase 4b  Add bilingual column headers
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/types.ts` | 1 | Edit |
| `lib/islamic-calendar.ts` | 2 | Create |
| `lib/agents/prompt-builder.ts` | 2 | Edit |
| `app/(app)/publishing/page.tsx` | 1, 3, 4 | Edit |

---

## Scope Boundary

- **No calendar sync** (Google Calendar, Outlook) — out of scope.
- **No drag-to-reschedule on generated calendar** — edit individual entries only.
- **No automatic caption writing** — calendar generates titles/briefs. Actual copy is written via the copywriter agent on each task/post individually.
- **Islamic calendar data is 2026 only** — update the static file each year or integrate a live Islamic calendar API later.
