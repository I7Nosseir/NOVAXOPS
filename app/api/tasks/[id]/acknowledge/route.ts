import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTaskAcknowledged } from '@/lib/email'

// POST /api/tasks/[id]/acknowledge
// Body: { user_id: string; type: 'seen' | 'read' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { user_id?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { user_id, type } = body
  if (!user_id || !['seen', 'read'].includes(type ?? '')) {
    return NextResponse.json({ error: 'user_id and type (seen|read) required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: task, error: fetchErr } = await db
    .from('tasks')
    .select('assigned_to, seen_at, read_at, created_by, title, client_id')
    .eq('id', id)
    .single()

  if (fetchErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (task.assigned_to !== user_id) {
    return NextResponse.json({ error: 'Only the assignee can acknowledge this task' }, { status: 403 })
  }

  // Don't overwrite an existing acknowledgment
  if (type === 'seen' && task.seen_at) return NextResponse.json({ ok: true })
  if (type === 'read' && task.read_at) return NextResponse.json({ ok: true })

  const now = new Date().toISOString()
  const updates = type === 'read'
    ? { read_at: now, read_by: user_id, updated_at: now }
    : { seen_at: now, seen_by: user_id, updated_at: now }

  const { error } = await db.from('tasks').update(updates).eq('id', id)
  if (error) {
    console.error('[tasks/acknowledge]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fire-and-forget: notify creator
  if (task.created_by) {
    notifyCreator(db, {
      taskId:    id,
      taskTitle: task.title as string,
      createdBy: task.created_by as string,
      assigneeId: user_id,
      type: type as 'seen' | 'read',
    }).catch(err => console.error('[tasks/acknowledge] notification failed:', err))
  }

  return NextResponse.json({ ok: true })
}

async function notifyCreator(
  db: ReturnType<typeof createAdminClient>,
  opts: {
    taskId: string
    taskTitle: string
    createdBy: string
    assigneeId: string
    type: 'seen' | 'read'
  },
) {
  const { taskId, taskTitle, createdBy, assigneeId, type } = opts

  const [creatorResult, assigneeResult] = await Promise.all([
    db.from('users').select('name, email').eq('id', createdBy).single(),
    db.from('users').select('name').eq('id', assigneeId).single(),
  ])

  const creator  = creatorResult.data  as { name: string; email: string } | null
  const assignee = assigneeResult.data as { name: string } | null

  const verb = type === 'seen' ? 'seen' : 'read'
  const description = `${assignee?.name ?? 'Assignee'} has ${verb} task: ${taskTitle}`

  // In-app notification for the creator
  await db.from('audit_log').insert({
    action:      `task.${verb}`,
    entity_type: 'task',
    entity_id:   taskId,
    user_id:     createdBy,
    metadata: {
      description,
      task_title:    taskTitle,
      assignee_name: assignee?.name ?? '',
      ack_type:      type,
    },
    created_at: new Date().toISOString(),
  })

  // Email the creator
  if (creator?.email) {
    await sendTaskAcknowledged({
      creatorEmail:  creator.email,
      creatorName:   creator.name ?? 'Team',
      assigneeName:  assignee?.name ?? 'Assignee',
      taskTitle,
      taskId,
      type,
    })
  }
}
