-- Migration 027: Approval Request Items
-- Phase 5 — Approval Page Redesign
-- Adds per-row items to approval_requests so each post can have its own
-- media, caption, and status inside a single approval request.
-- Safe to re-run (all idempotent)

-- Add items column if it doesn't exist
-- Each item shape: { id, post_id?, media_url?, caption, status, client_notes, sort_order }
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]';

-- Track the last time the client submitted the approval form
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS client_submitted_at timestamptz;

-- Human-readable summary returned from client portal (e.g. "3 approved, 1 needs changes")
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS client_submission_summary text;

NOTIFY pgrst, 'reload schema';
