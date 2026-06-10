-- Migration 031: User Activity Tracking
-- Phase 11 — User Tracking / Security
-- Tracks page visits, button clicks, and API calls per user.
-- Safe to re-run (all idempotent)

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,    -- 'page_view' | 'button_click' | 'api_call'
  page        text,
  action      text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id  ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created  ON public.user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type     ON public.user_activity_log(event_type);

-- Keep only 90 days of activity (run via cron cleanup)
-- CREATE INDEX IF NOT EXISTS idx_activity_cleanup ON public.user_activity_log(created_at)
--   WHERE created_at < now() - interval '90 days';

-- Add last_seen_at to users for live status
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_at   timestamptz,
  ADD COLUMN IF NOT EXISTS current_page   text;

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_activity" ON public.user_activity_log
  FOR ALL USING (auth.role() = 'service_role');

-- Admins and CEOs can read all activity
CREATE POLICY "admin_read_activity" ON public.user_activity_log
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'ceo')
    )
  );

NOTIFY pgrst, 'reload schema';
