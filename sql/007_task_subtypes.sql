-- Migration 007: Add sub_type to tasks
-- Run this in the Supabase SQL editor once.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_type text;

COMMENT ON COLUMN tasks.sub_type IS 'Optional sub-type of the task (e.g. Motion Graphics, Caption, Shoot & Edit). Contextual to pipeline_stage.';
