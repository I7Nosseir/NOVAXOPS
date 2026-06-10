# NOVAX Ops — Pre-Orientation Build Plan

> **Purpose:** Track all 11 build phases before agency orientation. Each phase is built, deployed, and tested before the next begins.
> **Legend:** ⬜ Pending · 🔨 In Progress · ✅ Done · ❌ Blocked

---

## Phase 1 — Critical Bugs ✅ COMPLETE
**Scope:** Everything that is fully broken. No new features.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 1.1 | Sign out button does nothing | ✅ |
| 1.2 | New Project button does nothing | ✅ |
| 1.3 | Studio: "Recent Sessions" label shown twice | ✅ |
| 1.4 | Studio: delete session button not wired | ✅ |
| 1.5 | Moderation: empty state improved with integration context | ✅ |
| 1.6 | Approval: media not fitting inside frame (object-contain) | ✅ |
| 1.7 | Performance / Pattern Intelligence: added Gemini fallback | ✅ |
| 1.8 | Performance / Content tab: posts route resilient to missing snapshots | ✅ |
| 1.9 | Performance / Benchmarks: proper empty state + no misleading zeros | ✅ |

---

## Phase 2 — UI: Loading States · Mobile · Contrast ✅ COMPLETE
**Scope:** Full-screen AI loading overlay, mobile layout fix, dark/light contrast audit, housekeeping.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 2.1 | Full-screen branded loading overlay for every AI generation | ✅ |
| 2.2 | Mobile: fix horizontal overflow on all pages | ✅ |
| 2.3 | Mobile: fix header right-side (profile, notifications) | ✅ |
| 2.4 | Dark/light contrast audit — fix illegible text/icon combos | ✅ |
| 2.5 | Remove Resize tab from AI Image Generation page | ✅ |
| 2.6 | Remove stray "New Session" buttons on strategy/other pages | ✅ |
| 2.7 | Hide Pinterest + Instagram from Inspiration Library source tabs | ✅ |
| 2.8 | NOVAX logo embedded in all generated reports (PDF, PPTX) | ✅ |

---

## Phase 3 — AI Assistant Overhaul ✅ COMPLETE
**Scope:** Complete UI redesign + persistent saved chats across devices.
**SQL migrations needed:** `026_assistant_chats.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 3.1 | UI redesign: full-height, proper bubbles, markdown rendering | ✅ |
| 3.2 | Persistent chats: new `assistant_chats` table + `use-assistant-chats.ts` hook | ✅ |
| 3.3 | Chat list sidebar (`components/assistant/chat-sidebar.tsx`) | ✅ |
| 3.4 | Context preserved when switching: `key={activeChatId}` remount + `initialMessages` prop | ✅ |
| 3.5 | Chat titles auto-generated from first user message + saved to DB | ✅ |

---

## Phase 4 — Studio Excellence: Samples · Guidance · Competitive Analysis ✅ COMPLETE
**Scope:** Demo brand pre-seeded, sample outputs for every tool, guidance panels, competitive analysis depth upgrade.
**SQL migrations needed:** `032_lumara_demo.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 4.1 | Demo brand "Lumara" seeded in DB (global skincare, UAE) — `sql/032_lumara_demo.sql` | ✅ |
| 4.2 | "Try with Lumara" pre-fill button on every studio brief form (`lumara-prefill-button.tsx`) | ✅ |
| 4.3 | `StudioGuidancePanel` collapsible on all 8 studio pages with tool-specific jargon + tips | ✅ |
| 4.4 | Competitive Analysis: prompt now requests exactly 3 global + 3 local competitors | ✅ |
| 4.5 | Competitor cards: ExternalLink button opens social page in new tab (landscape + threats) | ✅ |
| 4.6 | "Save as PDF" button → `/api/competitors/export-pdf` → Supabase Storage + asset entry | ✅ |
| 4.7 | Deeper analysis: scope, platform_strategy, best_performing_format, strengths, weaknesses per competitor | ✅ |
| 4.8 | Removed "New Session" button from Strategy page | ✅ |

---

## Phase 5 — Approval Page Redesign ✅ COMPLETE
**Scope:** Two-column layout, media upload, select from scheduled, team email on submission.
**SQL migrations needed:** `027_approval_items.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 5.1 | Two-column rows: left = 112px media column, right = caption + status badge | ✅ |
| 5.2 | Visual post picker: thumbnail card with checkmark overlay + inline media upload | ✅ |
| 5.3 | Custom posts section: ad-hoc items (media + caption) stored in `items` JSONB column | ✅ |
| 5.4 | Team email fired on client approval submission | ✅ |
| 5.5 | Email body: X approved, Y need changes + per-post caption + status + client note | ✅ |

---

## Phase 6 — Client Assignment System ✅ COMPLETE
**Scope:** Users are assigned to specific clients. Tasks, publishing, notifications all filter by assignment.
**SQL migrations needed:** `028_client_assignments.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 6.1 | `client_assignments` table (user_id ↔ client_id) | ✅ |
| 6.2 | Settings UI: admin assigns users to clients (Client Access tab in Edit Access modal) | ✅ |
| 6.3 | Tasks + Pipeline filtered by assigned clients | ✅ |
| 6.4 | Publishing filtered by assigned clients (client dropdown + post list) | ✅ |
| 6.5 | Notifications scoped to assigned clients (best-effort via metadata.client_id) | ✅ |
| 6.6 | Moderation filtered by assigned clients | ✅ |
| 6.7 | Admin, CEO, Creative Director always see all clients (bypass roles) | ✅ |

---

## Phase 7 — Context Bank · CEO Intelligence · AI Kill Switch ✅ COMPLETE
**Scope:** Context Bank caption examples, date-aware CEO Hub, AI emergency kill switch.
**SQL migrations needed:** `029_system_settings.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 7.1 | Context Bank: "Content Example" category with styled caption preview box | ✅ |
| 7.2 | Context Bank: inline edit for all entries (summary + full_text + category); manual direct-add mode (no AI processing) | ✅ |
| 7.3 | CEO Hub: "Pre-fill from brand profile" button on quarterly strategy — populates goals from key_messages, themes from brand identity | ✅ |
| 7.4 | CEO Hub: monthly content requirements panel in Agency Health tab (target vs actual per client, traffic light) | ✅ |
| 7.5 | CEO morning email: monthly requirements table + API cost this month section | ✅ |
| 7.6 | AI kill switch: `lib/ai-guard.ts` (30s TTL cache), `/api/system/settings` route, guard wired into `/api/ai`, 8 studio routes, assistant chat. Settings → Security tab toggle (admin/CEO only) | ✅ |

---

## Phase 8 — Reports · Media Buying Upgrade ✅ COMPLETE
**Scope:** Reports deeper analysis, cover redesign, paid ads improvements. Media buying: multiple options, budget intelligence, media buyer guide.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 8.1 | Reports: 16:9 landscape slide ratio (`@page { size: 297mm 167mm }`) | ✅ |
| 8.2 | Reports: cover redesign — date, confidentiality line, client logo top-right | ✅ |
| 8.3 | Reports: deeper narrative + `### Platform Narratives` section per active platform | ✅ |
| 8.4 | Reports: multi-campaign paid ads, Scan Screenshot button → `/api/media-buying/scan-ads` | ✅ |
| 8.5 | Reports: ad creative image shown per campaign entry | ✅ |
| 8.6 | Reports: SAR default currency, options: SAR / AED / USD / EGP / KWD | ✅ |
| 8.7 | Reports: validation second-pass strips recommendation leakage from AI narrative | ✅ |
| 8.8 | Media buying: 2–5 campaign options, + button, remove when >2 | ✅ |
| 8.9 | Media buying: client dropdown (real clients table) | ✅ |
| 8.10 | Media buying: branded cover page — NOVAX logo, client, period, date | ✅ |
| 8.11 | Media buying: CPM benchmarks per platform → budget→KPI estimates (impressions, reach, CPC) | ✅ |
| 8.12 | Media buying: Media Buyer Guide — 4–6 sections (setup, audience, creative, optimisation, reporting) | ✅ |
| 8.13 | Media buying: 3–6 reference image upload | ✅ |
| 8.14 | Media buying: SAR default, currencies SAR / AED / USD / EGP / KWD | ✅ |

---

## Phase 9 — Inspiration Library Overhaul ✅ COMPLETE
**Scope:** Dual filters, personal library, load more, publishing dates, boosted results.
**SQL migrations needed:** `030_personal_inspiration.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 9.1 | Views + Engagement dual filters active simultaneously | ✅ |
| 9.2 | More view range buckets (500K, 1M, 5M, 10M+) | ✅ |
| 9.3 | Publishing date visible on each card | ✅ |
| 9.4 | Load More button (up to 5 clicks, 50 items per load) | ✅ |
| 9.5 | Boost Apify + YouTube scrape limits per query | ✅ |
| 9.6 | Personal library per user (private, no client assigned) | ✅ |
| 9.7 | Pinterest + Instagram source tabs hidden | ✅ |

---

## Phase 10 — Google Drive Global Connection ✅ COMPLETE
**Scope:** Admin/CEO connects Drive once; all users access through stored credentials.
**SQL migrations needed:** Uses `029_system_settings.sql` from Phase 7 (already run)

| # | Item | Status |
|---|---|---|
| 10.1 | Store OAuth tokens server-side in `system_settings` — callback saves tokens + email via service role, no cookies | ✅ |
| 10.2 | All users access Drive via stored admin credentials — files route reads from DB, returns email to UI | ✅ |
| 10.3 | Remove Drive connect button from non-admin/ceo roles — non-admin sees "ask your admin" message; disconnect button admin/CEO only; Settings → Integrations → Google Drive card (admin only) | ✅ |
| 10.4 | Auto-refresh tokens on expiry — `auth.on('tokens', ...)` listener persists refreshed credentials back to DB immediately | ✅ |

---

## Phase 11 — User Tracking · Security · Document Import ✅ COMPLETE
**Scope:** User activity page, security audit, content eval upgrades, Excel/doc import.
**SQL migrations needed:** `031_user_activity.sql` ← run in Supabase SQL editor

| # | Item | Status |
|---|---|---|
| 11.1 | User activity tracking page: live status, page, API calls per user | ✅ |
| 11.2 | Per-user API call count from `api_usage` table | ✅ |
| 11.3 | Content eval: accept doc/Excel/text input | ✅ |
| 11.4 | Content eval: multiple platform selection | ✅ |
| 11.5 | Strategy eval: accept doc/Excel input | ✅ |
| 11.6 | Excel/Word upload → native `documents` table entry | ✅ |
| 11.7 | Deep security audit plan documented (SQL injection, RLS gaps, IDOR, file upload) | ✅ |

---

## SQL Migration Index

| File | Phase | Description |
|------|-------|-------------|
| `026_assistant_chats.sql` | 3 | Persistent AI assistant chat sessions |
| `027_approval_items.sql` | 5 | Per-row items on approval requests |
| `028_client_assignments.sql` | 6 | User ↔ client assignment mapping |
| `029_system_settings.sql` | 7 | System-wide key/value settings (AI kill switch, Drive tokens) |
| `030_personal_inspiration.sql` | 9 | Per-user private inspiration library |
| `031_user_activity.sql` | 11 | User activity + page + API call tracking |
| `032_lumara_demo.sql`   | 4  | Lumara demo client seed + competitor snapshots |
