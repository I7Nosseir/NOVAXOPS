import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { sendApprovalRequest, sendApprovalDecision } from '@/lib/email'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/approval?token=xxx — public, no auth required
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const db = adminSupabase()

  const { data: request, error } = await db
    .from('approval_requests')
    .select('*, approval_post_statuses(*)')
    .eq('token', token)
    .single()

  if (error || !request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch the actual post data for the post_ids
  const postIds: string[] = request.post_ids ?? []
  const { data: posts } = postIds.length > 0
    ? await db.from('scheduled_posts').select('*').in('id', postIds)
    : { data: [] }

  // DB stores media_urls (array). The client expects media_url (singular) for the
  // first image AND media_urls for carousels. Add both to every row.
  const mappedPosts = (posts ?? []).map(p => {
    const urls = (p.media_urls as string[] | null) ?? []
    return { ...p, media_url: urls[0] ?? null, media_urls: urls }
  })

  return NextResponse.json({ request, posts: mappedPosts })
}

// POST /api/approval — create new request (authenticated)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  let body: { client_id: string; title: string; post_ids: string[]; expiry_days?: number; client_email?: string; client_name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { client_id, title, post_ids, expiry_days = 7, client_email, client_name } = body
  if (!client_id || !title || !Array.isArray(post_ids) || post_ids.length === 0) {
    return NextResponse.json({ error: 'client_id, title, and post_ids are required' }, { status: 400 })
  }

  const token = randomBytes(6).toString('hex') // 12-char hex token
  const expires_at = new Date()
  expires_at.setDate(expires_at.getDate() + expiry_days)

  const db = adminSupabase()

  const { data: request, error: insertErr } = await db
    .from('approval_requests')
    .insert({
      client_id,
      title,
      token,
      post_ids,
      status: 'pending',
      client_note: '',
      notify_email: client_email ?? null,
      created_by: profile?.id ?? null,
      expires_at: expires_at.toISOString(),
    })
    .select()
    .single()

  if (insertErr || !request) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Insert per-post status rows
  const { error: statusErr } = await db.from('approval_post_statuses').insert(
    post_ids.map((post_id) => ({ request_id: request.id, post_id, status: 'pending' }))
  )

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 })
  }

  // Fire-and-forget approval email if client_email was supplied
  if (client_email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'
    sendApprovalRequest({
      clientEmail: client_email,
      clientName: client_name ?? client_email,
      requestTitle: title,
      approvalLink: `${appUrl}/approval/${token}`,
      expiresAt: expires_at.toISOString(),
    }).catch(() => {
      // Best-effort — do not fail the request if email sending fails
    })
  }

  return NextResponse.json({ id: request.id, token })
}

// PATCH /api/approval — client submits review (public, by token)
export async function PATCH(req: NextRequest) {
  let body: {
    token: string
    decisions: Record<string, { status: 'approved' | 'changes_requested'; note: string }>
    client_note: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { token, decisions, client_note } = body
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const db = adminSupabase()

  const { data: request, error: fetchErr } = await db
    .from('approval_requests')
    .select('id, post_ids, title, client_id, created_by')
    .eq('token', token)
    .single()

  if (fetchErr || !request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const statuses = Object.values(decisions).map((d) => d.status)
  const overallStatus = statuses.every((s) => s === 'approved')
    ? 'approved'
    : statuses.some((s) => s === 'changes_requested')
    ? 'changes_requested'
    : 'pending'

  await db.from('approval_requests').update({
    status: overallStatus,
    client_note: client_note ?? '',
  }).eq('id', request.id)

  for (const [post_id, { status, note }] of Object.entries(decisions)) {
    await db.from('approval_post_statuses')
      .update({ status, note: note ?? '' })
      .match({ request_id: request.id, post_id })
  }

  // Fire-and-forget: notify the team member who created the request
  if (request.created_by) {
    const [{ data: createdByUser }, { data: client }] = await Promise.all([
      db.from('users').select('email').eq('id', request.created_by).single(),
      db.from('clients').select('name').eq('id', request.client_id).single(),
    ])

    const teamEmail = createdByUser?.email ?? process.env.NOVA_TEAM_EMAIL
    if (teamEmail) {
      const approvedCount = statuses.filter(s => s === 'approved').length
      const changesCount = statuses.filter(s => s === 'changes_requested').length
      const summary = `${approvedCount} approved, ${changesCount} changes requested`
      sendApprovalDecision({
        teamEmail,
        clientName: client?.name ?? 'Client',
        requestTitle: request.title,
        decisionSummary: summary,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, status: overallStatus })
}
