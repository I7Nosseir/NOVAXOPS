# NOVAX Ops — Master Status & Roadmap

**Last updated:** 2026-06-02  
**Platform state:** Production-ready MVP. Studio tools rebuilt to world-class standard. Platform-wide upgrade plan underway.

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
| Per-post performance data sync from Metricool | [PLAN_metricool_full_integration.md](./PLAN_metricool_full_integration.md) | Routes exist, needs cron wired |
| Scheduled post sync (catch Metricool-native posts) | [PLAN_metricool_full_integration.md](./PLAN_metricool_full_integration.md) | Route exists `/api/metricool/sync` |

### Medium priority — operational gaps

| Feature | Notes |
|---|---|
| Bulk "Schedule All" for calendar output | Small UX improvement |
| Reference document upload per client | Feeds into report generation context |

### Low priority — polish & power features

| Feature | Notes |
|---|---|
| AI Video Creation page (Higgsfield) | Excluded — API not available |
| Report template upload + matching | Nice-to-have |
| Vercel cron for daily performance sync | `/api/cron/sync-performance` exists; wire in vercel.json |

### Studio Power Tools (Sprint roadmap — all use Claude API)

| Feature | Status |
|---|---|
| Studio landing page `/studio` | **BUILT** |
| Hook Lab `/studio/hooks` + API | **BUILT** (One Peak 3C, 20 hooks, save to library) |
| Content Creation Studio `/studio/content` | **BUILT** (Define → Research → Hooks → Script → Schedule) |
| Strategy Command Center `/studio/strategy` | **BUILT** (5 meta-phases, all using Claude Opus) |
| Hook Library DB table + API | **BUILT** (sql/012_studio.sql) |
| Studio sessions DB table | **BUILT** (sql/012_studio.sql) |
| Action bridges: Performance → Studio | **BUILT** ("Create This" on each recommendation) |
| Action bridges: Client Intelligence → Studio | **BUILT** (Content Gaps → Studio, Strategy → Strategy Center) |
| Sidebar sectioned (Workspace/Studio/Creative/Intelligence) | **BUILT** |
| Viral Pattern Library `/studio/patterns` | Planned — Sprint 5 |
| Brand Voice Trainer | Planned — Sprint 6 |
| Admin Intelligence Panel | Planned — Sprint 6 |

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

### Platform World-Class Upgrade (2026-06-02 — studio-level intelligence on all pages)

**Full plan:** [PLAN_platform_world_class.md](./PLAN_platform_world_class.md) — 57h across ~8 sessions

| Priority | Feature | Est. | Status |
|---|---|---|---|
| P0 | Cross-cutting intelligence infrastructure (evidence chip, boss brief, anomaly detector, daily brief) | 5h | Planned |
| P0 | Dashboard → Intelligence Command Center | 6h | Planned |
| P1 | Clients → Real AI intelligence document (replaces mock SWOT) | 6h | Planned |
| P1 | Reports → Studio-style generation flow with narrative | 8h | Planned |
| P1 | Publishing → Compose mini-flow + calendar performance overlay | 7h | Planned |
| P2 | Moderation → Priority queue + 3 reply variants + quality check | 6h | Planned |
| P2 | Pipeline → Health banner + smart stage gates + bottleneck detection | 5h | Planned |
| P3 | Approval → Package builder + analytics | 4h | Planned |
| P3 | Assets → Performance linking + AI intelligence | 5h | Planned |
| P3 | Creative Eval → Evidence scoring + Boss Brief | 3h | Planned |
| P3 | Workload → Capacity forecast + skill match warnings | 2h | Planned |

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
