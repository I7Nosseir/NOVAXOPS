-- Studio Sessions table
-- Safe to run even if table already exists (IF NOT EXISTS throughout)

CREATE TABLE IF NOT EXISTS studio_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  client_id            uuid REFERENCES clients(id) ON DELETE SET NULL,
  tool                 text NOT NULL CHECK (tool IN (
                         'content', 'hooks', 'strategy', 'campaign',
                         'postmortem', 'intel', 'trends', 'ads', 'repurpose'
                       )),
  created_by           uuid REFERENCES users(id),
  status               text NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'partial', 'complete', 'error')),
  brief                text,
  inputs               jsonb DEFAULT '{}',
  outputs              jsonb DEFAULT '{}',
  executive_summary    text,
  boss_brief           jsonb,
  structured_answers   jsonb DEFAULT '{}',
  chat_history         jsonb DEFAULT '[]',
  edit_history         jsonb DEFAULT '[]',
  signal_report_used   jsonb,
  metricool_snapshot   jsonb,
  performance          jsonb,
  performance_verdict  text CHECK (performance_verdict IN (
                         'exceeded', 'met', 'below', 'significantly_below'
                       )),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS studio_sessions_client_idx     ON studio_sessions (client_id);
CREATE INDEX IF NOT EXISTS studio_sessions_tool_idx       ON studio_sessions (tool, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_sessions_created_by_idx ON studio_sessions (created_by);
CREATE INDEX IF NOT EXISTS studio_sessions_status_idx     ON studio_sessions (status);

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
CREATE OR REPLACE FUNCTION update_studio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS studio_sessions_updated_at ON studio_sessions;
CREATE TRIGGER studio_sessions_updated_at
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW EXECUTE FUNCTION update_studio_sessions_updated_at();
