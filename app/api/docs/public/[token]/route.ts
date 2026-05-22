import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/docs/public/[token] — fetch public document by share token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const db = adminSupabase()

  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found or not public' }, { status: 404 })
  return NextResponse.json(data)
}
