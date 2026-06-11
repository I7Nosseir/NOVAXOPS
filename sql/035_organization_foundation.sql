-- Migration 035: Multi-Tenant Organization Foundation
-- Phase 1A — organizations table + NOVAX seed org
-- Phase 1B — organization_id added to all 25 core tables (backfilled, NOT NULL, indexed)
-- Phase 1C — get_my_org_id() helper function for future RLS policies
-- Phase 1D — is_super_admin column on users
--
-- SAFE TO RE-RUN — all statements are idempotent.
-- Run in Supabase SQL Editor. No data is deleted.
--
-- After running, verify with:
--   SELECT id, slug, plan FROM organizations;
--   SELECT COUNT(*) FROM users WHERE organization_id IS NULL;

-- ══════════════════════════════════════════════════════════════
-- 1. ORGANIZATIONS TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT        NOT NULL,
  slug                    TEXT        UNIQUE NOT NULL,
  plan                    TEXT        NOT NULL DEFAULT 'trial'
                            CHECK (plan IN ('trial', 'starter', 'growth', 'scale')),
  status                  TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'cancelled')),
  -- Social publishing (Postiz — future)
  postiz_workspace_id     TEXT,
  -- Comment moderation (Chatwoot — future)
  chatwoot_account_id     INTEGER,
  -- Stripe billing (future)
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  stripe_price_id         TEXT,
  -- Trial window
  trial_ends_at           TIMESTAMPTZ,
  -- Plan limits (denormalized for fast enforcement — no JOIN needed)
  max_clients             INTEGER     NOT NULL DEFAULT 5,
  max_users               INTEGER     NOT NULL DEFAULT 5,
  ai_calls_per_month      INTEGER     NOT NULL DEFAULT 500,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_service_all" ON organizations;
DROP POLICY IF EXISTS "org_auth_select" ON organizations;
CREATE POLICY "org_service_all" ON organizations FOR ALL       TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "org_auth_select" ON organizations FOR SELECT    TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 2. SUPER ADMIN FLAG ON USERS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════
-- 3. NOVAX FOUNDING ORG SEED
-- On conflict (re-run) → do nothing, slug is unique
-- ══════════════════════════════════════════════════════════════

INSERT INTO organizations (name, slug, plan, status, max_clients, max_users, ai_calls_per_month)
VALUES ('NOVAX', 'novax', 'scale', 'active', 9999, 9999, 9999999)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 4. ADD organization_id COLUMN TO ALL 25 TABLES
-- Uses a loop with table-existence checks — safe for any schema state.
-- Skips tables that don't exist and logs a NOTICE instead of erroring.
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  novax_id UUID;
  tbl      TEXT;
  tables   TEXT[] := ARRAY[
    'users',
    'clients',
    'projects',
    'tasks',
    'scheduled_posts',
    'moderation_items',
    'approval_requests',
    'approval_post_statuses',
    'assets',
    'documents',
    'studio_sessions',
    'post_performance_snapshots',
    'competitor_snapshots',
    'competitor_intelligence_reports',
    'audit_log',
    'ai_responses',
    'api_usage',
    'ai_feedback',
    'client_context_bank',
    'inspiration_board',
    'format_favorites',
    'task_comments',
    'ceo_context',
    'ai_generation_cache'
  ];
  -- arabic_knowledge_base is handled separately (stays nullable — NULL = global rule)
BEGIN
  -- Resolve NOVAX org ID
  SELECT id INTO novax_id FROM organizations WHERE slug = 'novax';
  IF novax_id IS NULL THEN
    RAISE EXCEPTION 'NOVAX org not found — did step 3 run?';
  END IF;

  RAISE NOTICE 'NOVAX org ID: %', novax_id;

  -- Loop through every table
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      -- Add column (idempotent)
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE',
        tbl
      );
      -- Backfill NULLs with NOVAX org
      EXECUTE format(
        'UPDATE %I SET organization_id = $1 WHERE organization_id IS NULL',
        tbl
      ) USING novax_id;
      RAISE NOTICE 'OK: %', tbl;
    ELSE
      RAISE NOTICE 'SKIPPED (table not found): %', tbl;
    END IF;
  END LOOP;

  -- arabic_knowledge_base: separate handling — nullable (NULL = global rules)
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'arabic_knowledge_base'
  ) THEN
    EXECUTE 'ALTER TABLE arabic_knowledge_base ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE';
    -- Do NOT backfill — NULL means global, applicable to all orgs
    RAISE NOTICE 'OK (nullable): arabic_knowledge_base';
  ELSE
    RAISE NOTICE 'SKIPPED (table not found): arabic_knowledge_base';
  END IF;

END $$;

-- ══════════════════════════════════════════════════════════════
-- 5. ENFORCE NOT NULL (after backfill)
-- Skips any table that still has NULL rows (logs warning instead of error).
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl        TEXT;
  null_count BIGINT;
  tables     TEXT[] := ARRAY[
    'users', 'clients', 'projects', 'tasks', 'scheduled_posts',
    'moderation_items', 'approval_requests', 'approval_post_statuses',
    'assets', 'documents', 'studio_sessions', 'post_performance_snapshots',
    'competitor_snapshots', 'competitor_intelligence_reports',
    'audit_log', 'ai_responses', 'api_usage', 'ai_feedback',
    'client_context_bank', 'inspiration_board', 'format_favorites',
    'task_comments', 'ceo_context', 'ai_generation_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      -- Check for any remaining NULLs before adding NOT NULL
      EXECUTE format(
        'SELECT COUNT(*) FROM %I WHERE organization_id IS NULL',
        tbl
      ) INTO null_count;

      IF null_count = 0 THEN
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL',
          tbl
        );
        RAISE NOTICE 'NOT NULL set: %', tbl;
      ELSE
        RAISE WARNING 'SKIPPED NOT NULL on % — % rows still NULL (backfill incomplete?)', tbl, null_count;
      END IF;
    END IF;
  END LOOP;
  -- arabic_knowledge_base intentionally stays nullable
END $$;

-- ══════════════════════════════════════════════════════════════
-- 6. INDEXES (critical for RLS performance)
-- Without these, every query does a full table scan through RLS.
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_org_id                  ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id                ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id               ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id                  ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_org_id        ON scheduled_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_id                 ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id              ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_org_id        ON studio_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id              ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_org_id            ON ai_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_context_bank_org_id    ON client_context_bank(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org_id          ON task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_format_favorites_org_id       ON format_favorites(organization_id);
CREATE INDEX IF NOT EXISTS idx_inspiration_board_org_id      ON inspiration_board(organization_id);
CREATE INDEX IF NOT EXISTS idx_arabic_knowledge_base_org_id  ON arabic_knowledge_base(organization_id);

-- Conditional indexes (tables may not exist)
DO $$
DECLARE
  pairs TEXT[][] := ARRAY[
    ARRAY['moderation_items',                'idx_moderation_items_org_id'],
    ARRAY['approval_requests',               'idx_approval_requests_org_id'],
    ARRAY['approval_post_statuses',          'idx_approval_post_statuses_org_id'],
    ARRAY['post_performance_snapshots',      'idx_post_perf_snapshots_org_id'],
    ARRAY['competitor_snapshots',            'idx_competitor_snapshots_org_id'],
    ARRAY['competitor_intelligence_reports', 'idx_comp_intel_reports_org_id'],
    ARRAY['ai_responses',                    'idx_ai_responses_org_id'],
    ARRAY['api_usage',                       'idx_api_usage_org_id'],
    ARRAY['ceo_context',                     'idx_ceo_context_org_id'],
    ARRAY['ai_generation_cache',             'idx_ai_generation_cache_org_id']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = pair[1]) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I(organization_id)',
        pair[2], pair[1]
      );
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 7. get_my_org_id() HELPER FUNCTION
-- Used by future RLS policies to scope queries to the calling user's org.
-- Returns the organization_id of the currently authenticated user.
-- Pattern: USING (organization_id = get_my_org_id())
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 8. VERIFY
-- Run these selects after the migration to confirm everything worked.
-- ══════════════════════════════════════════════════════════════

-- SELECT id, name, slug, plan, status, max_clients, max_users, ai_calls_per_month FROM organizations;
-- SELECT COUNT(*) AS users_without_org FROM users WHERE organization_id IS NULL;
-- SELECT COUNT(*) AS clients_without_org FROM clients WHERE organization_id IS NULL;
-- SELECT COUNT(*) AS tasks_without_org FROM tasks WHERE organization_id IS NULL;
-- SELECT get_my_org_id();  -- Run as authenticated user — should return NOVAX org UUID
