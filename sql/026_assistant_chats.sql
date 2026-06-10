-- Migration 026: Persistent AI Assistant Chats
-- Phase 3 — AI Assistant Overhaul
-- Safe to re-run (all idempotent)

CREATE TABLE IF NOT EXISTS public.assistant_chats (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'New Chat',
  messages     jsonb       NOT NULL DEFAULT '[]',
  client_id    uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  task_id      uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_chats_user_id ON public.assistant_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_chats_updated ON public.assistant_chats(updated_at DESC);

ALTER TABLE public.assistant_chats ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_all_chats" ON public.assistant_chats
  FOR ALL USING (auth.role() = 'service_role');

-- Users can only access their own chats
CREATE POLICY "users_own_chats" ON public.assistant_chats
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistant_chats_updated_at ON public.assistant_chats;
CREATE TRIGGER assistant_chats_updated_at
  BEFORE UPDATE ON public.assistant_chats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
