import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMentionNotification } from '@/lib/email'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Extract all @tokens from a comment body.
 * Returns the raw tokens without the leading @.
 */
function extractMentionTokens(body: string): string[] {
  const matches = body.match(/@(\w+)/g) ?? []
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
}

/**
 * Match @tokens against the users list.
 * A user matches if their first name OR full name (no spaces) matches the token.
 * Returns unique matched user ids, excluding the commenter.
 */
function parseMentionedUserIds(
  body: string,
  users: Array<{ id: string; name: string }>,
  excludeId: string,
): string[] {
  const tokens = extractMentionTokens(body)
  if (tokens.length === 0) return []

  const matched = new Set<string>()
  for (const user of users) {
    if (user.id === excludeId) continue
    const firstName = user.name.split(' ')[0].toLowerCase()
    const fullNoSpaces = user.name.toLowerCase().replace(/\s+/g, '')
    for (const token of tokens) {
      if (token === firstName || token === fullNoSpaces) {
        matched.add(user.id)
        break
      }
    }
  }
  return [...matched]
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

  // Quick exit: no @ in the comment at all
  if (!commentBody.includes('@')) {
    return NextResponse.json({ ok: true, mentioned: 0 })
  }

  const db = serviceClient()

  // Fetch all users (id + name + email)
  const { data: users, error: usersErr } = await db
    .from('users')
    .select('id, name, email')

  if (usersErr || !users) {
    console.error('[mention] Failed to fetch users:', usersErr?.message)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  const mentionedIds = parseMentionedUserIds(commentBody, users, commenterId)

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
    console.error('[mention] Task not found:', taskId, taskErr?.message)
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Commenter name
  const commenter = users.find(u => u.id === commenterId)
  const commenterName = (commenter?.name as string | undefined) ?? 'A team member'

  // Client name (best-effort)
  const { data: clientRow } = await db
    .from('clients')
    .select('name')
    .eq('id', task.client_id)
    .single()

  const clientName = (clientRow?.name as string | undefined) ?? ''
  const commentPreview = commentBody.trim().slice(0, 200)

  // Send one email per mentioned user
  let mentioned = 0
  const errors: string[] = []

  for (const userId of mentionedIds) {
    const mentionedUser = users.find(u => u.id === userId)
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

    if (result.ok) {
      mentioned++
    } else {
      console.error('[mention] Email failed for', mentionedUser.email, result.error)
      errors.push(result.error ?? 'Unknown')
    }
  }

  return NextResponse.json({ ok: true, mentioned, errors: errors.length ? errors : undefined })
}
