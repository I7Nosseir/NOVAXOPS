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

## Phase 2 — UI: Loading States · Mobile · Contrast ⬜
**Scope:** Full-screen AI loading overlay, mobile layout fix, dark/light contrast audit, housekeeping.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 2.1 | Full-screen branded loading overlay for every AI generation | ⬜ |
| 2.2 | Mobile: fix horizontal overflow on all pages | ⬜ |
| 2.3 | Mobile: fix header right-side (profile, notifications) | ⬜ |
| 2.4 | Dark/light contrast audit — fix illegible text/icon combos | ⬜ |
| 2.5 | Remove Resize tab from AI Image Generation page | ⬜ |
| 2.6 | Remove stray "New Session" buttons on strategy/other pages | ⬜ |
| 2.7 | Hide Pinterest + Instagram from Inspiration Library source tabs | ⬜ |
| 2.8 | NOVAX logo embedded in all generated reports (PDF, PPTX) | ⬜ |

---

## Phase 3 — AI Assistant Overhaul ⬜
**Scope:** Complete UI redesign + persistent saved chats across devices.
**SQL migrations needed:** `026_assistant_chats.sql`

| # | Item | Status |
|---|---|---|
| 3.1 | UI redesign: full-height, proper bubbles, markdown rendering | ⬜ |
| 3.2 | Persistent chats: new `assistant_chats` table | ⬜ |
| 3.3 | Chat list sidebar: all previous chats, reopenable | ⬜ |
| 3.4 | Context preserved when switching between chats | ⬜ |
| 3.5 | Chat titles auto-generated from first message | ⬜ |

---

## Phase 4 — Studio Excellence: Samples · Guidance · Competitive Analysis ⬜
**Scope:** Demo brand pre-seeded, sample outputs for every tool, guidance panels, competitive analysis depth upgrade.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 4.1 | Demo brand "Lumara" seeded in DB (global skincare, UAE) | ⬜ |
| 4.2 | Sample outputs for all studio tools using Lumara | ⬜ |
| 4.3 | Jargon/guidance collapsible panel on each studio page | ⬜ |
| 4.4 | Competitive Analysis: 3 global + 3 local per run | ⬜ |
| 4.5 | Competitor cards: "Open social page" button (new tab) | ⬜ |
| 4.6 | Save competitive analysis as PDF → Supabase Storage → asset entry | ⬜ |
| 4.7 | Deeper analysis: platform strategy, cadence, growth, engagement per competitor | ⬜ |
| 4.8 | Remove "New Session" button from Strategy page | ⬜ |

---

## Phase 5 — Approval Page Redesign ⬜
**Scope:** Two-column layout, media upload, select from scheduled, team email on submission.
**SQL migrations needed:** `027_approval_items.sql`

| # | Item | Status |
|---|---|---|
| 5.1 | Two-column rows: left = media, right = caption | ⬜ |
| 5.2 | "Add from Scheduled" picker for this client's scheduled posts | ⬜ |
| 5.3 | Direct media upload for unscheduled content | ⬜ |
| 5.4 | Team email on client approval submission | ⬜ |
| 5.5 | Email body: X approved, Y need changes + post-by-post list | ⬜ |

---

## Phase 6 — Client Assignment System ⬜
**Scope:** Users are assigned to specific clients. Tasks, publishing, notifications all filter by assignment.
**SQL migrations needed:** `028_client_assignments.sql`

| # | Item | Status |
|---|---|---|
| 6.1 | `client_assignments` table (user_id ↔ client_id) | ⬜ |
| 6.2 | Settings UI: admin assigns users to clients | ⬜ |
| 6.3 | Tasks filtered by assigned clients | ⬜ |
| 6.4 | Publishing filtered by assigned clients | ⬜ |
| 6.5 | Notifications scoped to assigned clients | ⬜ |
| 6.6 | Moderation filtered by assigned clients | ⬜ |
| 6.7 | Admin, CEO, Creative Director always see all clients | ⬜ |

---

## Phase 7 — Context Bank · CEO Intelligence · AI Kill Switch ⬜
**Scope:** Context Bank caption examples, date-aware CEO Hub, AI emergency kill switch.
**SQL migrations needed:** `029_system_settings.sql`

| # | Item | Status |
|---|---|---|
| 7.1 | Context Bank: "Examples" category with caption/content preview | ⬜ |
| 7.2 | Context Bank: all entries reliably saved + editable | ⬜ |
| 7.3 | CEO Hub: date-aware quarterly brief auto-generated | ⬜ |
| 7.4 | CEO Hub: monthly content requirements per client | ⬜ |
| 7.5 | CEO morning email includes: this month's requirements + API cost forecast | ⬜ |
| 7.6 | AI kill switch (admin/CEO toggle): disables all generation routes | ⬜ |

---

## Phase 8 — Reports · Media Buying Upgrade ⬜
**Scope:** Reports deeper analysis, cover redesign, paid ads improvements. Media buying: multiple options, budget intelligence, media buyer guide.
**SQL migrations needed:** None

| # | Item | Status |
|---|---|---|
| 8.1 | Reports: reduce to 16:9 slide ratio | ⬜ |
| 8.2 | Reports: cover page redesign (NOVAX logo, client logo, date) | ⬜ |
| 8.3 | Reports: deeper narrative + platform-by-platform breakdown | ⬜ |
| 8.4 | Reports: paid ads — multiple ads/campaigns, screenshot upload, AI reads numbers | ⬜ |
| 8.5 | Reports: ad image/thumbnail included per ad entry | ⬜ |
| 8.6 | Reports: multi-currency (SAR default, USD, EGP, AED, KWD) | ⬜ |
| 8.7 | Reports: validation/reflection agent second-pass before returning | ⬜ |
| 8.8 | Media buying: multiple options via + button (2–5) | ⬜ |
| 8.9 | Media buying: client name from dropdown (real clients table) | ⬜ |
| 8.10 | Media buying: cover page redesign, branded | ⬜ |
| 8.11 | Media buying: budget allocation intelligence schema (CPM benchmarks, seasonality) | ⬜ |
| 8.12 | Media buying: Media Buyer Guide generated alongside report | ⬜ |
| 8.13 | Media buying: 3–6 image selection before generation | ⬜ |
| 8.14 | Media buying: multi-currency support | ⬜ |

---

## Phase 9 — Inspiration Library Overhaul ⬜
**Scope:** Dual filters, personal library, load more, publishing dates, boosted results.
**SQL migrations needed:** `030_personal_inspiration.sql`

| # | Item | Status |
|---|---|---|
| 9.1 | Views + Engagement dual sliders active simultaneously | ⬜ |
| 9.2 | More view range buckets (500K, 1M, 5M, 10M+) | ⬜ |
| 9.3 | Publishing date visible on each card | ⬜ |
| 9.4 | Load More button (up to 5 clicks, 50 items per load) | ⬜ |
| 9.5 | Boost Apify scrape limits per query | ⬜ |
| 9.6 | Personal library per user (private, no client assigned) | ⬜ |
| 9.7 | Pinterest + Instagram source tabs hidden | ⬜ |

---

## Phase 10 — Google Drive Global Connection ⬜
**Scope:** Admin/CEO connects Drive once; all users access through stored credentials.
**SQL migrations needed:** Uses `029_system_settings.sql` from Phase 7

| # | Item | Status |
|---|---|---|
| 10.1 | Store OAuth tokens server-side in `system_settings` | ⬜ |
| 10.2 | All users access Drive via stored admin credentials | ⬜ |
| 10.3 | Remove Drive connect button from non-admin/ceo roles | ⬜ |
| 10.4 | Auto-refresh tokens on expiry | ⬜ |

---

## Phase 11 — User Tracking · Security · Document Import ⬜
**Scope:** User activity page, security audit, content eval upgrades, Excel/doc import.
**SQL migrations needed:** `031_user_activity.sql`

| # | Item | Status |
|---|---|---|
| 11.1 | User activity tracking page: live status, page, API calls per user | ⬜ |
| 11.2 | Per-user API call count from `api_usage` table | ⬜ |
| 11.3 | Content eval: accept doc/Excel/text input | ⬜ |
| 11.4 | Content eval: multiple platform selection | ⬜ |
| 11.5 | Strategy eval: accept doc/Excel input | ⬜ |
| 11.6 | Excel/Word upload → native `documents` table entry | ⬜ |
| 11.7 | Deep security audit plan documented (SQL injection, RLS gaps, IDOR, file upload) | ⬜ |

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
