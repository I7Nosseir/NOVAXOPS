import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTaskStatusChanged } from '@/lib/email'
import type { TaskStatus } from '@/lib/types'

const VALID_STATUSES: TaskStatus[] = ['pending', 'active', 'blocked', 'completed']

// PATCH /api/tasks/[id]/status
// Body: { user_id: string; status: TaskStatus }
// Any authenticated user can update task status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { user_id?: string; status?: TaskStatus }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { user_id, status } = body
  if (!user_id || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'user_id and valid status required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: task, error: fetchErr } = await db
    .from('tasks')
    .select('created_by, title, assigned_to, client_id')
    .eq('id', id)
    .single()

  if (fetchErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { error } = await db
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[tasks/status]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fire-and-forget: notify creator if someone else changed the status
  if (task.created_by && task.created_by !== user_id) {
    notifyCreatorOfStatusChange(db, {
      taskId:      id,
      taskTitle:   task.title as string,
      createdBy:   task.created_by as string,
      changedById: user_id,
      newStatus:   status,
    }).catch(err => console.error('[tasks/status] notification failed:', err))
  }

  return NextResponse.json({ ok: true })
}

async function notifyCreatorOfStatusChange(
  db: ReturnType<typeof createAdminClient>,
  opts: {
    taskId: string
    taskTitle: string
    createdBy: string
    changedById: string
    newStatus: string
  },
) {
  const { taskId, taskTitle, createdBy, changedById, newStatus } = opts

  const [creatorResult, changerResult] = await Promise.all([
    db.from('users').select('name, email').eq('id', createdBy).single(),
    db.from('users').select('name').eq('id', changedById).single(),
  ])

  const creator = creatorResult.data  as { name: string; email: string } | null
  const changer = changerResult.data  as { name: string } | null

  const description = `${changer?.name ?? 'Team member'} marked task "${taskTitle}" as ${newStatus}`

  // In-app notification for the creator
  await db.from('audit_log').insert({
    action:      'task.status_changed',
    entity_type: 'task',
    entity_id:   taskId,
    user_id:     createdBy,
    metadata: {
      description,
      task_title:     taskTitle,
      changed_by:     changer?.name ?? '',
      new_status:     newStatus,
    },
    created_at: new Date().toISOString(),
  })

  // Email the creator
  if (creator?.email) {
    await sendTaskStatusChanged({
      creatorEmail:   creator.email,
      creatorName:    creator.name ?? 'Team',
      changedByName:  changer?.name ?? 'A team member',
      taskTitle,
      taskId,
      newStatus,
    })
  }
}
