-- ============================================================
-- MIGRATION 002 — Crisis Mode + Approval Portal
-- Run in Supabase SQL editor after 001_initial_schema.sql
-- ============================================================

-- Phase B: crisis_mode column on clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS crisis_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Phase C: Approval Portal tables
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  token        TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  post_ids     UUID[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | approved | changes_requested
  client_note  TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.approval_post_statuses (
  request_id  UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | changes_requested
  PRIMARY KEY (request_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_token    ON public.approval_requests (token);
CREATE INDEX IF NOT EXISTS idx_approval_requests_client   ON public.approval_requests (client_id);
CREATE INDEX IF NOT EXISTS idx_approval_post_statuses_req ON public.approval_post_statuses (request_id);

ALTER TABLE public.approval_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_post_statuses ENABLE ROW LEVEL SECURITY;

-- Public read by token (no auth — client-facing portal)
CREATE POLICY "approval_requests_public_read"
  ON public.approval_requests FOR SELECT USING (true);

CREATE POLICY "approval_post_statuses_public_read"
  ON public.approval_post_statuses FOR SELECT USING (true);

CREATE POLICY "approval_post_statuses_public_update"
  ON public.approval_post_statuses FOR UPDATE USING (true);

-- Only authenticated users can create approval requests
CREATE POLICY "approval_requests_auth_insert"
  ON public.approval_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can update approval requests (overall status)
CREATE POLICY "approval_requests_auth_update"
  ON public.approval_requests FOR UPDATE
  USING (auth.role() = 'authenticated');
