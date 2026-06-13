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

  let body: {
    client_id: string
    title: string
    post_ids: string[]
    expiry_days?: number
    client_email?: string
    client_name?: string
    ad_hoc_items?: { caption: string; media_url?: string; media_urls?: string[] }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { client_id, title, post_ids, expiry_days = 7, client_email, client_name, ad_hoc_items } = body
  if (!client_id || !title || !Array.isArray(post_ids)) {
    return NextResponse.json({ error: 'client_id, title, and post_ids are required' }, { status: 400 })
  }
  const adhocList = (ad_hoc_items ?? []).filter(x => x.caption?.trim())
  if (post_ids.length === 0 && adhocList.length === 0) {
    return NextResponse.json({ error: 'At least one post or custom item is required' }, { status: 400 })
  }

  const token = randomBytes(6).toString('hex') // 12-char hex token
  const expires_at = new Date()
  expires_at.setDate(expires_at.getDate() + expiry_days)

  // Build ad-hoc items with stable IDs
  const items = adhocList.map((x) => ({
    id: randomBytes(8).toString('hex'),
    caption: x.caption,
    media_url: x.media_url ?? x.media_urls?.[0] ?? null,
    media_urls: x.media_urls && x.media_urls.length > 0 ? x.media_urls : (x.media_url ? [x.media_url] : null),
    status: 'pending',
  }))

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
      items,
    })
    .select()
    .single()

  if (insertErr || !request) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Insert per-post status rows (scheduled posts + ad-hoc items)
  const statusRows = [
    ...post_ids.map((post_id) => ({ request_id: request.id, post_id, status: 'pending' })),
    ...items.map((item) => ({ request_id: request.id, post_id: item.id, status: 'pending' })),
  ]
  const { error: statusErr } = await db.from('approval_post_statuses').insert(statusRows)

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
  if (Object.keys(decisions ?? {}).length > 100) {
    return NextResponse.json({ error: 'Too many decisions in a single submission' }, { status: 400 })
  }

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
    const [{ data: createdByUser }, { data: client }, { data: postData }] = await Promise.all([
      db.from('users').select('email').eq('id', request.created_by).single(),
      db.from('clients').select('name').eq('id', request.client_id).single(),
      (request.post_ids ?? []).length > 0
        ? db.from('scheduled_posts').select('id, caption').in('id', request.post_ids ?? [])
        : Promise.resolve({ data: [] as { id: string; caption: string }[] }),
    ])

    // Also fetch ad-hoc item captions from the request's items JSON
    const { data: fullRequest } = await db
      .from('approval_requests')
      .select('items')
      .eq('id', request.id)
      .single()
    const adhocItems = (fullRequest?.items ?? []) as { id: string; caption: string }[]

    const postResults = Object.entries(decisions).map(([post_id, { status, note }]) => {
      const scheduledPost = (postData as { id: string; caption: string }[] ?? []).find(p => p.id === post_id)
      const adhocItem = adhocItems.find(x => x.id === post_id)
      return {
        caption: scheduledPost?.caption ?? adhocItem?.caption ?? '(Custom content)',
        status,
        note: note || undefined,
      }
    })

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
        postResults,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, status: overallStatus })
}
