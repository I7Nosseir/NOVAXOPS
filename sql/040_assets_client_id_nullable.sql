-- Migration 040: Allow null client_id on assets (AI-generated images not tied to a client)
ALTER TABLE assets ALTER COLUMN client_id DROP NOT NULL;
