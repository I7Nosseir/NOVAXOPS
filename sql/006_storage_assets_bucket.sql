-- ── sql/006_storage_assets_bucket.sql ──────────────────────────────────────────
-- Creates the 'assets' public storage bucket and its RLS policies.
-- Run once in the Supabase SQL Editor.
-- Safe to re-run — all statements are guarded with IF NOT EXISTS / ON CONFLICT.

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,
  52428800,   -- 50 MB per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies on storage.objects
--    (storage.objects has RLS enabled by default in Supabase)

-- Anyone can read files in the assets bucket (it is a public bucket)
DO $$ BEGIN
  CREATE POLICY "assets: public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can upload to the assets bucket
DO $$ BEGIN
  CREATE POLICY "assets: authenticated upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'assets'
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can delete their own uploads (owner is set automatically by Supabase on upload)
DO $$ BEGIN
  CREATE POLICY "assets: owner delete"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'assets'
      AND owner = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can replace (update) their own uploads
DO $$ BEGIN
  CREATE POLICY "assets: owner update"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'assets'
      AND owner = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
