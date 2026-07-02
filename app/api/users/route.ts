import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET /api/users — returns all users (used by OrganizationsTab for member assignment)
export async function GET() {
  const db = createAdminClient()
  const { data, error } = await db
    .from('users')
    .select('id, name, email, role, organization_id')
    .order('name')

  if (error) {
    console.error('[GET /api/users]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
