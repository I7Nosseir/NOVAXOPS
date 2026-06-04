import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()

  const supabase = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', authUser.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update page permissions' }, { status: 403 })
  }

  const body = await req.json() as { page_permissions: string[] | null }
  const { page_permissions } = body

  const adminClient = createClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
  )

  const { error } = await adminClient
    .from('users')
    .update({ page_permissions })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
