import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_time_logs')
    .select('*, user:user_id(id, name, initials, color)')
    .eq('task_id', id)
    .order('logged_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { user_id: string; hours: number; note?: string; logged_at?: string }
  if (!body.hours || body.hours <= 0) {
    return NextResponse.json({ error: 'hours must be positive' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_time_logs')
    .insert({
      task_id: id,
      user_id: body.user_id,
      hours: body.hours,
      note: body.note ?? null,
      logged_at: body.logged_at ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const logId = searchParams.get('logId')
  if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('task_time_logs').delete().eq('id', logId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
