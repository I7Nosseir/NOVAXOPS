-- 023_client_normalized_profile.sql
-- Adds a structured, normalized client profile column.
-- This is distinct from client_context_bank (freeform memory) — it is a fixed
-- schema of fields that every client must fill in, injected at the top of every AI call.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS normalized_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN clients.normalized_profile IS
  'Structured client profile. Schema: { positioning_statement, primary_offering, key_differentiator, price_positioning, audience_age_range, audience_gender_skew, audience_location, audience_psychographic, brand_voice[], language, arabic_dialect, formality, emoji_policy, content_goal, primary_cta, banned_topics, hashtag_policy, primary_platform, secondary_platforms[], posts_per_week, best_posting_times }';
