-- Migration 034: Competitor Intelligence (full create + upgrade)
-- Creates competitor_snapshots if it doesn't exist (migration 002 may not have run).
-- Adds scope, social_url, platform_strategy, brand_positioning, content_themes columns.
-- Fixes RLS policies. Creates competitor_intelligence_reports table.
-- SAFE to re-run — all statements are idempotent.

-- ── 1. competitor_snapshots (create fresh or upgrade existing) ───────────────
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform            TEXT        NOT NULL,
  competitor_handle   TEXT        NOT NULL,
  followers           INT         DEFAULT 0,
  avg_er              NUMERIC(5,2) DEFAULT 0,
  top_content_types   JSONB       DEFAULT '{}',
  posting_frequency   NUMERIC(4,1) DEFAULT 0,
  captured_at         TIMESTAMPTZ DEFAULT NOW(),
  notes               TEXT,
  scope               TEXT        DEFAULT 'global' CHECK (scope IN ('local', 'global')),
  social_url          TEXT,
  platform_strategy   TEXT,
  brand_positioning   TEXT,
  content_themes      JSONB       DEFAULT '[]',
  last_analyzed_at    TIMESTAMPTZ,
  CONSTRAINT uq_comp_client_handle_platform UNIQUE (client_id, competitor_handle, platform)
);

-- Add new columns if table already existed without them
ALTER TABLE competitor_snapshots
  ADD COLUMN IF NOT EXISTS scope             TEXT        DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS social_url        TEXT,
  ADD COLUMN IF NOT EXISTS platform_strategy TEXT,
  ADD COLUMN IF NOT EXISTS brand_positioning TEXT,
  ADD COLUMN IF NOT EXISTS content_themes    JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_analyzed_at  TIMESTAMPTZ;

-- Add constraint if it doesn't exist (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_comp_client_handle_platform'
      AND conrelid = 'competitor_snapshots'::regclass
  ) THEN
    ALTER TABLE competitor_snapshots
      ADD CONSTRAINT uq_comp_client_handle_platform
      UNIQUE (client_id, competitor_handle, platform);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comp_client_id ON competitor_snapshots(client_id);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop old policies that may use unreliable auth.role() syntax
DROP POLICY IF EXISTS "service_role_all_comp"      ON competitor_snapshots;
DROP POLICY IF EXISTS "authed_read_comp"            ON competitor_snapshots;
DROP POLICY IF EXISTS "comp_snap_service_all"       ON competitor_snapshots;
DROP POLICY IF EXISTS "comp_snap_auth_select"       ON competitor_snapshots;
DROP POLICY IF EXISTS "comp_snap_auth_write"        ON competitor_snapshots;

CREATE POLICY "comp_snap_service_all"  ON competitor_snapshots FOR ALL       TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "comp_snap_auth_select"  ON competitor_snapshots FOR SELECT    TO authenticated USING (true);
CREATE POLICY "comp_snap_auth_insert"  ON competitor_snapshots FOR INSERT    TO authenticated WITH CHECK (true);
CREATE POLICY "comp_snap_auth_update"  ON competitor_snapshots FOR UPDATE    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comp_snap_auth_delete"  ON competitor_snapshots FOR DELETE    TO authenticated USING (true);

-- ── 3. competitor_intelligence_reports ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_intelligence_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_json  JSONB       NOT NULL,
  model_used   TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_comp_report_client UNIQUE (client_id)
);

ALTER TABLE competitor_intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_report_service_all"  ON competitor_intelligence_reports;
DROP POLICY IF EXISTS "comp_report_auth_select"  ON competitor_intelligence_reports;

CREATE POLICY "comp_report_service_all" ON competitor_intelligence_reports FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "comp_report_auth_select" ON competitor_intelligence_reports FOR SELECT TO authenticated USING (true);
