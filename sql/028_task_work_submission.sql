-- Add work_submission column to tasks
-- This is where the assignee submits their deliverable (URL, text, or description)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS work_submission TEXT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
