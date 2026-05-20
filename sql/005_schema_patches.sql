-- ============================================================
-- 005_schema_patches.sql
-- Safe incremental patches — run in Supabase SQL Editor
-- All statements guard against re-runs
-- ============================================================

-- 1. Add 'ceo' to user_role enum
--    types.ts has it, initial schema was missing it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ceo'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'ceo' AFTER 'admin';
  END IF;
END$$;

-- 2. Add crisis_mode to clients
--    UI uses this flag to pause publishing; initial schema was missing it
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS crisis_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Ensure scheduled_posts columns exist
--    These should already be in 001 — this is a safe no-op if they are

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS metricool_post_id TEXT;

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Add unique constraint on metricool_post_id if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'scheduled_posts'
      AND constraint_name = 'scheduled_posts_metricool_post_id_key'
  ) THEN
    ALTER TABLE public.scheduled_posts
      ADD CONSTRAINT scheduled_posts_metricool_post_id_key UNIQUE (metricool_post_id);
  END IF;
END$$;

-- 4. Ensure clients Metricool/Respond.io columns exist
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS metricool_blog_id TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS respond_io_channel_id TEXT;

-- 5. Backfill metricool_blog_id for any clients missing it
--    One Metricool account → one blogId for the entire agency
UPDATE public.clients
SET metricool_blog_id = '6276264'
WHERE metricool_blog_id IS NULL;

-- 6. Update RLS policy to allow service role to update crisis_mode
--    (service role bypasses RLS by default, this is just a reminder)

-- ============================================================
-- VERIFICATION — run these SELECT statements to confirm
-- ============================================================

-- Check client columns
SELECT
  id,
  name,
  crisis_mode,
  metricool_blog_id,
  status
FROM public.clients
ORDER BY name;

-- Check scheduled_posts columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scheduled_posts'
ORDER BY ordinal_position;

-- Check enum values
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;
