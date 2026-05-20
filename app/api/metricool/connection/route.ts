import { NextResponse } from 'next/server'
import { getScheduledPosts } from '@/lib/metricool'

/**
 * GET /api/metricool/connection
 *
 * Smoke-tests the Metricool credentials and returns the first page of scheduled
 * posts for the configured blog. Use this to verify the token + userId are correct
 * before wiring clients.
 *
 * Admin-only endpoint — do not expose to non-admin roles.
 *
 * Your credentials:
 *   blogId  = 6276264  (from URL: app.metricool.com/evolution/...?blogId=6276264)
 *   userId  = 4837620  (from URL: ...&userId=4837620)
 *
 * Paste blogId into clients.metricool_blog_id in Supabase for each client.
 */
export async function GET() {
  const blogId = process.env.METRICOOL_BLOG_ID ?? '6276264'

  try {
    const posts = await getScheduledPosts(blogId)
    return NextResponse.json({
      connected: true,
      blogId,
      userId: process.env.METRICOOL_USER_ID,
      scheduledPostCount: posts.length,
      posts: posts.slice(0, 5),   // first 5 for preview
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        connected: false,
        error: message,
        hint: 'Check METRICOOL_API_TOKEN and METRICOOL_USER_ID in .env.local.',
      },
      { status: 503 }
    )
  }
}
