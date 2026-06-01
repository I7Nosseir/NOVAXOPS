# Studio Tools Redesign — Action Plan

**Goal:** Make all three Studio tools work like a competent employee. User fills in the brief once, hits one button, the system runs every phase automatically, produces a clean document ready to export, and a chatbot that knows everything that was generated and can edit it on request.

---

## What's Wrong Now

| Tool | Problem |
|---|---|
| Content Studio | Requires 4 manual "next" clicks between phases. Each phase is a raw collapsible JSON card. |
| Hook Lab | Output is styled but no document export, no chatbot. |
| Strategy Command Center | Each of 5 meta-phases requires a manual click. Output is raw JSON keys. |

---

## What We're Building

### Behavior Change (all tools)
- User fills brief / inputs **once**
- Hits **one button** — all phases run sequentially, automatically
- A progress indicator shows which phase is currently running
- When complete — shows a **clean, formatted document**
- Document has an attached **chatbot** that knows the full generation

### The Document
Not a JSON dump. A proper report with:
- Executive Brief at top (3 lines, plain English — "here's what we built and why")
- Labeled sections with proper prose, bullet points, and visual hierarchy
- Export to PDF (browser print dialog, pre-styled for print) and plain-text `.txt`

### The Chatbot
Contextual AI assistant per generation:
- Full generation context injected as system prompt
- Structured, scientific response format — no generic LLM fluff
- Can receive edit requests and applies them to the live document
- Side panel layout on desktop, slide-up on mobile

---

## Architecture

### New Files to Create

```
components/studio/
  studio-chatbot.tsx         reusable chat panel (all three tools)
  studio-document.tsx        document renderer base
  studio-runner.tsx          auto-phase orchestrator + progress display

app/api/studio/
  chat/route.ts              chat API: accepts messages + context, returns response or edit command

lib/
  studio-export.ts           shared TXT export utility
```

### Files to Modify

```
app/(app)/studio/content/page.tsx    full rewrite
app/(app)/studio/hooks/page.tsx      add document view + chatbot
app/(app)/studio/strategy/page.tsx   auto-run all phases + document + chatbot
```

---

## Component Specs

### 1. `StudioChatbot`

**Props:**
```typescript
interface StudioChatbotProps {
  context: StudioChatContext
  tool: 'content' | 'hooks' | 'strategy'
  onEdit: (edit: StudioEdit) => void
}

interface StudioChatContext {
  client_name?: string
  brief: string
  platform?: string
  goal?: string
  // content tool
  research?: ResearchData
  selected_hook?: GeneratedHook
  script?: ScriptData
  all_hooks?: GeneratedHook[]
  // strategy tool
  strategy_phases?: Partial<Record<MetaPhase, Record<string, unknown>>>
  executive_summary?: string
}

interface StudioEdit {
  target: string
  new_content: string
  reasoning: string
}
```

**Layout:** Right panel (40% width on screens 1280px+), slide-up sheet on mobile. Toggled by a "Chat about this" button anchored to the document header.

**UX states:**
- Empty: show starter chip suggestions
- Loading: streaming dots indicator
- Response: assistant bubble with formatted text
- Edit applied: inline confirmation "Updated [section]"

**Starter chips (shown when chat is empty):**
- "Why did you choose this hook?"
- "What should I film first?"
- "Make the CTA sharper"
- "Summarize this for my client"

---

### 2. `StudioDocument` — Content Studio output

Sections rendered in order:

```
┌─────────────────────────────────────────────────────────────┐
│  [Client] · [Platform] · [Goal] · [Language]   [Export PDF] │
│                                                  [Export TXT]│
├─────────────────────────────────────────────────────────────┤
│  WHAT WE BUILT                                               │
│  [AI-generated 3-line plain-English summary]                 │
├─────────────────────────────────────────────────────────────┤
│  AUDIENCE INTELLIGENCE                                       │
│  Who they are / What drives them / What's trending           │
│  [3 key research findings — prose not JSON keys]             │
├─────────────────────────────────────────────────────────────┤
│  SELECTED HOOK               S-tier · Curiosity · 28/30     │
│  "hook text here"                                            │
│  Why selected: highest curiosity score of 20 generated       │
├─────────────────────────────────────────────────────────────┤
│  THE SCRIPT          30 seconds · Medium production          │
│                                                              │
│  HOOK  (0:00–0:03)                                           │
│    Line 1                                                    │
│    Line 2                                                    │
│    Visual: wide shot of product                              │
│                                                              │
│  BODY  (0:03–0:25)                                           │
│    ...                                                       │
│                                                              │
│  CTA   (0:25–0:30)                                           │
│    ...                                                       │
├─────────────────────────────────────────────────────────────┤
│  PRODUCTION CHECKLIST                                        │
│  · B-Roll shot 1   · B-Roll shot 2   · B-Roll shot 3        │
├─────────────────────────────────────────────────────────────┤
│  CAPTION                                [Copy to clipboard]  │
│  Caption text here...                                        │
└─────────────────────────────────────────────────────────────┘
```

The "WHAT WE BUILT" executive brief is generated by one extra AI call at the end of the run — 3 sentences, plain English, no jargon.

---

### 3. `StudioDocument` — Strategy output

```
┌─────────────────────────────────────────────────────────────┐
│  [CLIENT] STRATEGY DOCUMENT                    [Export PDF]  │
│  Built [date] · 17-phase analysis complete                   │
├─────────────────────────────────────────────────────────────┤
│  EXECUTIVE SUMMARY                                           │
│  [AI-generated 3-line plain-English strategy summary]        │
├─────────────────────────────────────────────────────────────┤
│  INTELLIGENCE                                                │
│  Market Position: ...                                        │
│  Primary Audience: ...                                       │
│  Key Opportunities: bullet list                              │
│  The One Thing That Matters Most: [strategic_priority value] │
├─────────────────────────────────────────────────────────────┤
│  POSITIONING                                                 │
│  Brand Archetype: The [X]                                    │
│  Why Customers Choose You: [uvp]                             │
│  Primary Message: ...                                        │
│  Customer Journey: Awareness → Consideration → Conversion    │
├─────────────────────────────────────────────────────────────┤
│  EXECUTION                                                   │
│  Content Pillars (5):                                        │
│    Authority — 2x/week — example topics                      │
│    Emotional — 2x/week — example topics                      │
│    ...                                                       │
│  Total: X posts/week                                         │
├─────────────────────────────────────────────────────────────┤
│  SCALE & RETAIN                                              │
│  Loyalty: ...                                                │
│  Paid Split: Awareness 40% · Retargeting 35% · Conversion 25%│
│  KPIs: [3 targets]                                           │
├─────────────────────────────────────────────────────────────┤
│  OPTIMIZE                                                    │
│  Month 1–3: ...                                              │
│  Month 4–6: ...                                              │
│  Month 7–12: ...                                             │
│  First A/B Test: [test 1]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. Chat API — `/api/studio/chat/route.ts`

**Request:**
```typescript
{
  messages: { role: 'user' | 'assistant'; content: string }[]
  context: StudioChatContext
  tool: 'content' | 'hooks' | 'strategy'
}
```

**Response:**
```typescript
// Normal message
{ type: 'message'; content: string }

// Edit command (when user asks to change something)
{ type: 'edit'; target: string; new_content: string; reasoning: string }
```

**System prompt (exact text — do not change without updating this doc):**

```
You are the NOVAX Studio Intelligence System. You are a senior creative strategist
embedded in a social media agency's production pipeline.

YOUR ROLE:
Discuss, analyze, and improve the generated content below. You have complete
context of everything produced in this session.

RESPONSE RULES:
1. Start with the direct answer — no preamble. Never open with "Great question!",
   "Certainly!", "Of course!", or any variant.
2. Quote specific lines from the content when referencing it. Never be vague.
3. For analytical responses, use this structure: FINDING → EVIDENCE → ACTION
   (one line each). Only use this structure when 3+ lines are needed.
4. Maximum 4 sentences per response unless listing items. Lists: max 6 items.
5. No emojis. No hashtags. No filler phrases.
6. If the answer is not in the generation context, say exactly: "Not in the
   generation context."

EDIT MODE:
If the user asks to change, rewrite, improve, shorten, lengthen, translate,
or modify any part of the generated content, respond with ONLY this JSON
— no other text before or after:
{
  "type": "edit",
  "target": "<key>",
  "new_content": "<replacement text only>",
  "reasoning": "<one sentence>"
}

Valid edit targets:
Content Studio: hook | script_hook | script_body | script_cta | caption | broll_list
Strategy:       phase_intelligence | phase_positioning | phase_execution |
                phase_scale | phase_optimize | executive_summary
Hook Lab:       hook_0 | hook_1 | hook_2 ... (index of the hook in the list)

GENERATION CONTEXT:
{{CONTEXT_JSON}}
```

Model: `claude-sonnet-4-6` (fast for chat, keeps cost low).

---

### 5. `StudioRunner` (Content Studio auto-chainer)

Replaces the current 4-click manual flow. State machine:

```
idle → running → complete | error
```

**Auto-chain algorithm:**
```
1. runResearch(brief, client)           → store research
2. runHooks(brief, research, client)    → store all_hooks[]
3. autoSelectHook(all_hooks)            → pick highest total_score from S or A tier
                                          (fallback: highest total_score overall)
4. runScript(brief, selectedHook, research, client) → store script
5. generateExecSummary(all data)        → 3-sentence plain English summary
6. setComplete(true)                    → render document + chatbot
```

**Progress UI (shown during `running` state):**
```
Research   →   Hooks   →   Script   →   Summary
████████░░     ░░░░░░░░    ░░░░░░░░     ░░░░░░░░
Analyzing your audience...
```

Each step shows a one-line status message in plain English (not technical names).

| Step | Status message shown |
|---|---|
| Research | "Analyzing your audience and what's trending..." |
| Hooks | "Writing 20 hook options..." |
| Script | "Writing the full script..." |
| Summary | "Packaging everything up..." |

**Error handling:** If a step fails, show the failed step highlighted red with a "Retry this step" button. Other completed steps are preserved — no full restart.

---

## Document Section Label Map

Replace all raw JSON key names with human-readable labels in the document renderer.

| Raw JSON key | Rendered label |
|---|---|
| `audience_psychology` | Audience Intelligence |
| `trend_intelligence` | What's Trending Now |
| `performance_context` | What Performs Well |
| `market_position` | Market Position |
| `primary_audience` | Your Primary Audience |
| `swot_summary` | SWOT in Plain English |
| `strategic_priority` | The One Thing That Matters Most |
| `brand_archetype` | Brand Archetype |
| `uvp` | Why Customers Choose You |
| `positioning_statement` | Positioning Statement |
| `messaging_hierarchy` | Message Hierarchy |
| `content_pillars` | Content Pillars |
| `posting_cadence` | How Often to Post |
| `platform_strategy` | Platform Strategy |
| `community_architecture` | Community Building |
| `paid_strategy` | Paid Advertising Plan |
| `ab_test_roadmap` | What to Test First |
| `iteration_roadmap` | 12-Month Roadmap |
| `performance_benchmarks` | Performance Targets |

**Rendering rules:**
- Array values → clean bullet list with `·` prefix
- Nested objects → labeled sub-rows (not nested collapsible boxes)
- Percentage values → visual fill bar (reuse `ScoreBar` pattern from Hook Lab)
- No JSON syntax, no underscores, no `"key": value` formatting anywhere in the document

---

## Executive Brief Generation

At the end of every run, one extra AI call generates the "WHAT WE BUILT" section.

**Prompt:**
```
Summarize what was just produced for a busy agency owner who has 10 seconds to read.

Write exactly 3 sentences:
1. What was produced (the output — be specific)
2. The key decision or insight from the process
3. What to do next with this

No jargon. No agency speak. Short sentences.

What was produced:
{{GENERATION_SUMMARY}}
```

Model: `claude-haiku-4-5-20251001` (cheapest, this is a simple summarization task).

---

## Edit Flow (End-to-End)

1. User types: "Make the hook more aggressive"
2. Chat API receives message + full generation context
3. System prompt triggers EDIT MODE — model returns JSON only
4. API returns: `{type:"edit", target:"hook", new_content:"Nobody tells you this, but...", reasoning:"Removed question framing for direct confrontational tone"}`
5. `StudioChatbot` fires `onEdit(edit)` callback
6. Parent page patches the relevant state field
7. `StudioDocument` re-renders the updated section with a brief highlight animation
8. Chat thread shows a confirmation: "Updated hook. Previous: 'Did you know...' → New: 'Nobody tells you...'"

---

## PDF Export Implementation

No third-party library. Use `window.print()` with print-specific CSS.

In `globals.css`, add:
```css
@media print {
  .no-print { display: none !important; }
  .studio-document { max-width: 100%; padding: 0; }
  /* Remove sidebar, header, chat panel, action buttons */
}
```

Each document section gets `.studio-document` class. All other layout elements (sidebar, header, chatbot panel, export button itself) get `.no-print`.

The PDF output will be the document sections only, clean and paginated by the browser.

---

## Implementation Steps

| Step | File | What | Est. |
|---|---|---|---|
| 1 | `app/api/studio/chat/route.ts` | Create chat API with system prompt + edit detection | 1h |
| 2 | `components/studio/studio-chatbot.tsx` | Chat panel: messages, input, starter chips, edit handling | 1.5h |
| 3 | `components/studio/studio-document.tsx` | Document renderer: content + strategy variants, label map, export | 2h |
| 4 | `components/studio/studio-runner.tsx` | Auto-chain orchestrator + progress bar | 1h |
| 5 | `app/(app)/studio/content/page.tsx` | Full rewrite using runner + document + chatbot | 2.5h |
| 6 | `app/(app)/studio/strategy/page.tsx` | Auto-run all 5 phases + strategy document + chatbot | 2h |
| 7 | `app/(app)/studio/hooks/page.tsx` | Wrap results in document view + add chatbot | 1h |
| 8 | `lib/studio-export.ts` | Shared TXT export utility used by all three tools | 30m |

**Total: ~11.5 hours**

---

## Priority Order

| Priority | Item | Reason |
|---|---|---|
| P0 | Chat API + StudioChatbot | Foundation — all tools depend on it |
| P0 | Content Studio rewrite | Flagship tool, most used |
| P1 | StudioDocument renderer | Shared by all tools |
| P1 | Strategy rewrite | High-value output, biggest UX improvement |
| P2 | Hook Lab update | Already mostly working, smaller delta |
| P2 | PDF export | Useful but not blocking |
