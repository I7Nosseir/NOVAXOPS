# Task System — Action Plan

> **Goal:** A fully functional ClickUp-style task system: create, edit, delete, filter, list view, inline field editing, per-column add, and comments. Everything wired to the real Supabase DB.

---

## Current State Audit

### What already works
| Piece | Status |
|-------|--------|
| Kanban board (10 columns, DnD) | Done |
| Drag-to-change-stage + Supabase persist | Done — `useUpdateTaskStage()` is wired |
| `useUpdateTask()` mutation | Done — hook exists, just unused |
| Task card display (client, priority, due date, assignee) | Done |
| Task detail panel (read-only slide-over) | Done — no edits possible |
| `useTasks()` from real Supabase | Done |

### What is broken / missing
| Piece | Status |
|-------|--------|
| "New Task" button | Dead — no dialog behind it |
| Task creation | Not built at all |
| Task editing (any field) | Not built — panel is display-only |
| Task deletion | Not built |
| List view | Toggle exists, nothing renders |
| Filter button | Dead — no panel behind it |
| "Add task" per column | Not built |
| Comments / activity log | Not built |
| Status change (active/blocked/completed) | Not editable |
| `useCreateTask()` | Does not exist |
| `useDeleteTask()` | Does not exist |

---

## Implementation Phases

Phases are ordered by dependency. Each phase is independently shippable.

---

## Phase 1 — Task Creation

**Blocks everything else. Do this first.**

### What to build
A `<CreateTaskDialog>` modal triggered by:
- "New Task" button in `components/layout/header.tsx`
- A "+" button at the bottom of each `PipelineColumn`
- Optionally pre-filling the `pipeline_stage` when triggered from a specific column

### Form fields

| Field | Input type | Required | Default |
|-------|-----------|----------|---------|
| Title | Text input | Yes | — |
| Description | Textarea | No | — |
| Client | Dropdown (from `useClients()`) | Yes | — |
| Project | Dropdown filtered by client | No | — |
| Assignee | Avatar grid picker (from `useUsers()`) | No | — |
| Pipeline stage | Select (10 options from `STAGE_CONFIG`) | Yes | `'strategy'` |
| Priority | Segmented control (low/medium/high/urgent) | Yes | `'medium'` |
| Due date | Date picker | No | — |
| Tags | Tag input (comma-separated, add on Enter) | No | `[]` |

### New hook: `useCreateTask()`

**File:** `lib/hooks/use-tasks.ts` — add to existing file

```ts
export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
```

### Files to create / edit

| File | Action |
|------|--------|
| `components/tasks/create-task-dialog.tsx` | Create — the modal |
| `lib/hooks/use-tasks.ts` | Edit — add `useCreateTask()` |
| `components/layout/header.tsx` | Edit — wire "New Task" button to dialog |
| `components/pipeline/pipeline-column.tsx` | Edit — add "+" button at column bottom |
| `components/pipeline/pipeline-board.tsx` | Edit — pass `onCreateInStage` prop down |

### Column "+" button (quick add)

At the bottom of each column, below the task list:
- Small `+ Add task` text button
- Click → opens `<CreateTaskDialog>` with `pipeline_stage` pre-filled to that column's stage
- Same dialog, just different defaults

---

## Phase 2 — Task Editing (Inline in Detail Panel)

**The panel currently displays data. Make every field editable.**

### Editing model

Use **click-to-edit** per field (no "Edit mode" toggle):
- Click on a field value → it becomes an input
- Blur or Enter → fires `useUpdateTask()` mutation
- Escape → reverts

### Fields to make editable

| Field | Current display | Edit control |
|-------|----------------|--------------|
| Title | `<h2>` | Click → inline text input, save on blur |
| Description | `<p>` | Click → expanding textarea |
| Pipeline stage | Badge (read-only) | Dropdown (`Select` from shadcn/ui) |
| Priority | Badge (read-only) | Segmented button group |
| Assignee | Avatar + name | Avatar grid picker (same as create) |
| Due date | Formatted string | Date picker popover |
| Status | Not shown | Toggle: Active / Blocked / Done (3-way) |
| Tags | Pill list | Click tag to remove, `+` to add new |

### Status badge

Add a visible `status` indicator to both the task card and the detail panel header:
- `active` → green dot
- `blocked` → red dot + "Blocked" label
- `completed` → checkmark

When status is set to `completed`, move the task to the last touched stage (or leave in place — do not auto-move to `reporting`).

### Files to edit

| File | Change |
|------|--------|
| `components/tasks/task-detail-panel.tsx` | Replace read-only fields with editable controls |
| `components/pipeline/task-card.tsx` | Add status dot to footer |
| `lib/hooks/use-tasks.ts` | `useUpdateTask()` already exists — just use it |

---

## Phase 3 — Task Deletion

**Simple. Add a delete option in the detail panel.**

### UX pattern

- Three-dot menu (`MoreHorizontal` icon) in the panel header → dropdown with "Delete task"
- Click → inline confirmation (replace button with "Confirm delete" + "Cancel" for 3s)
- On confirm → `useDeleteTask()` → panel closes → task removed from board

### New hook: `useDeleteTask()`

**File:** `lib/hooks/use-tasks.ts`

```ts
export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
```

### Files to edit

| File | Change |
|------|--------|
| `components/tasks/task-detail-panel.tsx` | Add `...` menu + delete flow |
| `lib/hooks/use-tasks.ts` | Add `useDeleteTask()` |

---

## Phase 4 — List View

**The view toggle exists. Build what renders when `view === 'list'`.**

### Layout

A full-width table. Columns (left to right):

| Column | Content | Sortable |
|--------|---------|---------|
| — | Checkbox (future bulk select) | No |
| Task | Title + client color dot | Yes (A-Z) |
| Stage | `STAGE_CONFIG` badge | Yes |
| Priority | `PRIORITY_CONFIG` badge | Yes |
| Assignee | Avatar + name | Yes |
| Due date | Formatted, red if overdue | Yes |
| Status | Dot badge | Yes |
| — | `...` menu (edit, delete) | No |

- Click any row → opens `TaskDetailPanel` (same as board)
- Click column header → toggle sort asc/desc
- Sticky header

### Files to create / edit

| File | Action |
|------|--------|
| `components/pipeline/task-list.tsx` | Create — the table component |
| `app/(app)/pipeline/page.tsx` | Edit — render `<TaskList>` when `view === 'list'` |

---

## Phase 5 — Filtering

**The Filter button exists. Build what it opens.**

### Filter options

| Filter | Control | How it works |
|--------|---------|-------------|
| Client | Multi-select checkbox list | `client_id IN [...]` |
| Assignee | Avatar multi-picker | `assigned_to IN [...]` |
| Priority | Checkbox group (4 options) | `priority IN [...]` |
| Stage | Checkbox group (10 stages) | `pipeline_stage IN [...]` |
| Status | Toggle group (active/blocked/completed) | `status IN [...]` |
| Due date | Presets: Overdue / Today / This week / Custom range | computed from `due_date` |

### UX pattern

- Filter button opens a **dropdown panel** below the toolbar (not a modal)
- Active filters shown as **chips** in a row below the toolbar (e.g., "Client: Luxe Cosmetics ×")
- "Clear all" link when any filter is active
- Filter state lives in URL params (`?client=c1&priority=urgent`) so it's shareable and survives refresh

### Files to create / edit

| File | Action |
|------|--------|
| `components/pipeline/filter-panel.tsx` | Create — the dropdown filter UI |
| `components/pipeline/filter-chips.tsx` | Create — active filter pill row |
| `app/(app)/pipeline/page.tsx` | Edit — read filter state from URL, pass to `useTasks()` |
| `lib/hooks/use-tasks.ts` | Edit — `useTasks()` already accepts filters, just expand the params |

---

## Phase 6 — Comments & Activity Log

**The final layer that makes tasks feel alive.**

### Comments

A new section below the AI agents in the detail panel:

- Text input at bottom + "Send" button
- Comments list (avatar, name, timestamp, text)
- Realtime: new comments appear without refresh

### Activity log

Automatic entries written on every task mutation:
- Stage changed from X to Y
- Priority changed from X to Y
- Assignee changed to X
- Task created

### New table needed: `task_comments`

```sql
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### New hooks needed

**File:** `lib/hooks/use-task-comments.ts` (new file)

```ts
export function useTaskComments(taskId: string)   // SELECT + realtime subscription
export function useCreateComment()                 // INSERT
```

### Files to create / edit

| File | Action |
|------|--------|
| `lib/hooks/use-task-comments.ts` | Create |
| `components/tasks/task-comments.tsx` | Create — comments + activity section |
| `components/tasks/task-detail-panel.tsx` | Edit — import and append comments section |
| Supabase SQL editor | Run `task_comments` table + RLS policy |

---

## Data Shape Reference

### Task (current, from `lib/types.ts`)

```ts
interface Task {
  id: string
  project_id: string
  client_id: string
  assigned_to: string       // single user — Phase 2 keeps this
  title: string
  description: string
  pipeline_stage: PipelineStage
  priority: Priority
  status: TaskStatus        // 'active' | 'blocked' | 'completed'
  due_date: string
  created_at: string
  updated_at: string
  tags: string[]
}
```

No type changes needed for Phases 1–5. Phase 6 adds `task_comments`.

---

## Build Order (exact sequence)

```
Phase 1a  useCreateTask() hook
Phase 1b  <CreateTaskDialog> component
Phase 1c  Wire "New Task" button in header
Phase 1d  "+" per-column quick add in PipelineColumn

Phase 2a  Editable title in TaskDetailPanel
Phase 2b  Editable stage dropdown
Phase 2c  Editable priority picker
Phase 2d  Editable assignee picker
Phase 2e  Editable due date
Phase 2f  Editable description
Phase 2g  Status toggle + task card status dot

Phase 3a  useDeleteTask() hook
Phase 3b  Delete flow in TaskDetailPanel

Phase 4a  <TaskList> table component
Phase 4b  Sort logic
Phase 4c  Wire list view toggle in pipeline page

Phase 5a  Filter state in URL params
Phase 5b  <FilterPanel> dropdown
Phase 5c  <FilterChips> row
Phase 5d  useTasks() filter wiring

Phase 6a  task_comments table in Supabase
Phase 6b  useTaskComments() hook
Phase 6c  <TaskComments> component
Phase 6d  Append to TaskDetailPanel
```

---

## File Map (all files touched)

| File | Phase | Type |
|------|-------|------|
| `lib/hooks/use-tasks.ts` | 1, 3 | Edit |
| `lib/hooks/use-task-comments.ts` | 6 | Create |
| `components/tasks/create-task-dialog.tsx` | 1 | Create |
| `components/tasks/task-detail-panel.tsx` | 2, 3, 6 | Edit |
| `components/tasks/task-comments.tsx` | 6 | Create |
| `components/pipeline/pipeline-board.tsx` | 1 | Edit |
| `components/pipeline/pipeline-column.tsx` | 1 | Edit |
| `components/pipeline/task-card.tsx` | 2 | Edit |
| `components/pipeline/task-list.tsx` | 4 | Create |
| `components/pipeline/filter-panel.tsx` | 5 | Create |
| `components/pipeline/filter-chips.tsx` | 5 | Create |
| `components/layout/header.tsx` | 1 | Edit |
| `app/(app)/pipeline/page.tsx` | 4, 5 | Edit |
| Supabase SQL editor | 6 | SQL |

---

## What Not to Build (scope boundary)

- **Multi-assignee** — the DB schema has `assigned_to: string` (single user). Changing this requires a junction table migration. Out of scope for now.
- **Subtasks** — no parent/child task relationship in schema. Out of scope.
- **Time tracking** — out of scope.
- **Task templates** — out of scope.
- **Recurring tasks** — out of scope.
- **Bulk actions** — the checkbox column in list view is reserved for future bulk move/delete. Do not implement bulk logic now.
