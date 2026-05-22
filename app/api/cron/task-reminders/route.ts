import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTaskReminder } from '@/lib/email'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/cron/task-reminders
 *
 * Vercel Cron: runs on schedule (configure in vercel.json).
 * Sends reminder emails for tasks due within the next 48 hours.
 *
 * Security: Bearer token checked against CRON_SECRET env var.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()

  const now = new Date()
  const in48h = new Date(Date.now() + 48 * 3600 * 1000)

  const { data: tasks, error: tasksErr } = await db
    .from('tasks')
    .select('id, title, due_date, priority, assigned_to, client_id')
    .neq('status', 'completed')
    .not('due_date', 'is', null)
    .not('assigned_to', 'is', null)
    .gte('due_date', now.toISOString().split('T')[0])
    .lte('due_date', in48h.toISOString().split('T')[0])

  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, reminders_sent: 0 })
  }

  // Collect unique user ids and client ids for batch lookups
  const userIds = [...new Set(tasks.map((t) => t.assigned_to as string))]
  const clientIds = [...new Set(tasks.map((t) => t.client_id as string))]

  const [{ data: users }, { data: clients }] = await Promise.all([
    db.from('users').select('id, name, email').in('id', userIds),
    db.from('clients').select('id, name').in('id', clientIds),
  ])

  const userMap: Record<string, { name: string; email: string }> = {}
  for (const u of users ?? []) {
    userMap[u.id as string] = { name: u.name as string, email: u.email as string }
  }

  const clientMap: Record<string, string> = {}
  for (const c of clients ?? []) {
    clientMap[c.id as string] = c.name as string
  }

  let remindersSent = 0

  for (const task of tasks) {
    const assignedUser = userMap[task.assigned_to as string]
    if (!assignedUser?.email) continue

    const hoursUntilDue = Math.round(
      (new Date(task.due_date as string).getTime() - Date.now()) / 3600000,
    )

    const dueDateFormatted = new Date(task.due_date as string).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const result = await sendTaskReminder({
      userEmail: assignedUser.email,
      userName: assignedUser.name,
      taskTitle: task.title as string,
      taskId: task.id as string,
      clientName: clientMap[task.client_id as string] ?? '',
      dueDate: dueDateFormatted,
      priority: (task.priority as string) ?? 'Normal',
      hoursUntilDue,
    })

    if (result.ok) remindersSent++
  }

  return NextResponse.json({ ok: true, reminders_sent: remindersSent })
}
