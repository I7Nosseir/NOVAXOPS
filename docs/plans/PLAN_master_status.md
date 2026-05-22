# NOVAX Ops — Master Status & Roadmap

**Last updated:** 2026-05-21  
**Platform state:** Production-ready MVP. Core content pipeline works end-to-end.

---

## What is working RIGHT NOW

### The Core Loop (fully functional)
```
Create post → Upload media → Generate AI caption → Schedule in Metricool → Client reviews via approval portal → Published → Webhook marks it done
```

Every step of this loop is live:

| Feature | Status | Notes |
|---|---|---|
| Auth (login, sessions, middleware) | Live | Email/password, cookie sessions |
| 13-page app shell | Live | All pages load real Supabase data |
| Pipeline Kanban (10 stages, drag-drop) | Live | |
| Task detail with 5 AI agents | Live | Claude: analyze, copy, research, asset, caption |
| Client management + Crisis Mode | Live | Crisis mode pauses publishing banner |
| New Client Wizard (9 steps) | Live | UI complete; backend AI analysis not wired |
| Publishing page (grid + calendar) | Live | |
| Post compose (EN/AR, carousel, video thumbnail) | Live | |
| Media upload to Supabase Storage | Live | XHR progress tracking, 500MB limit |
| Google Drive link → proxy | Live | Server-side proxy, auto-converts Drive URLs |
| Bulk schedule (Excel template + import) | Live | |
| AI caption generation (with image vision) | Live | Claude sees the actual image |
| Metricool scheduling | Live | Corrected date format (Z timezone) |
| Draft posts + retry scheduling | Live | PostCard actions: Push to Metricool, Delete |
| Delete draft/scheduled post | Live | 404 gracefully refreshes list |
| Internal approval portal | Live | Create requests, share links |
| Public approval portal (/approval/[token]) | Live | Media display, per-post decisions, submit |
| Moderation page (comment queue) | Live | AI reply generation |
| Assets page | Live | Upload, Higgsfield mock UI |
| Creative Evaluation | Live | Claude vision scoring |
| Workload view | Live | |
| Content Library | Live | |
| Reports page + AI analysis | Live | Gemini text+screenshot → markdown report |
| Metricool analytics API | Live | `/api/metricool/analytics` |
| Metricool publish webhook | Live | Auto-marks posts published/failed |
| Team invite | Live | `/api/auth/invite` |

---

## What is INCOMPLETE

### High priority — directly impacts daily use

| Feature | Plan doc | Blocker |
|---|---|---|
| Per-post performance data sync from Metricool | [PLAN_metricool_full_integration.md](./PLAN_metricool_full_integration.md) | Not built |
| Scheduled post sync (catch Metricool-native posts) | [PLAN_metricool_full_integration.md](./PLAN_metricool_full_integration.md) | Not built |
| Performance Library (content + competitor analytics + recommendations) | [PLAN_performance_library.md](./PLAN_performance_library.md) | Not built |
| Report export to PDF + PowerPoint | [PLAN_text_to_report.md](./PLAN_text_to_report.md) | Not built |
| Respond.io webhook + reply sender | No plan doc yet | Not built |
| Client SWOT / Intelligence (real AI, not mock) | [project_client_wizard_plan.md in memory] | MOCK_INTEL only |

### Medium priority — operational gaps

| Feature | Notes |
|---|---|
| Role-based vendor name masking | All roles see "Metricool" — should be masked to non-admin/ceo |
| Integrations tab hidden from non-admin | Currently visible to all roles |
| Approval Portal email to client | Link is generated + copyable but no email sent |
| Crisis Mode persistence to Supabase | Local state only — resets on refresh |
| Google Drive OAuth file browser | Routes exist at `/api/drive/*` but not wired to Assets UI |

### Low priority — polish & power features

| Feature | Notes |
|---|---|
| AI Image Creation page (Flux 2 / Ideogram) | Full page not built |
| AI Video Creation page (Higgsfield) | Mock UI exists; real API route not built |
| Presentation Builder (text → pptxgenjs → .pptx) | pptxgenjs installed, route not built |
| Per-client pipeline view | Filter pipeline board by client |
| Reference document upload per client | Feeds into report generation context |
| Google Drive file browser in Assets | OAuth routes built, browser UI now wired |
| Report template upload + matching | Not built |
| Best time to post recommendation | Dependent on performance data accumulation |
| Vercel cron for daily performance sync | Needs post-performance pull built first |
| Bulk "Schedule All" for calendar output | Small UX improvement |
| Metricool blog ID config UI in Settings | Currently set manually in Supabase |

---

## Unfinished Plans (from prior sessions)

### 1. New Client Wizard Backend (from memory: project_client_wizard_plan.md)
**What's built:** 9-step UI wizard collects everything (social links, competitors, brand, tone, audience, KPIs)  
**What's missing:** Backend analysis pipeline — web scraping of social profiles → Claude SWOT/strategy generation → auto-fill `clients.brand_identity_json` and intelligence tab  
**Gap:** MOCK_INTEL in `clients/page.tsx` intelligence tab shows hardcoded SWOT data instead of real AI analysis

### 2. Respond.io Integration
**What's built:** Moderation page UI with comment queue, AI reply button  
**What's missing:** `/api/webhooks/respond-io` to receive incoming comments/DMs, `/api/respond-io/reply` to send replies  
**Note:** Instagram public comments CANNOT be replied to via API (Instagram restriction). DM replies work. Facebook comments work fine.

### 3. Role-Based Access Control
**What's built:** Role system in DB, role field on users  
**What's missing:** Any UI enforcement — all routes/tabs visible to all roles. See CLAUDE.md for visibility rules per role.

---

## Planned New Features

### Round 1 (previous sessions)

| Feature | Plan doc | Status |
|---|---|---|
| Performance Library | [PLAN_performance_library.md](./PLAN_performance_library.md) | Planned |
| Raw Text to Report (formatted export) | [PLAN_text_to_report.md](./PLAN_text_to_report.md) | Planned |
| Metricool full integration | [PLAN_metricool_full_integration.md](./PLAN_metricool_full_integration.md) | Planned |

### Round 2 (2026-05-21 — team meeting + designer workflow feedback)

| Priority | Feature | Plan doc | Status |
|---|---|---|---|
| P0 | Approval page media upload (captions-only is broken) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-1) | Planned |
| P0 | Tasks page `/tasks` + My Tasks floating button | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-2) | Planned |
| P1 | Task sub-types & filtering (Motion Graphics vs Social Graphic etc.) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-3) | Planned |
| P1 | Resend email notifications (team + client) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-4) | Planned |
| P2 | Client design brief forms (sizing, AI video needs, style refs) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-5) | Planned |
| P2 | In-app collaborative documents (replaces emailed Excel sheets) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-6) | Planned |
| P3 | AI Smart Image Resize Engine (Type 2: layout adaptation, not crop) | [PLAN_new_features_round2.md](./PLAN_new_features_round2.md#feature-7) | Planned |

---

## Suggested Build Order (next sessions)

### Immediate (highest daily impact — do first)
1. **Approval page media upload** — 2h — critical workflow blocker, captions-only breaks client approval
2. **Task sub-types** — 3h — DB migration + badge + filter, low effort high clarity gain for designers
3. **Tasks page `/tasks`** — 4h — proper task tracking for all users, currently tasks disappear into pipeline
4. **My Tasks floating button** — 3h — quick access from any page

### Next
5. **Resend email notifications** — 4h — install + task-assigned + approval emails wired to existing routes
6. **Client design brief forms** — 6h — client modal tab + task panel reference section
7. **Metricool post sync + per-post stats pull** — enables performance features; core data source
8. **Performance Library Tab 1 + 3** — content performance grid + pattern intelligence
9. **Report export PDF** — print CSS approach (fast, 1 session)
10. **Respond.io webhook + reply** — closes the moderation loop

### Later
11. **In-app collaborative documents** — 10h — Tiptap editor, full feature
12. **AI Smart Resize Engine** — 8h — Claude Vision + Sharp composition
13. **Client SWOT from real data** — replace MOCK_INTEL with real Claude analysis
14. **Role-based access control** — Integrations tab + vendor masking
