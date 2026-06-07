-- ============================================================
-- 024_enable_realtime.sql
-- Adds the tables that need live updates to the
-- supabase_realtime Postgres publication.
-- Idempotent: safe to re-run (checks before adding).
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tasks',
    'approval_requests',
    'approval_post_statuses',
    'moderation_items',
    'audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    ELSE
      RAISE NOTICE '% already in supabase_realtime — skipped', t;
    END IF;
  END LOOP;
END $$;

-- Verify: should show all 5 tables
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
