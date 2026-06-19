-- ============================================================
-- MIGRATION 036: Org-Scoped Row Level Security
-- ============================================================
-- Run this AFTER migration 035 (organization_foundation).
-- Fully idempotent — safe to re-run at any time.
-- All table sections use IF EXISTS so missing tables are skipped.
-- ============================================================

-- ── Helper functions ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    false
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Macro: drop + create all policies for each table ─────────

DO $$ BEGIN

-- ============================================================
-- USERS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
  DROP POLICY IF EXISTS "users_read_all"    ON users;
  DROP POLICY IF EXISTS "users_read_org"    ON users;
  DROP POLICY IF EXISTS "users_update_own"  ON users;
  DROP POLICY IF EXISTS "users_admin_all"   ON users;
  DROP POLICY IF EXISTS "users_super_admin" ON users;
  DROP POLICY IF EXISTS "users_admin_manage" ON users;

  CREATE POLICY "users_read_org" ON users
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "users_update_own" ON users
    FOR UPDATE TO authenticated
    USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

  CREATE POLICY "users_admin_manage" ON users
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director'))
    );
END IF;

-- ============================================================
-- CLIENTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='clients') THEN
  DROP POLICY IF EXISTS "clients_read"   ON clients;
  DROP POLICY IF EXISTS "clients_manage" ON clients;

  CREATE POLICY "clients_read" ON clients
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "clients_manage" ON clients
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager'))
    );
END IF;

-- ============================================================
-- PROJECTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='projects') THEN
  DROP POLICY IF EXISTS "projects_read"   ON projects;
  DROP POLICY IF EXISTS "projects_manage" ON projects;

  CREATE POLICY "projects_read" ON projects
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "projects_manage" ON projects
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager','strategist'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager','strategist'))
    );
END IF;

-- ============================================================
-- TASKS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='tasks') THEN
  DROP POLICY IF EXISTS "tasks_read"            ON tasks;
  DROP POLICY IF EXISTS "tasks_insert"          ON tasks;
  DROP POLICY IF EXISTS "tasks_write"           ON tasks;
  DROP POLICY IF EXISTS "tasks_update_assigned" ON tasks;
  DROP POLICY IF EXISTS "tasks_update"          ON tasks;
  DROP POLICY IF EXISTS "tasks_delete"          ON tasks;

  CREATE POLICY "tasks_read" ON tasks
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "tasks_write" ON tasks
    FOR INSERT TO authenticated
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager','strategist'))
    );

  CREATE POLICY "tasks_update" ON tasks
    FOR UPDATE TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (assigned_to = get_my_user_id() OR get_my_role() IN ('admin','creative_director','account_manager'))
      )
    );

  CREATE POLICY "tasks_delete" ON tasks
    FOR DELETE TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director'))
    );
END IF;

-- ============================================================
-- SCHEDULED_POSTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='scheduled_posts') THEN
  DROP POLICY IF EXISTS "posts_read"   ON scheduled_posts;
  DROP POLICY IF EXISTS "posts_manage" ON scheduled_posts;

  CREATE POLICY "posts_read" ON scheduled_posts
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "posts_manage" ON scheduled_posts
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','social_manager','account_manager'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','social_manager','account_manager'))
    );
END IF;

-- ============================================================
-- MODERATION_ITEMS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='moderation_items') THEN
  DROP POLICY IF EXISTS "moderation_read"   ON moderation_items;
  DROP POLICY IF EXISTS "moderation_manage" ON moderation_items;

  CREATE POLICY "moderation_read" ON moderation_items
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "moderation_manage" ON moderation_items
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','social_manager','account_manager'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','social_manager','account_manager'))
    );
END IF;

-- ============================================================
-- ASSETS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='assets') THEN
  DROP POLICY IF EXISTS "assets_read"   ON assets;
  DROP POLICY IF EXISTS "assets_insert" ON assets;
  DROP POLICY IF EXISTS "assets_delete" ON assets;

  CREATE POLICY "assets_read" ON assets
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "assets_insert" ON assets
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "assets_delete" ON assets
    FOR DELETE TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (downloaded_by = get_my_user_id() OR get_my_role() IN ('admin','creative_director'))
      )
    );
END IF;

-- ============================================================
-- APPROVAL_REQUESTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='approval_requests') THEN
  DROP POLICY IF EXISTS "approvals_read"   ON approval_requests;
  DROP POLICY IF EXISTS "approvals_manage" ON approval_requests;

  CREATE POLICY "approvals_read" ON approval_requests
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "approvals_manage" ON approval_requests
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','creative_director','account_manager'))
    );
END IF;

-- ============================================================
-- APPROVAL_POST_STATUSES
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='approval_post_statuses') THEN
  DROP POLICY IF EXISTS "approval_post_statuses_read"   ON approval_post_statuses;
  DROP POLICY IF EXISTS "approval_post_statuses_manage" ON approval_post_statuses;

  CREATE POLICY "approval_post_statuses_read" ON approval_post_statuses
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "approval_post_statuses_manage" ON approval_post_statuses
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- DOCUMENTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='documents') THEN
  DROP POLICY IF EXISTS "documents_read"   ON documents;
  DROP POLICY IF EXISTS "documents_manage" ON documents;

  CREATE POLICY "documents_read" ON documents
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id() OR is_public = true);

  CREATE POLICY "documents_manage" ON documents
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (created_by = get_my_user_id() OR get_my_role() IN ('admin','creative_director'))
      )
    )
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- STUDIO_SESSIONS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='studio_sessions') THEN
  DROP POLICY IF EXISTS "studio_sessions_read"   ON studio_sessions;
  DROP POLICY IF EXISTS "studio_sessions_manage" ON studio_sessions;
  DROP POLICY IF EXISTS "studio_sessions_write"  ON studio_sessions;

  CREATE POLICY "studio_sessions_read" ON studio_sessions
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "studio_sessions_manage" ON studio_sessions
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (created_by = get_my_user_id() OR get_my_role() IN ('admin','creative_director'))
      )
    )
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- TASK_COMMENTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='task_comments') THEN
  DROP POLICY IF EXISTS "task_comments_read"   ON task_comments;
  DROP POLICY IF EXISTS "task_comments_manage" ON task_comments;
  DROP POLICY IF EXISTS "task_comments_write"  ON task_comments;
  DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
  DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;

  CREATE POLICY "task_comments_read" ON task_comments
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "task_comments_write" ON task_comments
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "task_comments_update" ON task_comments
    FOR UPDATE TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND (user_id = get_my_user_id() OR get_my_role() = 'admin'))
    );

  CREATE POLICY "task_comments_delete" ON task_comments
    FOR DELETE TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND (user_id = get_my_user_id() OR get_my_role() IN ('admin','creative_director')))
    );
END IF;

-- ============================================================
-- AI_RESPONSES
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='ai_responses') THEN
  DROP POLICY IF EXISTS "ai_responses_read"   ON ai_responses;
  DROP POLICY IF EXISTS "ai_responses_manage" ON ai_responses;
  DROP POLICY IF EXISTS "ai_responses_insert" ON ai_responses;

  CREATE POLICY "ai_responses_read" ON ai_responses
    FOR SELECT TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id());

  CREATE POLICY "ai_responses_insert" ON ai_responses
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- API_USAGE
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='api_usage') THEN
  DROP POLICY IF EXISTS "api_usage_read"   ON api_usage;
  DROP POLICY IF EXISTS "api_usage_insert" ON api_usage;

  CREATE POLICY "api_usage_read" ON api_usage
    FOR SELECT TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (user_id = get_my_user_id() OR get_my_role() IN ('admin','ceo','creative_director'))
      )
    );

  CREATE POLICY "api_usage_insert" ON api_usage
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- AUDIT_LOG
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='audit_log') THEN
  DROP POLICY IF EXISTS "audit_read" ON audit_log;

  CREATE POLICY "audit_read" ON audit_log
    FOR SELECT TO authenticated
    USING (
      is_super_admin()
      OR (
        organization_id = get_my_org_id()
        AND (user_id = get_my_user_id() OR get_my_role() IN ('admin','ceo'))
      )
    );
END IF;

-- ============================================================
-- AI_FEEDBACK
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='ai_feedback') THEN
  DROP POLICY IF EXISTS "ai_feedback_read"   ON ai_feedback;
  DROP POLICY IF EXISTS "ai_feedback_manage" ON ai_feedback;
  DROP POLICY IF EXISTS "ai_feedback_org"    ON ai_feedback;

  CREATE POLICY "ai_feedback_org" ON ai_feedback
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- CLIENT_CONTEXT_BANK
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='client_context_bank') THEN
  DROP POLICY IF EXISTS "context_bank_read"   ON client_context_bank;
  DROP POLICY IF EXISTS "context_bank_manage" ON client_context_bank;
  DROP POLICY IF EXISTS "context_bank_org"    ON client_context_bank;

  CREATE POLICY "context_bank_org" ON client_context_bank
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- CEO_CONTEXT
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='ceo_context') THEN
  DROP POLICY IF EXISTS "ceo_context_read"   ON ceo_context;
  DROP POLICY IF EXISTS "ceo_context_manage" ON ceo_context;
  DROP POLICY IF EXISTS "ceo_context_org"    ON ceo_context;

  CREATE POLICY "ceo_context_org" ON ceo_context
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','ceo','creative_director'))
    )
    WITH CHECK (
      is_super_admin()
      OR (organization_id = get_my_org_id() AND get_my_role() IN ('admin','ceo','creative_director'))
    );
END IF;

-- ============================================================
-- POST_PERFORMANCE_SNAPSHOTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='post_performance_snapshots') THEN
  DROP POLICY IF EXISTS "perf_snapshots_read"   ON post_performance_snapshots;
  DROP POLICY IF EXISTS "perf_snapshots_manage" ON post_performance_snapshots;
  DROP POLICY IF EXISTS "perf_snapshots_org"    ON post_performance_snapshots;

  CREATE POLICY "perf_snapshots_org" ON post_performance_snapshots
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- COMPETITOR_TRACKING / COMPETITOR_SNAPSHOTS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='competitor_tracking') THEN
  DROP POLICY IF EXISTS "competitor_tracking_read"   ON competitor_tracking;
  DROP POLICY IF EXISTS "competitor_tracking_manage" ON competitor_tracking;
  DROP POLICY IF EXISTS "competitor_tracking_org"    ON competitor_tracking;

  CREATE POLICY "competitor_tracking_org" ON competitor_tracking
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='competitor_snapshots') THEN
  DROP POLICY IF EXISTS "competitor_snapshots_read"   ON competitor_snapshots;
  DROP POLICY IF EXISTS "competitor_snapshots_manage" ON competitor_snapshots;
  DROP POLICY IF EXISTS "competitor_snapshots_org"    ON competitor_snapshots;

  CREATE POLICY "competitor_snapshots_org" ON competitor_snapshots
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- INSPIRATION_BOARD
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='inspiration_board') THEN
  DROP POLICY IF EXISTS "inspiration_read"   ON inspiration_board;
  DROP POLICY IF EXISTS "inspiration_manage" ON inspiration_board;
  DROP POLICY IF EXISTS "inspiration_org"    ON inspiration_board;

  CREATE POLICY "inspiration_org" ON inspiration_board
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- FORMAT_FAVORITES
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='format_favorites') THEN
  DROP POLICY IF EXISTS "format_favorites_read"   ON format_favorites;
  DROP POLICY IF EXISTS "format_favorites_manage" ON format_favorites;
  DROP POLICY IF EXISTS "format_favorites_org"    ON format_favorites;

  CREATE POLICY "format_favorites_org" ON format_favorites
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- AI_GENERATION_CACHE
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='ai_generation_cache') THEN
  DROP POLICY IF EXISTS "ai_cache_read"   ON ai_generation_cache;
  DROP POLICY IF EXISTS "ai_cache_manage" ON ai_generation_cache;
  DROP POLICY IF EXISTS "ai_cache_org"    ON ai_generation_cache;

  CREATE POLICY "ai_cache_org" ON ai_generation_cache
    FOR ALL TO authenticated
    USING (is_super_admin() OR organization_id = get_my_org_id())
    WITH CHECK (is_super_admin() OR organization_id = get_my_org_id());
END IF;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='organizations') THEN
  DROP POLICY IF EXISTS "org_auth_select"    ON organizations;
  DROP POLICY IF EXISTS "org_service_all"    ON organizations;
  DROP POLICY IF EXISTS "org_super_admin_all" ON organizations;
  DROP POLICY IF EXISTS "org_member_read"    ON organizations;

  CREATE POLICY "org_service_all" ON organizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

  CREATE POLICY "org_super_admin_all" ON organizations
    FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

  CREATE POLICY "org_member_read" ON organizations
    FOR SELECT TO authenticated
    USING (id = get_my_org_id());
END IF;

END $$;

-- ── Indexes (idempotent) ──────────────────────────────────────

DO $$ DECLARE
  pairs TEXT[][] := ARRAY[
    ARRAY['users',                    'idx_users_org_id'],
    ARRAY['clients',                  'idx_clients_org_id'],
    ARRAY['projects',                 'idx_projects_org_id'],
    ARRAY['tasks',                    'idx_tasks_org_id'],
    ARRAY['scheduled_posts',          'idx_scheduled_posts_org_id'],
    ARRAY['moderation_items',         'idx_moderation_items_org_id'],
    ARRAY['assets',                   'idx_assets_org_id'],
    ARRAY['documents',                'idx_documents_org_id'],
    ARRAY['studio_sessions',          'idx_studio_sessions_org_id'],
    ARRAY['task_comments',            'idx_task_comments_org_id'],
    ARRAY['ai_responses',             'idx_ai_responses_org_id'],
    ARRAY['api_usage',                'idx_api_usage_org_id'],
    ARRAY['audit_log',                'idx_audit_log_org_id'],
    ARRAY['ai_feedback',              'idx_ai_feedback_org_id'],
    ARRAY['client_context_bank',      'idx_client_context_bank_org_id'],
    ARRAY['ceo_context',              'idx_ceo_context_org_id'],
    ARRAY['post_performance_snapshots','idx_post_perf_snapshots_org_id'],
    ARRAY['competitor_snapshots',     'idx_competitor_snapshots_org_id'],
    ARRAY['inspiration_board',        'idx_inspiration_board_org_id'],
    ARRAY['format_favorites',         'idx_format_favorites_org_id'],
    ARRAY['ai_generation_cache',      'idx_ai_generation_cache_org_id']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename=pair[1]) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(organization_id)', pair[2], pair[1]);
    END IF;
  END LOOP;
END $$;
