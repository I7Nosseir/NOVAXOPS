-- Add design brief JSON to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS design_brief_json jsonb DEFAULT NULL;
