-- 048_ai_generations.sql
-- Universal AI output persistence table.
-- Replaces scattered per-route caching patterns.
-- Keyed by (entity_type, entity_id, agent_type, context_hash).
-- context_hash = SHA-256 of all inputs + client context_version.

CREATE TABLE IF NOT EXISTS ai_generations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text        NOT NULL CHECK (entity_type IN (
                              'client', 'task', 'session', 'post', 'global'
                            )),
  entity_id     text        NOT NULL,
  agent_type    text        NOT NULL,
  context_hash  text        NOT NULL,
  response_json jsonb,
  response_text text,
  model         text,
  tokens_used   int,
  org_id        uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, agent_type, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_lookup
  ON ai_generations (entity_type, entity_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_ai_generations_created
  ON ai_generations (created_at DESC);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all. Anon/authenticated users read their org's rows.
CREATE POLICY "service_role_all" ON ai_generations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
