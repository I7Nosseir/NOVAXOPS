# NOVAX Ops — Master Build Plan
**Version:** 1.0  
**Written:** 2026-05-21  
**Scope:** Full platform transformation from MVP → Intelligent Action Platform → SaaS-ready product  

---

## Current Baseline (What Exists Today)

The platform is a **production-ready single-agency MVP**. Every core loop works:

```
Create Task → AI Agents → Compose Post → Schedule via Metricool → Client Approval → Publish → Webhook confirms
```

| Already live | Quality |
|---|---|
| Auth, sessions, middleware | Production-ready |
| 13 pages with real Supabase data | Production-ready |
| Pipeline Kanban (drag-drop, 10 stages) | Production-ready |
| 5 AI agents in Task panel (Claude) | Working but passive |
| Publishing (compose, bulk upload, calendar) | Production-ready |
| Metricool scheduling + webhooks | Production-ready |
| Approval portal (internal + client-facing) | Production-ready |
| Moderation queue (Respond.io plumbing ready) | Working |
| Reports + AI analysis | Working |
| Performance page (charts, competitor tab) | Working, not yet intelligent |
| Creative Eval, Assets, Library, Workload | Working |

**The gap:** The app surfaces intelligence but creates no path to act on it. The AI is reactive (you ask → it answers) not proactive (it spots → it triggers).

---

## The Transformation Vision

```
TODAY:  Intelligence Dashboard  →  User figures out what to do  →  Manual task creation
TARGET: Intelligence Layer  →  One-click action surface  →  AI-powered production  →  Publish
```

Every insight the platform generates will have a direct "do something about this" button that launches the correct tool pre-loaded with context. The AI stops being a text box and becomes an operating system for content production.

---

## The 7 Power Tools Being Built

| # | Tool | Purpose | Who uses it |
|---|---|---|---|
| 1 | **Content Creation Studio** | End-to-end content production pipeline | All roles |
| 2 | **Hook Lab** | Scientific hook writing with One Peak framework | Copywriters, admin |
| 3 | **Strategy Command Center** | 17-phase marketing strategy as a living document | Admin, CEO, Creative Director |
| 4 | **Viral Pattern Library** | Cross-client performance intelligence + templates | Admin, Creative Director |
| 5 | **Campaign Architecture Tool** | Multi-platform, multi-week campaign builder | Account Managers, Admin |
| 6 | **Brand Voice Trainer** | AI voice calibration per client from real examples | Admin |
| 7 | **Admin Intelligence Panel** | Meta-view across all clients + AI configuration | Admin only |

---

## Sprint Breakdown

---

### SPRINT 1 — The Action Bridge
**Duration: 1 week**  
**Theme: Make every insight clickable**

This is the single highest-ROI change in the entire roadmap. Zero new tools built — just connecting existing intelligence to action surfaces.

#### What gets built:

**1a. Performance page — action cards**
- Every `next_recommendations` card in the Pattern Intelligence tab gets a "Create This" button
- Click → `/studio/new` opens pre-loaded with: client, platform, content type, caption angle from the recommendation
- Content gap items in client Intelligence tab → "Fix This Gap" button → same Studio trigger

**1b. Client detail — SWOT action bridge**
- `opportunities[]` items → "Build content around this" button
- `content_gap[]` items → "Create missing content" button
- `strategy_90_days[]` items → "Start this strategy" button (triggers Strategy Command Center)

**1c. Dashboard — actionable alerts**
- "3 clients below benchmark" card → "Review Performance" link directly to the right client tab
- "No posts scheduled this week for [Client]" → "Schedule content" → Publishing page filtered to client

**1d. Studio shell — `/studio`**
- The destination for all action bridges above
- A new sidebar section: "Studio" with sub-items (Content, Hooks, Strategy)
- Studio landing page: 3 entry points (Create Content / Write Hooks / Build Strategy)

#### What this transforms:
The platform goes from a **reporting dashboard** to an **action dashboard**. Every time a team member opens the app, they see gaps AND can immediately close them. The intelligence is no longer decoration.

---

### SPRINT 2 — Content Creation Studio (Core)
**Duration: 3 weeks**  
**Theme: 16-phase pipeline collapsed into 6 user steps**

The flagship tool. Runs your content creation pipeline with AI handling the research-heavy phases automatically and in parallel.

#### Architecture:

```
/studio/content/new          → Phase 1: Define
/studio/content/[id]/explore → Phase 2: AI Research (auto)
/studio/content/[id]/hooks   → Phase 3: Hook Lab
/studio/content/[id]/script  → Phase 4: Script Workshop
/studio/content/[id]/direct  → Phase 5: Visual Direction
/studio/content/[id]/package → Phase 6: Package + Schedule
```

Each phase is a persisted document in Supabase — user can leave and return. Progress auto-saves.

#### Phase 1: Define (user fills in ~90 seconds)
- Platform selector (TikTok / Instagram / YouTube / LinkedIn / Facebook / X)
- Audience type: B2B or B2C (pre-filled from client profile)
- Content goal: Virality / Authority / Leads / Engagement / Sales / Community
- Desired emotion: Inspire / Educate / Entertain / Challenge / Reassure / Shock
- CTA goal (free text, 1 sentence)
- Crisis mode auto-detected from `client.is_in_crisis` — adjusts tone options available
- Client context auto-injected: brand_identity, tone_of_voice, key_messages, industry

#### Phase 2: AI Research Batch (auto, parallel, ~30 seconds)
- 3 Claude calls run simultaneously:
  - **Audience Psychology Agent** → emotional triggers, identity desires, fears, language patterns
  - **Trend Intelligence Agent** → viral patterns in niche, hook formats performing now, competitor content gaps
  - **Performance Context Agent** → reads `client.performance_intel`, surfaces what has/hasn't worked for THIS client
- Results presented as 3 collapsible cards with key takeaways
- User can expand each, dismiss individual findings, or add their own notes
- "Regenerate" button per card if findings seem off

#### Phase 3: Hook Lab (embedded One Peak framework)
- AI generates 20 hooks using the 5-step One Peak roadmap:
  1. Start with the end in mind (from Phase 1 CTA goal)
  2. Write 20 hooks applying the 3C framework (Clarity / Context / Curiosity)
  3. Score each 0–10 on each C = total virality score out of 30
  4. Rank and present top 8 with format recommendation (Vocal / Text Block / Caption)
  5. User selects one → "Refine" button generates 3 variations
- Hook types generated: Curiosity, Contradiction, Fear, Status, Authority, Transformation, Emotional, Story, Shock
- Selected hook saves to client's Hook Pattern Library
- User can manually edit the hook before proceeding

#### Phase 4: Script Workshop
- AI writes full production-ready script in one shot using:
  - Selected hook (Phase 3 output)
  - Audience psychology (Phase 2 output)
  - Trend intel (Phase 2 output)
  - Client brand voice + brand_identity
  - One Peak retention structure: Hook → Context → Tension → Value → Payoff → CTA
  - Platform-specific pacing (TikTok = 1 sentence/cut, LinkedIn = longer paragraphs)
- Script rendered as a rich document with:
  - Visual cue markers `[VISUAL: ...]`
  - B-roll suggestions `[B-ROLL: ...]`
  - Subtitle emphasis points `[EMPHASIS]`
  - Sound cue moments `[SOUND: ...]`
- **AI Chat Thread** — a focused chat window for refining ONLY this script:
  - "Make the hook more urgent"
  - "The transition at line 8 is too slow"
  - "Give me 3 alternative endings"
  - "Add a fear trigger at the opening"
  - Claude has ONLY the script as context — no confusion about what to edit
- Version history: every major AI revision saves as a named version
- Brand Compliance Check: Claude checks script against client's tone_of_voice + key_messages before allowing user to proceed — flags any violations

#### Phase 5: Visual Direction
- AI generates based on script:
  - Shot list with framing notes
  - Lighting mood + color references
  - Camera movement style (static / handheld / drone / macro)
  - Scene transitions
  - Cinematic reference suggestions
  - B-roll priority list (top 5 shots to prioritize if time is limited)
- User can edit/approve each item
- Output formatted as a PDF-ready production brief (for handing to videographer)

#### Phase 6: Package + Schedule
- AI generates from full script + platform:
  - Post title / video title
  - Caption (full, platform-adapted — short for TikTok, structured for LinkedIn, story-driven for Instagram)
  - 3 caption variants (user selects)
  - Thumbnail concept description
  - Cover frame suggestion (which second of video to use)
  - Hashtag strategy (if client requests them)
  - Optimal posting time (from `performance_intel.optimal_times`)
- One-click schedule to Metricool
- Or: save as draft to Publishing page
- Or: send to approval portal for client sign-off first

#### API routes needed:
```
POST /api/studio/content          → create new session
GET  /api/studio/content/[id]     → fetch session state
PATCH /api/studio/content/[id]    → update phase output
POST /api/studio/content/[id]/research   → trigger Phase 2 parallel agents
POST /api/studio/content/[id]/hooks      → generate hooks with 3C scoring
POST /api/studio/content/[id]/script     → generate script
POST /api/studio/content/[id]/chat       → script refinement chat
POST /api/studio/content/[id]/direction  → visual direction
POST /api/studio/content/[id]/package    → generate packaging assets
```

#### DB schema additions:
```sql
CREATE TABLE studio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  phase text NOT NULL DEFAULT 'define',      -- current phase
  phase_1_data jsonb DEFAULT '{}',           -- define form
  phase_2_data jsonb DEFAULT '{}',           -- AI research outputs
  phase_3_data jsonb DEFAULT '{}',           -- hooks + selected hook
  phase_4_data jsonb DEFAULT '{}',           -- script + versions + chat history
  phase_5_data jsonb DEFAULT '{}',           -- visual direction
  phase_6_data jsonb DEFAULT '{}',           -- package assets
  status text NOT NULL DEFAULT 'draft',      -- draft | completed | scheduled
  scheduled_post_id uuid REFERENCES scheduled_posts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### What this transforms:
The app becomes a **content production system**, not a scheduling app. A copywriter or social manager can go from "we need a post about X" to a production-ready script + visual brief + scheduled post in under 20 minutes, with AI handling all research, psychology analysis, hook engineering, brand compliance checking, and packaging. The platform is now a peer to any boutique content agency's internal workflow.

---

### SPRINT 3 — Hook Lab (Standalone)
**Duration: 1 week**  
**Theme: Scientific hook writing as a power tool**

#### What gets built:

**Page: `/studio/hooks`**

A standalone workspace for hook writing, accessible outside the Content Creation Studio flow. Ideal for rapid experimentation, pre-planning content batches, or training the team on hook writing.

**Workflow:**
1. Input: content concept (2–3 sentence brief) + platform + audience type + client (optional)
2. AI runs One Peak 5-step roadmap → 20 hooks generated
3. Each hook displayed as a card:
   - Hook text
   - Type badge (Curiosity / Fear / Status / Story / etc.)
   - 3C scores: Clarity `8` · Context `7` · Curiosity `9` → Total `24/30`
   - Format recommendation: Vocal / Text Block / Caption / All Three
   - Virality tier: S (27-30) / A (21-26) / B (15-20) / C (<15)
4. Select hooks → "Refine Selected" → AI produces 3 variations of each
5. Save to Hook Pattern Library

**Hook Pattern Library (per client tab + global admin tab)**
- Every hook ever generated, with its 3C score
- After post publishes: performance data linked to hook (ER, reach)
- Pattern clustering (updated monthly by AI):
  - "For [Client], Fear hooks outperform Curiosity hooks by 1.8x on Instagram"
  - "Questions with 'you' in the first 3 words score 4 points higher on average"
- Template extraction: AI extracts the structure of top performers as reusable formulas
- Global admin view: patterns across ALL clients (reveals agency-wide insights)

#### What this transforms:
Hook writing stops being an individual skill and becomes an **agency system**. Every hook tested, every performance data point, every pattern compounds into a proprietary database of what works for each client and niche. After 3 months this library is worth more than any tool the team has.

---

### SPRINT 4 — Strategy Command Center
**Duration: 2 weeks**  
**Theme: 17-phase strategy as a living document, not a deliverable**

#### Page: `/studio/strategy`

Not a one-time generation. A **living strategic workspace** per client that evolves as data accumulates.

#### 5 Meta-Phase structure (not 17 raw phases):

**META 1 — Intelligence** (Pipeline Phases 1 + 2 + 3 in parallel)
- AI runs simultaneously: Business Intelligence + Market Analysis + Audience Psychology
- Each delivered as structured cards the user can review, annotate, and approve
- Client data auto-injected: brand_identity, competitor_context, performance_intel, historical posts
- Baseline KPIs captured: current followers per platform, average ER, monthly reach, revenue (if known)

**META 2 — Positioning** (Phases 4 + 5 + 6)
- Brand archetype selection (user picks from 12 archetypes, AI writes the narrative)
- Offer engineering: AI reviews current offer structure and suggests optimization
- Customer journey map: awareness → advocacy, with friction points and conversion mechanisms
- Output: Positioning Statement + UVP + Competitive Differentiation Strategy

**META 3 — Execution System** (Phases 7 + 8 + 9 + 10 + 11)
- Content pillar definitions (5 pillars: Authority / Emotional / Proof / Viral / Conversion)
- Platform-specific strategy per active platform
- Lead generation system design
- Sales psychology and conversion optimization notes
- Cultural/seasonal calendar: Ramadan, holidays, industry events mapped to content moments
- Budget allocation framework across channels

**META 4 — Scale & Retention** (Phases 12 + 13)
- Community architecture: how to build brand loyalty, participation loops, UGC systems
- Paid advertising strategy: creative brief, targeting approach, budget split, KPIs
- Retargeting architecture

**META 5 — Optimize & Dominate** (Phases 14 + 15 + 17)
- Performance KPI dashboard wired to real Metricool data
- Iteration roadmap: what to A/B test next, what formats to explore
- Category ownership strategy: how to own the conversation in the niche

#### Living Document behavior:
- Strategy persists as a client artifact in Supabase
- Quarterly Review Mode: AI compares current performance vs strategy KPIs, identifies drift, suggests course corrections
- Crisis Override: one button switches active strategy into crisis mode — AI rewrites messaging approach, CTA goals, content mix
- Strategy → Content bridge: every content pillar has a "Create content for this pillar" button → Studio opens pre-loaded

#### DB additions:
```sql
CREATE TABLE client_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  meta_1_data jsonb DEFAULT '{}',
  meta_2_data jsonb DEFAULT '{}',
  meta_3_data jsonb DEFAULT '{}',
  meta_4_data jsonb DEFAULT '{}',
  meta_5_data jsonb DEFAULT '{}',
  status text DEFAULT 'active',    -- active | archived | crisis
  version int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### What this transforms:
The agency stops delivering static strategy decks and starts maintaining a **live strategic operating system** per client. Every content decision references the strategy. Every performance data point updates the strategy's effectiveness score. This is the deliverable that justifies retainer pricing at the highest tier.

---

### SPRINT 5 — Viral Pattern Library + Performance Intelligence Loop
**Duration: 2 weeks**  
**Theme: The compound flywheel — the platform gets smarter with every post**

#### Part A: Auto-extraction pipeline
Every time a post's performance data syncs from Metricool:
1. AI extracts features: hook type, emotional trigger, format, posting time, caption structure, language, media type
2. Post tagged as: Viral (top 20% ER) / Performing (middle 60%) / Underperforming (bottom 20%)
3. Patterns updated in `client.performance_intel` for that client
4. Global pattern bank updated for admin view

#### Part B: Pattern Library page (`/studio/patterns`)
- Filter by: client / platform / content type / hook type / date range
- Sort by: engagement rate / reach / saves / shares
- Each pattern card shows:
  - Hook structure extracted (formula, not exact text)
  - Emotional trigger identified
  - Performance stats
  - "Use This Pattern" → Studio opens with pattern pre-loaded as template
- Admin view: cross-client patterns (which hook types work across all clients)

#### Part C: Automated weekly intelligence report
- Every Monday: AI analyzes past 7 days of performance data across all clients
- Generates a "Weekly Intelligence Brief" accessible from Dashboard
- Includes: what's trending, what flopped, recommended adjustments, content opportunities spotted

#### Part D: Predictive ER display in Compose
- When composing a post, after caption is entered + platform selected:
  - AI predicts engagement rate based on: hook type detected, media type, platform, posting time, historical client data
  - Shows: "Predicted ER: 4.2–5.8% (based on your last 45 similar posts)"
  - This is the "ML layer" described in PLAN_performance_library.md — implemented with Claude + accumulated data rather than a separate model

#### What this transforms:
The platform develops a **proprietary intelligence advantage** that no generic tool can replicate. The longer the agency uses NOVAX Ops, the harder it is to leave. Every post makes the AI smarter about what works for each specific client. After 6 months of data, the system can predict post performance with meaningful accuracy. This is the moat.

---

### SPRINT 6 — Brand Voice Trainer + Admin Intelligence Panel
**Duration: 2 weeks**  
**Theme: Precision AI calibration and agency-wide oversight**

#### Brand Voice Trainer (`/clients/[id]/voice`)

Currently AI uses the text field `tone_of_voice` from brand_identity. Too vague. This replaces it.

**Setup flow (one-time per client):**
1. User pastes 5–10 example posts/captions that represent the client's perfect voice
2. AI analyzes:
   - Average sentence length + range
   - Vocabulary sophistication level (1–10)
   - Formality register (very casual → very formal)
   - Power words used repeatedly
   - Words/phrases never used (auto-detected by absence)
   - Emotional register (warm / authoritative / playful / urgent / aspirational)
   - Structural patterns (does the brand start sentences with questions? Use short punchy lines?)
3. Generates a **Voice Profile** — a structured JSON object, not a text description:
   ```json
   {
     "sentence_length": { "avg": 8, "max": 15 },
     "formality": 3,
     "power_words": ["transform", "effortless", "elevate"],
     "avoided_words": ["cheap", "basic", "simple"],
     "emotional_register": "aspirational-warm",
     "structural_patterns": ["short opener", "question in middle", "strong imperative CTA"],
     "vocabulary_level": 6
   }
   ```
4. Voice Profile injects into every AI prompt for this client
5. Compliance score shown on all generated copy: "Voice match: 91%"

**Voice Drift Detection:**
- After posts publish, AI checks if the published caption matches the voice profile
- If drift detected ("this post sounds nothing like the brand"), flag in Performance intelligence

#### Admin Intelligence Panel (`/admin`)

Visible only to `role === 'admin'`. Accessible from a "Command" item in sidebar for admin users.

**Sections:**

1. **Agency Overview** — cross-client health at a glance
   - All clients: last post date, ER trend (up/down arrow), active tasks count, crisis status
   - Production velocity: avg days from task creation to published post, per client
   - Bottleneck heatmap: which pipeline stage is backing up across which clients

2. **AI Cost Control Center**
   - Cost per client per month (Claude API spend)
   - Cost per agent type (which agents are most expensive)
   - Cost per session in Content Creation Studio
   - Model usage breakdown (Sonnet vs Opus)
   - Monthly projection + budget alert threshold
   - Model override per client tier: downgrade heavy users to Haiku for basic tasks

3. **Hook Performance Meta-analysis**
   - Which hook types are winning across all clients this month
   - Which emotional triggers are declining
   - Emerging patterns in high-performing hooks

4. **Pipeline Configuration**
   - Customize system prompts for each agent per client (or globally)
   - Add/remove pipeline stages (admin only)
   - Set rate limits per user role

5. **Team Productivity**
   - Posts created per team member this week
   - AI usage per team member
   - Tasks moved per team member

#### What this transforms:
Admin goes from managing individual pages to running an **agency operating system**. The AI becomes precisely calibrated per client instead of generic. Cost visibility prevents runaway Claude API spend. The Admin Panel is the control room that no other agency tool provides.

---

### SPRINT 7 — SaaS Infrastructure
**Duration: 5 weeks**  
**Theme: From single-agency tool to a product other agencies can subscribe to**

This sprint is architecturally different from all others. It requires fundamental changes to the data model, routing, and business logic.

#### 7A: Multi-tenancy (Week 1)
The current schema has no concept of "agency" — everything is a single flat namespace. This must change.

```sql
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,        -- used for routing: novax.app/[slug]
  plan text DEFAULT 'starter',      -- starter | growth | agency | enterprise
  metricool_token text,             -- per-agency Metricool credential
  respond_io_key text,
  anthropic_key text,               -- use agency's own key on higher plans
  created_at timestamptz DEFAULT now()
);

-- All existing tables get agency_id foreign key:
ALTER TABLE clients ADD COLUMN agency_id uuid REFERENCES agencies(id);
ALTER TABLE users   ADD COLUMN agency_id uuid REFERENCES agencies(id);
-- ... (all 13 tables)

-- RLS policies updated: users can only see data from their agency_id
```

**Routing:** Each agency gets a subdomain or path prefix. Route middleware checks agency membership before every request.

#### 7B: Billing with Stripe (Week 2)
```
Starter   — $149/mo — 2 clients, 3 users, 100 AI credits/mo, no Studio
Growth    — $299/mo — 10 clients, 10 users, 500 AI credits/mo, full Studio
Agency    — $599/mo — 30 clients, unlimited users, 2000 AI credits/mo, Admin Panel
Enterprise — custom — unlimited everything, dedicated support, custom AI prompts
```

**What gets built:**
- Stripe Checkout integration (hosted payment page, no custom UI needed)
- Subscription management webhook: plan upgrades/downgrades/cancellations
- Usage metering: AI credit tracking per agency per billing period
- Paywall middleware: gate Studio, Hook Lab, Strategy Command Center behind Growth+
- Billing page in Settings: current plan, usage, upgrade CTA, invoice history

#### 7C: Onboarding Flow (Week 3)
New agencies need to get from "sign up" to "first post scheduled" in under 15 minutes.

**6-step onboarding wizard (agency-level, one time):**
1. Agency name + logo upload
2. Connect Metricool (paste API token → test connection)
3. Create first client (simplified 3-step version of the 9-step wizard)
4. Add first team member (optional)
5. Schedule first post (demo post with AI caption pre-generated)
6. Done — dashboard shown with confetti + quick-start checklist

**In-app guidance:**
- Empty states with actionable prompts (not just "No data yet")
- First-time tooltips on all Studio pages
- Progress tracker for first 7 days ("Complete your setup" checklist on dashboard)

#### 7D: Public Marketing Site (Week 4)
A separate Next.js site at `novax.app` (or whatever domain is chosen). Not inside the current app.

**Pages:**
- `/` — Hero, 3-minute demo video, pricing, social proof
- `/features` — Each of the 7 tools with animated demos
- `/pricing` — Pricing table + FAQ
- `/blog` — Content marketing (agency tips, social media strategy)
- `/login` and `/signup` — Connects to the same Supabase Auth

This is a separate project, not built here. Estimated 1 week design + dev.

#### 7E: SaaS Hardening (Week 5)
- **Privacy & Legal:** Privacy Policy, Terms of Service, Data Processing Agreement pages
- **GDPR compliance:** Data deletion endpoint, data export endpoint, cookie consent banner
- **Rate limiting:** Per-agency per-minute limits on all API routes
- **Error monitoring:** Sentry integration (or similar) — catch runtime errors in production
- **Email:** Transactional emails via Resend or Postmark (invite accepted, subscription renewed, usage warning at 80%)
- **Support:** Intercom or Crisp chat widget (or a simple feedback button that emails you)
- **Status page:** A simple uptime page so agencies know when there's an incident
- **Security audit:** Review all API routes for missing auth checks, RLS policy audit, env var hygiene

---

## Full Timeline

| Sprint | Name | Duration | Cumulative |
|---|---|---|---|
| 1 | Action Bridge | 1 week | Week 1 |
| 2 | Content Creation Studio | 3 weeks | Week 4 |
| 3 | Hook Lab (Standalone) | 1 week | Week 5 |
| 4 | Strategy Command Center | 2 weeks | Week 7 |
| 5 | Viral Pattern Library + Intelligence Loop | 2 weeks | Week 9 |
| 6 | Brand Voice Trainer + Admin Panel | 2 weeks | Week 11 |
| 7 | SaaS Infrastructure | 5 weeks | Week 16 |

**Total: 16 weeks / 4 months from start to SaaS-ready**

Milestones:
- **Week 1:** App becomes action-first. Intelligence connects to production.
- **Week 4:** Content can be created end-to-end in under 20 minutes with AI.
- **Week 7:** Strategy is a living system, not a PDF.
- **Week 9:** The platform starts compounding — every post makes the AI smarter.
- **Week 11:** AI is calibrated per client. Admin has full agency oversight.
- **Week 16:** Another agency can sign up, pay, and be producing content within 15 minutes.

---

## Transformation Arc: What Changes at Each Milestone

### After Sprint 1 (Week 1)
**Before:** "The AI says we have a content gap in authority posts."  
**After:** "The AI says we have a content gap in authority posts. [Create Authority Post]" → click → done.

The team spends less time deciding what to work on and more time producing.

### After Sprint 2 (Week 4)
**Before:** Copywriter opens a blank doc, researches the brief, writes 3 drafts, sends for review.  
**After:** Copywriter opens Studio, fills one form, AI delivers research brief + 8 ranked hooks + full production script in 90 seconds. Copywriter refines via chat. Script is ready in 15 minutes instead of 3 hours.

A single copywriter can now produce 3× the volume without working harder.

### After Sprint 3 (Week 5)
**Before:** Hook writing is an individual skill — whoever writes the best hooks wins.  
**After:** Hook writing is an agency system. Every hook is scored. Every performance outcome links back to the hook. The agency builds a private database of what works for each client and niche. This knowledge doesn't walk out the door when a team member leaves.

### After Sprint 4 (Week 7)
**Before:** Strategy is a PDF delivered once per quarter. Client can't track if it's being executed.  
**After:** Strategy is a live system. Every content decision references it. Every KPI is tracked against it. Quarterly reviews happen with real data, not gut feel. The strategy adapts when the market shifts.

This is the difference between being an agency and being a **strategic partner**. Retainer pricing justification becomes obvious.

### After Sprint 5 (Week 9)
**Before:** Every content decision is a fresh guess.  
**After:** The system tells you exactly what format, hook type, emotional trigger, posting time, and caption structure will perform best for each client — based on that client's actual historical data. The longer you use it, the more accurate it becomes.

The platform now has a **moat**. The longer an agency stays, the more intelligence their account accumulates, and the more painful it is to leave.

### After Sprint 6 (Week 11)
**Before:** AI generates copy that sometimes sounds off-brand.  
**After:** AI generates copy calibrated to a structured voice profile built from real examples. Brand compliance score shown on every output. Voice drift flagged automatically. Admin sees cost, productivity, and performance across all clients from one screen.

The platform is now **professionally deployable** at a creative director level.

### After Sprint 7 (Week 16)
Another agency signs up. They connect Metricool, create their first client, and schedule their first AI-generated post — all within 15 minutes. They pay $299/month. The platform that runs your agency now runs theirs too.

---

## SaaS Readiness Assessment

### Is the platform ready for SaaS after Sprint 7? Yes — with conditions.

#### Technical readiness: YES
After Sprint 7 the codebase is multi-tenant, Stripe-billed, rate-limited, GDPR-compliant, error-monitored, and has an onboarding flow. The technical foundation is solid. Next.js 15 + Supabase scales to thousands of concurrent users without infrastructure changes.

#### Product readiness: YES
The 7 power tools represent a genuine category-defining product. No existing social media tool combines:
- End-to-end content production pipeline (Studio)
- Scientific hook writing (Hook Lab)
- Living strategy document (Strategy Command Center)
- Compound performance intelligence (Pattern Library)
- Per-client AI voice calibration (Voice Trainer)

Competitors like Buffer, Hootsuite, Sprout Social are schedulers with basic analytics. Later, ContentStudio, Publer — all schedulers. None have the production pipeline or strategy layer.

#### Market readiness: It depends on your go-to-market

**If you sell to agencies:** YES immediately at launch. The positioning is clear — "The operating system built by an agency, for agencies." The content pipeline alone justifies the price. Cold outreach to boutique social media agencies with a 3-minute demo video.

**If you sell to brands directly (B2B):** Need 6 more months of data. Brands need more onboarding support and simpler UX than agencies. The platform as designed is agency-grade, which is a feature for agencies but a barrier for solo brand marketing teams.

**Recommended go-to-market: Agency-first.** 5 beta agencies at free/discounted rate during Week 12–15 of Sprint 7. Use their feedback to refine onboarding. Launch publicly at Week 16 with 5 case studies.

#### What's NOT yet SaaS-ready after Sprint 7:

| Gap | When to address |
|---|---|
| No mobile experience | Month 5–6 post-launch (agencies use desktop) |
| No white-labeling for agencies to resell | Month 6–8 (enterprise tier only) |
| No API access for custom integrations | Month 8+ (developer ecosystem) |
| Respond.io limited to DM replies (Instagram restriction) | Permanent limitation, document clearly |
| No AI image generation (Flux 2 / Ideogram) | Month 5 (currently planned) |
| No video generation (Higgsfield) | Month 5 (mock UI exists) |
| No Google Drive OAuth file browser | Month 4 (routes exist, UI not wired) |

---

## Pricing Validation

At $299/month (Growth plan), an agency needs to justify this against:
- A mid-level copywriter: $2,000–4,000/month
- A strategist: $3,000–6,000/month  
- Buffer Business + Hootsuite Professional: $250–400/month (no AI, no pipeline, no strategy)

The Studio alone saves 2–3 hours per piece of content. For an agency producing 20 posts/month per client across 5 clients, that is 200–300 hours saved at $50/hour = **$10,000–15,000 of labor saved per month**. At $299/month the ROI case writes itself.

The risk is not price — it is adoption. The onboarding sprint (7C) is the most commercially critical build in the entire roadmap.

---

## Recommended Immediate Next Step

**Start Sprint 1 immediately.** It is 1 week of work and transforms the emotional experience of the app for your team right now. No new architecture, no new DB tables, no risk. Pure connection of existing intelligence to existing tools.

After Sprint 1 is live: start Sprint 2. The Studio is the product's core identity and everything else builds on top of it.

---

*Last updated: 2026-05-21*
