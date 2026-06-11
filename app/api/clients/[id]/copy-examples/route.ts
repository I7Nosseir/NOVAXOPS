import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

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

  return profile ?? null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: client_id } = await params
  const db = createAdminClient()

  const { data, error } = await db
    .from('copy_examples')
    .select('id, platform, language, content_type, caption, slide_captions, framework_used, performance_note, dialect, hashtags, created_at')
    .eq('client_id', client_id)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[copy-examples GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ examples: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: client_id } = await params

  let body: {
    platform?: string
    language?: string
    content_type?: string
    caption: string
    slide_captions?: string[]
    framework_used?: string
    performance_note?: string
    dialect?: string
    hashtags?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.caption?.trim()) {
    return NextResponse.json({ error: 'caption is required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data, error } = await db
    .from('copy_examples')
    .insert({
      client_id,
      platform:        body.platform      ?? 'instagram',
      language:        body.language       ?? 'ar',
      content_type:    body.content_type   ?? 'single',
      caption:         body.caption.trim(),
      slide_captions:  body.slide_captions ?? [],
      framework_used:  body.framework_used ?? null,
      performance_note: body.performance_note ?? null,
      dialect:         body.dialect        ?? 'saudi',
      hashtags:        body.hashtags       ?? [],
      is_approved:     true,
      created_by:      caller.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[copy-examples POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerProfile()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const example_id = searchParams.get('example_id')
  if (!example_id) return NextResponse.json({ error: 'example_id required' }, { status: 400 })

  const { id: client_id } = await params
  const db = createAdminClient()

  const { error } = await db
    .from('copy_examples')
    .delete()
    .eq('id', example_id)
    .eq('client_id', client_id)

  if (error) {
    console.error('[copy-examples DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
