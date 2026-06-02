import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { schedulePost, deleteScheduledPost, splitMediaUrls, PLATFORM_TO_METRICOOL } from '@/lib/metricool'
import type { SocialPlatform } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/metricool/schedule/edit
 *
 * Updates a scheduled or draft post's caption, scheduled_at, and/or platforms.
 * If the post was already scheduled in Metricool (has metricool_post_id):
 *   1. Cancels the old Metricool entry FIRST — aborts with 502 if this fails (prevents duplicates)
 *   2. Creates a new Metricool entry with updated details
 *   3. Updates DB with new metricool_post_id
 *
 * Body: { post_id, caption, scheduled_at, platforms }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { post_id, caption, scheduled_at, platforms } = body as {
    post_id?: string
    caption?: string
    scheduled_at?: string
    platforms?: SocialPlatform[]
  }

  if (!post_id || !caption?.trim() || !scheduled_at || !platforms?.length) {
    return NextResponse.json({ error: 'post_id, caption, scheduled_at, and platforms are required' }, { status: 400 })
  }

  const { data: post, error: fetchError } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', post_id)
    .single()

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status === 'published') {
    return NextResponse.json({ error: 'Cannot edit a published post' }, { status: 409 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('metricool_blog_id, name')
    .eq('id', post.client_id)
    .single()

  // Step 1: Cancel the existing Metricool post BEFORE touching the DB.
  // This is the gate that prevents duplicates — if delete fails, we abort.
  // deleteScheduledPost treats 404 as success (already gone = fine).
  if (post.metricool_post_id && client?.metricool_blog_id) {
    try {
      await deleteScheduledPost(post.metricool_post_id, client.metricool_blog_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[edit] Metricool delete failed — aborting edit to prevent duplicate:', message)
      return NextResponse.json(
        { error: `Could not cancel the existing scheduled post in Metricool (${message}). Edit aborted to prevent duplicate posts. Please try again.` },
        { status: 502 }
      )
    }
  }

  // Step 2: Update DB now that the old Metricool entry is gone (or was never there).
  const { error: updateError } = await supabase
    .from('scheduled_posts')
    .update({ caption, scheduled_at, platforms, status: 'draft', metricool_post_id: null })
    .eq('id', post_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Step 3: Re-schedule in Metricool if blog ID is configured.
  if (!client?.metricool_blog_id) {
    return NextResponse.json({ post_id, saved_as_draft: true, error: `"${client?.name}" has no Metricool blog ID` })
  }

  const providers = platforms
    .map(p => PLATFORM_TO_METRICOOL[p])
    .filter(Boolean)
    .map(network => ({ network }))

  const requestedAt = new Date(scheduled_at)
  const effectiveAt = requestedAt < new Date() ? new Date(Date.now() + 2 * 60 * 1000) : requestedAt
  const publicationDate = {
    dateTime: effectiveAt.toISOString().replace(/\.\d{3}Z$/, ''),
    timezone: 'UTC',
  }

  const rawMediaUrls: string[] | undefined = (post.media_urls as string[])?.length
    ? (post.media_urls as string[])
    : undefined

  try {
    const metricoolPost = await schedulePost({
      blogId: client.metricool_blog_id,
      text: caption,
      providers,
      publicationDate,
      ...splitMediaUrls(rawMediaUrls),
    })

    await supabase
      .from('scheduled_posts')
      .update({ metricool_post_id: metricoolPost.id, status: 'scheduled' })
      .eq('id', post_id)

    return NextResponse.json({ success: true, post_id, metricool_post_id: metricoolPost.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Old post was already deleted from Metricool. New post failed to create.
    // DB is in draft state with no metricool_post_id — user can push again manually.
    return NextResponse.json({ post_id, saved_as_draft: true, error: `Saved — Metricool reschedule failed: ${message}` }, { status: 502 })
  }
}
