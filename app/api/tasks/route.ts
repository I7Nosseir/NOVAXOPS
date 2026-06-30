import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { sendTaskAssigned } from '@/lib/email'

async function resolveOrgId(authUserId: string): Promise<string | null> {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('users')
      .select('organization_id')
      .eq('auth_id', authUserId)
      .single()
    return (data as { organization_id: string | null } | null)?.organization_id ?? null
  } catch {
    return null
  }
}

async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await sessionClient.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.title || !body.client_id) {
    return NextResponse.json({ error: 'title and client_id are required' }, { status: 400 })
  }

  const organization_id = await resolveOrgId(user.id)

  const db = createAdminClient()
  const now = new Date().toISOString()

  const insertData: Record<string, unknown> = { ...body, created_at: now, updated_at: now }
  if (organization_id) insertData.organization_id = organization_id

  const { data, error } = await db
    .from('tasks')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[POST /api/tasks]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fire-and-forget: notify assignee via email + audit_log
  if (data.assigned_to) {
    notifyAssignee(db, data).catch(err =>
      console.error('[POST /api/tasks] notification failed:', err)
    )
  }

  return NextResponse.json(data, { status: 201 })
}

async function notifyAssignee(
  db: ReturnType<typeof createAdminClient>,
  task: Record<string, unknown>,
) {
  const taskId    = task.id as string
  const taskTitle = task.title as string
  const assignedTo = task.assigned_to as string
  const clientId  = task.client_id as string

  // Look up assignee profile + client name in parallel
  const [assigneeResult, clientResult] = await Promise.all([
    db.from('users').select('name, email').eq('id', assignedTo).single(),
    db.from('clients').select('name').eq('id', clientId).single(),
  ])

  const assignee    = assigneeResult.data as { name: string; email: string } | null
  const clientName  = (clientResult.data as { name: string } | null)?.name ?? 'Unknown client'

  // In-app notification via audit_log
  await db.from('audit_log').insert({
    action:      'task.assigned',
    entity_type: 'task',
    entity_id:   taskId,
    user_id:     assignedTo,
    metadata: {
      description: `New task assigned: ${taskTitle}`,
      task_title:  taskTitle,
      client_id:   clientId,
      client_name: clientName,
    },
    created_at: new Date().toISOString(),
  })

  // Email
  if (assignee?.email) {
    await sendTaskAssigned({
      taskTitle,
      taskId,
      assigneeName:  assignee.name ?? 'Team member',
      assigneeEmail: assignee.email,
      clientName,
      dueDate:   (task.due_date as string | null) ?? null,
      priority:  (task.priority as string | null) ?? null,
    })
  }
}
