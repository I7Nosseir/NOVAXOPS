-- Patch for migration 026: grant table access to authenticated role.
-- Tables created via raw SQL in Supabase do not auto-grant permissions.
-- Run this in Supabase SQL Editor if /assistant shows a 403 error.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_chats TO service_role;

-- Also make the INSERT RLS policy explicit with WITH CHECK
-- (FOR ALL USING alone can block inserts on some Supabase versions)
DROP POLICY IF EXISTS "users_own_chats" ON public.assistant_chats;

CREATE POLICY "users_own_chats" ON public.assistant_chats
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
