-- Migration 023: Content Brief Requests
-- Per-task creative brief form sent to clients externally (no login required)

CREATE TABLE IF NOT EXISTS content_brief_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'submitted', 'expired')),
  brief_data   JSONB,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  submitted_at TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_brief_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users (team members) can read, create, and update
CREATE POLICY "Team can manage brief requests"
  ON content_brief_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS content_brief_requests_task_id_idx  ON content_brief_requests (task_id);
CREATE INDEX IF NOT EXISTS content_brief_requests_token_idx    ON content_brief_requests (token);
CREATE INDEX IF NOT EXISTS content_brief_requests_status_idx   ON content_brief_requests (status);
