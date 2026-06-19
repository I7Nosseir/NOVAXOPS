-- ============================================================
-- MIGRATION 036: Org-Scoped Row Level Security
-- ============================================================
-- Run this AFTER migration 035 (organization_foundation).
-- Adds organization isolation to every data table.
-- Super admins (is_super_admin = true) bypass org filters
-- and can see all data across all orgs.
-- ============================================================

-- ── Helper: check if the calling user is a super admin ───────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    false
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Updated get_my_org_id — returns NULL for super admins (bypasses WHERE filter) ──
-- Note: we DON'T return NULL for super admins here because that would break
-- "organization_id = get_my_org_id()" which evaluates NULL = NULL as false.
-- Instead we use separate super admin policies.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USERS TABLE
-- ============================================================
DROP POLICY IF EXISTS "users_read_all" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_admin_all" ON users;
DROP POLICY IF EXISTS "users_super_admin" ON users;

CREATE POLICY "users_read_org" ON users
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "users_admin_manage" ON users
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director')
    )
  );

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "clients_read" ON clients;
DROP POLICY IF EXISTS "clients_manage" ON clients;

CREATE POLICY "clients_read" ON clients
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "clients_manage" ON clients
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager')
    )
  );

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "projects_read" ON projects;
DROP POLICY IF EXISTS "projects_manage" ON projects;

CREATE POLICY "projects_read" ON projects
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "projects_manage" ON projects
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist')
    )
  );

-- ============================================================
-- TASKS TABLE
-- ============================================================
DROP POLICY IF EXISTS "tasks_read" ON tasks;
DROP POLICY IF EXISTS "tasks_update_assigned" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

CREATE POLICY "tasks_read" ON tasks
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "tasks_write" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist')
    )
  );

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        assigned_to = get_my_user_id()
        OR get_my_role() IN ('admin', 'creative_director', 'account_manager')
      )
    )
  );

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director')
    )
  );

-- ============================================================
-- SCHEDULED_POSTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "posts_read" ON scheduled_posts;
DROP POLICY IF EXISTS "posts_manage" ON scheduled_posts;

CREATE POLICY "posts_read" ON scheduled_posts
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "posts_manage" ON scheduled_posts
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager')
    )
  );

-- ============================================================
-- MODERATION_ITEMS TABLE
-- ============================================================
DROP POLICY IF EXISTS "moderation_read" ON moderation_items;
DROP POLICY IF EXISTS "moderation_manage" ON moderation_items;

CREATE POLICY "moderation_read" ON moderation_items
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "moderation_manage" ON moderation_items
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager')
    )
  );

-- ============================================================
-- ASSETS TABLE
-- ============================================================
DROP POLICY IF EXISTS "assets_read" ON assets;
DROP POLICY IF EXISTS "assets_insert" ON assets;
DROP POLICY IF EXISTS "assets_delete" ON assets;

CREATE POLICY "assets_read" ON assets
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "assets_insert" ON assets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "assets_delete" ON assets
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        downloaded_by = get_my_user_id()
        OR get_my_role() IN ('admin', 'creative_director')
      )
    )
  );

-- ============================================================
-- APPROVAL_REQUESTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "approvals_read" ON approval_requests;
DROP POLICY IF EXISTS "approvals_manage" ON approval_requests;

CREATE POLICY "approvals_read" ON approval_requests
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "approvals_manage" ON approval_requests
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'creative_director', 'account_manager')
    )
  );

-- ============================================================
-- APPROVAL_POST_STATUSES TABLE
-- ============================================================
DROP POLICY IF EXISTS "approval_post_statuses_read" ON approval_post_statuses;
DROP POLICY IF EXISTS "approval_post_statuses_manage" ON approval_post_statuses;

CREATE POLICY "approval_post_statuses_read" ON approval_post_statuses
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "approval_post_statuses_manage" ON approval_post_statuses
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "documents_read" ON documents;
DROP POLICY IF EXISTS "documents_manage" ON documents;

CREATE POLICY "documents_read" ON documents
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
    OR is_public = true
  );

CREATE POLICY "documents_manage" ON documents
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        created_by = get_my_user_id()
        OR get_my_role() IN ('admin', 'creative_director')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- STUDIO_SESSIONS TABLE
-- ============================================================
DROP POLICY IF EXISTS "studio_sessions_read" ON studio_sessions;
DROP POLICY IF EXISTS "studio_sessions_manage" ON studio_sessions;

CREATE POLICY "studio_sessions_read" ON studio_sessions
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "studio_sessions_manage" ON studio_sessions
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        user_id = get_my_user_id()
        OR get_my_role() IN ('admin', 'creative_director')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- TASK_COMMENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "task_comments_read" ON task_comments;
DROP POLICY IF EXISTS "task_comments_manage" ON task_comments;

CREATE POLICY "task_comments_read" ON task_comments
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "task_comments_write" ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "task_comments_update" ON task_comments
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        user_id = get_my_user_id()
        OR get_my_role() = 'admin'
      )
    )
  );

CREATE POLICY "task_comments_delete" ON task_comments
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        user_id = get_my_user_id()
        OR get_my_role() IN ('admin', 'creative_director')
      )
    )
  );

-- ============================================================
-- AI_RESPONSES TABLE
-- ============================================================
DROP POLICY IF EXISTS "ai_responses_read" ON ai_responses;
DROP POLICY IF EXISTS "ai_responses_manage" ON ai_responses;

CREATE POLICY "ai_responses_read" ON ai_responses
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

CREATE POLICY "ai_responses_insert" ON ai_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- API_USAGE TABLE
-- ============================================================
DROP POLICY IF EXISTS "api_usage_read" ON api_usage;
DROP POLICY IF EXISTS "api_usage_insert" ON api_usage;

CREATE POLICY "api_usage_read" ON api_usage
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        user_id = get_my_user_id()
        OR get_my_role() IN ('admin', 'ceo', 'creative_director')
      )
    )
  );

CREATE POLICY "api_usage_insert" ON api_usage
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- AUDIT_LOG TABLE
-- ============================================================
DROP POLICY IF EXISTS "audit_read" ON audit_log;

CREATE POLICY "audit_read" ON audit_log
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND (
        user_id = get_my_user_id()
        OR get_my_role() IN ('admin', 'ceo')
      )
    )
  );

-- ============================================================
-- AI_FEEDBACK TABLE
-- ============================================================
DROP POLICY IF EXISTS "ai_feedback_read" ON ai_feedback;
DROP POLICY IF EXISTS "ai_feedback_manage" ON ai_feedback;

CREATE POLICY "ai_feedback_org" ON ai_feedback
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- CLIENT_CONTEXT_BANK TABLE
-- ============================================================
DROP POLICY IF EXISTS "context_bank_read" ON client_context_bank;
DROP POLICY IF EXISTS "context_bank_manage" ON client_context_bank;

CREATE POLICY "context_bank_org" ON client_context_bank
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- CEO_CONTEXT TABLE
-- ============================================================
DROP POLICY IF EXISTS "ceo_context_read" ON ceo_context;
DROP POLICY IF EXISTS "ceo_context_manage" ON ceo_context;

CREATE POLICY "ceo_context_org" ON ceo_context
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'ceo', 'creative_director')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      organization_id = get_my_org_id()
      AND get_my_role() IN ('admin', 'ceo', 'creative_director')
    )
  );

-- ============================================================
-- POST_PERFORMANCE_SNAPSHOTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "perf_snapshots_read" ON post_performance_snapshots;
DROP POLICY IF EXISTS "perf_snapshots_manage" ON post_performance_snapshots;

CREATE POLICY "perf_snapshots_org" ON post_performance_snapshots
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- COMPETITOR_TRACKING TABLE (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competitor_tracking') THEN
    EXECUTE 'DROP POLICY IF EXISTS "competitor_tracking_read" ON competitor_tracking';
    EXECUTE 'DROP POLICY IF EXISTS "competitor_tracking_manage" ON competitor_tracking';
    EXECUTE $policy$
      CREATE POLICY "competitor_tracking_org" ON competitor_tracking
        FOR ALL TO authenticated
        USING (is_super_admin() OR organization_id = get_my_org_id())
        WITH CHECK (is_super_admin() OR organization_id = get_my_org_id())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- INSPIRATION_BOARD TABLE
-- ============================================================
DROP POLICY IF EXISTS "inspiration_read" ON inspiration_board;
DROP POLICY IF EXISTS "inspiration_manage" ON inspiration_board;

CREATE POLICY "inspiration_org" ON inspiration_board
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- FORMAT_FAVORITES TABLE
-- ============================================================
DROP POLICY IF EXISTS "format_favorites_read" ON format_favorites;
DROP POLICY IF EXISTS "format_favorites_manage" ON format_favorites;

CREATE POLICY "format_favorites_org" ON format_favorites
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- AI_GENERATION_CACHE TABLE
-- ============================================================
DROP POLICY IF EXISTS "ai_cache_read" ON ai_generation_cache;
DROP POLICY IF EXISTS "ai_cache_manage" ON ai_generation_cache;

CREATE POLICY "ai_cache_org" ON ai_generation_cache
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR organization_id = get_my_org_id()
  )
  WITH CHECK (
    is_super_admin()
    OR organization_id = get_my_org_id()
  );

-- ============================================================
-- ORGANIZATIONS TABLE — ensure super admin can access all
-- ============================================================
DROP POLICY IF EXISTS "org_auth_select" ON organizations;
DROP POLICY IF EXISTS "org_service_all" ON organizations;

-- Service role can do anything
CREATE POLICY "org_service_all" ON organizations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Super admins can read all orgs
CREATE POLICY "org_super_admin_all" ON organizations
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Regular users can read their own org only
CREATE POLICY "org_member_read" ON organizations
  FOR SELECT TO authenticated
  USING (id = get_my_org_id());

-- ============================================================
-- PERFORMANCE INDEXES (if not already created by migration 035)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_org_id            ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id          ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id         ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id            ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_org_id  ON scheduled_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_moderation_items_org_id ON moderation_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_id           ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id        ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_org_id  ON studio_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org_id    ON task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_org_id     ON ai_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_org_id        ON api_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id        ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_org_id      ON ai_feedback(organization_id);
