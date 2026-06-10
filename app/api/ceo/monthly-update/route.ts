import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireRole } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin', 'ceo']); if ('error' in auth) return auth.error
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!client_id || !year || !month) {
    return NextResponse.json({ error: 'client_id, year, and month are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('client_monthly_updates')
    .select('*')
    .eq('client_id', client_id)
    .eq('year', parseInt(year))
    .eq('month', parseInt(month))
    .maybeSingle()

  if (error) {
    console.error('[ceo/monthly-update] Fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'ceo']); if ('error' in auth) return auth.error
  let body: {
    client_id: string
    year: number
    month: number
    content_summary: string
    what_worked: string
    what_didnt: string
    posts_published: number
    notes: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const {
    client_id, year, month,
    content_summary = '', what_worked = '', what_didnt = '',
    posts_published = 0, notes = '',
  } = body

  if (!client_id || !year || !month) {
    return NextResponse.json({ error: 'client_id, year, and month are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('client_monthly_updates')
    .upsert(
      { client_id, year, month, content_summary, what_worked, what_didnt, posts_published, notes, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,year,month' },
    )
    .select()
    .single()

  if (error) {
    console.error('[ceo/monthly-update] Upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
