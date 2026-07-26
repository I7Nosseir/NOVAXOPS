-- Migration 046: Client locale + culture fields
-- Used by the Marketing Director tool to apply cultural intelligence per client.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS culture_notes TEXT;

COMMENT ON COLUMN clients.country       IS 'Client operating country (e.g. Saudi Arabia, Egypt, UAE)';
COMMENT ON COLUMN clients.city          IS 'Primary city (e.g. Riyadh, Dubai, Cairo)';
COMMENT ON COLUMN clients.culture_notes IS 'Cultural context: consumer behaviour, local customs, sensitivities, holidays';
