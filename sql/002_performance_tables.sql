-- ─── Sprint: Performance Library + Crisis Mode persistence ───────────────────
-- Run once in Supabase SQL editor.

-- 1. Per-post performance snapshots
CREATE TABLE IF NOT EXISTS post_performance_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  platform        text NOT NULL,
  reach           int DEFAULT 0,
  impressions     int DEFAULT 0,
  likes           int DEFAULT 0,
  comments        int DEFAULT 0,
  shares          int DEFAULT 0,
  saves           int DEFAULT 0,
  link_clicks     int DEFAULT 0,
  engagement_rate numeric(6,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_perf_post_id ON post_performance_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_perf_captured_at ON post_performance_snapshots(captured_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_post_platform ON post_performance_snapshots(post_id, platform);

-- 2. Competitor snapshots
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid REFERENCES clients(id) ON DELETE CASCADE,
  platform            text NOT NULL,
  competitor_handle   text NOT NULL,
  followers           int DEFAULT 0,
  avg_er              numeric(5,2) DEFAULT 0,
  top_content_types   jsonb DEFAULT '{}',  -- e.g. {"video": 60, "carousel": 30, "image": 10}
  posting_frequency   numeric(4,1) DEFAULT 0,  -- posts per week
  captured_at         timestamptz DEFAULT now(),
  notes               text
);

CREATE INDEX IF NOT EXISTS idx_comp_client_id ON competitor_snapshots(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_client_handle_platform ON competitor_snapshots(client_id, competitor_handle, platform);

-- 3. Performance intelligence on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS performance_intel jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS performance_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_in_crisis boolean NOT NULL DEFAULT false;

-- 4. Patch moderation_items for Respond.io webhook integration
--    respond_io_conversation_id was NOT NULL in original schema — make it nullable
--    and add the contact/message ID columns used by the webhook + reply routes.
ALTER TABLE moderation_items
  ALTER COLUMN respond_io_conversation_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS respond_io_contact_id  text,
  ADD COLUMN IF NOT EXISTS respond_io_message_id  text;

-- Unique constraint so webhook upserts are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_respond_io_msg
  ON moderation_items (respond_io_message_id)
  WHERE respond_io_message_id IS NOT NULL;

-- 5. RLS: same policies as other tables (service role full access, users read own client data)
ALTER TABLE post_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots       ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by API routes)
CREATE POLICY "service_role_all_perf" ON post_performance_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_comp" ON competitor_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "authed_read_perf" ON post_performance_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authed_read_comp" ON competitor_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');
