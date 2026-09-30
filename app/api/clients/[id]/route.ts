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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: profile, error: profileError } = await db
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }

  const role = (profile as { role: string }).role
  const body = await req.json() as Record<string, unknown>

  // Only these roles may update client records
  const canManageClients = ['admin', 'ceo', 'creative_director', 'account_manager'].includes(role)
  if (!canManageClients) {
    return NextResponse.json({ error: 'You do not have permission to edit clients' }, { status: 403 })
  }

  // Crisis mode toggle is further restricted to admin and ceo
  if ('is_in_crisis' in body && role !== 'admin' && role !== 'ceo') {
    return NextResponse.json({ error: 'Only admin or ceo can toggle crisis mode' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })

  const { error } = await db.from('clients').update(body).eq('id', id)
  if (error) {
    console.error('[PATCH /api/clients/[id]]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
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
