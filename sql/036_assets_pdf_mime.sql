-- Migration 036: Allow PDF uploads to the assets bucket
-- The bucket was created with only image/video MIME types.
-- PDFs need to be allowed for creative-eval and strategy-eval uploads.

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
WHERE id = 'assets'
  AND NOT ('application/pdf' = ANY(allowed_mime_types));
