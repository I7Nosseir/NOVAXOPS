import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/brief-requests?task_id=xxx — fetch brief request for a task (authenticated)
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const taskId = req.nextUrl.searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'Missing task_id' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('content_brief_requests')
    .select('id, token, status, brief_data, submitted_at, created_at, expires_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[brief-requests] GET:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

// POST /api/brief-requests — create a brief request for a task (authenticated)
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { task_id, client_id } = body as { task_id?: string; client_id?: string }
  if (!task_id || !client_id) {
    return NextResponse.json({ error: 'Missing task_id or client_id' }, { status: 400 })
  }

  const db = createAdminClient()

  // Return existing pending request if one already exists
  const { data: existing } = await db
    .from('content_brief_requests')
    .select('id, token, status')
    .eq('task_id', task_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ token: existing.token, existed: true })
  }

  const { data, error } = await db
    .from('content_brief_requests')
    .insert({ task_id, client_id, created_by: user.id })
    .select('id, token')
    .single()

  if (error) {
    console.error('[brief-requests] POST:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token: data.token })
}
