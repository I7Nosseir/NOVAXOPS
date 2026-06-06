import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const year = searchParams.get('year')
  const quarter = searchParams.get('quarter')

  if (!client_id || !year || !quarter) {
    return NextResponse.json({ error: 'client_id, year, and quarter are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('client_quarterly_strategies')
    .select('*')
    .eq('client_id', client_id)
    .eq('year', parseInt(year))
    .eq('quarter', parseInt(quarter))
    .maybeSingle()

  if (error) {
    console.error('[ceo/quarterly-strategy] Fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  let body: {
    client_id: string
    year: number
    quarter: number
    goals: string
    themes: string
    kpis: string
    notes: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { client_id, year, quarter, goals = '', themes = '', kpis = '', notes = '' } = body
  if (!client_id || !year || !quarter) {
    return NextResponse.json({ error: 'client_id, year, and quarter are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('client_quarterly_strategies')
    .upsert(
      { client_id, year, quarter, goals, themes, kpis, notes, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,year,quarter' },
    )
    .select()
    .single()

  if (error) {
    console.error('[ceo/quarterly-strategy] Upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
