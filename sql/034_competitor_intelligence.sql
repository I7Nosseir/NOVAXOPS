-- Migration 034: Competitor Intelligence Upgrade
-- Adds scope (local/global), intelligence fields, fixes RLS, adds reports cache table
-- Run once in Supabase SQL editor.

-- ── 1. Enhance competitor_snapshots ──────────────────────────────────────────
ALTER TABLE competitor_snapshots
  ADD COLUMN IF NOT EXISTS scope            TEXT    DEFAULT 'global'
    CHECK (scope IN ('local', 'global')),
  ADD COLUMN IF NOT EXISTS social_url       TEXT,
  ADD COLUMN IF NOT EXISTS platform_strategy TEXT,
  ADD COLUMN IF NOT EXISTS brand_positioning TEXT,
  ADD COLUMN IF NOT EXISTS content_themes   JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;

-- ── 2. Fix RLS policies (old syntax used auth.role() which is unreliable) ──
DROP POLICY IF EXISTS "service_role_all_comp"   ON competitor_snapshots;
DROP POLICY IF EXISTS "authed_read_comp"         ON competitor_snapshots;

CREATE POLICY "comp_snap_service_all" ON competitor_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "comp_snap_auth_select" ON competitor_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comp_snap_auth_write" ON competitor_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Competitor intelligence reports: cached full analysis per client ──────
CREATE TABLE IF NOT EXISTS competitor_intelligence_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_json  JSONB       NOT NULL,
  model_used   TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_comp_report_client UNIQUE (client_id)
);

ALTER TABLE competitor_intelligence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comp_report_service_all" ON competitor_intelligence_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "comp_report_auth_select" ON competitor_intelligence_reports
  FOR SELECT TO authenticated USING (true);
