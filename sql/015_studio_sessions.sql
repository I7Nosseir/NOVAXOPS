-- Studio Sessions table: stores all AI generation sessions across tools
-- Run this in Supabase SQL editor after 001_initial_schema.sql

CREATE TABLE studio_sessions (
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
  performance          jsonb,          -- filled 7 days after publish via /api/studio/session/[id]/performance
  performance_verdict  text CHECK (performance_verdict IN (
                         'exceeded', 'met', 'below', 'significantly_below'
                       )),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX studio_sessions_client_idx      ON studio_sessions (client_id);
CREATE INDEX studio_sessions_tool_idx        ON studio_sessions (tool, created_at DESC);
CREATE INDEX studio_sessions_created_by_idx  ON studio_sessions (created_by);
CREATE INDEX studio_sessions_status_idx      ON studio_sessions (status);
CREATE INDEX studio_sessions_verdict_idx     ON studio_sessions (performance_verdict)
  WHERE performance_verdict IS NOT NULL;

-- Row Level Security
ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sessions
CREATE POLICY "users_own_sessions" ON studio_sessions
  FOR ALL
  USING (created_by = auth.uid());

-- Admins, CEOs, and Creative Directors can see all sessions
CREATE POLICY "admin_all_sessions" ON studio_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo', 'creative_director')
    )
  );

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_studio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_sessions_updated_at
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_sessions_updated_at();
