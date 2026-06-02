-- Inspiration Board table
-- Safe to run even if partially applied (IF NOT EXISTS throughout)

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

-- Indexes
CREATE INDEX IF NOT EXISTS inspiration_board_client_idx   ON inspiration_board (client_id);
CREATE INDEX IF NOT EXISTS inspiration_board_saved_by_idx ON inspiration_board (saved_by);

-- RLS
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
