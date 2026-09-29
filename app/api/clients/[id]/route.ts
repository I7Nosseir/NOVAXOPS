import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch the requesting user's role
  const { data: profile, error: profileError } = await db
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }

  const role = (profile as { role: string }).role
  if (role !== 'admin' && role !== 'ceo') {
    return NextResponse.json({ error: 'Only admin or ceo can archive clients' }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
  }

  const { error } = await db
    .from('clients')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/clients/[id]] Archive failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
