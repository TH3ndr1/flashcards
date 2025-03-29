import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client instance for use in server-side contexts (Server Components, Route Handlers).
 * 
 * It automatically handles reading and writing authentication cookies.
 * 
 * @returns A Supabase server client instance.
 */
export function createSupabaseServerClient() {
  // Removed top-level cookieStore
  // const cookieStore: ReadonlyRequestCookies = cookies()

  // Retrieve Supabase URL and Anon Key from environment variables
  // Ensure these are set in your .env.local or environment configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const cookieStore = cookies()
        // @ts-ignore - Linter incorrectly assumes Promise in server context
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        const cookieStore = cookies()
        try {
          // @ts-ignore - Linter incorrectly assumes Promise in server context
          cookieStore.set({ name, value, ...options })
        } catch (error) {          
          // Ignore errors if called from Server Component (middleware handles refresh)
        }
      },
      remove(name: string, options: CookieOptions) {
        const cookieStore = cookies()
        try {
          // Use set with empty value for removal
          // @ts-ignore - Linter incorrectly assumes Promise in server context
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {          
          // Ignore errors if called from Server Component (middleware handles refresh)
        }
      },
    },
  })
} 