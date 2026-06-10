-- Migration 030: Personal Inspiration Library
-- Phase 9 — Inspiration Library Overhaul
-- Per-user private saved content. Not tied to any client.
-- Safe to re-run (all idempotent)

CREATE TABLE IF NOT EXISTS public.personal_inspiration (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url              text        NOT NULL,
  platform         text,                               -- instagram, tiktok, youtube, etc.
  thumbnail_url    text,
  caption          text,
  author_handle    text,
  views            bigint      NOT NULL DEFAULT 0,
  likes            bigint      NOT NULL DEFAULT 0,
  comments         bigint      NOT NULL DEFAULT 0,
  engagement_rate  numeric(6,2) NOT NULL DEFAULT 0,
  published_at     timestamptz,
  notes            text,                               -- user's personal notes
  saved_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_inspiration_user ON public.personal_inspiration(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_inspiration_saved ON public.personal_inspiration(saved_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_inspiration_user_url ON public.personal_inspiration(user_id, url);

ALTER TABLE public.personal_inspiration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_personal_inspo" ON public.personal_inspiration
  FOR ALL USING (auth.role() = 'service_role');

-- Users can only access their own saved items
CREATE POLICY "users_own_personal_inspo" ON public.personal_inspiration
  FOR ALL USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
