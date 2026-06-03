import { NextRequest, NextResponse } from 'next/server'

// Allows large-file proxying within Vercel's timeout window
export const maxDuration = 60

/**
 * GET /api/proxy/drive?id={fileId}
 *
 * Fetches a Google Drive file and streams it back with correct Content-Type headers.
 * Solves two Drive problems:
 *   1. Drive's uc?export=download redirects are unreliable for third-party services (Metricool).
 *   2. Files >25 MB hit a virus-scan interstitial — we bypass it with &confirm=t.
 *
 * REQUIREMENT: The Drive file must be shared as "Anyone with the link can view".
 */
export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get('id')

  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new NextResponse('Invalid file ID', { status: 400 })
  }

  const driveUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`

  let upstream: Response
  try {
    upstream = await fetch(driveUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NOVAOps/1.0)' },
      redirect: 'follow',
    })
  } catch {
    return new NextResponse('Failed to reach Google Drive', { status: 502 })
  }

  if (!upstream.ok) {
    return new NextResponse(`Google Drive returned ${upstream.status}`, { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'

  // Google returns text/html when the file isn't publicly shared or when sign-in is required
  if (contentType.includes('text/html')) {
    return new NextResponse(
      'File not accessible. Open Google Drive → Share → Change to "Anyone with the link" → Viewer.',
      { status: 403 }
    )
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
