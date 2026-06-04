-- Migration 002: per-user page access control
-- Run once in the Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS page_permissions TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.users.page_permissions IS
  'Allowed optional page keys for this user. NULL = all pages visible (default). '
  'Empty array = only required pages. Set by admin at invite time or via Settings > Team.';
