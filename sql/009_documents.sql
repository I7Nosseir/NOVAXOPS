CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Document',
  content jsonb DEFAULT '{}',
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_share_token ON documents(share_token);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage documents" ON documents;
CREATE POLICY "Users can manage documents" ON documents FOR ALL USING (true);
