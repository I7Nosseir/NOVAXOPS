-- Time logging: tracked hours per task per user
CREATE TABLE IF NOT EXISTS task_time_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  hours      numeric(5,2) NOT NULL,
  note       text,
  logged_at  date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON task_time_logs(user_id);
