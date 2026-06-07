import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET /api/brief-requests/[token] — public, no auth. Returns brief context for the form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const db = createAdminClient()

  const { data: briefReq, error } = await db
    .from('content_brief_requests')
    .select('id, task_id, client_id, status, expires_at, brief_data, submitted_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !briefReq) {
    return NextResponse.json({ error: 'Brief request not found' }, { status: 404 })
  }

  if (new Date(briefReq.expires_at) < new Date()) {
    await db
      .from('content_brief_requests')
      .update({ status: 'expired' })
      .eq('token', token)
    return NextResponse.json({ error: 'This brief request has expired' }, { status: 410 })
  }

  const [taskRes, clientRes] = await Promise.all([
    db.from('tasks').select('title').eq('id', briefReq.task_id).single(),
    db.from('clients').select('name, color').eq('id', briefReq.client_id).single(),
  ])

  return NextResponse.json({
    task_title: taskRes.data?.title ?? 'Creative Brief',
    client_name: clientRes.data?.name ?? '',
    client_color: clientRes.data?.color ?? '#1B3D38',
    status: briefReq.status,
    expires_at: briefReq.expires_at,
    brief_data: briefReq.brief_data,
  })
}
