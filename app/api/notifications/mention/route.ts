import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMentionNotification } from '@/lib/email'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Parse @mentions from a comment body.
 * For each user, check if @{firstName} (case-insensitive) appears in the text.
 * Returns the ids of matched users.
 */
function parseMentionedUserIds(
  commentBody: string,
  users: Array<{ id: string; name: string }>,
): string[] {
  const lower = commentBody.toLowerCase()
  const matched: string[] = []
  for (const user of users) {
    const firstName = user.name.split(' ')[0]
    if (lower.includes(`@${firstName.toLowerCase()}`)) {
      matched.push(user.id)
    }
  }
  return matched
}

// POST /api/notifications/mention
// Body: { taskId: string; commentBody: string; commenterId: string }
export async function POST(req: NextRequest) {
  let body: { taskId?: string; commentBody?: string; commenterId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { taskId, commentBody, commenterId } = body
  if (!taskId || !commentBody || !commenterId) {
    return NextResponse.json(
      { error: 'taskId, commentBody and commenterId are required' },
      { status: 400 },
    )
  }

  const db = serviceClient()

  // Fetch all users
  const { data: users, error: usersErr } = await db
    .from('users')
    .select('id, name, email')

  if (usersErr || !users) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // Determine which users are @mentioned (skip commenter)
  const mentionedIds = parseMentionedUserIds(commentBody, users).filter(
    (id) => id !== commenterId,
  )

  if (mentionedIds.length === 0) {
    return NextResponse.json({ ok: true, mentioned: 0 })
  }

  // Fetch task details
  const { data: task, error: taskErr } = await db
    .from('tasks')
    .select('id, title, client_id')
    .eq('id', taskId)
    .single()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Fetch commenter name
  const commenter = users.find((u) => u.id === commenterId)
  const commenterName = commenter?.name ?? 'A team member'

  // Fetch client name (best-effort)
  const { data: clientRow } = await db
    .from('clients')
    .select('name')
    .eq('id', task.client_id)
    .single()

  const clientName = (clientRow?.name as string | undefined) ?? ''

  // Trim comment preview to 200 chars
  const commentPreview = commentBody.trim().slice(0, 200)

  // Send mention notifications
  let mentioned = 0
  for (const userId of mentionedIds) {
    const mentionedUser = users.find((u) => u.id === userId)
    if (!mentionedUser?.email) continue

    const result = await sendMentionNotification({
      mentionedEmail: mentionedUser.email as string,
      mentionedName: mentionedUser.name as string,
      mentionerName: commenterName,
      taskTitle: task.title as string,
      taskId: task.id as string,
      clientName,
      commentPreview,
    })

    if (result.ok) mentioned++
  }

  return NextResponse.json({ ok: true, mentioned })
}
