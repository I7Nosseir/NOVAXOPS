-- Migration 023: competitor_post_samples
-- Stores scraped post samples per competitor per client.
-- Used by the Competitor Intelligence studio tool for gap analysis.

CREATE TABLE IF NOT EXISTS competitor_post_samples (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competitor_handle TEXT          NOT NULL,
  platform          TEXT          NOT NULL,
  post_url          TEXT,
  content_type      TEXT          CHECK (content_type IN ('reel', 'carousel', 'static', 'story', 'video', 'other')),
  caption           TEXT,
  hook_text         TEXT,
  likes             INT           DEFAULT 0,
  comments          INT           DEFAULT 0,
  views             INT           DEFAULT 0,
  shares            INT           DEFAULT 0,
  engagement_rate   NUMERIC(6,2)  DEFAULT 0,
  posted_at         TIMESTAMPTZ,
  scraped_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_posts_client   ON competitor_post_samples(client_id);
CREATE INDEX IF NOT EXISTS idx_comp_posts_handle   ON competitor_post_samples(client_id, competitor_handle);
CREATE INDEX IF NOT EXISTS idx_comp_posts_platform ON competitor_post_samples(platform);

ALTER TABLE competitor_post_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_023"  ON competitor_post_samples FOR ALL       TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_023"    ON competitor_post_samples FOR SELECT     TO authenticated USING (true);
