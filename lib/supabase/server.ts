import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Global token cache for authentication between routes
// This is a fallback for dynamic routes where cookies can't be accessed
let AUTH_TOKEN_CACHE: string | null = null;

// Extract token format from cookie name
function getSupabaseTokenName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // Format is: sb-{project-ref}-auth-token
  return `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`
}

// For standard server actions
export function createActionClient() {
  try {
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value
          } catch (error) {
            console.warn(`Cookie get warning (${name}):`, error)
            return undefined
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            if (error instanceof Error && error.message.includes('ReadOnly')) {
              console.debug(`Cookie set skipped (read-only context) for: ${name}`)
            } else {
              console.warn(`Cookie set warning (${name}):`, error)
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            if (error instanceof Error && error.message.includes('ReadOnly')) {
              console.debug(`Cookie remove skipped (read-only context) for: ${name}`)
            } else {
              console.warn(`Cookie remove warning (${name}):`, error)
            }
          }
        },
      },
    })
  } catch (e) {
    console.warn("Error creating action client:", e)
    return createAnonymousClient()
  }
}

/**
 * Extract the JWT/session token from the request headers
 * This function reads the custom header set by middleware
 */
async function extractJwtFromHeaders(): Promise<string | null> {
  try {
    // Get the headers with await to avoid Next.js warnings
    const headersList = await headers();
    
    // Try to get our custom auth header set by middleware
    const rawToken = headersList.get('x-supabase-auth-token');
    
    if (!rawToken) {
      console.warn("[extractJwtFromHeaders] No token found in request headers");
      return null;
    }
    
    console.log("[extractJwtFromHeaders] Found raw token in request headers");
    
    // APPROACH 0: Handle Supabase's base64 prefix format
    if (rawToken.startsWith('base64-')) {
      try {
        // Remove 'base64-' prefix and decode the base64 string
        const base64Content = rawToken.substring(7); // 'base64-' is 7 characters
        const decodedContent = Buffer.from(base64Content, 'base64').toString();
        console.log("[extractJwtFromHeaders] Decoded base64 content");
        
        try {
          // Try to parse the decoded content as JSON
          const parsedObj = JSON.parse(decodedContent);
          if (parsedObj && typeof parsedObj === 'object') {
            if (parsedObj.access_token) {
              console.log("[extractJwtFromHeaders] Successfully extracted access_token from decoded base64");
              return parsedObj.access_token;
            }
          }
        } catch (e) {
          // Not valid JSON after decoding, continue to other approaches
          console.log("[extractJwtFromHeaders] Decoded content is not JSON, using as raw token");
          return decodedContent;
        }
      } catch (e) {
        console.warn("[extractJwtFromHeaders] Failed to decode base64 content:", e);
      }
    }
    
    // Rest of the existing approaches...
    // APPROACH 1: Try direct JSON parsing first
    try {
      const parsedObj = JSON.parse(rawToken);
      if (parsedObj && typeof parsedObj === 'object') {
        // If it's a standard JSON object with access_token
        if (parsedObj.access_token) {
          console.log("[extractJwtFromHeaders] Successfully extracted access_token from JSON");
          return parsedObj.access_token;
        }
        // If it might be another format with a token property
        if (parsedObj.token) {
          console.log("[extractJwtFromHeaders] Found token property in JSON");
          return parsedObj.token;
        }
      }
    } catch (e) {
      // Not valid JSON, continue to other approaches
      console.log("[extractJwtFromHeaders] Token is not direct JSON, trying other formats");
    }
    
    // APPROACH 2: Handle Supabase cookie format which can be {"currentSession":{"token":{"..."}"}}
    try {
      // Sometimes the token is embedded in a more complex structure
      const jsonMatch = rawToken.match(/"access_token":"([^"]+)"/);
      if (jsonMatch && jsonMatch[1]) {
        console.log("[extractJwtFromHeaders] Extracted access_token via regex");
        return jsonMatch[1];
      }
    } catch (e) {
      console.log("[extractJwtFromHeaders] Regex extraction failed");
    }
    
    // APPROACH 3: For JWT format validation, check for the characteristic 3-part structure
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(rawToken)) {
      console.log("[extractJwtFromHeaders] Token appears to be a valid JWT format");
      return rawToken;
    }
    
    // If we reach here, log detailed token info for debugging (safely)
    const tokenPreview = rawToken.substring(0, Math.min(30, rawToken.length));
    console.warn(`[extractJwtFromHeaders] Unable to extract valid JWT. Token preview: ${tokenPreview}...`);
    
    return null;
  } catch (error) {
    console.error("[extractJwtFromHeaders] Error:", error);
    return null;
  }
}

/**
 * For dynamic routes - uses a header-based approach to extract the 
 * auth token set by middleware and apply it to requests.
 */
export async function createDynamicRouteClient() {
  console.log("[createDynamicRouteClient] Creating client with JWT from headers");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  try {
    // Try to get JWT from headers - must await this
    const jwtToken = await extractJwtFromHeaders();
    
    // Create client with auth header if we have a token
    const authHeaders = jwtToken ? {
      global: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      }
    } : {};
    
    if (jwtToken) {
      console.log("[createDynamicRouteClient] Created client with valid JWT token");
    } else {
      console.warn("[createDynamicRouteClient] No valid JWT token available");
    }
    
    return createClient(supabaseUrl, supabaseAnonKey, authHeaders);
  } catch (e) {
    console.warn("Error creating dynamic route client:", e);
    return createAnonymousClient();
  }
}

// Creates a client without any cookie operations or auth
function createAnonymousClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

// For server components (deprecated, but kept for compatibility)
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        try {
          return cookieStore.get(name)?.value
        } catch (error) {
          console.warn(`Cookie get warning (${name}):`, error)
          return undefined
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {          
          if (error instanceof Error && error.message.includes('ReadOnly')) {
            console.debug(`Cookie set skipped (read-only context) for: ${name}`)
          } else {
            console.warn(`Cookie set warning (${name}):`, error)
          }
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {          
          if (error instanceof Error && error.message.includes('ReadOnly')) {
            console.debug(`Cookie remove skipped (read-only context) for: ${name}`)
          } else {
            console.warn(`Cookie remove warning (${name}):`, error)
          }
        }
      },
    },
  })
} 