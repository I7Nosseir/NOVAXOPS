-- Migration 042: Task checklist items + watchers
-- Checklist: jsonb array of {id, text, done} objects
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]'::jsonb;

-- Watchers: array of user IDs who are following this task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS watchers text[] DEFAULT '{}';
