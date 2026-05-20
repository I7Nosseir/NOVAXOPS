import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { schedulePost, deleteScheduledPost, PLATFORM_TO_METRICOOL } from '@/lib/metricool'
import type { SocialPlatform } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/metricool/schedule
 *
 * Persists a post to DB (status=draft) then pushes it to Metricool.
 * If Metricool succeeds  → updates status='scheduled' + stores metricool_post_id.
 * If Metricool fails     → leaves status='draft', returns saved_as_draft=true.
 *
 * Body:
 *   client_id     string (UUID)
 *   platforms     SocialPlatform[]
 *   caption       string (English caption)
 *   caption_ar?   string (Arabic — appended after newlines if provided)
 *   media_url?    string (public URL)
 *   scheduled_at  string (ISO 8601)
 *   task_id?      string (UUID)
 */
// Converts relative proxy URLs (e.g. /api/proxy/drive?id=…) to absolute so Metricool
// can fetch them. Relative URLs would only work from the same origin — Metricool is external.
function toAbsolute(url: string | undefined, req: NextRequest): string | undefined {
  if (!url) return undefined
  if (url.startsWith('/')) {
    const host = req.headers.get('host') ?? 'localhost:3000'
    const proto = host.includes('localhost') ? 'http' : 'https'
    return `${proto}://${host}${url}`
  }
  return url
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client_id, platforms, caption, caption_ar, media_url, media_urls, thumbnail_url, scheduled_at, task_id } = body

  // Carousel takes precedence over single URL; make all URLs absolute
  const rawUrls: string[] | undefined = media_urls?.filter(Boolean).length
    ? media_urls.filter(Boolean)
    : media_url ? [media_url] : undefined
  const resolvedMediaUrls = rawUrls?.map(u => toAbsolute(u, req) ?? u)
  const resolvedThumbnail = toAbsolute(thumbnail_url, req)

  if (!client_id || !platforms?.length || (!caption?.trim() && !caption_ar?.trim()) || !scheduled_at) {
    return NextResponse.json(
      { error: 'client_id, platforms, caption, and scheduled_at are required' },
      { status: 400 }
    )
  }

  // Resolve client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', client_id)
    .single()

  if (clientError || !client) {
    return NextResponse.json(
      { error: `Client not found (id: ${client_id}). ${clientError?.message ?? ''}` },
      { status: 404 }
    )
  }

  // Merge captions — handle Arabic-only posts (caption may be empty)
  const enPart = caption?.trim() ?? ''
  const arPart = caption_ar?.trim() ?? ''
  const finalCaption = enPart && arPart
    ? `${enPart}\n\n${arPart}`
    : enPart || arPart

  // Metricool DateTimeInfo is a JSON object { dateTime, timezone }, not a plain string
  const publicationDate = {
    dateTime: new Date(scheduled_at).toISOString().replace(/\.\d{3}Z$/, ''),
    timezone: 'UTC',
  }

  // Persist to DB first
  const { data: post, error: insertError } = await supabase
    .from('scheduled_posts')
    .insert({
      client_id,
      task_id: task_id || null,
      platforms: platforms as SocialPlatform[],
      caption: finalCaption,
      media_urls: resolvedMediaUrls ?? [],
      scheduled_at,
      status: 'draft',
    })
    .select()
    .single()

  if (insertError || !post) {
    return NextResponse.json(
      { error: `DB insert failed: ${insertError?.message}` },
      { status: 500 }
    )
  }

  // No blog ID configured — saved as draft, user needs to set it
  if (!client.metricool_blog_id) {
    return NextResponse.json({
      post_id: post.id,
      saved_as_draft: true,
      error: `"${client.name}" has no Metricool blog ID. Set clients.metricool_blog_id = 6276264 in Supabase (or the correct blog ID for this client).`,
    })
  }

  // Map platforms → Metricool provider objects
  const providers = (platforms as string[])
    .map(p => PLATFORM_TO_METRICOOL[p])
    .filter(Boolean)
    .map(network => ({ network }))

  // Push to Metricool
  try {
    const metricoolPost = await schedulePost({
      blogId: client.metricool_blog_id,
      text: finalCaption,
      providers,
      publicationDate,
      imageUrls: resolvedMediaUrls,
      thumbnailUrl: resolvedThumbnail,
    })

    await supabase
      .from('scheduled_posts')
      .update({ metricool_post_id: metricoolPost.id, status: 'scheduled' })
      .eq('id', post.id)

    return NextResponse.json({
      success: true,
      post_id: post.id,
      metricool_post_id: metricoolPost.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        error: `Metricool scheduling failed: ${message}`,
        post_id: post.id,
        saved_as_draft: true,
      },
      { status: 502 }
    )
  }
}

/**
 * DELETE /api/metricool/schedule
 * Body: { post_id: string }
 *
 * Cancels in Metricool (best-effort) then deletes from DB.
 */
export async function DELETE(req: NextRequest) {
  const { post_id } = await req.json()

  if (!post_id) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
  }

  const { data: post, error } = await supabase
    .from('scheduled_posts')
    .select('metricool_post_id, status, client_id')
    .eq('id', post_id)
    .single()

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status === 'published') {
    return NextResponse.json({ error: 'Cannot delete a published post' }, { status: 409 })
  }

  if (post.metricool_post_id) {
    // Get blog ID for this client
    const { data: client } = await supabase
      .from('clients')
      .select('metricool_blog_id')
      .eq('id', post.client_id)
      .single()

    if (client?.metricool_blog_id) {
      try {
        await deleteScheduledPost(post.metricool_post_id, client.metricool_blog_id)
      } catch (err) {
        console.error('[metricool] delete from Metricool failed (continuing):', err)
      }
    }
  }

  await supabase.from('scheduled_posts').delete().eq('id', post_id)
  return NextResponse.json({ success: true })
}

/**
 * PATCH /api/metricool/schedule
 * Body: { post_id: string }
 *
 * Re-attempts scheduling an existing draft post in Metricool.
 * Updates status='scheduled' and stores metricool_post_id on success.
 */
export async function PATCH(req: NextRequest) {
  const { post_id } = await req.json()
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const { data: post, error: postError } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', post_id)
    .single()

  if (postError || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.status === 'published') return NextResponse.json({ error: 'Cannot reschedule a published post' }, { status: 409 })

  const { data: client } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', post.client_id)
    .single()

  if (!client?.metricool_blog_id) {
    return NextResponse.json(
      { error: `"${client?.name}" has no Metricool blog ID — set it in the client settings.` },
      { status: 400 }
    )
  }

  const providers = (post.platforms as string[])
    .map(p => PLATFORM_TO_METRICOOL[p])
    .filter(Boolean)
    .map(network => ({ network }))

  const publicationDate = {
    dateTime: new Date(post.scheduled_at).toISOString().replace(/\.\d{3}Z$/, ''),
    timezone: 'UTC',
  }
  const mediaUrls: string[] | undefined = (post.media_urls as string[])?.length
    ? (post.media_urls as string[]).map(u => toAbsolute(u, req) ?? u)
    : undefined

  try {
    const metricoolPost = await schedulePost({
      blogId: client.metricool_blog_id,
      text: post.caption as string,
      providers,
      publicationDate,
      imageUrls: mediaUrls,
    })

    await supabase
      .from('scheduled_posts')
      .update({ metricool_post_id: metricoolPost.id, status: 'scheduled' })
      .eq('id', post_id)

    return NextResponse.json({ success: true, metricool_post_id: metricoolPost.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Metricool scheduling failed: ${message}` }, { status: 502 })
  }
}
