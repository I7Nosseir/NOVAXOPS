-- Migration 038: Enhanced API cost tracking — token-level granularity + EGP pricing
-- Run in Supabase SQL editor

-- ── 1. Enhance api_usage table ───────────────────────────────────────────────

ALTER TABLE api_usage
  ADD COLUMN IF NOT EXISTS input_tokens    INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens   INTEGER,
  ADD COLUMN IF NOT EXISTS cached_tokens   INTEGER DEFAULT 0,    -- prompt-cache hits
  ADD COLUMN IF NOT EXISTS cost_usd        NUMERIC(10, 6),        -- exact USD cost
  ADD COLUMN IF NOT EXISTS cost_egp        NUMERIC(10, 4),        -- USD × egp_rate at call time
  ADD COLUMN IF NOT EXISTS egp_rate        NUMERIC(8, 4),         -- exchange rate used (e.g. 50.00)
  ADD COLUMN IF NOT EXISTS provider        TEXT DEFAULT 'gemini', -- 'claude' | 'gemini'
  ADD COLUMN IF NOT EXISTS model_id        TEXT,                  -- exact model string used
  ADD COLUMN IF NOT EXISTS agent_type      TEXT,                  -- 'task_analyzer' | 'copywriter' | etc.
  ADD COLUMN IF NOT EXISTS client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cached          BOOLEAN DEFAULT false, -- was this a cache hit?
  ADD COLUMN IF NOT EXISTS duration_ms     INTEGER;               -- AI call latency

-- ── 2. Index for common dashboard queries ────────────────────────────────────

CREATE INDEX IF NOT EXISTS api_usage_user_created ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_client_created ON api_usage(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_provider_created ON api_usage(provider, created_at DESC);

-- ── 3. Pricing reference table ───────────────────────────────────────────────
-- Updated by admin when provider prices change (no deploy needed)

CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,            -- 'claude' | 'gemini'
  model_id     TEXT NOT NULL UNIQUE,     -- exact model string
  input_price_per_m   NUMERIC(10, 6),    -- USD per 1M input tokens
  output_price_per_m  NUMERIC(10, 6),    -- USD per 1M output tokens
  cached_price_per_m  NUMERIC(10, 6),    -- USD per 1M cached input tokens (0 for non-caching)
  notes        TEXT,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current pricing (September 2026 rates)
INSERT INTO ai_model_pricing (provider, model_id, input_price_per_m, output_price_per_m, cached_price_per_m, notes)
VALUES
  ('claude',  'claude-sonnet-4-6',     3.00,   15.00,  0.30,  'Claude Sonnet 4.6 — standard workloads'),
  ('claude',  'claude-opus-4-7',       15.00,  75.00,  1.50,  'Claude Opus 4.7 — complex strategy/boss brief'),
  ('claude',  'claude-haiku-4-5-20251001', 0.80, 4.00, 0.08, 'Claude Haiku — fast, cheap, simple tasks'),
  ('gemini',  'gemini-3-flash-preview', 0.075, 0.30,  0.00,  'Gemini 3 Flash — current fallback'),
  ('gemini',  'gemini-2.0-flash',      0.10,  0.40,   0.00,  'Gemini 2.0 Flash')
ON CONFLICT (model_id) DO UPDATE SET
  input_price_per_m  = EXCLUDED.input_price_per_m,
  output_price_per_m = EXCLUDED.output_price_per_m,
  cached_price_per_m = EXCLUDED.cached_price_per_m,
  updated_at         = NOW();

-- ── 4. Exchange rate history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exchange_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_curr  TEXT NOT NULL DEFAULT 'USD',
  to_curr    TEXT NOT NULL DEFAULT 'EGP',
  rate       NUMERIC(10, 4) NOT NULL,
  set_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current rate (admin updates this when rate changes significantly)
INSERT INTO exchange_rates (from_curr, to_curr, rate)
VALUES ('USD', 'EGP', 50.00);

-- ── 5. Helper view: cost_by_month ─────────────────────────────────────────────

CREATE OR REPLACE VIEW api_cost_by_month AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  provider,
  SUM(cost_usd)       AS total_cost_usd,
  SUM(cost_egp)       AS total_cost_egp,
  SUM(input_tokens)   AS total_input_tokens,
  SUM(output_tokens)  AS total_output_tokens,
  COUNT(*)            AS total_calls,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) AS cache_hits,
  ROUND(100.0 * SUM(CASE WHEN cached THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS cache_hit_rate_pct
FROM api_usage
WHERE created_at > NOW() - INTERVAL '12 months'
GROUP BY month, provider
ORDER BY month DESC, provider;

-- ── 6. Helper view: cost_by_user ─────────────────────────────────────────────

CREATE OR REPLACE VIEW api_cost_by_user AS
SELECT
  u.name AS user_name,
  u.role,
  DATE_TRUNC('month', a.created_at) AS month,
  a.provider,
  SUM(a.cost_usd)  AS cost_usd,
  SUM(a.cost_egp)  AS cost_egp,
  COUNT(*)         AS calls,
  SUM(a.input_tokens + COALESCE(a.output_tokens, 0)) AS total_tokens
FROM api_usage a
JOIN users u ON u.id = a.user_id
WHERE a.created_at > NOW() - INTERVAL '3 months'
GROUP BY u.name, u.role, month, a.provider
ORDER BY month DESC, cost_usd DESC;

-- ── 7. Helper view: cost_by_client ────────────────────────────────────────────

CREATE OR REPLACE VIEW api_cost_by_client AS
SELECT
  c.name AS client_name,
  DATE_TRUNC('month', a.created_at) AS month,
  a.provider,
  SUM(a.cost_usd)  AS cost_usd,
  SUM(a.cost_egp)  AS cost_egp,
  COUNT(*)         AS calls
FROM api_usage a
JOIN clients c ON c.id = a.client_id
WHERE a.created_at > NOW() - INTERVAL '3 months'
GROUP BY c.name, month, a.provider
ORDER BY month DESC, cost_usd DESC;

-- ── 8. RLS on new tables ──────────────────────────────────────────────────────

ALTER TABLE ai_model_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_for_authenticated" ON ai_model_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON ai_model_pricing FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE auth_id = auth.uid()) = 'admin');

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_for_authenticated" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON exchange_rates FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE auth_id = auth.uid()) = 'admin');
