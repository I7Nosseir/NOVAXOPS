-- Migration 041: Add due_time column to tasks for time-of-day deadline support
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME;
