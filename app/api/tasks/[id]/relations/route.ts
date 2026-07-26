import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const [{ data: asFrom, error: e1 }, { data: asTo, error: e2 }] = await Promise.all([
    supabase
      .from('task_relations')
      .select('*, linked_task:to_task_id(id, title, pipeline_stage, status, client_id)')
      .eq('from_task_id', id),
    supabase
      .from('task_relations')
      .select('*, linked_task:from_task_id(id, title, pipeline_stage, status, client_id)')
      .eq('to_task_id', id),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })
  return NextResponse.json({ outgoing: asFrom ?? [], incoming: asTo ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { to_task_id: string; relation_type: 'blocks' | 'related' }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_relations')
    .insert({ from_task_id: id, to_task_id: body.to_task_id, relation_type: body.relation_type })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(req.url)
  const relationId = searchParams.get('relationId')
  if (!relationId) return NextResponse.json({ error: 'relationId required' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('task_relations').delete().eq('id', relationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
