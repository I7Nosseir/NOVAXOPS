# NOVAX Ops — Master Todo & Priority Matrix
_Last updated: 2026-09-29_

---

## Priority Framework

| | **High Gain** | **Low Gain** |
|---|---|---|
| **Low Effort** | ✅ DO FIRST | 🔹 Do when convenient |
| **High Effort** | 🔥 Plan carefully, execute in phases | ⏳ Backlog / future |

---

## ✅ HIGH GAIN × LOW EFFORT — Do First

### Bugs & Broken Wiring
- [ ] Fix "Assigned by Me" tab showing 0 — verify `created_by` field in DB vs `user.id` match
- [x] Fix crisis/pause toggle button — reads `crisis_mode` but display uses `is_in_crisis ?? crisis_mode` — now syncs both fields
- [ ] Fix canvas overflow — buttons eaten on smaller screens (check all studio pages)
- [ ] Wire API cost tracking properly — `api_usage` table inserts are missing/wrong on most routes
- [ ] Comment out / disable AI Image page (`/ai-image`) — FAL/Ideogram keys not set, broken UX
- [ ] Fix infinite loading states — identify all spinners that never resolve (Supabase query timeouts, empty state fallbacks missing)
- [ ] Set ANTHROPIC_API_KEY in Vercel (critical — all AI falls back to Gemini currently)

### Quick UX Wins
- [ ] Add client "Delete" option with confirmation modal (currently missing entirely)
- [ ] Add "Paused" as client status option alongside Active/Inactive/Prospect
- [ ] Add user gating approval email — new users see "pending approval" screen until admin activates
- [ ] Fix sidebar badge counts to use realtime subscriptions not manual 60s polling
- [ ] Add URL-based state for client modal — `/clients?id=xxx` opens the right client on reload

### Email System
- [ ] Employee notification emails — task assigned, task overdue, stage moved
- [ ] CEO notification emails — crisis mode activated, new client added, weekly digest
- [ ] User invite email polish — ensure Resend templates look branded and professional
- [ ] "Change password" email flow for employee offboarding

---

## 🔥 HIGH GAIN × HIGH EFFORT — Phase Work

### Phase A: Architecture & Stability (4–6 weeks)
**Priority: Do before adding any new features**

- [ ] Error logging system (Sentry or Highlight.io) — catch all errors with user/client context
- [ ] State management audit — replace scattered useState with Zustand stores for cross-component state
- [ ] Persistent generation saving — save AI generation progress to DB if user closes browser
- [ ] Kill all infinite loading — add `retry: 1`, proper error boundaries, empty state components everywhere
- [ ] URL-based state (search params) — all modals/filters become deep-linkable, shareable URLs
- [ ] User heatmap / session recording (Microsoft Clarity — free) — wire up in layout.tsx
- [ ] Automated test suite — Playwright for 10 critical flows + Vitest for API routes
- [ ] Security hardening — RLS verification, rate limiting improvements, input sanitization
- [ ] Remove or isolate all mock/stub code — make stubs explicit with clear STUB comments

### Phase B: Agent System Revolution (8–10 weeks)
**This is the biggest UI/UX change — replaces Studio tools with named agents**

- [ ] **5 Named Agents** with distinct personalities and animated UX:
  1. **Zara** — Copywriting Agent (warm, precise, culturally aware)
  2. **Nexus** — Content Strategy Agent (analytical, trend-aware, bold)
  3. **Canvas** — Content Creator Agent (visual thinker, format expert)
  4. **Pulse** — Media Buying Agent (data-driven, ROI-focused)
  5. **Director** — Creative Director Agent (evaluator, gives scores + redlines)
- [ ] Agent conversation sessions — persistent multi-turn chat, saved to DB
- [ ] Arabic / English language toggle on ALL AI outputs (system-level preference)
- [ ] Anti-AI-looking output system — prompt engineering layer that eliminates AI clichés
- [ ] Saudi Arabia + Egypt events calendar — injected into all content generation
- [ ] Client context auto-injection — every agent session starts with full client intelligence
- [ ] Agent "mode" selection — brief mode, deep dive mode, quick fire mode
- [ ] Animated agent UX — typing indicators, streaming responses, personality-specific loading states

### Phase C: Premium Experience (6–8 weeks)
- [ ] UI/UX redesign — simplified navigation, fewer nested settings, more welcoming homepage
- [ ] Premium PDF export — replace @react-pdf/renderer with Puppeteer/headless Chrome for pixel-perfect reports
- [ ] Voice interface (Jarvis mode) — ElevenLabs TTS + browser STT, Arabic + English, streaming
- [ ] Copy Engine UX overhaul — single clean interface, not complex nested panels
- [ ] Document system solidification — Tiptap autosave, conflict resolution, offline mode
- [ ] Client profile simplification — 3-tab max, progressive disclosure of advanced fields
- [ ] Design system foundation — component tokens, motion design, consistent spacing system

### Phase D: Infrastructure & Integrations (6–8 weeks)
- [ ] Employee full controls — remove from platform, revoke access, force password reset
- [ ] Multi-tenant SaaS hardening — org isolation verification, slug-based routing
- [ ] File storage improvements — chunked uploads, CDN, image optimization pipeline
- [ ] Validation rules system — form-level and API-level validation with clear user guidance
- [ ] Social media scraping via Apify — competitor analysis, trend detection (already have API key)
- [ ] Postiz self-hosted (replaces Metricool) — Docker + Railway deployment
- [ ] Chatwoot self-hosted (replaces Respond.io) — Docker deployment, webhook integration

---

## 🔹 LOW GAIN × LOW EFFORT — Do when convenient

- [ ] Add client industry filter to clients page
- [ ] Task board column count badges
- [ ] Export reports as ZIP (PDF + CSV together)
- [ ] Dark mode improvements — audit all new components
- [ ] Keyboard shortcuts for common actions (new task, search)

---

## ⏳ BACKLOG / FUTURE

- [ ] Meeting listener extension — Chrome extension, attends meetings, generates task list
- [ ] Postiz replacement (Phase D) — self-hosted, full publishing control
- [ ] Chatwoot moderation (Phase D) — self-hosted comment/DM management
- [ ] AI-generated images (FAL/Ideogram) — needs API keys + UI flow
- [ ] Higgsfield video generation — needs API key + integration
- [ ] Content performance ML — learn from past post performance to predict future
- [ ] White-label SaaS portal — other agencies sign up and get isolated workspaces
- [ ] Stripe billing — subscription management for multi-tenant

---

## Current Sprint Focus (as of 2026-09-29)

1. Fix all bugs in "Do First" section
2. Set up Sentry error logging
3. Disable/comment AI image page
4. Add client delete option
5. User approval email gating
6. Agent system architecture design (parallel planning)
