import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import type { ContentBriefData } from '@/lib/types'

// POST /api/brief-requests/[token]/submit — public, no auth. Submits the completed brief.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const body = await req.json() as ContentBriefData

  if (!body.content_type) {
    return NextResponse.json({ error: 'content_type is required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: briefReq, error: fetchError } = await db
    .from('content_brief_requests')
    .select('id, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (fetchError || !briefReq) {
    return NextResponse.json({ error: 'Brief request not found' }, { status: 404 })
  }

  if (briefReq.status === 'submitted') {
    return NextResponse.json({ error: 'Brief already submitted' }, { status: 409 })
  }

  if (new Date(briefReq.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Brief request has expired' }, { status: 410 })
  }

  const { error } = await db
    .from('content_brief_requests')
    .update({
      status: 'submitted',
      brief_data: body,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', briefReq.id)

  if (error) {
    console.error('[brief-requests/submit]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
