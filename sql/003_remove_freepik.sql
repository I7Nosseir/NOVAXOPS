-- ─── Sprint: Remove Freepik, add Google Drive support ────────────────────────
-- Run once in Supabase SQL editor after 002_performance_tables.sql.

-- 1. Add 'drive' to asset_source enum (PostgreSQL cannot remove values, only add)
ALTER TYPE asset_source ADD VALUE IF NOT EXISTS 'drive';

-- 2. Add drive_file_id column to assets (replaces freepik_id usage)
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Unique constraint for idempotent Drive imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_drive_file_id
  ON assets (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- 3. integration_type: add 'google_drive', remove 'freepik' usage
--    PostgreSQL cannot remove enum values — we just stop inserting 'freepik'.
--    Existing 'freepik' rows in integrations table are safe (ignored by app).
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'google_drive';

-- 4. Migrate existing freepik assets to upload source (optional cleanup)
UPDATE assets SET source = 'upload' WHERE source = 'freepik';
