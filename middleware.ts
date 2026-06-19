import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const sanitize = (v: string | undefined) => (v ?? '').trim().replace(/[^\x20-\x7E]/g, '')

// Derive org slug from the request hostname.
// novaxops.com or www.novaxops.com → 'novax' (default org)
// acme.novaxops.com → 'acme'
// localhost → 'novax'
function resolveOrgSlug(request: NextRequest): string {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0] // strip port

  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'novax'
  if (hostname === 'novaxops.com' || hostname === 'www.novaxops.com') return 'novax'

  // Subdomain pattern: <slug>.novaxops.com
  if (hostname.endsWith('.novaxops.com')) {
    const sub = hostname.slice(0, hostname.length - '.novaxops.com'.length)
    if (sub && sub !== 'www') return sub
  }

  // Custom domain: looked up at runtime via DB — we don't know it here,
  // so pass the full hostname and let API routes / server components resolve it.
  if (!hostname.includes('novaxops.com')) return hostname

  return 'novax'
}

export async function middleware(request: NextRequest) {
  // If Supabase env vars are not configured, let all requests through
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  // Stamp org slug on every request so server components and API routes can read it
  const orgSlug = resolveOrgSlug(request)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-org-slug', orgSlug)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — always call getUser() to keep token alive
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public: API routes + landing + public portals + static assets + PWA files + pricing + admin bootstrap
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/approval/') ||
    pathname.startsWith('/brief/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/landing' ||
    pathname === '/pricing' ||
    pathname === '/privacy' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return supabaseResponse
  }

  // Unauthenticated: root → landing page, everything else → login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = pathname === '/' ? '/landing' : '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated + on login or root → dashboard
  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
