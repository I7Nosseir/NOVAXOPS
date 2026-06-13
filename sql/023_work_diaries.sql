-- Work Diaries: daily employee log with structured work + AI feedback sections
-- RLS: each user sees only their own entries; admin sees all

CREATE TABLE IF NOT EXISTS work_diaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,

  -- Structured work log: [{client_name, description, time_minutes}]
  tasks_worked    JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Friction / blockers: predefined tags + optional freeform note
  blockers        TEXT[] NOT NULL DEFAULT '{}',
  blockers_notes  TEXT,

  -- Wins / highlights for the day
  highlights      TEXT,

  -- Self-reported energy: 1 (drained) → 5 (peak)
  energy_score    SMALLINT CHECK (energy_score BETWEEN 1 AND 5),

  -- AI output feedback: [{tool, issue_types: string[], notes: string}]
  ai_feedback_notes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Open reflection / anything else
  free_notes      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One entry per user per day
  UNIQUE (user_id, date)
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_work_diaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_diaries_updated_at
  BEFORE UPDATE ON work_diaries
  FOR EACH ROW EXECUTE FUNCTION update_work_diaries_updated_at();

-- RLS
ALTER TABLE work_diaries ENABLE ROW LEVEL SECURITY;

-- Each user can fully manage their own diary
CREATE POLICY "diary_own"
  ON work_diaries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can read every entry
CREATE POLICY "diary_admin_read"
  ON work_diaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index for fast user+date lookups
CREATE INDEX IF NOT EXISTS work_diaries_user_date_idx ON work_diaries (user_id, date DESC);
