-- Add is_personal flag to documents.
-- Personal documents are only visible to their creator.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_personal boolean DEFAULT false;

-- Ensure created_by is indexed for fast per-user lookups.
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
