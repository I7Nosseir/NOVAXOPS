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

// GET /api/organizations/[id]/members — list all members of an org
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertSuperAdmin()
  if (guard) return guard

  const { id } = await params
  const db = adminDb()
  const { data, error } = await db
    .from('users')
    .select('id, name, email, role, is_super_admin, initials, color, created_at')
    .eq('organization_id', id)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/organizations/[id]/members — move a user into this org
// Body: { user_id: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertSuperAdmin()
  if (guard) return guard

  const { id } = await params
  const { user_id } = await req.json() as { user_id?: string }
  if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  const db = adminDb()

  // Verify org exists
  const { data: org } = await db.from('organizations').select('id').eq('id', id).single()
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { error } = await db
    .from('users')
    .update({ organization_id: id })
    .eq('id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
