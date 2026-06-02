# Studio Tools — Final Plan (v4 · Definitive)

> Research-backed. Architecturally complete. Formatting-specified. Ready for implementation.
> All previous versions are superseded by this document.

---

## 0. Core Philosophy

**The pipeline is the product — the user never sees it.**
No steps. No phases. No "Next" buttons. The user fills in a brief, answers one smart
question, hits Run, and gets a finished document. Every phase happens invisibly.

**Structured input beats free text.**
At one or two moments per tool, the pipeline pauses and presents AI-generated option
buttons. The user picks one (or types something else). These answers become hard
constraints — they define the prompt, not just inform it.

**Real data or it doesn't count.**
Every generation is grounded in the Signal Network (5 targeted data probes, pre-computed
daily by industry) and the client's live Metricool performance data. No generic assumptions.

**Every generation produces two outputs.**
The Document: a premium-formatted professional artifact. The Boss Brief: a 5-block
simplified card written like an employee reporting to a busy boss — no jargon, no
decoration, one actionable insight per block.

**Nothing is lost. Everything compounds.**
Every session is saved with its data snapshot, chat history, and edit history. The
system learns from what performs after publishing. The longer it's used, the smarter it gets.

---

## 1. Trend Intelligence: The Signal Network

The answer to "can we track trends without scanning the whole internet?" is yes —
because scanning the whole internet is the wrong approach. The right approach is
5 targeted high-signal probes, pre-computed once daily per industry and shared
across all clients in that category.

### The 5 Sources

| Source | What it tells you | Frequency | Cost | Status |
|---|---|---|---|---|
| Google Trends API (2025 alpha) | Search intent velocity — what's entering people's minds before they open social | Daily | Free (quota) | Official alpha |
| TikTok Creative Center | What's actively going viral right now — hashtags, sounds, formats by region | Every 4 hours | ~$0.50/scrape via Apify | No official API |
| Reddit Rising | Cultural signals 24-48h before mainstream — upvote velocity in industry subreddits | Every 2 hours | $0.24/1K calls | Official API |
| YouTube Data API v3 | Video format trends by category — what's capturing attention this week | Daily | Free | Official API |
| Metricool | The ground truth for this specific client — what actually worked for them | Per-generation pull | Existing | Existing |

### How It Works: Pre-Computed, Not Per-Generation

A cron job runs at 6am daily. It computes one `SignalReport` per industry category
(beauty, tech, food, fitness, finance, etc.). All clients in the same industry share
one report that day. Zero per-generation scraping cost. Fast generation times.

```typescript
interface SignalReport {
  industry: string
  generated_at: string
  valid_until: string          // next 6am

  trending_topics: {
    topic: string
    platform: string
    velocity: 'rising_fast' | 'rising' | 'peaking' | 'declining'
    evidence: string           // "up 340% in 48h on Google Search"
  }[]

  trending_formats: {
    format: string
    platform: string
    why_working: string        // AI-extracted pattern
  }[]

  cultural_tensions: {
    tension: string            // "People love X but hate that it requires Y"
    evidence: string           // source: subreddit + search data
    opportunity: string        // what a brand could do with this
  }[]

  trending_sounds: string[]    // TikTok
  breakout_keywords: string[]  // Google Trends
}
```

Stored in `ai_responses` with key `signal_report_{industry}_{YYYY-MM-DD}`.

### What Gets Injected Into Every Prompt

```
LIVE MARKET INTELLIGENCE — [Industry] — [Date]
────────────────────────────────────────────────────────────────
Trending topics (last 48h):
· "[Topic 1]" — rising 340% on Google Search, peaked on Reddit r/[sub]
· "[Topic 2]" — breakout TikTok sound tied to [theme], 2.1M videos this week

What's winning on [Platform] this week:
· Format: [format] — avg ER 6.2% vs 2.1% for [loser format]
· Tone working: [tone pattern from top content analysis]

Cultural tension in [Industry]:
· [Tension] — evidence: [source data]
· Opportunity: [one-line opportunity for a brand]

CLIENT PERFORMANCE — [Client] — Last 30 days (Metricool):
· Best format: [format] — ER [X]% (industry avg: [Y]%)
· Best posting time: [day] [time]
· Observed pattern: [AI-extracted from top 5 posts]
· NOTE: [any warning if data is thin or missing]
```

Every recommendation is traceable to one of these data points. Not AI assumption —
cited evidence.

### Signal Report Failure Mode

If any of the 5 sources fails or returns incomplete data:
- The system uses the previous day's cached report for that source
- The prompt injection includes: `NOTE: [Source] data is from [date] due to fetch failure.
  Treat with reduced confidence.`
- Generation continues — never blocked by a single source failure

---

## 2. The Cold Start Experience

A new client has zero Metricool data. The system handles this as a named state,
not a silent fallback.

### What Happens

When a client has no Metricool history (or less than 7 days):

**Brief Confirmation screen shows:**
```
Performance data: Not available yet (0 days of history)
This generation will be based on industry benchmarks and market trends.
After 30 days of Metricool data, outputs for this client will be grounded
in their actual performance record.
```

**The prompt injection changes:**
```
CLIENT PERFORMANCE: No performance history available for [Client].
All format and timing recommendations below are based on industry benchmarks
for [industry] on [platform]. Flag all recommendations as benchmark-based,
not performance-proven. Include a note in the output advising the user
to revisit this brief after 30 days of Metricool data.
```

**The document adds a cold-start notice:**
A visible callout at the top of every section:
"Based on industry data, not [Client]'s own performance history.
Rerun this session after 30 days to ground it in real results."

**After 30 days:**
A notification prompts the user to re-run their first sessions now that real data exists.
The old session is archived. The new one links to it as a comparison point.

---

## 3. Structured Interactivity System

The pipeline asks for user input at maximum 2 moments per tool.
Not a questionnaire — one smart question that genuinely changes the output.

### The Interaction Pattern

**Step 1 — Brief Confirmation (every tool, always first)**

The system makes a fast Haiku call (<1s) that reads the brief and returns a structured
understanding. The user sees:

```
┌──────────────────────────────────────────────────────────────┐
│  Here's what I understood                                     │
│                                                               │
│  Client:       Luxe Cosmetics                                 │
│  Platforms:    Instagram · TikTok                             │
│  Goal:         Drive saves and follows                        │
│  Audience:     Women 25-35, skeptical of product claims       │
│  Language:     English                                        │
│                                                               │
│  Performance data: 30 days available                          │
│  Key signal: Reels outperform static posts 3.1× for this client │
│                                                               │
│  [Looks right — continue]        [Let me adjust]             │
└──────────────────────────────────────────────────────────────┘
```

**Step 2 — The One Question (tool-specific)**

```
┌──────────────────────────────────────────────────────────────┐
│  One question before I start                                  │
│                                                               │
│  What should this content make people FEEL the moment         │
│  they see the first second?                                   │
│  I'll build every hook, line, and CTA around your answer.    │
│                                                               │
│  ● Called out — their current belief is wrong                 │
│  ○ Curious — they're missing something important              │
│  ○ FOMO — everyone else already knows this                    │
│  ○ Proud — this reflects their taste and values               │
│  ○ Something else...  ▸ [text input appears here]            │
│                                                               │
│  [Run →]                                                      │
└──────────────────────────────────────────────────────────────┘
```

### Design Rules

1. **Options are AI-generated from the brief** — a Haiku call generates 4 contextually
   relevant options before the question is shown. Generic defaults only as fallback.

2. **"Something else..." is always present** — selecting it reveals an inline text field.
   No new screen. No modal.

3. **Maximum 2 questions per tool** — a third question is a form. Never a third.

4. **Answers become hard constraints:**
   User answers "Called out" →
   `CONSTRAINT: Primary emotional trigger = cognitive dissonance.
   Every hook must challenge a belief the audience currently holds.
   This is a hard constraint — not a preference.`

5. **Fallback options** — if the Haiku options-generation call fails, show 4 generic
   options per tool. Generation is never blocked by this call failing.

### Questions Per Tool

| Tool | Question | Type |
|---|---|---|
| Content Studio | "What should this content make people FEEL?" | AI-generated options from brief |
| Hook Lab | "How bold should these hooks be?" | Fixed options (Familiar / Unexpected / Edge) |
| Strategy | "What's the biggest obstacle right now?" | AI-generated from client profile |
| Campaign Igniter Q1 | "How bold are we going?" | Fixed (Safe / Disrupting / Red Bull level) |
| Campaign Igniter Q2 | "Any constraint to design around?" | Fixed (Budget / Timeline / Brand-safe) |

---

## 4. The Boss Brief

Every generation produces two outputs. The document and the Boss Brief.

### The Boss Brief Card

A visually distinct card rendered below every document.
Dark NOVAX background. Five labeled blocks. Each block is one sentence.

```
┌──────────────────────────────────────────────────────────────┐
│  BOSS BRIEF                          30-second version        │
│──────────────────────────────────────────────────────────────│
│  WHAT WE MADE                                                 │
│  We wrote a 30-second Instagram Reel script for Luxe          │
│  Cosmetics targeting women who are skeptical of claims.       │
│──────────────────────────────────────────────────────────────│
│  WHY THIS WORKS                                               │
│  Your best content this month was educational Reels (7.1% ER) │
│  — this script leads with the hook type winning right now.    │
│──────────────────────────────────────────────────────────────│
│  THE ONE THING                                                │
│  "Everything you know about moisturizer is wrong."            │
│  Film that line in the first 3 seconds. Everything else       │
│  is secondary.                                                │
│──────────────────────────────────────────────────────────────│
│  DO THIS NOW                                                  │
│  Film Tuesday. Post Thursday 7pm — your peak window.          │
│  That's it.                                                   │
│──────────────────────────────────────────────────────────────│
│  ⚠  WATCH OUT FOR                         [amber styling]    │
│  The hook is confrontational — if this client is conservative, │
│  get their approval before filming.                           │
└──────────────────────────────────────────────────────────────┘
```

### The Fifth Block: Watch Out For

The Quality Flags pass (Six Thinking Hats, internal) produces risks.
One risk surfaces into the Boss Brief as "Watch Out For."

Rules for this block:
- Rendered in amber — visually distinct, not alarming but noticeable
- One sentence maximum
- Pulled from Black Hat findings (what could go wrong) or Red Hat (tone mismatch)
- If no meaningful risk exists: this block is hidden. Not shown as "no risks."

### Boss Brief Writing Rules (prompt constraints for the AI)

- No marketing jargon. No passive voice. No sentences over 20 words.
- Never use: "leverage", "synergy", "utilize", "going forward", "circle back",
  "touch base", "deep dive", "actionable insights", "move the needle"
- Written for someone in back-to-back meetings who has 30 seconds
- Every block must be evidenced or actionable — no decoration
- The "Watch Out For" block cites the specific risk, not a vague warning

---

## 5. Feedback Loop: Sessions Learn Over Time

The current plan generates content. This addition makes it learn.

### How It Works

After a session is published (content goes live via Publishing page):
1. A reference is created: `session_id → scheduled_post_id`
2. 7 days after publishing, a background job fetches Metricool post performance
3. The session is updated with real performance data:

```typescript
interface SessionPerformance {
  post_id: string
  platform: string
  published_at: string
  measured_at: string
  metrics: {
    reach: number
    impressions: number
    engagement_rate: number
    saves: number
    shares: number
    comments: number
    link_clicks?: number
  }
  performance_verdict: 'exceeded' | 'met' | 'below' | 'significantly_below'
  vs_client_average: number    // percentage above/below client's avg ER
  vs_industry_benchmark: number
}
```

4. The session is tagged in the session list with a performance badge:
   `↑ Exceeded avg by 34%` or `↓ Below avg by 12%`

### How This Compounds

Sessions with performance data become training examples for future generations.
When running a new Content Studio session for the same client:

```
PERFORMANCE HISTORY — [Client] — Verified Results:
Best performing session: "[Session name]" — ER 8.4% (client avg: 5.2%)
· Hook used: curiosity type, challenge framing
· Format: Reel, 28 seconds
· Posted: Thursday 7pm
· What the data says: challenge hooks outperform transformation hooks 2.1× for this client

Worst performing session: "[Session name]" — ER 1.1%
· Hook used: authority type
· Format: Static carousel
· Avoid: authority hooks in static format for this client specifically
```

Over time, the system builds a verified performance library per client.
Not generic best practices — evidence from this client's actual results.

---

## 6. Phase-by-Phase Session Saving

If generation fails at phase 5 of a 7-phase run, nothing is lost.

### Save Strategy

Each phase writes its output to the session immediately on completion:

```typescript
// After each phase completes:
await supabase
  .from('studio_sessions')
  .update({
    outputs: { ...existingOutputs, [phaseName]: phaseResult },
    updated_at: new Date().toISOString(),
  })
  .eq('id', sessionId)
```

### Resume on Failure

If a phase fails, the session status becomes `'partial'`.
On next page load:

```
┌──────────────────────────────────────────────────────────────┐
│  Session paused at Step 5                                     │
│  Research and hooks are ready. Script generation failed.      │
│                                                               │
│  [Resume from Step 5]    [Start over]                        │
└──────────────────────────────────────────────────────────────┘
```

"Resume from Step 5" reloads the session with completed phases pre-filled
and retries only from the failed step forward. The user never loses completed work.

---

## 7. Content Studio — Pipeline

### Input Form

Multi-platform chip select. User picks 1 to 5 platforms.
One unified generation pass. Platform adaptation notes appear inline per script section.

```typescript
interface ContentInputs {
  platforms: string[]
  audience: 'B2C' | 'B2B'
  goal: string
  cta: string
  brief: string
  language: 'english' | 'arabic'
  dialect?: 'saudi' | 'egyptian' | 'gulf' | 'msa'
  emotional_trigger?: string    // from structured question
}
```

### Auto-Chain (invisible)

```
1  SIGNAL PULL         Load industry SignalReport + Metricool 30-day data
2  BRIEF EXPANSION     JTBD extraction + ELM calibration + WOOP framing + emotional constraint
3  RESEARCH            Audience psychology + trend alignment + performance context
4  DIVERGENT HOOKS     20 hooks, zero scoring pressure, wild options encouraged
5  CONVERGENT SCORING  3C scoring + SCAMPER on hooks below 15 + auto-select best
6  SCRIPT              StoryBrand arc + Narrative Transportation + Fogg CTA
                       Platform adaptation notes per section for multi-platform
7  QUALITY FLAGS       Six Thinking Hats (internal) — one finding surfaces to Boss Brief
8  BOSS BRIEF          Haiku model, 5-block summary
9  RENDER              Document + Boss Brief + Chatbot
```

### Scientific Framework Prompts

**JTBD:**
```
JOBS-TO-BE-DONE PRE-ANALYSIS:
1. Functional job: What task does consuming this content accomplish?
2. Emotional job: How should they feel AFTER watching, not during?
3. Social job: If they share this, what does it say about them?
Ground all research, hooks, and script in these three answers.
```

**ELM Calibration:**
```
Audience: {{B2C|B2B}} → Route: {{peripheral|central}}
Platform: {{platform}} → Depth: {{scroll-speed|considered}}
Peripheral: emotion, aesthetics, social proof, identity first.
Central: data, expertise, logical structure, authority first.
```

**WOOP:**
```
Wish (what they desire) → Outcome (what success feels like) →
Obstacle (what blocks them right now) → Plan (how this content/brand helps)
The most powerful hooks address the Obstacle — not the Wish.
```

**StoryBrand:**
```
HOOK: Open with the Hero's desire or the Problem. Their world. Their words.
BODY: Brand = Guide. Empathy first, then competence. Plan in 2-3 steps.
      Paint SUCCESS before delivering CTA.
CTA:  Direct. Minimum ability required. Failure is implicit — never stated.
```

**Fogg Model:**
```
By CTA time, motivation is at peak. Require MINIMUM ability:
Instagram/TikTok: save, share, follow, comment (1 tap)
LinkedIn: comment or share (1 action)
YouTube: subscribe + bell
Never: website visits, form fills, multi-step actions in short-form CTAs.
```

---

## 8. Hook Lab — Refined Pipeline

### Two-Pass Generation

**Problem:** Current single-pass generates and scores simultaneously. The AI self-censors.
**Fix:** Separate divergent from convergent.

**Pass 1 — Divergent (no judgment):**
"You are in a brainstorm. No scoring. No self-censoring. Include wild options.
The audience can be surprised, challenged, slightly uncomfortable. Virality is irrelevant here."

**Pass 2 — Convergent (strict scoring):**
Score all 20 on 3C. Apply SCAMPER to any hook below 15. Re-score. Sort. Return.

Expected improvement: 2-3 S-tier hooks per batch → 4-6 S-tier per batch.

### SCAMPER Auto-Refinement Table

| Trigger | How it's applied | Example |
|---|---|---|
| Substitute | Replace one element with something unexpected | "skincare routine" → "mirror" |
| Combine | Merge two hook types | Curiosity + Status trigger combined |
| Adapt | Apply structure to a different emotion | Challenge hook → Pride framing |
| Modify | Amplify the core claim | "Most people don't know" → "99% of people are wrong about" |
| Eliminate | Strip the obvious framing, keep only the payload | Remove setup, start with the punchline |
| Reverse | Flip the premise entirely | "Why X happens" → "Why X never happens to people who..." |

---

## 9. Strategy Command Center — Refined Pipeline

### Auto-Chain (invisible)

```
1  SIGNAL PULL         Load industry SignalReport
2  INTELLIGENCE        Market position, SWOT, audience — Double Diamond: Discover
                       WOOP: Client's Wish → Outcome → Obstacle → Strategic Plan
3  POSITIONING         Archetype, UVP, messaging — Double Diamond: Define
                       Medici Effect: one cross-domain positioning analogy injected
4  EXECUTION           Content pillars, platform strategy — Double Diamond: Develop
                       Signal Report formats injected: "winning this week"
5  SCALE & RETAIN      Community, paid, retargeting — Double Diamond: Deliver
6  OPTIMIZE            A/B roadmap, 12-month iteration, benchmarks
7  QUALITY FLAGS       Six Thinking Hats internal pass
8  EXEC SUMMARY        Plain-English synthesis, CEO comprehension level
9  BOSS BRIEF          5-block summary
```

### Double Diamond Prompt Framing

Each phase instruction names its Diamond position to enforce proper cognitive scope:

```
Intelligence: "DISCOVER phase — gather broadly, do not filter, include contradictions."
Positioning:  "DEFINE phase — narrow to ONE strategic priority. Not three. One."
Execution:    "DEVELOP phase — generate a broad content system. Diverge before converging."
Optimize:     "DELIVER phase — narrow to the highest-confidence actions only."
```

---

## 10. Campaign Igniter — The Breakthrough Ideas Tool

### Time Expectation (shown before Run)

Campaign Igniter is the deepest tool. 7 phases. 3-5 minutes minimum.
Before the user hits Run, an upfront notice:

```
┌──────────────────────────────────────────────────────────────┐
│  This one takes 3-4 minutes                                   │
│  We're doing real creative work — cultural analysis,          │
│  constraint mapping, cross-domain thinking, and execution      │
│  briefs for every concept. Worth the wait.                    │
│                                                               │
│  [Run Campaign Igniter →]                                     │
└──────────────────────────────────────────────────────────────┘
```

### The 7-Phase Pipeline (invisible)

**Phase 1 — CULTURAL TENSION MINING**
Pulls from: SignalReport.cultural_tensions + Reddit rising + Google Trends.
Extracts 5-7 tensions: specific contradictions the target audience holds simultaneously.

```
A tension is something the audience simultaneously wants AND resists.
"People love skincare but feel guilty about how complicated it's become."
"People want to be seen as successful but are tired of brands selling hustle."
Output: 5 tensions with the tension, the evidence, and the opportunity.
```

**Phase 2 — CONSTRAINT INVERSION**
Identifies 5 unwritten rules of marketing in this industry.
Inverts each one deliberately and with intention.

```
What are the 5 things EVERY brand in [industry] does without questioning?
Then: what happens if one brand breaks each rule publicly and on purpose?
Output: 5 rule + inversion pairs. Each inversion must be specific and actionable.
```

**Phase 3 — CROSS-DOMAIN STIMULATION**
3 domains randomly selected from `lib/studio-campaign-domains.ts` (50 entries:
film direction, game design, street art, culinary arts, chess, theater, aviation,
stand-up comedy, 1960s advertising, military strategy, magic/illusion, etc.)

```
For each domain: If this campaign was designed by a [domain expert],
what would the core mechanic be?
Not themes to copy — thinking lenses.
A game designer asks: "What is the reward loop?"
A street artist asks: "What is the unexpected surface or medium?"
Output: 3 raw concept seeds. Wild. No judgment.
```

**Phase 4 — DIVERGENT IDEATION (no judgment)**
Combines tensions + inversions + cross-domain seeds.
Generates 15 raw concepts. Zero filtering.

```
Rules: Budget irrelevant. Feasibility irrelevant.
Include at least 3 concepts that would make a cautious brand manager uncomfortable.
Include at least 2 rooted in a specific cultural tension.
Each concept: one sentence only. No explanation yet.
```

**Phase 5 — PARTICIPATORY MECHANIC DESIGN**
For the top 7 concepts: designs how the audience becomes the campaign.

```
Great campaigns are not consumed — they are participated in.
Duolingo's death hoax: audiences mourned and resurrected Duo.
Vaseline Verified: audiences tested the hacks themselves.
McDonald's illegal flowers: pedestrians photographed them daily.

For each concept — "How does the audience become the campaign?"
UGC trigger / Opinion mechanic / Mystery / Physical action / Duet-reaction / Share-to-unlock
```

**Phase 6 — CONVERGENT SCORING**

Score each concept:

| Dimension | 1-10 | Notes |
|---|---|---|
| Boldness | — | How unexpected vs. industry norms |
| Implementability | — | 10 = doable in 3 days, 1 = needs Netflix budget |
| Virality Potential | — | How participatory and spreadable |

Filters: Implementability < 4 only kept if Virality = 9-10. Boldness < 5 excluded.
Apply Fogg Model check: does audience participation require minimum ability?

**Phase 7 — EXECUTION BRIEFS**

For each top 3-5 concepts:

```json
{
  "campaign_name": "3 words max",
  "tagline": "The idea in one punchy line",
  "core_idea": "One sentence. If you can't say it in one sentence, it's too complex.",
  "why_it_works": "The psychological principle by name + how it applies here",
  "cultural_tension": "Which tension from Phase 1 does this activate?",
  "platform": "Primary + secondary platform",
  "execution_steps": ["Step 1 — who does what", "Step 2", "...max 6"],
  "participation_mechanic": "Exactly how the audience becomes part of this",
  "shareable_moment": "The specific frame, screenshot, or moment they will share",
  "scoring": { "boldness": 9, "implementability": 7, "virality": 8 },
  "budget": "Low | Medium | High",
  "timeline": "Days | Weeks | Months",
  "risk": "One-line risk",
  "mitigation": "One-line mitigation"
}
```

---

## 11. Why Didn't This Work — Post-Mortem Tool

A new tool. The agency posts content, Metricool shows it underperformed.
Instead of guessing why, they run a post-mortem.

### Location

New tab in Studio: `/studio/postmortem`
Also accessible from the session list when a session has `performance_verdict: 'below'`.

### Input

User selects a session (or a specific Metricool post from the client's history).
System pulls the session data: brief, hook, script, caption, publish time, platform.
System pulls the Metricool performance: reach, ER, saves, shares.

### The Diagnostic Pipeline (4 analyses, parallel)

```
1  HOOK ANALYSIS       Was the hook the problem?
                       Score the hook retrospectively against current trend data.
                       Compare hook type vs. what's performing in this industry right now.

2  FORMAT ANALYSIS     Was it the wrong format for this moment?
                       Compare format to Metricool's best-format data for this client.
                       Flag if format contradicts the client's performance pattern.

3  TIMING ANALYSIS     Did it go out at the wrong time?
                       Compare actual publish time vs. client's peak engagement window.
                       Flag deviation.

4  CAPTION ANALYSIS    Did the caption kill the content?
                       Score caption for CTA clarity, hook continuation, and friction.
```

### Output Document

```
┌──────────────────────────────────────────────────────────────┐
│  POST-MORTEM                                                  │
│  "[Session name]" · [Platform] · Posted [date]               │
│  Result: ER 1.2% (client avg: 5.2%) · Below by 77%           │
├──────────────────────────────────────────────────────────────┤
│  HOOK              🔴 LIKELY CAUSE                            │
│  Authority hooks perform 2.3× below curiosity hooks for       │
│  this client based on 6 months of Metricool data.            │
│  Fix: Switch to curiosity or challenge framing next time.     │
├──────────────────────────────────────────────────────────────┤
│  FORMAT            🟡 CONTRIBUTING FACTOR                     │
│  Static carousel on Instagram averages 1.8% ER for this       │
│  client. Reels average 7.1%. Format choice cost reach.        │
│  Fix: Move this topic to Reel format next run.               │
├──────────────────────────────────────────────────────────────┤
│  TIMING            🟢 NOT THE ISSUE                           │
│  Posted Thursday 7pm — within the client's optimal window.   │
├──────────────────────────────────────────────────────────────┤
│  CAPTION           🟡 MINOR FACTOR                            │
│  CTA asked for a website visit — high ability required.       │
│  Platform data shows save/share CTAs outperform link CTAs     │
│  3.4× for awareness content on Instagram.                     │
│  Fix: Change CTA to "Save this for later."                   │
├──────────────────────────────────────────────────────────────┤
│  VERDICT                                                      │
│  Primary cause: wrong hook type for this client's audience.   │
│  Rerun this brief with a curiosity hook and Reel format —    │
│  estimated performance uplift: 3-4× based on client history. │
│                                                               │
│  [Rerun with fixes →]                                        │
└──────────────────────────────────────────────────────────────┘
```

"Rerun with fixes" pre-fills a new Content Studio session with the same brief,
the fixes applied as constraints, and a note linking back to the original session.

---

## 12. Mobile Design

Studio tools are used on laptops in offices and on phones at client sites.
Every component must render cleanly on both.

### Rules

**Loading screen:** Full screen on mobile. Phase messages center-aligned.
No two-column layout. Single column list of steps.

**Document:** All sections stack vertically. No grid layouts that break below 640px.
Section cards are full-width. Score badges wrap to a second line rather than truncate.

**Boss Brief:** Full-width card. Each block stacks. The "Watch Out For" block is
always visible on mobile — never collapsed.

**Chatbot panel:** On desktop: right side panel (40% width). On mobile: bottom sheet
that slides up, covers 70% of screen. A "Chat" floating button anchored to bottom-right.

**Structured questions:** Option buttons stack vertically on mobile. Full-width.
"Something else..." always last, always visible without scrolling.

**Session list:** On mobile: a swipeable card stack, not a table.

**Campaign concept cards:** On mobile: each concept is a full-page card.
Swipe left/right between concepts. Score badges at top. Execution steps in accordion
(tap to expand each step).

### Breakpoints

- 640px and below: mobile layout (full-width stacked)
- 641px–1024px: tablet layout (two columns where appropriate)
- 1025px+: desktop layout (document + chatbot side by side)

---

## 13. Output Formatting Standards

**No output anywhere in Studio is raw text.**
Every piece of content has a visual container, a type treatment, and a hierarchy.
This is not cosmetic — formatting signals quality and makes outputs usable, not just readable.

### Content Studio Document

```
DOCUMENT HEADER
  bg-white border-b border-slate-200 px-6 py-4
  Left: Client color dot + client name (font-semibold) + platform chips (bg-novax-light)
  Right: [Export PDF] [Export TXT] [Chat about this ↗]

SECTION: WHAT WE BUILT
  bg-novax rounded-2xl p-6 mb-6
  Label: "BUILT FOR YOU" — text-[10px] tracking-[0.2em] text-novax-accent font-bold uppercase
  Summary text: text-base text-white leading-relaxed

SECTION: AUDIENCE INTELLIGENCE
  3-column grid (1-col on mobile)
  Each column: bg-white border border-slate-200 rounded-xl p-4
  Column header: text-[10px] uppercase tracking-widest text-slate-400
  Content: text-sm text-slate-700 with · prefix bullets

SECTION: SELECTED HOOK
  bg-novax-light border-2 border-novax-border rounded-2xl p-6
  Top row: Tier badge (S=amber, A=emerald, B=blue, C=slate) + Hook type chip + Score "28/30"
  Hook text: text-xl font-semibold text-slate-900 leading-snug my-4
             dir="rtl" if Arabic
  3C score bars (always visible, not expandable):
    "Clarity" bar + score number
    "Context" bar + score number
    "Curiosity" bar + score number
  Bottom: "Why selected:" text-xs text-novax-muted italic

SECTION: THE SCRIPT
  Section label: "THE SCRIPT" + Duration badge + Production difficulty badge
  Each script section (HOOK / BODY / CTA):
    Header bar: bg-novax rounded-t-xl px-4 py-2
      Left: section name text-xs font-bold text-white tracking-widest
      Right: timestamp text-xs text-novax-accent
    Content area: bg-white rounded-b-xl border border-novax-border px-4 py-3
      Spoken lines: text-sm text-slate-800 leading-relaxed
      Stage directions: [bracketed] — text-xs text-slate-400 italic
      Visual note (bottom): border-t border-slate-100 mt-3 pt-3
                             text-xs text-novax-muted italic
                             Prefixed with camera icon

SECTION: PRODUCTION CHECKLIST
  Label: "B-ROLL NEEDED"
  Chip grid (flex-wrap): each shot as bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5
                          text-xs font-medium with a camera icon prefix

SECTION: CAPTION
  bg-slate-50 border border-slate-200 rounded-xl p-4
  Top row: "CAPTION" label + [Copy] button (novax-muted)
  Caption text: text-sm text-slate-800 leading-relaxed
               dir="rtl" if Arabic
  Bottom: platform-specific note if multi-platform
```

### Boss Brief Card

```
bg-novax rounded-2xl overflow-hidden mt-8

HEADER
  px-6 py-4 border-b border-white/10
  Left: "BOSS BRIEF" — text-xs tracking-[0.2em] text-novax-accent font-bold
  Right: "30-second version" — text-xs text-white/50

ROWS (each row)
  px-6 py-4 border-b border-white/10
  Label: text-[10px] tracking-wider text-novax-accent font-bold uppercase mb-1
  Content: text-sm text-white leading-relaxed

ROW: THE ONE THING
  Content in text-base font-semibold text-white (larger than others)

ROW: WATCH OUT FOR (only if risk exists)
  bg-amber-500/10 border-l-4 border-amber-400
  Label: text-amber-300
  Content: text-sm text-amber-100
  Prefixed with TriangleAlert icon (amber)
```

### Hook Lab Document

```
DOCUMENT HEADER
  Same pattern as Content Studio

SUMMARY BAR
  bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-4
  "X hooks generated"
  Tier breakdown: S·3 (amber badge) A·8 (emerald badge) B·7 (blue) C·2 (slate)

FEATURED HOOK (top S-tier, always shown first)
  bg-novax text-white rounded-2xl p-6 mb-4
  "BEST HOOK" label — text-[10px] tracking-widest text-novax-accent
  Hook text: text-xl font-semibold leading-snug my-3
  3C bars in white/novax-accent

HOOK LIST (remaining hooks)
  bg-white border border-slate-200 rounded-xl p-4 space-y-2

EACH HOOK CARD
  flex items-start gap-3 p-4 rounded-xl border transition-all
  Saved: border-novax-border bg-novax-light/30
  Normal: border-slate-200
  Left: Rank number (text-[11px] text-slate-400) + Tier badge
  Body: Hook text (text-sm font-medium) + type chip + format chip + score
  3C score bars: always visible (3 lines, compact)
  Actions right: Star (save) + Copy + Refresh (SCAMPER variation)
```

### Strategy Document

```
DOCUMENT HEADER
  Client name + "STRATEGY DOCUMENT" + date built + Export button

EXECUTIVE SUMMARY
  bg-novax rounded-2xl p-6
  Same treatment as Content Studio "WHAT WE BUILT"

PHASE CARDS (5 cards, each)
  bg-white border border-slate-200 rounded-2xl overflow-hidden

  PHASE HEADER
    bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-4
    Phase number: text-3xl font-black text-slate-100 (large, decorative)
    Phase name: text-sm font-bold text-slate-800
    Diamond position: text-xs text-slate-400 (Discover / Define / etc.)

  PHASE CONTENT (inside card)
    px-6 py-5 space-y-4

  KEY INSIGHT CALLOUT
    bg-novax-light border-l-4 border-novax-border rounded-r-xl p-4
    "THE INSIGHT" label — text-[10px] tracking-wider text-novax-muted
    Content: text-sm font-medium text-novax

  NUMBERS/METRICS
    Displayed larger: text-2xl font-black text-slate-900 with label text-xs below

  CONTENT PILLARS (Execution phase)
    5-card grid (2-3 col on desktop, 1-col mobile)
    Each pillar: bg-slate-50 rounded-xl p-4
      Pillar name: font-bold text-slate-800
      Frequency: badge chip (novax-light)
      2 example topics: text-xs text-slate-500 with · prefix

  12-MONTH ROADMAP (Optimize phase)
    3-column timeline (Month 1-3 / 4-6 / 7-12)
    Each column: bg-slate-50 rounded-xl p-4 with month range header

  PAID BUDGET SPLIT
    3-col visual with percentage in large text + label
    Awareness: text-novax / Retargeting: text-novax-muted / Conversion: text-novax-accent
```

### Campaign Igniter Document

```
DOCUMENT HEADER
  Client + Industry + Boldness level chip (color-coded) + Export + Chat

WHAT WE FOUND (pre-concepts section)
  3-column grid:
    Cultural Tensions found: count + amber indicator
    Industry rules broken: count + red indicator
    Creative domains used: [domain 1] · [domain 2] · [domain 3] chips

TENSION CALLOUT CARDS (collapsible, top 3)
  bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4
  "CULTURAL TENSION" label — text-[10px] amber text
  Tension text: text-sm font-medium text-amber-900
  Evidence: text-xs text-amber-700

CAMPAIGN CONCEPT CARDS (3-5 cards)
  bg-white border-2 border-slate-200 rounded-2xl overflow-hidden
  (Selected/highlighted: border-novax)

  CONCEPT HEADER
    px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center
    Left: "CONCEPT [1/2/3]" text-xs text-slate-400 + Campaign name text-sm font-bold
    Right: Score badges row:
      Bold: bg-novax text-white rounded-lg px-2 py-1 text-xs font-bold
      Easy: bg-emerald-100 text-emerald-700
      Viral: bg-violet-100 text-violet-700

  TAGLINE
    px-6 py-4
    text-lg font-semibold text-slate-900 italic

  WHY IT WORKS
    bg-novax-light border border-novax-border rounded-xl mx-6 p-4 my-2
    "WHY IT WORKS" label text-[10px] tracking-wider text-novax-muted
    Psychological principle + application: text-sm text-novax

  EXECUTION STEPS
    px-6 py-4
    Numbered list: each step in its own row
    Number: text-lg font-black text-novax (large, decorative)
    Step text: text-sm text-slate-700 (inline with number)

  PARTICIPATION MECHANIC
    bg-slate-900 text-white rounded-xl mx-6 p-4 my-2
    "HOW THE AUDIENCE BECOMES THE CAMPAIGN" text-[10px] tracking-wider text-slate-400
    Mechanic description: text-sm text-white font-medium

  THE SHAREABLE MOMENT
    bg-novax text-white rounded-xl mx-6 p-4 my-2
    Camera icon + "THE SHAREABLE MOMENT" label
    Description: text-sm text-novax-accent

  CARD FOOTER
    px-6 py-3 border-t border-slate-100 flex items-center gap-3 flex-wrap
    Budget chip: Low=bg-emerald-100 / Medium=bg-amber-100 / High=bg-red-100
    Timeline chip: bg-slate-100
    Risk (if present): bg-amber-50 border border-amber-200 text-amber-800 text-xs
```

### Post-Mortem Document

```
HEADER
  "[Session name]" + platform + post date
  Result row: ER percentage + vs. client avg (colored: red if below)

DIAGNOSTIC ROWS (4 rows: Hook / Format / Timing / Caption)
  Each row: bg-white border rounded-xl p-4
  Left: Diagnosis label + status indicator:
    🔴 "LIKELY CAUSE" — bg-red-50 border border-red-200
    🟡 "CONTRIBUTING FACTOR" — bg-amber-50 border border-amber-200
    🟢 "NOT THE ISSUE" — bg-emerald-50 border border-emerald-200
  Finding: text-sm text-slate-700
  Fix (if applicable): text-sm text-novax-muted italic "Fix: ..."

VERDICT
  bg-novax rounded-2xl p-6
  Verdict text: text-sm text-white
  [Rerun with fixes →] button
```

### Loading Screen

```
STAGE 1 — BRIEFING (0-1.5s)
  Full-screen center. NOVAX wordmark. One line text-sm text-slate-500.
  No progress. No animation except wordmark fade-in.

STAGE 2 — WORKING
  Max-width container, centered vertically.

  Session name: text-lg font-semibold text-slate-800 mb-6

  STEP LIST
    Each step: flex items-start gap-3 py-2
    Icon states:
      Pending:   Circle (text-slate-300)
      Active:    Loader2 animate-spin (text-novax-accent)
      Complete:  CheckCircle (text-emerald-500)
    Step text: text-sm text-slate-700 (pending: text-slate-400)

    COMPLETED STEP INSIGHT
      Appears below completed step line
      bg-novax-light border border-novax-border rounded-lg px-3 py-1.5 mt-1
      text-xs text-novax-muted italic
      "✓ 20 hooks generated — top hook scored 28/30"

  CAMPAIGN IGNITER ONLY: Progress bar
    bg-slate-100 rounded-full h-1.5 mt-6
    Fill: bg-novax transition-all duration-1000

  Elapsed time: text-xs text-slate-400 mt-4 text-right

STAGE 3 — REVEAL (0.5s)
  "Done." — text-lg font-semibold text-slate-900
  Stats line: text-xs text-slate-500 "20 hooks · Score 28/30 · 4 sections · Caption ready"
  Document sections fade up with stagger animation (100ms between sections)
```

---

## 14. Data Architecture

### New API Routes

| Route | Purpose | Model | Est. |
|---|---|---|---|
| `GET /api/studio/signal-report/[industry]` | Read cached report or trigger compute | — | 30m |
| `POST /api/studio/signal-report/generate` | Full compute (cron target) | sonnet-4-6 | 2h |
| `POST /api/studio/chat` | Contextual chat + edit detection | sonnet-4-6 | 1h |
| `POST /api/studio/questions` | Generate structured question options from brief | haiku-4-5 | 45m |
| `POST /api/studio/brief-confirm` | Structured brief understanding | haiku-4-5 | 30m |
| `GET/POST /api/studio/session` | Session CRUD | — | 1h |
| `PATCH /api/studio/session/[id]` | Update session (per-phase saves) | — | 30m |
| `GET /api/studio/metricool-context/[clientId]` | Performance data pull + normalize | — | 1.5h |
| `POST /api/studio/campaign/generate` | Campaign Igniter 7-phase pipeline | opus-4-8 | 3h |
| `POST /api/studio/postmortem` | Post-mortem diagnostic analysis | sonnet-4-6 | 1.5h |
| `POST /api/studio/session/[id]/performance` | Update session with Metricool post results | — | 1h |

### DB Migration

```sql
-- sql/015_studio_sessions.sql

CREATE TABLE studio_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  client_id            uuid REFERENCES clients(id) ON DELETE SET NULL,
  tool                 text NOT NULL CHECK (tool IN (
                         'content', 'hooks', 'strategy', 'campaign',
                         'postmortem', 'intel', 'trends', 'ads', 'repurpose'
                       )),
  created_by           uuid REFERENCES users(id),
  status               text NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'partial', 'complete', 'error')),
  brief                text,
  inputs               jsonb DEFAULT '{}',
  outputs              jsonb DEFAULT '{}',
  executive_summary    text,
  boss_brief           jsonb,
  structured_answers   jsonb DEFAULT '{}',
  chat_history         jsonb DEFAULT '[]',
  edit_history         jsonb DEFAULT '[]',
  signal_report_used   jsonb,
  metricool_snapshot   jsonb,
  performance          jsonb,          -- filled 7 days after publish
  performance_verdict  text CHECK (performance_verdict IN (
                         'exceeded', 'met', 'below', 'significantly_below'
                       )),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX studio_sessions_client_idx ON studio_sessions (client_id);
CREATE INDEX studio_sessions_tool_idx ON studio_sessions (tool, created_at DESC);
CREATE INDEX studio_sessions_created_by_idx ON studio_sessions (created_by);

ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON studio_sessions
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "admin_all_sessions" ON studio_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'ceo', 'creative_director'))
  );
```

---

## 15. Chatbot System Prompt — Final Version

```
You are the NOVAX Studio Intelligence System.
You are a senior creative strategist embedded in this agency's production pipeline.

You are not a general-purpose assistant.
You are a specialist for exactly what was produced in this session — nothing else.

IDENTITY:
You ran the analysis. You chose the hook. You wrote the strategy.
Speak with that ownership. Do not hedge. Do not caveat unless critical.

RESPONSE RULES:
1. Start on word one. No "Great question!", "Certainly!", "Of course!", "Absolutely!".
   Banned phrases. The user's time matters more than your politeness.
2. Quote specific lines when referencing the content. Be exact. Never vague.
3. For analysis: FINDING → EVIDENCE → ACTION. One line each. Only when 3+ lines needed.
4. Maximum 4 sentences unless listing. Lists: maximum 6 items.
5. No emojis. No hashtags. No "feel free to..." or "hope this helps!".
6. Not in the context? Say: "Not in the generation context." Full stop.
7. Opinions: direct statements. "The hook is weak because [reason]." Not "might be."

SCIENTIFIC CONTEXT (how things were built):
- Hooks: 9 Cialdini trigger types + 3C scoring (Clarity, Context, Curiosity)
- Script: StoryBrand arc — Hero → Problem → Guide → Plan → CTA
- Research: Jobs-to-be-Done framing
- CTA: Fogg Behavior Model (Motivation × Ability × Prompt)
- Audience: ELM calibration ({{peripheral|central}} processing)
When asked why something was done, reference the framework by name.

EDIT MODE — HARD RULE:
If the user asks to change, rewrite, improve, shorten, lengthen, translate,
or modify ANYTHING — respond with ONLY this JSON. Zero other text:
{
  "type": "edit",
  "target": "<key>",
  "new_content": "<replacement only>",
  "reasoning": "<one sentence>"
}

Valid targets:
Content:     hook | script_hook | script_body | script_cta | caption | broll_list
Strategy:    phase_intelligence | phase_positioning | phase_execution |
             phase_scale | phase_optimize | executive_summary
Hooks:       hook_0 | hook_1 | hook_2 ...
Campaign:    concept_0_idea | concept_0_steps | concept_0_mechanic | concept_1_... etc.
Boss Brief:  boss_what | boss_why | boss_onething | boss_do | boss_watch

GENERATION CONTEXT:
{{CONTEXT_JSON}}
```

---

## 16. Implementation Order

| # | File | What | Est. | Sprint |
|---|---|---|---|---|
| 1 | `lib/studio-types.ts` | All types (StudioSession, SignalReport, CampaignConcept, SessionPerformance, etc.) | 1h | 4A |
| 2 | `sql/015_studio_sessions.sql` | DB migration | 30m | 4A |
| 3 | `app/api/studio/session/route.ts` + `[id]/route.ts` | Session CRUD + per-phase partial saves | 1.5h | 4A |
| 4 | `app/api/studio/brief-confirm/route.ts` | Brief understanding (Haiku, <1s) | 30m | 4A |
| 5 | `app/api/studio/questions/route.ts` | AI-generate option buttons from brief (Haiku) + static fallbacks | 45m | 4A |
| 6 | `app/api/studio/chat/route.ts` | Chat API + system prompt + edit detection | 1h | 4A |
| 7 | `components/studio/studio-brief-confirm.tsx` | Brief confirmation + question component with formatting spec | 1.5h | 4A |
| 8 | `components/studio/studio-loading.tsx` | 3-phase loading screen — mobile + desktop | 1.5h | 4A |
| 9 | `components/studio/studio-chatbot.tsx` | Chat panel — desktop side panel + mobile bottom sheet | 1.5h | 4A |
| 10 | `components/studio/studio-document.tsx` | Document renderer — all formatting specs per section | 3h | 4A |
| 11 | `app/(app)/studio/content/page.tsx` | Full rewrite — multi-platform, auto-chain, cold start | 2.5h | 4A |
| 12 | `app/api/studio/metricool-context/[clientId]/route.ts` | Metricool pull + normalize + 4h cache | 1.5h | 4B |
| 13 | `lib/data-providers/google-trends.ts` | Google Trends alpha API + SerpAPI fallback | 1h | 4B |
| 14 | `lib/data-providers/reddit.ts` | Reddit Rising API client | 1h | 4B |
| 15 | `lib/data-providers/tiktok-creative-center.ts` | TikTok CC via Apify | 1h | 4B |
| 16 | `lib/data-providers/youtube.ts` | YouTube Data API v3 | 45m | 4B |
| 17 | `app/api/studio/signal-report/[industry]/route.ts` | Read cache or trigger compute | 45m | 4B |
| 18 | `app/api/studio/signal-report/generate/route.ts` | Full Signal Report compute | 3h | 4B |
| 19 | `app/(app)/studio/strategy/page.tsx` | Full rewrite — auto-chain + strategy document | 2h | 4B |
| 20 | `app/(app)/studio/hooks/page.tsx` | Rewrite — two-pass generation + formatted document | 1.5h | 4B |
| 21 | `app/(app)/studio/page.tsx` | Hub redesign — recent sessions + tool cards | 1h | 4B |
| 22 | `components/studio/studio-session-list.tsx` | Session list with performance badges | 1h | 4B |
| 23 | `lib/studio-campaign-domains.ts` | 50 cross-domain stimuli entries | 30m | 5A |
| 24 | `app/(app)/studio/campaign/page.tsx` | Campaign Igniter page + time warning + all formatting | 2.5h | 5A |
| 25 | `app/api/studio/campaign/generate/route.ts` | 7-phase pipeline, phase-by-phase saves | 3h | 5A |
| 26 | `app/(app)/studio/postmortem/page.tsx` | Post-Mortem page + formatted diagnostic document | 2h | 5B |
| 27 | `app/api/studio/postmortem/route.ts` | 4-analysis diagnostic pipeline | 1.5h | 5B |
| 28 | `app/api/studio/session/[id]/performance/route.ts` | Post-publish performance update (called by cron) | 1h | 5B |
| 29 | `lib/studio-export.ts` | TXT + print-PDF export with `.no-print` CSS | 45m | 5B |

**Total: ~43 hours across Sprint 4A through Sprint 5B**

---

## 17. Priority Order

| Priority | Items | Sprint |
|---|---|---|
| P0 | Types + DB + Session API + Chat API + Questions API | 4A |
| P0 | Brief confirm component + Loading screen + Document renderer | 4A |
| P0 | Content Studio rewrite | 4A |
| P1 | Metricool context + Signal Report + all 4 data providers | 4B |
| P1 | Strategy rewrite + Hook Lab rewrite + Studio hub | 4B |
| P1 | Session list with performance badges | 4B |
| P2 | Campaign domains library + Campaign Igniter page + API | 5A |
| P2 | Post-Mortem page + API + Performance update route | 5B |
| P3 | Export (TXT + PDF) | 5B |

---

## 18. Market Position

| What this system does | What competitors do |
|---|---|
| Real performance data (Metricool) in every prompt | Generic AI with no client history |
| Daily Signal Network (5 targeted trend probes) | No live market data |
| Structured questions — AI-generated options from YOUR brief | Free text or generic dropdowns |
| Scientific frameworks embedded in prompts (JTBD, StoryBrand, Fogg, ELM, WOOP, SCAMPER) | Prompt engineering without methodology |
| Campaign Igniter: cultural tensions + constraint inversion + cross-domain stimuli | "Generate 5 campaign ideas" |
| Two-pass hook generation (divergent then convergent) | Single-pass, self-censored |
| Boss Brief: 5-block simplified output after every generation | Raw output only |
| Contextual chatbot that knows the data, the framework, and the evidence | Generic assistant |
| Post-Mortem: diagnoses why a post underperformed, runs the fix | No post-campaign analysis |
| Feedback loop: sessions learn from real post performance over time | Ephemeral outputs |
| Phase-by-phase session saves — resume from failure | All-or-nothing generation |
| Premium formatted documents — no raw text anywhere | Markdown or plain text |
| Cold start experience for new clients | Silent fallback |

The system is not an AI writing tool.
It is a production intelligence system with a memory, a methodology, and a feedback loop.

The output quality comes from the methodology — not the model.
Anyone can access the model. The methodology is the product.
