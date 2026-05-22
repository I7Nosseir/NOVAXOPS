-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage task comments" ON task_comments;
CREATE POLICY "Users can manage task comments" ON task_comments FOR ALL USING (true);

-- Document templates
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_category text;
CREATE INDEX IF NOT EXISTS idx_documents_is_template ON documents(is_template) WHERE is_template = true;

-- Task linked documents
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_doc_ids uuid[] DEFAULT '{}';
