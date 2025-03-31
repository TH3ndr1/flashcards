import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Decodes a Supabase cookie value if it's in base64 format
 */
function decodeSupabaseCookie(cookieValue?: string): string | undefined {
  if (!cookieValue) return undefined;
  
  // Handle base64 encoded cookies from Supabase
  if (cookieValue.startsWith('base64-')) {
    try {
      // Remove 'base64-' prefix and decode
      const base64Value = cookieValue.substring(7);
      return Buffer.from(base64Value, 'base64').toString();
    } catch (error) {
      console.error('Error decoding base64 cookie:', error);
      return cookieValue; // Return original as fallback
    }
  }
  
  return cookieValue;
}

/**
 * Supabase authentication middleware for Next.js.
 * 
 * This middleware is responsible for:
 * 1. Refreshing the user's session cookie if it has expired.
 * 2. Making the session available for server components and routes.
 * 
 * Using the standard @supabase/ssr approach.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware')
    return response
  }
  
  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // Update cookies on the request and response
        request.cookies.set({
          name,
          value,
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        response.cookies.set({
          name,
          value,
          ...options,
        })
      },
      remove(name: string, options: CookieOptions) {
        // Remove cookies from request and response
        request.cookies.set({
          name,
          value: '',
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: request.headers,
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
  
  // Refresh session if expired
  await supabase.auth.getSession()
  
  return response
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