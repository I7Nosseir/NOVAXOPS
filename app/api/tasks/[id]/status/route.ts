import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { TaskStatus } from '@/lib/types'

const MANAGER_ROLES = ['admin', 'ceo', 'creative_director', 'account_manager', 'strategist']
const VALID_STATUSES: TaskStatus[] = ['pending', 'active', 'blocked', 'completed']

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// PATCH /api/tasks/[id]/status
// Body: { user_id: string; role: string; status: TaskStatus }
// Allowed if: caller is the task assignee OR has a manager-level role.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { user_id?: string; role?: string; status?: TaskStatus }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { user_id, role, status } = body
  if (!user_id || !role || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'user_id, role, and valid status required' }, { status: 400 })
  }

  const supabase = db()

  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', id)
    .single()

  if (fetchErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const isAssignee = task.assigned_to === user_id
  const isManager = MANAGER_ROLES.includes(role)
  if (!isAssignee && !isManager) {
    return NextResponse.json({ error: 'Not authorized to update this task' }, { status: 403 })
  }

  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[tasks/status]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
