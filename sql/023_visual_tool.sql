-- ============================================================
-- 023_visual_tool.sql
-- Adds 'visual' to the studio_sessions tool constraint so
-- Visual Content Engine sessions can be saved to the DB.
-- Safe to re-run (idempotent constraint replace).
-- ============================================================

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
      'formats',
      'visual',
      'intel',
      'trends',
      'ads',
      'repurpose'
    ));

-- Verify
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'studio_sessions_tool_check';
