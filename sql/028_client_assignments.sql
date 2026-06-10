-- Migration 028: Client Assignment System
-- Phase 6 — Client Assignment System
-- Maps users to specific clients. Admin/CEO/Creative Director are always unfiltered.
-- Safe to re-run (all idempotent)

CREATE TABLE IF NOT EXISTS public.client_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_user ON public.client_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON public.client_assignments(client_id);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_assignments" ON public.client_assignments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authed_read_assignments" ON public.client_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
