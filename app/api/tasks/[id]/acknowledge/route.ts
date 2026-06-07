import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/tasks/[id]/acknowledge
// Body: { user_id: string; type: 'seen' | 'read' }
// Uses service role to bypass RLS — validates that user_id matches the task's assignee.
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

  const supabase = db()

  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('assigned_to, seen_at, read_at')
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

  const { error } = await supabase.from('tasks').update(updates).eq('id', id)
  if (error) {
    console.error('[tasks/acknowledge]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
