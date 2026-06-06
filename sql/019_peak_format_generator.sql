-- ============================================================
-- 019_peak_format_generator.sql
-- Peak Creative Format Generator — DB support.
-- 1. Adds 'formats' to studio_sessions tool enum
-- 2. Creates format_favorites table (cross-session saved formats)
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- ── 1. Expand studio_sessions tool constraint ─────────────────
-- Drop old constraint, recreate with 'formats' added.
ALTER TABLE studio_sessions
  DROP CONSTRAINT IF EXISTS studio_sessions_tool_check;

ALTER TABLE studio_sessions
  ADD CONSTRAINT studio_sessions_tool_check
    CHECK (tool IN (
      'content',
      'hooks',
      'strategy',
      'campaign',
      'postmortem',
      'intel',
      'trends',
      'ads',
      'repurpose',
      'formats'          -- Peak Creative Format Generator
    ));

-- ── 2. format_favorites table ─────────────────────────────────
-- Stores individual saved formats across sessions.
-- format_data is a full snapshot of the FormatResult JSON so
-- favorites survive even if the parent session is deleted.

CREATE TABLE IF NOT EXISTS format_favorites (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_by      uuid        NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  session_id    uuid                 REFERENCES studio_sessions(id) ON DELETE SET NULL,
  niche         text        NOT NULL,
  format_name   text        NOT NULL,
  format_data   jsonb       NOT NULL,   -- full FormatResult snapshot
  notes         text,
  tags          text[]      DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- Fast lookups by owner + recency (primary list view)
CREATE INDEX IF NOT EXISTS format_favorites_saved_by_idx
  ON format_favorites (saved_by, created_at DESC);

-- Filter by niche
CREATE INDEX IF NOT EXISTS format_favorites_niche_idx
  ON format_favorites (saved_by, niche);

-- Back-reference from session to its favorites
CREATE INDEX IF NOT EXISTS format_favorites_session_idx
  ON format_favorites (session_id)
  WHERE session_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE format_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_favorites" ON format_favorites;
CREATE POLICY "users_own_favorites" ON format_favorites
  FOR ALL USING (saved_by = auth.uid());

DROP POLICY IF EXISTS "admin_all_favorites" ON format_favorites;
CREATE POLICY "admin_all_favorites" ON format_favorites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'ceo', 'creative_director')
    )
  );

-- ── VERIFY ────────────────────────────────────────────────────

-- Confirm constraint was updated
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'studio_sessions_tool_check';

-- Confirm table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'format_favorites'
ORDER BY ordinal_position;
