-- ============================================================
-- 018_chatwoot_migration.sql
-- Replaces Respond.io tracking columns with Chatwoot equivalents.
-- Non-destructive: old respond_io_* columns are kept as nullable dead columns.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- 1. Add Chatwoot conversation tracking columns to moderation_items
ALTER TABLE public.moderation_items
  ADD COLUMN IF NOT EXISTS chatwoot_account_id      INTEGER,
  ADD COLUMN IF NOT EXISTS chatwoot_conversation_id INTEGER,
  ADD COLUMN IF NOT EXISTS chatwoot_message_id      INTEGER,
  ADD COLUMN IF NOT EXISTS chatwoot_contact_id      INTEGER,
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id        INTEGER;

-- 2. Unique partial index for dedup (mirrors respond_io_message_id pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_chatwoot_message
  ON public.moderation_items (chatwoot_message_id)
  WHERE chatwoot_message_id IS NOT NULL;

-- 3. Index on conversation_id for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_moderation_chatwoot_conversation
  ON public.moderation_items (chatwoot_conversation_id)
  WHERE chatwoot_conversation_id IS NOT NULL;

-- 4. Add chatwoot_inbox_id to clients (maps each client to their Chatwoot inbox)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id INTEGER;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'moderation_items'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN ('chatwoot_inbox_id', 'respond_io_channel_id');
