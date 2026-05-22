import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTaskAssigned } from '@/lib/email'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/tasks/notify
// Body: { taskId: string; assignedTo: string }
// Uses service role to look up task + user details, then sends assignment email.
// Called server-to-server / fire-and-forget from use-tasks.ts — no auth guard needed.
export async function POST(req: NextRequest) {
  let body: { taskId?: string; assignedTo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { taskId, assignedTo } = body
  if (!taskId || !assignedTo) {
    return NextResponse.json({ error: 'taskId and assignedTo are required' }, { status: 400 })
  }

  const db = serviceClient()

  // Look up task details
  const { data: task, error: taskErr } = await db
    .from('tasks')
    .select('id, title, due_date, priority, client_id')
    .eq('id', taskId)
    .single()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Look up assignee email + name from users table
  const { data: user, error: userErr } = await db
    .from('users')
    .select('name, email')
    .eq('id', assignedTo)
    .single()

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Best-effort: look up client name — treat missing as non-fatal
  const { data: clientRow } = await db
    .from('clients')
    .select('name')
    .eq('id', task.client_id)
    .single()

  const result = await sendTaskAssigned({
    taskId: task.id as string,
    taskTitle: task.title as string,
    assigneeName: user.name as string,
    assigneeEmail: user.email as string,
    clientName: (clientRow?.name as string | undefined) ?? '',
    dueDate: task.due_date as string | null,
    priority: task.priority as string | null,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
