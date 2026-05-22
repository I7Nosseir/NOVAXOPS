import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { schedulePost, deleteScheduledPost, splitMediaUrls, PLATFORM_TO_METRICOOL } from '@/lib/metricool'
import { isGoogleDriveUrl, getGoogleDriveFileId } from '@/lib/google-drive'
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
// Resolves any media URL to an absolute URL Metricool can fetch.
// Raw Drive share links (/view?usp=…) return HTML — route them through our proxy first,
// then make absolute so Metricool can fetch the actual binary with correct Content-Type.
function resolveMediaUrl(url: string, req: NextRequest): string {
  let resolved = url
  if (isGoogleDriveUrl(url)) {
    const fileId = getGoogleDriveFileId(url)
    if (fileId) resolved = `/api/proxy/drive?id=${fileId}`
  }
  if (resolved.startsWith('/')) {
    const host = req.headers.get('host') ?? 'localhost:3000'
    const proto = host.includes('localhost') ? 'http' : 'https'
    return `${proto}://${host}${resolved}`
  }
  return resolved
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client_id, platforms, caption, caption_ar, media_url, media_urls, scheduled_at, task_id, is_video } = body

  // Carousel takes precedence over single URL; make all URLs absolute
  const rawUrls: string[] | undefined = media_urls?.filter(Boolean).length
    ? media_urls.filter(Boolean)
    : media_url ? [media_url] : undefined
  const resolvedMediaUrls = rawUrls?.map(u => resolveMediaUrl(u, req))

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

  // If the scheduled time is in the past, move it 2 minutes ahead so Metricool publishes immediately
  const requestedAt = new Date(scheduled_at)
  const effectiveAt = requestedAt < new Date() ? new Date(Date.now() + 2 * 60 * 1000) : requestedAt
  const publicationDate = {
    dateTime: effectiveAt.toISOString().replace(/\.\d{3}Z$/, ''),
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
      ...splitMediaUrls(resolvedMediaUrls),
      ...(is_video != null ? { isVideo: Boolean(is_video) } : {}),
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

  let metricoolWarning: string | undefined

  if (post.metricool_post_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('metricool_blog_id')
      .eq('id', post.client_id)
      .single()

    if (client?.metricool_blog_id) {
      try {
        await deleteScheduledPost(post.metricool_post_id, client.metricool_blog_id)
      } catch (err) {
        // Still delete from DB — but surface the warning so the user knows
        // the post may still exist in Metricool and must be removed manually.
        metricoolWarning = err instanceof Error ? err.message : 'Could not remove from Metricool'
        console.error('[metricool] delete failed:', metricoolWarning)
      }
    }
  }

  await supabase.from('scheduled_posts').delete().eq('id', post_id)
  return NextResponse.json({ success: true, ...(metricoolWarning ? { metricool_warning: metricoolWarning } : {}) })
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

  const requestedAt2 = new Date(post.scheduled_at)
  const effectiveAt2 = requestedAt2 < new Date() ? new Date(Date.now() + 2 * 60 * 1000) : requestedAt2
  const publicationDate = {
    dateTime: effectiveAt2.toISOString().replace(/\.\d{3}Z$/, ''),
    timezone: 'UTC',
  }
  const rawMediaUrls: string[] | undefined = (post.media_urls as string[])?.length
    ? (post.media_urls as string[]).map(u => resolveMediaUrl(u, req))
    : undefined

  try {
    const metricoolPost = await schedulePost({
      blogId: client.metricool_blog_id,
      text: post.caption as string,
      providers,
      publicationDate,
      ...splitMediaUrls(rawMediaUrls),
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
