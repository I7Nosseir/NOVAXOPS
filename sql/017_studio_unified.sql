-- ============================================================
-- UNIFIED STUDIO MIGRATION — Run this once in Supabase
-- Safe to run even if tables already exist or were partially migrated.
-- Handles: studio_sessions (v4 upgrade) + inspiration_board (new)
-- ============================================================

-- ── PART 1: studio_sessions ───────────────────────────────────

-- Create table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS studio_sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL DEFAULT 'Untitled Session',
  tool                 text        NOT NULL DEFAULT 'content',
  client_id            uuid        REFERENCES clients(id) ON DELETE SET NULL,
  created_by           uuid        REFERENCES users(id),
  status               text        NOT NULL DEFAULT 'running',
  brief                text,
  inputs               jsonb       DEFAULT '{}',
  outputs              jsonb       DEFAULT '{}',
  executive_summary    text,
  boss_brief           jsonb,
  structured_answers   jsonb       DEFAULT '{}',
  chat_history         jsonb       DEFAULT '[]',
  edit_history         jsonb       DEFAULT '[]',
  signal_report_used   jsonb,
  metricool_snapshot   jsonb,
  performance          jsonb,
  performance_verdict  text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Add any v4 columns missing from older versions of the table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='name') THEN
    ALTER TABLE studio_sessions ADD COLUMN name text DEFAULT 'Untitled Session';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='tool') THEN
    ALTER TABLE studio_sessions ADD COLUMN tool text DEFAULT 'content';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='brief') THEN
    ALTER TABLE studio_sessions ADD COLUMN brief text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='inputs') THEN
    ALTER TABLE studio_sessions ADD COLUMN inputs jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='outputs') THEN
    ALTER TABLE studio_sessions ADD COLUMN outputs jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='executive_summary') THEN
    ALTER TABLE studio_sessions ADD COLUMN executive_summary text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='boss_brief') THEN
    ALTER TABLE studio_sessions ADD COLUMN boss_brief jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='structured_answers') THEN
    ALTER TABLE studio_sessions ADD COLUMN structured_answers jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='chat_history') THEN
    ALTER TABLE studio_sessions ADD COLUMN chat_history jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='edit_history') THEN
    ALTER TABLE studio_sessions ADD COLUMN edit_history jsonb DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='signal_report_used') THEN
    ALTER TABLE studio_sessions ADD COLUMN signal_report_used jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='metricool_snapshot') THEN
    ALTER TABLE studio_sessions ADD COLUMN metricool_snapshot jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='performance') THEN
    ALTER TABLE studio_sessions ADD COLUMN performance jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='performance_verdict') THEN
    ALTER TABLE studio_sessions ADD COLUMN performance_verdict text;
  END IF;

  -- Back-fill name from title only if title column exists on this table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_sessions' AND column_name='title') THEN
    UPDATE studio_sessions SET name = title WHERE name IS NULL OR name = 'Untitled Session';
  END IF;

  -- Back-fill tool for old rows
  UPDATE studio_sessions SET tool = 'content' WHERE tool IS NULL;

  -- Back-fill name for old rows
  UPDATE studio_sessions SET name = 'Untitled Session' WHERE name IS NULL;

  -- Normalise old status values to v4 equivalents
  UPDATE studio_sessions SET status = 'complete' WHERE status IN ('completed', 'scheduled', 'published');
  UPDATE studio_sessions SET status = 'running'  WHERE status IN ('draft', 'in_progress', 'active');
  UPDATE studio_sessions SET status = 'error'    WHERE status IN ('archived', 'failed');
  -- Default anything else to complete
  UPDATE studio_sessions SET status = 'complete'
  WHERE status NOT IN ('running', 'partial', 'complete', 'error');

END $$;

-- Drop old phase columns if they exist
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS title;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_1_data;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_2_data;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_3_data;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_4_data;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_5_data;
ALTER TABLE studio_sessions DROP COLUMN IF EXISTS phase_6_data;

-- Drop old constraints and recreate with v4 values
ALTER TABLE studio_sessions DROP CONSTRAINT IF EXISTS studio_sessions_tool_check;
ALTER TABLE studio_sessions DROP CONSTRAINT IF EXISTS studio_sessions_status_check;
ALTER TABLE studio_sessions DROP CONSTRAINT IF EXISTS studio_sessions_performance_verdict_check;

ALTER TABLE studio_sessions
  ADD CONSTRAINT studio_sessions_tool_check
    CHECK (tool IN ('content','hooks','strategy','campaign','postmortem','intel','trends','ads','repurpose')),
  ADD CONSTRAINT studio_sessions_status_check
    CHECK (status IN ('running','partial','complete','error')),
  ADD CONSTRAINT studio_sessions_performance_verdict_check
    CHECK (performance_verdict IN ('exceeded','met','below','significantly_below'));

-- Indexes
CREATE INDEX IF NOT EXISTS studio_sessions_client_idx      ON studio_sessions (client_id);
CREATE INDEX IF NOT EXISTS studio_sessions_tool_idx        ON studio_sessions (tool, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_sessions_created_by_idx  ON studio_sessions (created_by);
CREATE INDEX IF NOT EXISTS studio_sessions_status_idx      ON studio_sessions (status);
CREATE INDEX IF NOT EXISTS studio_sessions_perf_idx
  ON studio_sessions (performance_verdict)
  WHERE performance_verdict IS NOT NULL;

-- RLS
ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_sessions" ON studio_sessions;
CREATE POLICY "users_own_sessions" ON studio_sessions
  FOR ALL USING (created_by = auth.uid());

DROP POLICY IF EXISTS "admin_all_sessions" ON studio_sessions;
CREATE POLICY "admin_all_sessions" ON studio_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo', 'creative_director')
    )
  );

-- updated_at trigger
DROP TRIGGER  IF EXISTS studio_sessions_updated_at         ON studio_sessions;
DROP FUNCTION IF EXISTS update_studio_sessions_updated_at();

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


-- ── PART 2: inspiration_board ─────────────────────────────────

CREATE TABLE IF NOT EXISTS inspiration_board (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid        REFERENCES clients(id) ON DELETE CASCADE,
  saved_by      uuid        REFERENCES users(id),
  platform      text        NOT NULL,
  content_type  text        NOT NULL,
  title         text        NOT NULL,
  url           text        NOT NULL,
  thumbnail_url text,
  view_count    integer,
  channel       text,
  hashtag       text,
  industry      text,
  notes         text,
  tags          text[],
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspiration_board_client_idx   ON inspiration_board (client_id);
CREATE INDEX IF NOT EXISTS inspiration_board_saved_by_idx ON inspiration_board (saved_by);

ALTER TABLE inspiration_board ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_board" ON inspiration_board;
CREATE POLICY "users_own_board" ON inspiration_board
  FOR ALL USING (saved_by = auth.uid());

DROP POLICY IF EXISTS "admin_all_board" ON inspiration_board;
CREATE POLICY "admin_all_board" ON inspiration_board
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo', 'creative_director')
    )
  );


-- ── VERIFY ────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'studio_sessions'
ORDER BY ordinal_position;
