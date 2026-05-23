-- MIGRATION 003 — Per-post client notes + contact email on approval requests
-- Run in Supabase SQL editor after 002_crisis_mode_approvals.sql

-- Store the client's per-post revision note
ALTER TABLE public.approval_post_statuses
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

-- Store the client contact email so we can re-use it when sending the decision email
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS notify_email TEXT;
