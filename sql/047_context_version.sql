-- 047_context_version.sql
-- Adds context_version to clients table.
-- Incremented automatically when AI-relevant fields change.
-- Used as part of AI prompt cache keys so stale cached responses
-- are automatically invalidated when client context changes.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_version INT NOT NULL DEFAULT 0;

-- Trigger function
CREATE OR REPLACE FUNCTION increment_client_context_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.normalized_profile IS DISTINCT FROM NEW.normalized_profile OR
    OLD.copy_brief IS DISTINCT FROM NEW.copy_brief OR
    OLD.design_brief_json IS DISTINCT FROM NEW.design_brief_json OR
    OLD.brand_identity_json IS DISTINCT FROM NEW.brand_identity_json OR
    OLD.culture_notes IS DISTINCT FROM NEW.culture_notes OR
    OLD.country IS DISTINCT FROM NEW.country OR
    OLD.city IS DISTINCT FROM NEW.city
  ) THEN
    NEW.context_version = OLD.context_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_context_version ON clients;
CREATE TRIGGER trg_client_context_version
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION increment_client_context_version();
