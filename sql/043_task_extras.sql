-- Task extras: rich text description, start date, effort estimate, pin, template flag
-- Also adds reactions column to task_comments
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description_json jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours numeric(4,1);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}';
