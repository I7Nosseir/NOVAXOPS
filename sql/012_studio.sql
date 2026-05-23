-- Studio power tools: hook library + content creation sessions
-- Run in Supabase SQL editor after 011_doc_type.sql

-- Hook library: stores every generated hook with 3C scores + linked performance data
CREATE TABLE IF NOT EXISTS hook_library (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        REFERENCES clients(id) ON DELETE SET NULL,
  created_by     uuid        REFERENCES users(id)   ON DELETE SET NULL,
  hook_text      text        NOT NULL,
  hook_type      text        NOT NULL, -- curiosity|contradiction|fear|status|authority|transformation|emotional|story|shock
  format_rec     text        NOT NULL DEFAULT 'all_three', -- vocal|text_block|caption|all_three
  clarity_score  int         NOT NULL DEFAULT 0 CHECK (clarity_score BETWEEN 0 AND 10),
  context_score  int         NOT NULL DEFAULT 0 CHECK (context_score BETWEEN 0 AND 10),
  curiosity_score int        NOT NULL DEFAULT 0 CHECK (curiosity_score BETWEEN 0 AND 10),
  virality_tier  text        NOT NULL DEFAULT 'C' CHECK (virality_tier IN ('S','A','B','C')),
  platform       text,
  brief_context  text,
  engagement_rate numeric,
  post_id        uuid        REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  is_starred     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hook_library_client_id_idx ON hook_library (client_id);
CREATE INDEX IF NOT EXISTS hook_library_created_by_idx ON hook_library (created_by);
CREATE INDEX IF NOT EXISTS hook_library_hook_type_idx  ON hook_library (hook_type);

-- Content creation studio sessions: multi-phase content pipeline
CREATE TABLE IF NOT EXISTS studio_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        REFERENCES clients(id) ON DELETE CASCADE,
  created_by      uuid        REFERENCES users(id),
  title           text        NOT NULL DEFAULT 'Untitled Session',
  phase           text        NOT NULL DEFAULT 'define', -- define|research|hooks|script|direction|package
  phase_1_data    jsonb       NOT NULL DEFAULT '{}',
  phase_2_data    jsonb       NOT NULL DEFAULT '{}',
  phase_3_data    jsonb       NOT NULL DEFAULT '{}',
  phase_4_data    jsonb       NOT NULL DEFAULT '{}',
  phase_5_data    jsonb       NOT NULL DEFAULT '{}',
  phase_6_data    jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','scheduled','archived')),
  scheduled_post_id uuid      REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_sessions_client_id_idx    ON studio_sessions (client_id);
CREATE INDEX IF NOT EXISTS studio_sessions_created_by_idx   ON studio_sessions (created_by);
CREATE INDEX IF NOT EXISTS studio_sessions_status_idx       ON studio_sessions (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_studio_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS studio_sessions_updated_at ON studio_sessions;
CREATE TRIGGER studio_sessions_updated_at
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW EXECUTE FUNCTION update_studio_sessions_updated_at();
