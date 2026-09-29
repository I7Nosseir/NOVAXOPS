# NOVAX Ops — Future Plans & Vision
_Last updated: 2026-09-29_

---

## The Vision

NOVAX Ops becomes the **operating system for social media agencies** — not a tool, but a thinking partner. Every person on the team (strategist, copywriter, account manager, CEO) has named AI colleagues they work with daily. The platform learns from every client interaction, every win, every failure. Output quality gets better with every week of use.

---

## Horizon 1: Foundation (Q4 2026)
**Make what exists bulletproof before adding more**

### Agent System (replaces Studio tools)
Studio tools are powerful but feel like software. Agents should feel like colleagues.

Five named agents replace the Studio sidebar:
- **Zara** — Copywriting (warm, culturally precise, Gulf-market expert)
- **Nexus** — Strategy (analytical, connects dots across all clients)
- **Canvas** — Content (format-first, visual thinking, reel/carousel/static expert)
- **Pulse** — Media Buying (ROI brain, knows what platforms are doing)
- **Director** — Evaluator (Creative Director role, scores + redlines everything)

Each agent has:
- A distinct visual identity (color, icon, animated avatar)
- Memory of past sessions per client
- Knowledge of the client's brand voice, wins, objections
- Arabic/English preference per output
- A learning loop (feedback → better outputs over time)

### Voice Mode
Inspired by Jarvis. Two modes:
1. **Talk Mode** — dictate instructions, agent responds in voice
2. **Brief Mode** — describe a campaign brief in voice, agent structures it

Stack: ElevenLabs (TTS, Arabic voice) + browser Web Speech API (STT) + streaming Claude responses

### Premium PDF Reports
Current PDF exports are mediocre. Future:
- Pixel-perfect branded reports via headless Chrome (Puppeteer)
- Charts rendered as SVG, not as pixelated images
- Custom cover page, executive summary, data tables
- Arabic RTL support in exported PDFs
- One-click "Send to client" via Resend

---

## Horizon 2: Intelligence Layer (Q1 2027)

### Platform Learning
Every piece of content the agency produces feeds a performance model:
- Post goes live → collect engagement data (Metricool sync)
- Agent suggests similar formats to what performed best
- "Last time we tried this for [Client X], it got 8% ER" context in every generation

### Saudi Arabia + Egypt Events Calendar
A structured calendar of:
- Islamic calendar (Ramadan, Eid, Ashura)
- National days (Saudi National Day, Egypt Revolution Day, UAE National Day)
- Local cultural moments (Cairo Book Fair, Season launches in KSA)
- Automatically injected into all content strategy and campaign planning

### Competitive Intelligence (Enhanced)
- Apify scraping upgraded — weekly competitor snapshots stored in DB
- Trend pattern detection — "competitor posts carousels every Thursday at 7pm"
- Gap analysis — what content categories the client owns that competitors don't

### Design System → Content Generation Pipeline
Nano Banana integration (future):
- Design system tokens (colors, fonts, spacing) exported to Nano Banana
- AI describes scene → Nano Banana generates on-brand visual
- Higgsfield generates video from visual + script (when API available)
- Full pipeline: brief → copy → visual → video → scheduled

---

## Horizon 3: SaaS Platform (Q2-Q3 2027)

### Multi-Tenant White Label
Currently: NOVAX is the only tenant.
Future: Other agencies sign up and get their own isolated workspace.

Architecture:
- Slug-based routing: `myagency.novaxops.com` or custom domain
- Organization-level branding (logo, color, email templates)
- Per-org billing via Stripe
- Isolated Supabase schemas per org (or row-level isolation via organization_id — already partially built)

Pricing model (see payment plan for details):
- Starter: 1 agency, up to 5 users — $99/mo
- Growth: 1 agency, up to 15 users + all integrations — $249/mo
- Agency OS: unlimited users, white-label, custom domain — $499/mo

### Meeting Listener Extension
Chrome extension that:
- Joins Google Meet / Zoom meeting
- Transcribes in real-time (Arabic + English)
- After meeting: generates structured action items as NOVAX tasks
- Assigns tasks to team members by name recognition
- Sends meeting summary to CEO + relevant team members

Tech: Whisper API (transcription) + Claude (action item extraction) + Chrome Extension MV3

### Postiz (Self-hosted Metricool Replacement)
- Deploy Postiz via Docker on Railway/DigitalOcean
- Full API access to scheduling, analytics, multi-account
- No per-post fees
- Arabic caption support
- Custom approval flow integration
- Migration: export Metricool schedule → import to Postiz

### Chatwoot (Self-hosted Respond.io Replacement)
- Deploy Chatwoot via Docker
- Full comment + DM management
- Better API for AI reply integration
- Estimated cost: $0/month (self-hosted vs $50+/mo for Respond.io)

---

## Automation & Self-Running Workflows

### Gated User Automation
Users can set up auto-tasks that run and pause at approval gates:
1. User configures: "Every Monday, generate captions for [Client X] posts scheduled this week"
2. System runs the generation at midnight Sunday
3. User gets email: "3 captions generated for Privea — approve to queue them"
4. One-click approve → posts queued in Metricool/Postiz
5. Reject → agent refines and re-sends

### Smart Content Calendar Generation
1. Admin sets content pillars per client (done today via brief)
2. System proposes 30-day calendar based on events, past performance, competitor gaps
3. Account manager reviews + approves
4. Tasks auto-created in pipeline, assignments auto-distributed to team

---

## Tech Debt to Clear Before Horizon 2

1. **Real-time subscriptions** — all list pages need live updates without refresh
2. **Supabase RLS audit** — verify every table's policies with test cases
3. **API route error handling** — every route needs structured error responses, no silent catches
4. **Component architecture** — audit for unnecessary client components, split to RSC where possible
5. **Bundle size** — audit with Next.js bundle analyzer, lazy load heavy components
6. **Type safety** — eliminate all `as unknown as X` casts, use proper types end-to-end

---

## Questions Needing CEO Decision

- [ ] Pricing model when selling NOVAX Ops to other agencies — monthly SaaS vs one-time license?
- [ ] White-label branding level — full rebrand allowed, or "powered by NOVAX Ops" watermark?
- [ ] Data isolation preference — separate Supabase projects per tenant, or shared DB with RLS?
- [ ] Voice feature language priority — Arabic-first or English-first voice quality?
- [ ] Postiz migration timeline — when does NOVAX stop paying for Metricool?
