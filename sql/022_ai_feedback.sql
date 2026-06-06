-- 022_ai_feedback.sql
-- Per-client, per-agent-type taste profile from team corrections.
-- Injected into future AI calls to improve quality over time.

CREATE TABLE IF NOT EXISTS ai_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,
  agent_type        text NOT NULL,
  content_snapshot  text DEFAULT '',
  rating            text NOT NULL CHECK (rating IN ('positive','negative')),
  tags              text[] DEFAULT '{}',
  correction_text   text DEFAULT '',
  edited_version    text DEFAULT '',
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_feedback_lookup_idx
  ON ai_feedback (client_id, agent_type, created_at DESC);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_ai_feedback" ON ai_feedback;
CREATE POLICY "authenticated_manage_ai_feedback" ON ai_feedback
  FOR ALL USING (auth.role() = 'authenticated');
