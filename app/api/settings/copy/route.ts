import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getCallerProfile() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  return profile as { id: string; role: string } | null
}

export async function GET() {
  const db = createAdminClient()
  const { data } = await db
    .from('platform_settings')
    .select('value, updated_at')
    .eq('key', 'copy_instructions')
    .maybeSingle()
  return NextResponse.json({ value: (data as { value: string; updated_at: string } | null)?.value ?? '', updated_at: (data as { value: string; updated_at: string } | null)?.updated_at ?? null })
}

export async function POST(req: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creative_director'].includes(caller.role)) {
    return NextResponse.json({ error: 'Only Admin and Creative Director can update copy instructions.' }, { status: 403 })
  }

  const { value } = await req.json() as { value: string }
  const db = createAdminClient()
  const { error } = await db
    .from('platform_settings')
    .upsert({ key: 'copy_instructions', value: value ?? '', updated_by: caller.id, updated_at: new Date().toISOString() })

  if (error) {
    console.error('[settings/copy] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
