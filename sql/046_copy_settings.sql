-- 046_copy_settings.sql
-- Per-client free-text copy brief + agency-wide platform settings table

ALTER TABLE clients ADD COLUMN IF NOT EXISTS copy_brief text;

CREATE TABLE IF NOT EXISTS platform_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_read" ON platform_settings;
CREATE POLICY "platform_settings_read" ON platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "platform_settings_write" ON platform_settings;
CREATE POLICY "platform_settings_write" ON platform_settings
  FOR ALL USING (auth.role() = 'authenticated');
