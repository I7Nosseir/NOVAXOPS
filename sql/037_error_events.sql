-- ============================================================
-- MIGRATION 037: Error Events Table
-- ============================================================
-- Stores all server-side errors across all API routes.
-- Visible only to super_admin on the /admin/errors page.
-- Critical severity triggers an immediate email to ADMIN_ALERT_EMAIL.
-- ============================================================

CREATE TABLE IF NOT EXISTS error_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  route            TEXT NOT NULL,          -- e.g. '/api/studio/content/[id]/script'
  error_message    TEXT NOT NULL,
  error_stack      TEXT,
  context_json     JSONB DEFAULT '{}',     -- extra context: request body, params, etc.
  severity         TEXT NOT NULL DEFAULT 'error'
                     CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved         BOOLEAN NOT NULL DEFAULT false,
  resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for admin panel filters
CREATE INDEX IF NOT EXISTS idx_error_events_org_id    ON error_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_error_events_severity  ON error_events(severity);
CREATE INDEX IF NOT EXISTS idx_error_events_resolved  ON error_events(resolved);
CREATE INDEX IF NOT EXISTS idx_error_events_created   ON error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_route     ON error_events(route);

-- Enable RLS
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (needed for error inserts from API routes)
CREATE POLICY "error_events_service" ON error_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Super admins can read/update all errors (mark as resolved)
CREATE POLICY "error_events_super_admin" ON error_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND is_super_admin = true
    )
  );
