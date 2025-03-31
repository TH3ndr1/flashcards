import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { cookies } from 'next/headers'

// --- Function specifically for Server Actions/Route Handlers ---
export function createActionClient() {
  const cookieStore = cookies(); // Get cookies within the action context

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  // Create and return the client using the cookie store from this specific action call
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // Ignore errors in read-only contexts
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
           // Ignore errors in read-only contexts
        }
      },
    },
  })
}

// --- Keep the original function if needed for Server Components ---
// (Rename if necessary to avoid confusion, e.g., createComponentClient)
/**
 * Creates a Supabase client instance for use in server-side contexts 
 * (Server Components, Route Handlers, Server Actions).
 * 
 * Requires the cookie store from `next/headers` to be passed in for Server Actions/Route Handlers.
 * 
 * @param cookieStore The return value of `cookies()` from `next/headers`.
 * @returns A Supabase server client instance.
 * @deprecated Prefer createActionClient for Server Actions/Route Handlers
 */
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  // Retrieve Supabase URL and Anon Key from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {          
          // The `set` method was called from a Server Component or similar context
          // where modifying cookies is disallowed.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {          
          // The `delete` method was called from a Server Component or similar context.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })
} 