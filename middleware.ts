import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase authentication middleware for Next.js.
 * 
 * This middleware is responsible for:
 * 1. Refreshing the user's session cookie if it has expired.
 * 2. Making the session available to server-side rendering contexts.
 * 3. Handling authentication state consistently across client and server.
 * 4. Setting auth token in custom header for dynamic routes
 * 
 * @param {NextRequest} request The incoming request.
 * @returns {Promise<NextResponse>} The response, potentially with updated cookies.
 */
export async function middleware(request: NextRequest) {
  // Create a new headers object from the request headers
  const requestHeaders = new Headers(request.headers)
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Retrieve Supabase URL and Anon Key from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware')
    // Potentially redirect to an error page or return early
    // For now, we'll proceed but auth might not work correctly
    return response 
  }
  
  // Get auth token cookie name
  const tokenName = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`
  const authToken = request.cookies.get(tokenName)?.value
  
  // Pass the auth token via headers to server components
  if (authToken) {
    try {
      // The auth token cookie is in a specific format that needs careful handling
      // Log the first few characters to help diagnose issues (without exposing secrets)
      const previewLength = Math.min(authToken.length, 20);
      console.log(`[middleware] Auth token found (first ${previewLength} chars): ${authToken.substring(0, previewLength)}...`);
      
      // Add the raw token to the request headers - server will handle proper extraction
      requestHeaders.set('x-supabase-auth-token', authToken)
      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      console.log('[middleware] Auth token added to request headers for dynamic routes')
    } catch (error) {
      console.error('[middleware] Error handling auth token:', error)
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // If the cookie is set, update the request headers to reflect the change.
        request.cookies.set({
          name,
          value,
          ...options,
        })
        // Also update the response to set the cookie in the browser.
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
        response.cookies.set({
          name,
          value,
          ...options,
        })
      },
      remove(name: string, options: CookieOptions) {
        // If the cookie is removed, update the request headers to reflect the change.
        request.cookies.set({
          name,
          value: '',
          ...options,
        })
        // Also update the response to remove the cookie in the browser.
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
        response.cookies.set({
          name,
          value: '',
          ...options,
        })
      },
    },
  })

  // IMPORTANT: Avoid running session refresh for static files or specific paths.
  // Adjust the matcher in `config` below as needed.
  try {
    // Refresh session if expired - this will automatically handle cookie updates.
    await supabase.auth.getSession()
  } catch (error) {
    console.error('Error refreshing session in middleware:', error);
    // Handle error appropriately, maybe redirect or log
  }

  return response
}

// Configure the middleware matcher to avoid running on static assets
// and API routes if not needed.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 