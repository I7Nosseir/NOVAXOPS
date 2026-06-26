import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOrgId } from '@/lib/api-auth'

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET /api/ai-feedback?client_id=&agent_type=
// Returns last 8 negative feedback entries for prompt injection.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const agentType = searchParams.get('agent_type')

  if (!clientId || !agentType) {
    return NextResponse.json({ error: 'client_id and agent_type required' }, { status: 400 })
  }

  const db = adminSupabase()
  if (!db) return NextResponse.json({ feedback: [] })

  const { data, error } = await db
    .from('ai_feedback')
    .select('rating, tags, correction_text, edited_version, created_at')
    .eq('client_id', clientId)
    .eq('agent_type', agentType)
    .eq('rating', 'negative')
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) {
    console.error('[ai-feedback GET]', error.message)
    return NextResponse.json({ feedback: [] })
  }

  return NextResponse.json({ feedback: data })
}

// POST /api/ai-feedback
// Save a thumbs up or thumbs down with optional correction data.
export async function POST(req: NextRequest) {
  const db = adminSupabase()
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: {
    client_id: string
    agent_type: string
    content_snapshot?: string
    rating: 'positive' | 'negative'
    tags?: string[]
    correction_text?: string
    edited_version?: string
    created_by?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.client_id || !body.agent_type || !body.rating) {
    return NextResponse.json({ error: 'client_id, agent_type, rating required' }, { status: 400 })
  }

  const orgId = await resolveOrgId({ clientId: body.client_id, userId: body.created_by })

  const { data, error } = await db
    .from('ai_feedback')
    .insert({
      client_id: body.client_id,
      agent_type: body.agent_type,
      content_snapshot: (body.content_snapshot ?? '').slice(0, 500),
      rating: body.rating,
      tags: body.tags ?? [],
      correction_text: body.correction_text ?? '',
      edited_version: body.edited_version ?? '',
      created_by: body.created_by ?? null,
      organization_id: orgId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[ai-feedback POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
