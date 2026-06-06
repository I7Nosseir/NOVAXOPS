-- 021_client_context_bank.sql
-- Per-client living text memory injected into every AI call for that client.

CREATE TABLE IF NOT EXISTS client_context_bank (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category     text NOT NULL DEFAULT 'Meeting Notes'
               CHECK (category IN ('Client Instructions','Brand Update','Campaign Feedback','Market Intel','Meeting Notes','Competitor Intel')),
  summary      text NOT NULL DEFAULT '',
  full_text    text NOT NULL DEFAULT '',
  source_type  text NOT NULL DEFAULT 'manual'
               CHECK (source_type IN ('manual','document','studio','feedback')),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  is_active    bool DEFAULT true
);

CREATE INDEX IF NOT EXISTS context_bank_client_idx
  ON client_context_bank (client_id, is_active, created_at DESC);

ALTER TABLE client_context_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_context_bank" ON client_context_bank;
CREATE POLICY "authenticated_manage_context_bank" ON client_context_bank
  FOR ALL USING (auth.role() = 'authenticated');
