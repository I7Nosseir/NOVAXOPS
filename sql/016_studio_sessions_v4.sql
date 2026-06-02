-- ============================================================
-- MIGRATION 016 — Studio Sessions v4 (Definitive Redesign)
-- Date: 2026-06-02
-- Replaces the phase_1..6_data schema from 012_studio.sql
-- with the v4 structured schema matching studio-types.ts
-- ============================================================

-- Drop the old trigger and function first (safe: recreated below)
DROP TRIGGER  IF EXISTS studio_sessions_updated_at        ON studio_sessions;
DROP FUNCTION IF EXISTS update_studio_sessions_updated_at();

-- ── Alter existing table to v4 schema ────────────────────────
-- Add new columns (all nullable / with defaults so existing rows survive)

ALTER TABLE studio_sessions
  ADD COLUMN IF NOT EXISTS tool                text
    CHECK (tool IN ('content','hooks','strategy','campaign','postmortem','intel','trends','ads','repurpose')),
  ADD COLUMN IF NOT EXISTS name                text,
  ADD COLUMN IF NOT EXISTS brief               text,
  ADD COLUMN IF NOT EXISTS inputs              jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outputs             jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS executive_summary   text,
  ADD COLUMN IF NOT EXISTS boss_brief          jsonb,
  ADD COLUMN IF NOT EXISTS structured_answers  jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chat_history        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS edit_history        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signal_report_used  jsonb,
  ADD COLUMN IF NOT EXISTS metricool_snapshot  jsonb,
  ADD COLUMN IF NOT EXISTS performance         jsonb,
  ADD COLUMN IF NOT EXISTS performance_verdict text
    CHECK (performance_verdict IN ('exceeded','met','below','significantly_below'));

-- Back-fill: copy old title → name where name is null
UPDATE studio_sessions
SET name = title
WHERE name IS NULL AND title IS NOT NULL;

-- Back-fill tool to 'content' for rows that pre-date this migration
UPDATE studio_sessions
SET tool = 'content'
WHERE tool IS NULL;

-- Now make tool + name NOT NULL (safe after back-fill)
ALTER TABLE studio_sessions
  ALTER COLUMN tool SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;

-- Set default for new rows
ALTER TABLE studio_sessions
  ALTER COLUMN tool SET DEFAULT 'content',
  ALTER COLUMN name SET DEFAULT 'Untitled Session';

-- Drop old columns no longer needed in v4
-- (keep scheduled_post_id — still a useful FK for the feedback loop)
ALTER TABLE studio_sessions
  DROP COLUMN IF EXISTS phase,
  DROP COLUMN IF EXISTS phase_1_data,
  DROP COLUMN IF EXISTS phase_2_data,
  DROP COLUMN IF EXISTS phase_3_data,
  DROP COLUMN IF EXISTS phase_4_data,
  DROP COLUMN IF EXISTS phase_5_data,
  DROP COLUMN IF EXISTS phase_6_data;

-- Drop old status constraint and add v4 values
ALTER TABLE studio_sessions
  DROP CONSTRAINT IF EXISTS studio_sessions_status_check;

ALTER TABLE studio_sessions
  ADD CONSTRAINT studio_sessions_status_check
    CHECK (status IN ('running','partial','complete','error'));

-- Back-fill old status values to nearest v4 equivalent
UPDATE studio_sessions SET status = 'complete'  WHERE status IN ('completed','scheduled');
UPDATE studio_sessions SET status = 'running'   WHERE status IN ('draft','in_progress');
UPDATE studio_sessions SET status = 'error'     WHERE status = 'archived';

-- ── Indexes ───────────────────────────────────────────────────

DROP INDEX IF EXISTS studio_sessions_status_idx;

CREATE INDEX IF NOT EXISTS studio_sessions_client_idx
  ON studio_sessions (client_id);

CREATE INDEX IF NOT EXISTS studio_sessions_tool_idx
  ON studio_sessions (tool, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_sessions_created_by_idx
  ON studio_sessions (created_by);

CREATE INDEX IF NOT EXISTS studio_sessions_perf_verdict_idx
  ON studio_sessions (performance_verdict)
  WHERE performance_verdict IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "users_own_sessions"  ON studio_sessions;
DROP POLICY IF EXISTS "admin_all_sessions"  ON studio_sessions;

CREATE POLICY "users_own_sessions" ON studio_sessions
  FOR ALL
  USING (created_by = auth.uid());

CREATE POLICY "admin_all_sessions" ON studio_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo', 'creative_director')
    )
  );

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_studio_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER studio_sessions_updated_at
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW EXECUTE FUNCTION update_studio_sessions_updated_at();

-- ── Verify ────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'studio_sessions'
ORDER BY ordinal_position;
