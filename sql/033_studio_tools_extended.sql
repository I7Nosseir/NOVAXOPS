-- ============================================================
-- 033_studio_tools_extended.sql
-- Extend the studio_sessions tool check constraint to include
-- all active tools: visual, formats, copy, competitive, media_buying.
-- Run in Supabase SQL editor.
-- ============================================================

-- Drop old constraint (safe — idempotent)
ALTER TABLE studio_sessions DROP CONSTRAINT IF EXISTS studio_sessions_tool_check;

-- Add updated constraint with all active tool names
ALTER TABLE studio_sessions
  ADD CONSTRAINT studio_sessions_tool_check
    CHECK (tool IN (
      'content',
      'hooks',
      'strategy',
      'campaign',
      'postmortem',
      'visual',
      'formats',
      'copy',
      'competitive',
      'media_buying',
      'intel',
      'trends',
      'ads',
      'repurpose'
    ));

-- Verify
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'studio_sessions_tool_check';
