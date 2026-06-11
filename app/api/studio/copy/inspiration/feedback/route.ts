// ============================================================
// POST /api/studio/copy/inspiration/feedback
//
// Saves the copywriter's cluster feedback (more/less like this)
// and advances session status to 'harvest_pending'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  let body: {
    session_id: string
    feedback: Record<string, 'more' | 'less' | null>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { session_id, feedback } = body

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }
  if (!feedback || typeof feedback !== 'object') {
    return NextResponse.json({ error: 'feedback object is required' }, { status: 400 })
  }

  // Ensure at least one "more" rating
  const hasMore = Object.values(feedback).some(v => v === 'more')
  if (!hasMore) {
    return NextResponse.json(
      { error: 'Select at least one direction as "more like this"' },
      { status: 422 }
    )
  }

  const supabase = db()

  // Verify session exists and is in the right state
  const { data: session, error: fetchErr } = await supabase
    .from('pinterest_scrape_sessions')
    .select('id, status')
    .eq('id', session_id)
    .single()

  if (fetchErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.status !== 'awaiting_feedback' && session.status !== 'harvest_pending') {
    return NextResponse.json(
      { error: `Session is in state "${session.status}" — feedback not applicable` },
      { status: 409 }
    )
  }

  const { error: updateErr } = await supabase
    .from('pinterest_scrape_sessions')
    .update({
      cluster_feedback: feedback,
      status:           'harvest_pending',
      updated_at:       new Date().toISOString(),
    })
    .eq('id', session_id)

  if (updateErr) {
    console.error('[feedback] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sessionId: session_id })
}
