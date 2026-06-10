-- Migration 025: Ensure all task columns referenced in app code exist
-- Safe to re-run (all idempotent)

-- final_submission: shown in create-task-dialog and task-detail-panel
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS final_submission TEXT;

-- linked_doc_ids: document attachments on a task
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_doc_ids UUID[] DEFAULT '{}';

-- seen/read tracking used in mapTask
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS seen_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS read_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop NOT NULL on project_id and due_date — the UI allows tasks without these
ALTER TABLE public.tasks
  ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.tasks
  ALTER COLUMN due_date DROP NOT NULL;

-- Reload PostgREST schema cache so changes are immediately visible
NOTIFY pgrst, 'reload schema';
