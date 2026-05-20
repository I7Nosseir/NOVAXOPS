-- ============================================================
-- Set Metricool blog ID for existing clients
-- Run in Supabase SQL Editor
--
-- You have ONE Metricool account → ONE blogId (6276264).
-- Every client brand uses the same blogId.
-- The per-client differentiation in Metricool comes from
-- which social profiles (Instagram, Facebook, etc.) are
-- connected to that blog — not from separate blogIds.
-- ============================================================

-- 1. Check current state
SELECT id, name, metricool_blog_id
FROM public.clients
ORDER BY name;

-- 2. Set blogId for any clients that are missing it
UPDATE public.clients
SET metricool_blog_id = '6276264'
WHERE metricool_blog_id IS NULL;

-- 3. Confirm
SELECT name, metricool_blog_id
FROM public.clients
ORDER BY name;
