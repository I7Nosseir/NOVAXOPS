-- ============================================================
-- 018_ai_generation_cache.sql
-- Stores AI generations that don't belong to a task or studio
-- session: CEO strategy/crisis outputs, report narratives,
-- inspiration analysis results.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_generation_cache (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_type  TEXT        NOT NULL,
  -- flexible context reference (client_id, session_id, report period string, etc.)
  context_id       TEXT,
  -- sub-type within the generation_type (e.g. 'market_position', 'holding_statement')
  meta             TEXT,
  output_json      JSONB       NOT NULL,
  model_used       TEXT        DEFAULT 'gemini-3-flash-preview',
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_gen_cache_type_ctx_idx
  ON ai_generation_cache (generation_type, context_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_gen_cache_created_by_idx
  ON ai_generation_cache (created_by);

-- RLS: service role inserts via server routes.
-- Authenticated users can read cache entries (used for history/audit views).
ALTER TABLE ai_generation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_gen_cache_read" ON ai_generation_cache;
CREATE POLICY "ai_gen_cache_read" ON ai_generation_cache
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ai_gen_cache_insert" ON ai_generation_cache;
CREATE POLICY "ai_gen_cache_insert" ON ai_generation_cache
  FOR INSERT TO authenticated WITH CHECK (true);
