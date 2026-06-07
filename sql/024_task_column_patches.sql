-- Migration 024: Fix tasks table schema to match application code
-- Run in Supabase SQL Editor (safe to re-run — all statements are idempotent)

-- 1. Add final_submission column (referenced in types + create-task-dialog but never migrated)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS final_submission TEXT;

-- 2. Add seen/read tracking columns (referenced in mapTask and Task type but never migrated)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seen_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS read_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Make project_id nullable — tasks don't always belong to a project
--    The original schema had NOT NULL but the UI allows no-project tasks
ALTER TABLE public.tasks
  ALTER COLUMN project_id DROP NOT NULL;

-- 4. Make due_date nullable — the UI allows tasks with no due date
ALTER TABLE public.tasks
  ALTER COLUMN due_date DROP NOT NULL;

-- 5. Reload PostgREST schema cache so the new columns are immediately visible
--    (prevents the 400 on GET /rest/v1/tasks?select=* from stale cache)
NOTIFY pgrst, 'reload schema';
