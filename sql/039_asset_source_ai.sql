-- Migration 039: Add 'ai' value to asset_source enum
-- Required for AI Image generation saves (/api/ai-image/save)
ALTER TYPE asset_source ADD VALUE IF NOT EXISTS 'ai';
