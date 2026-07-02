-- 040_learning_loop.sql
-- Adds columns needed for the nightly performance learning loop
-- and extends client_context_bank category CHECK constraint.
-- Run in Supabase SQL editor.

-- Add new columns to client_context_bank (idempotent)
ALTER TABLE client_context_bank
  ADD COLUMN IF NOT EXISTS source           TEXT        DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score INT         DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_review     BOOLEAN     DEFAULT FALSE;

-- Extend CHECK constraint to allow learning-loop categories.
-- Drop by auto-generated name (created when the table was defined inline).
DO $$
BEGIN
  BEGIN
    ALTER TABLE client_context_bank
      DROP CONSTRAINT client_context_bank_category_check;
  EXCEPTION WHEN OTHERS THEN
    -- Constraint may not exist or may have a different auto-generated name — safe to continue.
    NULL;
  END;
END$$;

ALTER TABLE client_context_bank
  ADD CONSTRAINT client_context_bank_category_check
  CHECK (category IN (
    'Client Instructions',
    'Brand Update',
    'Campaign Feedback',
    'Market Intel',
    'Meeting Notes',
    'Competitor Intel',
    'Performance Win',
    'Performance Loss'
  ));

-- Index to make learning-loop cleanup queries fast
CREATE INDEX IF NOT EXISTS context_bank_source_expires_idx
  ON client_context_bank (source, expires_at)
  WHERE source = 'learning_loop';
