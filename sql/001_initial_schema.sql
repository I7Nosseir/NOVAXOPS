-- ============================================================
-- AGENCY OPS PLATFORM — DATABASE MIGRATIONS
-- Supabase (PostgreSQL) · Run in order
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE pipeline_stage AS ENUM (
  'strategy', 'ideas', 'calendar', 'copy', 'design',
  'review', 'approval', 'scheduled', 'published', 'reporting'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('active', 'blocked', 'completed');
CREATE TYPE user_role AS ENUM ('admin', 'creative_director', 'copywriter', 'designer', 'social_manager', 'account_manager', 'strategist');
CREATE TYPE department AS ENUM ('creative', 'strategy', 'accounts', 'social');
CREATE TYPE client_status AS ENUM ('active', 'inactive', 'prospect');
CREATE TYPE project_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE agent_type AS ENUM ('task_analyzer', 'copywriter', 'researcher', 'asset_finder', 'presentation_builder');
CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'pinterest');
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');
CREATE TYPE moderation_status AS ENUM ('pending', 'replied', 'ignored', 'escalated');
CREATE TYPE asset_source AS ENUM ('freepik', 'upload');
CREATE TYPE asset_type AS ENUM ('image', 'illustration', 'icon');
CREATE TYPE integration_type AS ENUM ('metricool', 'respond_io', 'freepik', 'claude');
CREATE TYPE report_type AS ENUM ('weekly', 'monthly', 'quarterly', 'custom');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users (mirrors Supabase Auth users)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'copywriter',
  department  department NOT NULL,
  phone       TEXT,
  whatsapp    TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  initials    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients
CREATE TABLE public.clients (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  initials                TEXT NOT NULL,
  color                   TEXT NOT NULL DEFAULT '#6366f1',
  status                  client_status NOT NULL DEFAULT 'active',
  brand_identity_json     JSONB NOT NULL DEFAULT '{}',
  -- Structure: { primary_color, secondary_color, tone_of_voice, target_audience, key_messages[], industry, logo_url }
  competitor_context_json JSONB NOT NULL DEFAULT '[]',
  reference_links         TEXT[] NOT NULL DEFAULT '{}',
  metricool_blog_id       TEXT,
  respond_io_channel_id   TEXT,
  account_manager_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE public.projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  status              project_status NOT NULL DEFAULT 'active',
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  quarter_strategy    JSONB NOT NULL DEFAULT '{}',
  -- Structure: { goals[], themes[], kpis[] }
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Tasks
CREATE TABLE public.tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  pipeline_stage  pipeline_stage NOT NULL DEFAULT 'strategy',
  priority        task_priority NOT NULL DEFAULT 'medium',
  status          task_status NOT NULL DEFAULT 'active',
  due_date        DATE NOT NULL,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  context_json    JSONB NOT NULL DEFAULT '{}',
  -- Extra context: brief notes, linked assets, approver, etc.
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI RESPONSES
-- ============================================================

CREATE TABLE public.ai_responses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_type   agent_type NOT NULL,
  prompt_hash  TEXT NOT NULL,
  -- MD5(task_id || agent_type || stable_context_snapshot)
  response_json JSONB NOT NULL,
  -- { output_text, structured_data, citations[] }
  cost_usd     NUMERIC(10, 6) NOT NULL DEFAULT 0,
  model_used   TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  is_cached    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint: same context = same response (caching key)
  UNIQUE (task_id, agent_type, prompt_hash)
);

CREATE INDEX idx_ai_responses_hash ON public.ai_responses (task_id, agent_type, prompt_hash);
CREATE INDEX idx_ai_responses_task  ON public.ai_responses (task_id);

-- ============================================================
-- ASSETS
-- ============================================================

CREATE TABLE public.assets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source        asset_source NOT NULL,
  type          asset_type NOT NULL,
  title         TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  storage_path  TEXT,
  -- Supabase Storage object path
  license_info  TEXT NOT NULL,
  freepik_id    TEXT,
  -- Original Freepik asset ID
  downloaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_client ON public.assets (client_id);
CREATE INDEX idx_assets_task   ON public.assets (task_id);

-- ============================================================
-- PUBLISHING
-- ============================================================

CREATE TABLE public.scheduled_posts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id             UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  metricool_post_id   TEXT UNIQUE,
  -- Set after Metricool confirms scheduling
  platforms           social_platform[] NOT NULL DEFAULT '{}',
  caption             TEXT NOT NULL,
  media_urls          TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at        TIMESTAMPTZ,
  status              post_status NOT NULL DEFAULT 'draft',
  performance_data    JSONB NOT NULL DEFAULT '{}',
  -- { reach, impressions, engagement_rate, likes, comments, shares, saves }
  published_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_client    ON public.scheduled_posts (client_id);
CREATE INDEX idx_posts_status    ON public.scheduled_posts (status);
CREATE INDEX idx_posts_scheduled ON public.scheduled_posts (scheduled_at);

-- ============================================================
-- MODERATION
-- ============================================================

CREATE TABLE public.moderation_items (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id                    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  task_id                      UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  -- Auto-created task linked to this moderation item
  respond_io_conversation_id   TEXT NOT NULL,
  platform                     social_platform NOT NULL,
  commenter_name               TEXT NOT NULL,
  commenter_handle             TEXT,
  comment_text                 TEXT NOT NULL,
  post_url                     TEXT,
  post_caption                 TEXT,
  ai_suggested_reply           TEXT,
  final_reply                  TEXT,
  status                       moderation_status NOT NULL DEFAULT 'pending',
  handled_by                   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at                  TIMESTAMPTZ
);

CREATE INDEX idx_moderation_client ON public.moderation_items (client_id);
CREATE INDEX idx_moderation_status ON public.moderation_items (status);

-- ============================================================
-- PRESENTATIONS
-- ============================================================

CREATE TABLE public.presentations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_type   TEXT NOT NULL,
  -- 'monthly_report' | 'pitch_deck' | 'campaign_recap' | 'social_recap'
  file_url        TEXT NOT NULL,
  -- Supabase Storage URL
  storage_path    TEXT NOT NULL,
  design_config   JSONB NOT NULL DEFAULT '{}',
  -- { colors, fonts, logo_url, slide_count, brand_id }
  slide_count     INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

CREATE TABLE public.integrations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                 integration_type NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'disconnected',
  -- 'connected' | 'disconnected' | 'error'
  encrypted_config     BYTEA,
  -- pgcrypto encrypted credentials blob
  config_meta          JSONB NOT NULL DEFAULT '{}',
  -- Non-sensitive config: model names, blog IDs, etc.
  last_sync            TIMESTAMPTZ,
  sync_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- API USAGE TRACKING
-- ============================================================

CREATE TABLE public.api_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service       TEXT NOT NULL,
  -- 'claude' | 'freepik' | 'metricool' | 'respond_io'
  endpoint      TEXT NOT NULL,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  task_id       UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  tokens_in     INTEGER NOT NULL DEFAULT 0,
  tokens_out    INTEGER NOT NULL DEFAULT 0,
  credits_used  NUMERIC(10, 4) NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0,
  was_cached    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_service ON public.api_usage (service);
CREATE INDEX idx_api_usage_user    ON public.api_usage (user_id);
CREATE INDEX idx_api_usage_date    ON public.api_usage (created_at);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE public.reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type            report_type NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  data_json       JSONB NOT NULL DEFAULT '{}',
  -- Full report data snapshot
  file_url        TEXT,
  -- .pptx download link (Supabase Storage)
  storage_path    TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sent_to_client  BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_reports_client ON public.reports (client_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE public.audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  -- 'task.stage_change' | 'ai.generation' | 'post.scheduled' | etc.
  entity_type  TEXT NOT NULL,
  -- 'task' | 'client' | 'post' | 'moderation' | 'asset'
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  metadata     JSONB NOT NULL DEFAULT '{}',
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity   ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_user     ON public.audit_log (user_id);
CREATE INDEX idx_audit_date     ON public.audit_log (created_at);

-- ============================================================
-- TRIGGERS: updated_at auto-maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON public.users           FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_clients_updated_at        BEFORE UPDATE ON public.clients         FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_projects_updated_at       BEFORE UPDATE ON public.projects        FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_tasks_updated_at          BEFORE UPDATE ON public.tasks           FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_posts_updated_at          BEFORE UPDATE ON public.scheduled_posts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_integrations_updated_at   BEFORE UPDATE ON public.integrations    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log       ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's role from the users table
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the current user's internal UUID
CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Authenticated users can read all users (for assignment dropdowns)
CREATE POLICY "users_read_all" ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Admins and Creative Directors can manage all users
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director'));

-- ============================================================
-- CLIENTS POLICIES
-- ============================================================

-- All authenticated users can view clients
CREATE POLICY "clients_read" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

-- Admins, Creative Directors, Account Managers can manage clients
CREATE POLICY "clients_manage" ON public.clients
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'account_manager'));

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================

CREATE POLICY "projects_read" ON public.projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "projects_manage" ON public.projects
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist'))
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist'));

-- ============================================================
-- TASKS POLICIES
-- ============================================================

-- All authenticated users can read tasks
CREATE POLICY "tasks_read" ON public.tasks
  FOR SELECT TO authenticated
  USING (true);

-- Users can update tasks assigned to them or tasks in their department scope
CREATE POLICY "tasks_update_assigned" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = get_my_user_id()
    OR get_my_role() IN ('admin', 'creative_director', 'account_manager')
  )
  WITH CHECK (
    assigned_to = get_my_user_id()
    OR get_my_role() IN ('admin', 'creative_director', 'account_manager')
  );

-- Admins, Creative Directors, Account Managers can create tasks
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'account_manager', 'strategist'));

-- Only admins and CDs can delete tasks
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director'));

-- ============================================================
-- AI RESPONSES POLICIES
-- ============================================================

-- Authenticated users can read all cached responses
CREATE POLICY "ai_responses_read" ON public.ai_responses
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can insert (triggering AI from any task)
CREATE POLICY "ai_responses_insert" ON public.ai_responses
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- ASSETS POLICIES
-- ============================================================

CREATE POLICY "assets_read" ON public.assets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "assets_insert" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "assets_delete" ON public.assets
  FOR DELETE TO authenticated
  USING (
    downloaded_by = get_my_user_id()
    OR get_my_role() IN ('admin', 'creative_director')
  );

-- ============================================================
-- SCHEDULED POSTS POLICIES
-- ============================================================

-- Social managers, admins, and CDs can manage posts
CREATE POLICY "posts_read" ON public.scheduled_posts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "posts_manage" ON public.scheduled_posts
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager'));

-- ============================================================
-- MODERATION POLICIES
-- ============================================================

CREATE POLICY "moderation_read" ON public.moderation_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "moderation_manage" ON public.moderation_items
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'social_manager', 'account_manager'));

-- ============================================================
-- PRESENTATIONS POLICIES
-- ============================================================

CREATE POLICY "presentations_read" ON public.presentations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "presentations_insert" ON public.presentations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- INTEGRATIONS POLICIES (admin-only)
-- ============================================================

CREATE POLICY "integrations_read" ON public.integrations
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director'));

CREATE POLICY "integrations_manage" ON public.integrations
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- API USAGE POLICIES
-- ============================================================

-- Users see their own usage; admins see all
CREATE POLICY "api_usage_read" ON public.api_usage
  FOR SELECT TO authenticated
  USING (
    user_id = get_my_user_id()
    OR get_my_role() IN ('admin', 'creative_director')
  );

CREATE POLICY "api_usage_insert" ON public.api_usage
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- REPORTS POLICIES
-- ============================================================

CREATE POLICY "reports_read" ON public.reports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "reports_manage" ON public.reports
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creative_director', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'creative_director', 'account_manager'));

-- ============================================================
-- AUDIT LOG POLICIES
-- ============================================================

-- Users can read their own audit entries; admins see all
CREATE POLICY "audit_read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    user_id = get_my_user_id()
    OR get_my_role() IN ('admin', 'creative_director')
  );

-- System/backend inserts (via service role) — no client policy needed
-- Frontend never writes directly to audit_log

-- ============================================================
-- REALTIME SUBSCRIPTIONS (enable for pipeline updates)
-- ============================================================

-- Enable Realtime for tables that need live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_responses;

-- ============================================================
-- STORAGE BUCKETS (run in Supabase Dashboard or via API)
-- ============================================================
-- NOTE: Storage bucket creation is done via the Supabase Dashboard
-- or the management API, not SQL. The following is documentation:
--
-- Bucket: 'assets'         → Public, max file size 50MB
--   Path pattern: {client_id}/{asset_id}/{filename}
--   Allowed types: image/*, video/mp4
--
-- Bucket: 'presentations'  → Private (authenticated only)
--   Path pattern: {client_id}/{report_id}/{filename}
--   Allowed types: application/vnd.openxmlformats-officedocument.presentationml.presentation
--
-- Bucket: 'uploads'        → Private (authenticated only)
--   Path pattern: {user_id}/{task_id}/{filename}
--   Allowed types: image/*, video/mp4, application/pdf

-- ============================================================
-- INDEXES: Performance optimisation
-- ============================================================

CREATE INDEX idx_tasks_pipeline_stage ON public.tasks (pipeline_stage);
CREATE INDEX idx_tasks_client         ON public.tasks (client_id);
CREATE INDEX idx_tasks_project        ON public.tasks (project_id);
CREATE INDEX idx_tasks_assigned       ON public.tasks (assigned_to);
CREATE INDEX idx_tasks_due_date       ON public.tasks (due_date);
CREATE INDEX idx_tasks_status         ON public.tasks (status);

CREATE INDEX idx_projects_client      ON public.projects (client_id);
CREATE INDEX idx_projects_status      ON public.projects (status);

CREATE INDEX idx_clients_status       ON public.clients (status);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
