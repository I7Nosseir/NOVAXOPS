-- User Activity Tracking (Phase 11.1 / 11.2)
-- Tracks last-seen time, current page, and session info per user.
-- API call counts come from the existing api_usage table (no schema change needed).

CREATE TABLE IF NOT EXISTS user_activity (
  user_id      uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen    timestamptz NOT NULL DEFAULT now(),
  current_page text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast recency sort
CREATE INDEX IF NOT EXISTS user_activity_last_seen_idx ON user_activity (last_seen DESC);

-- RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Users can update their own activity
DROP POLICY IF EXISTS "user_activity_self" ON user_activity;
CREATE POLICY "user_activity_self" ON user_activity
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Admins + CEO can read all activity
DROP POLICY IF EXISTS "user_activity_admin" ON user_activity;
CREATE POLICY "user_activity_admin" ON user_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo')
    )
  );
