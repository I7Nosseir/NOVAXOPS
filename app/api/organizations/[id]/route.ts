import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function assertSuperAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = adminDb()
  const { data } = await db.from('users').select('is_super_admin').eq('auth_id', user.id).single()
  if (!data?.is_super_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// PATCH /api/organizations/[id] — update org settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertSuperAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json() as {
    name?: string
    plan?: string
    status?: string
    max_clients?: number
    max_users?: number
    ai_calls_per_month?: number
  }

  const patch: Record<string, unknown> = {}
  if (body.name)               patch.name               = body.name.trim()
  if (body.plan)               patch.plan               = body.plan
  if (body.status)             patch.status             = body.status
  if (body.max_clients  != null) patch.max_clients        = body.max_clients
  if (body.max_users    != null) patch.max_users          = body.max_users
  if (body.ai_calls_per_month != null) patch.ai_calls_per_month = body.ai_calls_per_month
  patch.updated_at = new Date().toISOString()

  const db = adminDb()
  const { data, error } = await db
    .from('organizations')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
