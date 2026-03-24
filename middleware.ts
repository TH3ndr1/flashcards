import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { appLogger } from '@/lib/logger'

/**
 * Supabase authentication middleware for Next.js.
 *
 * Follows the official @supabase/ssr pattern:
 * - Uses getAll/setAll (batch) so multiple cookie changes don't overwrite each other
 * - Forwards the updated request object to server components so they see fresh cookies
 * - Redirects unauthenticated users to /login (fixes phantom/orphaned sessions that
 *   previously caused an infinite loading spinner on protected pages)
 *
 * Public paths (login, signup, auth callbacks, API routes) are excluded from the
 * redirect so they remain accessible without a session.
 */

/** Paths that must be reachable without authentication. */
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth',          // e.g. /auth/callback, /auth/update-password
  '/api/',          // all API routes handle their own auth
  '/legal',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    appLogger.error('Missing Supabase environment variables in middleware')
    return NextResponse.next()
  }

  // Start with a response that forwards the (possibly mutated) request to
  // server components.  We reassign this inside setAll so every batch of
  // cookie writes is reflected in the forwarded request headers.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // 1. Apply the new values to the request cookie store so that
        //    subsequent server-component reads (via next/headers) see them.
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set(name, value, options as Parameters<typeof request.cookies.set>[2])
        )
        // 2. Rebuild the forwarded-request response so the updated Cookie
        //    header is propagated to server components.
        supabaseResponse = NextResponse.next({ request })
        // 3. Also set the cookies on the response so the browser stores them.
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        )
      },
    },
  })

  // IMPORTANT: Do not add any logic between createServerClient and getUser().
  // A subtle mistake here can cause random logouts.
  // See: https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected pages.
  // This is the primary defence against phantom/orphaned sessions:
  // getUser() validates the token server-side, so stale cookies are detected
  // here and the user is sent to /login before any protected page renders.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preserve the originally-requested URL so we can redirect back after login.
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

// Configure the middleware matcher to avoid running on static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
