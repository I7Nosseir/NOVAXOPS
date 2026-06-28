import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

async function resolveOrgId(authUserId: string): Promise<string | null> {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('users')
      .select('organization_id')
      .eq('auth_id', authUserId)
      .single()
    return (data as { organization_id: string | null } | null)?.organization_id ?? null
  } catch {
    return null
  }
}

async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await sessionClient.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.title || !body.client_id) {
    return NextResponse.json({ error: 'title and client_id are required' }, { status: 400 })
  }

  const organization_id = await resolveOrgId(user.id)
  if (!organization_id) {
    return NextResponse.json({ error: 'Could not resolve organization' }, { status: 500 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('tasks')
    .insert({ ...body, organization_id, created_at: now, updated_at: now })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/tasks]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
