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

async function assertSuperAdmin(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = adminDb()
  const { data: profile } = await db.from('users').select('id, is_super_admin').eq('auth_id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { userId: profile.id }
}

// GET /api/organizations — list all orgs with member + client counts
export async function GET() {
  const check = await assertSuperAdmin()
  if (check instanceof NextResponse) return check

  const db = adminDb()
  const { data: orgs, error } = await db
    .from('organizations')
    .select('id, name, slug, plan, status, max_clients, max_users, ai_calls_per_month, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach member + client counts
  const orgIds = (orgs ?? []).map(o => o.id)

  const [membersRes, clientsRes] = await Promise.all([
    db.from('users').select('organization_id').in('organization_id', orgIds),
    db.from('clients').select('organization_id').in('organization_id', orgIds),
  ])

  const memberCounts: Record<string, number> = {}
  const clientCounts: Record<string, number> = {}
  for (const u of membersRes.data ?? []) memberCounts[u.organization_id] = (memberCounts[u.organization_id] ?? 0) + 1
  for (const c of clientsRes.data ?? []) clientCounts[c.organization_id] = (clientCounts[c.organization_id] ?? 0) + 1

  return NextResponse.json(
    (orgs ?? []).map(o => ({
      ...o,
      member_count: memberCounts[o.id] ?? 0,
      client_count: clientCounts[o.id] ?? 0,
    }))
  )
}

// POST /api/organizations — create new organization
export async function POST(req: NextRequest) {
  const check = await assertSuperAdmin()
  if (check instanceof NextResponse) return check

  const body = await req.json() as {
    name?: string
    slug?: string
    plan?: string
    max_clients?: number
    max_users?: number
  }

  const name = body.name?.trim()
  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')

  if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })

  const plan = body.plan ?? 'trial'

  const db = adminDb()
  const { data, error } = await db
    .from('organizations')
    .insert({
      name,
      slug,
      plan,
      status: 'active',
      max_clients:        body.max_clients        ?? 5,
      max_users:          body.max_users          ?? 5,
      ai_calls_per_month: 500,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
