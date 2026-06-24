-- Migration 038: Super Admin setup + org backfill
-- Safe to re-run. Only modifies:
--   1. Backfills organization_id NULLs → NOVAX
--   2. Grants is_super_admin to platform owner
-- Run in Supabase SQL Editor.

-- ── Ensure NOVAX org exists ───────────────────────────────────
INSERT INTO organizations (name, slug, plan, status, max_clients, max_users, ai_calls_per_month)
VALUES ('NOVAX', 'novax', 'scale', 'active', 9999, 9999, 9999999)
ON CONFLICT (slug) DO NOTHING;

-- ── Ensure is_super_admin column exists (idempotent) ─────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Backfill all users whose organization_id is still NULL ───
-- (Covers cases where migration 035 ran before some users were created)
DO $$
DECLARE
  novax_id  UUID;
  row_count BIGINT;
BEGIN
  SELECT id INTO novax_id FROM organizations WHERE slug = 'novax';
  IF novax_id IS NULL THEN
    RAISE WARNING 'NOVAX org not found — run migration 035 first, then re-run 038';
    RETURN;
  END IF;

  UPDATE users SET organization_id = novax_id WHERE organization_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % user(s) → NOVAX org (%)', row_count, novax_id;
END $$;

-- ── Mark platform super admin ─────────────────────────────────
UPDATE users
SET is_super_admin = true
WHERE auth_id IN (
  SELECT id FROM auth.users WHERE email = 'ismailnosseir7@gmail.com'
);

-- ── Verify ────────────────────────────────────────────────────
SELECT
  u.name,
  u.email,
  u.role,
  u.is_super_admin,
  o.name  AS org_name,
  o.slug  AS org_slug
FROM   users u
LEFT   JOIN organizations o ON o.id = u.organization_id
ORDER  BY u.is_super_admin DESC, u.name;
