-- Migration 029: System-Wide Settings
-- Phase 7 — Context Bank / CEO Intelligence / AI Kill Switch
-- Phase 10 — Google Drive Global Connection
-- Safe to re-run (all idempotent)

CREATE TABLE IF NOT EXISTS public.system_settings (
  key          text        PRIMARY KEY,
  value        jsonb       NOT NULL DEFAULT 'null',
  updated_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only service role reads/writes settings (all API routes use service role)
CREATE POLICY "service_role_all_settings" ON public.system_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read non-sensitive settings
CREATE POLICY "authed_read_settings" ON public.system_settings
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND key NOT IN ('google_drive_tokens')  -- sensitive keys hidden from client
  );

-- Seed default values
INSERT INTO public.system_settings (key, value) VALUES
  ('ai_enabled',          'true'),
  ('google_drive_tokens', 'null'),
  ('google_drive_email',  'null')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
