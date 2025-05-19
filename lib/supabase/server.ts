import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from '@/types/database'
import { appLogger, statusLogger } from '@/lib/logger'

/**
 * Creates a Supabase client for use in Server Components.
 * The cookie handler is fully async-compatible with dynamic routes.
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        // Use a try-catch to handle any potential errors with cookie access
        try {
          // For dynamic routes, we need to await the cookies() function itself
          const cookieStore = await cookies()
          return cookieStore.get(name)?.value
        } catch (error) {
          appLogger.error(`Error accessing cookie ${name}:`, error)
          return undefined
        }
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // This happens in read-only contexts like middleware or edge functions
          appLogger.info(`Cookie ${name} not set - read-only context`)
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // This happens in read-only contexts like middleware or edge functions
          appLogger.info(`Cookie ${name} not removed - read-only context`)
        }
      },
    },
  })
}

/**
 * Creates a Supabase client for use in Server Actions and Route Handlers.
 * The cookie handler is fully async-compatible with dynamic routes.
 */
export function createActionClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        try {
          // Await the cookies() function itself
          const cookieStore = await cookies()
          return cookieStore.get(name)?.value
        } catch (error) {
          appLogger.error(`Error accessing cookie ${name}:`, error)
          return undefined
        }
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // This happens in read-only contexts
          appLogger.info(`Cookie ${name} not set - read-only context`)
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // This happens in read-only contexts
          appLogger.info(`Cookie ${name} not removed - read-only context`)
        }
      },
    },
  })
}

/**
 * For backward compatibility with existing code.
 * The cookie handler is fully async-compatible with dynamic routes.
 */
export function createDynamicRouteClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        try {
          // Await the cookies() function itself
          const cookieStore = await cookies()
          return cookieStore.get(name)?.value
        } catch (error) {
          appLogger.error(`Error accessing cookie ${name}:`, error)
          return undefined
        }
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          appLogger.info(`Cookie ${name} not set - read-only context`)
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies()
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          appLogger.info(`Cookie ${name} not removed - read-only context`)
        }
      },
    },
  })
}

/**
 * Creates a client without authentication (for public data)
 */
export function createAnonymousClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  // For anonymous access, we don't need cookie handling
  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: () => undefined,
      set: () => {},
      remove: () => {},
    },
  })
} 