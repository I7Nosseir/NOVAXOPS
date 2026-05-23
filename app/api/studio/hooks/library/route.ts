import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const HAS_DB = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// POST /api/studio/hooks/library — save a hook to the library
export async function POST(req: NextRequest) {
  let body: {
    client_id?: string | null
    created_by?: string | null
    hook_text: string
    hook_type: string
    format_rec: string
    clarity_score: number
    context_score: number
    curiosity_score: number
    virality_tier: string
    platform?: string
    brief_context?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.hook_text?.trim()) {
    return NextResponse.json({ error: 'hook_text required' }, { status: 400 })
  }

  if (!HAS_DB) {
    return NextResponse.json({ ok: true, _mock: true })
  }

  const db = adminSupabase()
  const { data, error } = await db
    .from('hook_library')
    .insert({
      client_id:       body.client_id       || null,
      created_by:      body.created_by      || null,
      hook_text:       body.hook_text.trim(),
      hook_type:       body.hook_type,
      format_rec:      body.format_rec,
      clarity_score:   body.clarity_score,
      context_score:   body.context_score,
      curiosity_score: body.curiosity_score,
      virality_tier:   body.virality_tier,
      platform:        body.platform        || null,
      brief_context:   body.brief_context   || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET /api/studio/hooks/library?client_id=&platform=&hook_type=&tier=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const platform  = searchParams.get('platform')
  const hook_type = searchParams.get('hook_type')
  const tier      = searchParams.get('tier')

  if (!HAS_DB) {
    return NextResponse.json({ hooks: [], _mock: true })
  }

  const db = adminSupabase()
  let query = db
    .from('hook_library')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (client_id) query = query.eq('client_id', client_id)
  if (platform)  query = query.eq('platform', platform)
  if (hook_type) query = query.eq('hook_type', hook_type)
  if (tier)      query = query.eq('virality_tier', tier)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ hooks: data ?? [] })
}

// PATCH /api/studio/hooks/library — toggle star on a hook
export async function PATCH(req: NextRequest) {
  let body: { id: string; is_starred: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!HAS_DB) return NextResponse.json({ ok: true, _mock: true })

  const db = adminSupabase()
  const { error } = await db
    .from('hook_library')
    .update({ is_starred: body.is_starred })
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
