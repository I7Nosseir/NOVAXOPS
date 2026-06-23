-- Migration 026c: Create assistant_chats with correct RLS (replaces 026 + 026b)
-- Safe to re-run (all idempotent).
-- NOTE: auth.uid() = public.users.auth_id, NOT public.users.id.
-- user_id references public.users(id), so RLS must resolve via auth_id.

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_chats TO service_role;

-- Drop old policies before recreating (idempotent)
DROP POLICY IF EXISTS "users_own_chats"        ON public.assistant_chats;
DROP POLICY IF EXISTS "service_role_all_chats"  ON public.assistant_chats;

CREATE POLICY "service_role_all_chats" ON public.assistant_chats
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "users_own_chats" ON public.assistant_chats
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

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
