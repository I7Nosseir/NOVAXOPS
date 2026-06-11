import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/api-auth'

const GEMINI_MODEL = 'gemini-3-flash-preview'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface ClientRow {
  id: string
  name: string
  status: string
  crisis_mode: boolean
  brand_identity: Record<string, string> | null
}

interface TaskRow {
  id: string
  title: string
  pipeline_stage: string
  status: string
  due_date: string | null
  client_id: string | null
  priority: string | null
}

interface CommentRow {
  content: string
  created_at: string
  task_id: string
  user_id: string
}

interface PostRow {
  id: string
  platform: string
  scheduled_at: string
  status: string
  client_id: string | null
}

interface UserRow {
  id: string
  name: string
  role: string
}

export async function GET() {
  const auth = await requireRole(['admin', 'ceo'])
  if ('error' in auth) return auth.error

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 500 })
  }

  const db = adminSupabase()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: clients },
    { data: tasks },
    { data: comments },
    { data: upcoming },
    { data: recentPublished },
    { data: users },
  ] = await Promise.all([
    db.from('clients')
      .select('id, name, status, crisis_mode, brand_identity')
      .eq('status', 'active')
      .returns<ClientRow[]>(),
    db.from('tasks')
      .select('id, title, pipeline_stage, status, due_date, client_id, priority')
      .eq('status', 'active')
      .returns<TaskRow[]>(),
    db.from('task_comments')
      .select('content, created_at, task_id, user_id')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(25)
      .returns<CommentRow[]>(),
    db.from('scheduled_posts')
      .select('id, platform, scheduled_at, status, client_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', fourteenDaysAhead)
      .order('scheduled_at')
      .limit(40)
      .returns<PostRow[]>(),
    db.from('scheduled_posts')
      .select('id, platform, scheduled_at, status, client_id')
      .eq('status', 'published')
      .gte('scheduled_at', sevenDaysAgo)
      .returns<PostRow[]>(),
    db.from('users')
      .select('id, name, role')
      .returns<UserRow[]>(),
  ])

  // Build lookup maps
  const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))
  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  const taskMap = Object.fromEntries((tasks ?? []).map(t => [t.id, t]))

  // Identify overdue tasks
  const overdueTasks = (tasks ?? [])
    .filter(t => t.due_date && new Date(t.due_date) < now)
    .map(t => ({
      ...t,
      clientName: t.client_id ? (clientMap[t.client_id]?.name ?? 'Unknown client') : 'No client',
      daysOverdue: Math.floor((now.getTime() - new Date(t.due_date!).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  // Pipeline stage counts
  const STAGE_ORDER = ['strategy', 'ideas', 'calendar', 'copy', 'design', 'review', 'approval', 'scheduled', 'published', 'reporting']
  const stageCounts: Record<string, { count: number; clientNames: string[] }> = {}
  for (const task of tasks ?? []) {
    const s = task.pipeline_stage
    if (!stageCounts[s]) stageCounts[s] = { count: 0, clientNames: [] }
    stageCounts[s].count++
    if (task.client_id) {
      const name = clientMap[task.client_id]?.name
      if (name && !stageCounts[s].clientNames.includes(name)) {
        stageCounts[s].clientNames.push(name)
      }
    }
  }

  // Published counts per client (last 7 days)
  const publishedPerClient: Record<string, number> = {}
  for (const p of recentPublished ?? []) {
    if (!p.client_id) continue
    publishedPerClient[p.client_id] = (publishedPerClient[p.client_id] ?? 0) + 1
  }

  // Clients with nothing scheduled in next 14 days
  const scheduledClientIds = new Set((upcoming ?? []).map(p => p.client_id).filter(Boolean))
  const clientsWithNoScheduled = (clients ?? []).filter(c => !scheduledClientIds.has(c.id))

  // ── Build prompt sections ───────────────────────────────────────────────────

  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const clientLines = (clients ?? []).map(c => {
    const clientTasks = (tasks ?? []).filter(t => t.client_id === c.id)
    const overdueCount = clientTasks.filter(t => t.due_date && new Date(t.due_date) < now).length
    const published = publishedPerClient[c.id] ?? 0
    const statusLabel = c.crisis_mode ? 'CRISIS' : overdueCount > 0 ? 'At Risk' : clientTasks.length > 0 ? 'Active' : 'Quiet'
    return `- ${c.name} | ${statusLabel} | Tasks: ${clientTasks.length} active, ${overdueCount} overdue | Published last 7d: ${published} | Industry: ${c.brand_identity?.industry ?? 'N/A'}`
  }).join('\n') || 'No active clients.'

  const pipelineLines = STAGE_ORDER
    .filter(s => stageCounts[s]?.count > 0)
    .map(s => {
      const { count, clientNames } = stageCounts[s]
      const label = s.charAt(0).toUpperCase() + s.slice(1)
      const clientStr = clientNames.slice(0, 3).join(', ') + (clientNames.length > 3 ? ` +${clientNames.length - 3} more` : '')
      return `- ${label}: ${count} task${count > 1 ? 's' : ''} (${clientStr})`
    }).join('\n') || 'No tasks in pipeline.'

  const overdueLines = overdueTasks.slice(0, 8).map(t =>
    `- "${t.title}" | ${t.clientName} | ${t.daysOverdue}d overdue | Stage: ${t.pipeline_stage}${t.priority === 'high' ? ' | PRIORITY: HIGH' : ''}`
  ).join('\n') || 'None — all tasks on time.'

  const commentLines = (comments ?? []).slice(0, 15).map(c => {
    const task = taskMap[c.task_id]
    const user = userMap[c.user_id]
    const hoursAgo = Math.round((now.getTime() - new Date(c.created_at).getTime()) / 3_600_000)
    const text = typeof c.content === 'string' ? c.content.slice(0, 110) : ''
    return `- ${user?.name ?? 'Team'} on "${task?.title ?? 'unknown task'}": "${text}" (${hoursAgo}h ago)`
  }).join('\n') || 'No comments in last 7 days.'

  const upcomingLines = (upcoming ?? []).slice(0, 15).map(p => {
    const client = p.client_id ? clientMap[p.client_id] : null
    const date = new Date(p.scheduled_at).toLocaleDateString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return `- ${client?.name ?? 'Unknown'} | ${p.platform} | ${date}`
  }).join('\n') || 'Nothing scheduled in next 14 days.'

  const noContentClients = clientsWithNoScheduled.length > 0
    ? `CLIENTS WITH NO SCHEDULED CONTENT (next 14 days): ${clientsWithNoScheduled.map(c => c.name).join(', ')}`
    : 'All active clients have content scheduled.'

  const recentPublishedLines = Object.entries(publishedPerClient)
    .map(([id, count]) => `- ${clientMap[id]?.name ?? id}: ${count} published`)
    .join('\n') || 'No posts published in last 7 days.'

  const prompt = `You are the CEO's personal intelligence agent at NOVAX, a social media agency. Scan the operational data below and deliver a crisp, honest pulse report. Be direct — no padding, no diplomatic softening. If something is fine, say it's fine in one word. Flag problems clearly.

TODAY: ${today}
ACTIVE CLIENTS: ${(clients ?? []).length}
ACTIVE TASKS: ${(tasks ?? []).length}
OVERDUE: ${overdueTasks.length}

═══ CLIENT STATUS ═══
${clientLines}

═══ PIPELINE STATE ═══
${pipelineLines}

═══ OVERDUE TASKS ═══
${overdueLines}

═══ TEAM COMMENTS (last 7 days — ${(comments ?? []).length} total) ═══
${commentLines}

═══ UPCOMING CONTENT (next 14 days) ═══
${upcomingLines}
${noContentClients}

═══ RECENTLY PUBLISHED (last 7 days) ═══
${recentPublishedLines}

────────────────────────────────────────

Write the CEO Pulse Report now. Strict structure, strict word limits:

## What's Happening Right Now
2-3 sentences. Honest state of the agency today — overall momentum, biggest concern, one thing going well.

## Clients Needing Attention
List only clients that are CRISIS, At Risk, or have 0 content scheduled. For each: name, the specific problem, the one immediate action. If all clients are healthy, write "All clients healthy."

## Pipeline Health
Which stages are congested or stalled? What is moving well? Any bottleneck? Be specific about stage names and counts.

## Team Activity
What does the comment volume and task distribution signal about where the team is focused? Any concentration risk (one client consuming all bandwidth)? Any silence that's concerning?

## Publishing Outlook
Which clients have no scheduled content? Who is well covered? Any urgency?

## 3 Actions for Today
Numbered. Specific. Completable today. Not strategy — actual next steps.

Rules: No hashtags. No emojis. Under 520 words. Executive prose.`

  try {
    let result = ''

    if (process.env.ANTHROPIC_API_KEY) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      })
      result = response.content[0].type === 'text' ? response.content[0].text : ''
    } else if (process.env.GEMINI_API_KEY) {
      result = await callGemini(prompt)
    } else {
      return NextResponse.json({ error: 'No AI API key configured.' }, { status: 500 })
    }

    return NextResponse.json({ result, generated_at: now.toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    console.error('[ceo/pulse]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
