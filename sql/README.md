# SQL Migrations — NOVAX Ops

Run these in the **Supabase SQL Editor** in the exact order listed below.
All migrations are idempotent (safe to re-run unless noted).

There is no automated migration runner — apply each file manually.

---

## Run Order

| # | File | What it does |
|---|------|-------------|
| 1 | `001_initial_schema.sql` | Core schema: users, clients, projects, tasks, pipeline stages, audit_log |
| 2 | `002_crisis_mode_approvals.sql` | Crisis mode flag + approval_requests + approval_post_statuses tables |
| 3 | `002_page_permissions.sql` | Adds `page_permissions TEXT[]` column to users |
| 4 | `002_performance_tables.sql` | post_performance_snapshots + competitor_tracking tables |
| 5 | `002_new_clients_2026_05_21.sql` | Seed data: initial client records |
| 6 | `003_remove_freepik.sql` | Drops Freepik-related columns (integration removed) |
| 7 | `003_approval_notes_notify.sql` | Adds notes + notification columns to approval tables |
| 8 | `003_privea_dent.sql` | Client-specific schema patch (Privea/Dent client) |
| 9 | `004_metricool_blog_ids.sql` | Adds `metricool_blog_id` column to clients |
| 10 | `005_schema_patches.sql` | General column + constraint patches |
| 11 | `006_storage_assets_bucket.sql` | Creates `assets` Supabase Storage bucket (public, 500MB/file) |
| 12 | `007_task_subtypes.sql` | Adds `sub_type` column to tasks (copy_variant, design_brief, etc.) |
| 13 | `008_design_brief.sql` | Per-client design brief JSON column |
| 14 | `009_documents.sql` | Documents table (Tiptap-backed rich text) |
| 15 | `010_task_comments_and_templates.sql` | task_comments table + content_templates table |
| 16 | `011_doc_type.sql` | Adds `doc_type` column to documents |
| 17 | `012_studio.sql` | studio_sessions table v1 |
| 18 | `013_onboarding.sql` | Onboarding checklist column + flag on users |
| 19 | `014_arabic_knowledge_base.sql` | arabic_knowledge_base table + seed rules per client |
| 20 | `015_omranion_client.sql` | Seed: Omranion client (id: b4d2340e, blogId: 6329305) |
| 21 | `015_studio_sessions.sql` | studio_sessions v2 — extended schema |
| 22 | `016_inspiration_board.sql` | inspiration_board table + RLS |
| 23 | `016_studio_sessions_v4.sql` | studio_sessions v4 — adds boss_brief, chat_history, performance cols |
| 24 | `017_studio_unified.sql` | Unified studio + inspiration (idempotent — safe to re-run anytime) |
| 25 | `018_ai_generation_cache.sql` | ai_generation_cache table (prompt-hash keyed response cache) |
| 26 | `018_chatwoot_migration.sql` | Chatwoot integration schema |
| 27 | `019_peak_format_generator.sql` | Adds 'formats' to studio tool enum + format_favorites table |
| 28 | `020_ceo_context.sql` | CEO cross-client context + quarterly strategy tables |
| 29 | `021_client_context_bank.sql` | client_context_bank table (wins, objections, signals per client) |
| 30 | `022_ai_feedback.sql` | ai_feedback table (team taste profiles per client + agent type) |
| 31 | `023_visual_tool.sql` | Adds 'visual' to studio_sessions tool constraint (Visual Content Engine) |
| 32 | `024_enable_realtime.sql` | Adds tasks, approval_requests, approval_post_statuses, moderation_items, audit_log to supabase_realtime publication |

---

## Notes on duplicate prefixes

Several early migrations share a prefix (002, 003, 015, 016, 018). This happened
because they were written in parallel and all needed to be applied at the same time.
The run order above is canonical — when in doubt, follow this table, not the filename prefix.

**Future migrations** should use the next sequential number: `023_*.sql`

---

## Key IDs to know

| Client | ID | Metricool blogId |
|--------|-----|-----------------|
| Omranion | `b4d2340e-807b-4855-bdd3-df30a35832ae` | `6329305` |

---

## Never do this

- Never create users via raw SQL — always use Supabase Dashboard UI.
  Raw SQL bypasses GoTrue password hashing → 500 error on login.
- Never drop the `studio_sessions_tool_check` constraint without re-adding it
  with the full list of tool values (see migration 019 for the current list).
