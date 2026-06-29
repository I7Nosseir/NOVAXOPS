-- Step 1: Run this first, then click Run again for Step 2.
-- PostgreSQL requires the enum addition to be committed before it can be referenced.

-- STEP 1 — run alone first:
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'pending';

-- STEP 2 — run alone after Step 1 succeeds:
-- ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'pending';
