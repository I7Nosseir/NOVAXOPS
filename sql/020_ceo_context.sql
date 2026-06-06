-- 020_ceo_context.sql
-- Per-client quarterly strategy and monthly content update tables.
-- CEO Hub analysis tools require these to be filled before generation runs.

CREATE TABLE IF NOT EXISTS client_quarterly_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  goals TEXT NOT NULL DEFAULT '',
  themes TEXT NOT NULL DEFAULT '',
  kpis TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, quarter)
);

CREATE TABLE IF NOT EXISTS client_monthly_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  content_summary TEXT NOT NULL DEFAULT '',
  what_worked TEXT NOT NULL DEFAULT '',
  what_didnt TEXT NOT NULL DEFAULT '',
  posts_published INT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, month)
);

ALTER TABLE client_quarterly_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_monthly_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_quarterly" ON client_quarterly_strategies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_manage_monthly" ON client_monthly_updates
  FOR ALL USING (auth.role() = 'authenticated');
