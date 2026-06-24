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

// DELETE /api/organizations/[id]/members/[userId]
// Moves the user back to NOVAX (the founding org).
// Never deletes a user — just changes their org membership.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const guard = await assertSuperAdmin()
  if (guard) return guard

  const { id, userId } = await params
  const db = adminDb()

  // Resolve NOVAX org id
  const { data: novax } = await db
    .from('organizations')
    .select('id')
    .eq('slug', 'novax')
    .single()

  if (!novax) return NextResponse.json({ error: 'NOVAX org not found' }, { status: 500 })
  if (novax.id === id) return NextResponse.json({ error: 'Cannot remove member from the NOVAX org' }, { status: 400 })

  const { error } = await db
    .from('users')
    .update({ organization_id: novax.id })
    .eq('id', userId)
    .eq('organization_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
