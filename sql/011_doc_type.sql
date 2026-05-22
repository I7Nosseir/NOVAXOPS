-- Add document type: 'doc' (rich text) or 'sheet' (spreadsheet)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'doc';
