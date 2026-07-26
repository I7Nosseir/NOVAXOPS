-- Task relations: blocks and related-to dependencies
CREATE TABLE IF NOT EXISTS task_relations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  to_task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('blocks', 'related')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(from_task_id, to_task_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_task_relations_from ON task_relations(from_task_id);
CREATE INDEX IF NOT EXISTS idx_task_relations_to   ON task_relations(to_task_id);
