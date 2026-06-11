-- 032_pinterest_inspiration_engine.sql
-- Pinterest Inspiration Reference Engine — tables for the Copywriting Engine.
-- Run after 031_copywriting_engine_arabic_v2.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pinterest_scrape_sessions — one record per inspiration search run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinterest_scrape_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid        REFERENCES clients(id) ON DELETE CASCADE,
  created_by        uuid        REFERENCES users(id) ON DELETE SET NULL,

  -- Input context
  brief_text        text        NOT NULL,
  platform          text        NOT NULL DEFAULT 'instagram',
  content_type      text        NOT NULL DEFAULT 'single',
  language          text        NOT NULL DEFAULT 'ar',

  -- AI-generated search queries (stored for auditability + harvest reuse)
  -- probe: [{angle: string, query: string}]
  probe_queries     jsonb       DEFAULT '[]'::jsonb,
  -- harvest: [{angle: string, query: string}] — bias-weighted toward approved clusters
  harvest_queries   jsonb       DEFAULT '[]'::jsonb,

  -- Style clusters discovered during probe clustering
  -- [{id, label, description, representative_pin_ids[], all_pin_ids[]}]
  style_clusters    jsonb       DEFAULT '[]'::jsonb,

  -- User feedback on clusters: {"A": "more"|"less"|null, "B": ...}
  cluster_feedback  jsonb       DEFAULT '{}'::jsonb,

  -- Stats
  probe_raw_count   int         DEFAULT 0,
  harvest_raw_count int         DEFAULT 0,
  filtered_count    int         DEFAULT 0,

  -- Linked copy session — set after copy generation (Phase 3)
  copy_session_id   uuid        REFERENCES copy_sessions(id) ON DELETE SET NULL,

  status            text        NOT NULL DEFAULT 'probe_pending'
                    CHECK (status IN (
                      'probe_pending',
                      'probing',
                      'awaiting_feedback',
                      'harvest_pending',
                      'harvesting',
                      'scored',
                      'complete'
                    )),

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pinterest_sessions_client_idx
  ON pinterest_scrape_sessions (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pinterest_sessions_user_idx
  ON pinterest_scrape_sessions (created_by, created_at DESC);

ALTER TABLE pinterest_scrape_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_pinterest_sessions" ON pinterest_scrape_sessions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pinterest_pins — one record per scraped pin
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinterest_pins (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL
                    REFERENCES pinterest_scrape_sessions(id) ON DELETE CASCADE,
  client_id         uuid        REFERENCES clients(id) ON DELETE CASCADE,

  -- Pinterest data (normalized from Apify response)
  pin_external_id   text,                         -- Pinterest's own pin ID
  pin_url           text,
  image_url         text        NOT NULL,
  destination_url   text,
  title             text,
  description       text,                         -- pin caption / description text
  board_name        text,
  board_url         text,
  pinner_username   text,
  save_count        int         DEFAULT 0,

  -- Scrape metadata
  scrape_phase      text        NOT NULL DEFAULT 'probe'
                    CHECK (scrape_phase IN ('probe', 'harvest')),
  query_used        text,                         -- which search query found this pin
  query_angle       text,                         -- angle category (lifestyle, emotion, etc.)

  -- Cluster assignment (set during probe clustering)
  style_cluster_id  text,                         -- 'A' | 'B' | 'C' | 'D'

  -- AI scoring (set during harvest scoring)
  visual_score      numeric(4,1),                 -- 0.0–10.0
  caption_score     numeric(4,1),                 -- 0.0–10.0
  structural_score  numeric(4,1),                 -- 0.0–10.0
  -- composite = visual*0.35 + caption*0.35 + structural*0.30 (computed in app)
  composite_score   numeric(4,1),
  score_rationale   text,                         -- AI one-line reason for the scores
  kept_after_filter boolean     DEFAULT false,    -- true if composite >= 6.0

  -- User interaction
  user_rating       text        CHECK (user_rating IN ('selected', 'rejected')),
  saved_to_board    boolean     DEFAULT false,    -- saved to existing inspiration_board table

  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pinterest_pins_session_score_idx
  ON pinterest_pins (session_id, composite_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS pinterest_pins_session_cluster_idx
  ON pinterest_pins (session_id, style_cluster_id);

CREATE INDEX IF NOT EXISTS pinterest_pins_client_kept_idx
  ON pinterest_pins (client_id, kept_after_filter, created_at DESC);

ALTER TABLE pinterest_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_pinterest_pins" ON pinterest_pins
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. copy_inspiration_links — which pins informed a copy session (Phase 3)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS copy_inspiration_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_session_id uuid        NOT NULL REFERENCES copy_sessions(id) ON DELETE CASCADE,
  pin_id          uuid        NOT NULL REFERENCES pinterest_pins(id) ON DELETE CASCADE,
  element_borrowed text,      -- "hook structure", "vocabulary register", "CTA pattern", "sentence rhythm"
  created_at      timestamptz DEFAULT now(),
  UNIQUE (copy_session_id, pin_id)
);

ALTER TABLE copy_inspiration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_inspiration_links" ON copy_inspiration_links
  FOR ALL USING (auth.uid() IS NOT NULL);
