-- Personal Inspiration Library (Phase 9.6)
-- Makes client_id nullable so users can save items to their personal library
-- Items where client_id IS NULL belong to the saving user's personal board

-- client_id was already nullable (no NOT NULL in original schema).
-- FK ON DELETE CASCADE still applies to non-NULL rows only.

-- Add index for fast personal-library queries
CREATE INDEX IF NOT EXISTS inspiration_board_personal_idx
  ON inspiration_board (saved_by)
  WHERE client_id IS NULL;

-- Add published_at column for storing original content publish date
ALTER TABLE inspiration_board
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Refresh RLS policies
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
