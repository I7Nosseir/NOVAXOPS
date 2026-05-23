-- Migration 013: Add onboarding fields to users table
-- Run in Supabase SQL editor after 012_studio.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS needs_onboarding boolean NOT NULL DEFAULT false;

-- Index for fast lookup of users who still need onboarding
CREATE INDEX IF NOT EXISTS idx_users_needs_onboarding ON users (needs_onboarding)
  WHERE needs_onboarding = true;
