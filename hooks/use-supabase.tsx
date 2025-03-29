"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// Assume Database type is defined elsewhere or use 'any'
// import type { Database } from '@/types/supabase';
type Database = any; // Replace with your actual Database type if generated

/**
 * Custom hook to provide a memoized Supabase client instance for use in client components.
 * Uses `createBrowserClient` from `@supabase/ssr` to ensure compatibility with middleware
 * and server-side Supabase handling.
 *
 * @returns {{ supabase: SupabaseClient }}
 */
export function useSupabase() {
  // Initialize the state with a function to ensure the client is created only once.
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Robust check for environment variables during initialization.
    // This is crucial because this code can run during the build process (SSR/SSG).
    if (!supabaseUrl || supabaseUrl.trim() === '' || !supabaseAnonKey || supabaseAnonKey.trim() === '') {
      // Throw an error if the keys are missing or empty.
      // This provides a clear error during build if env vars are not configured correctly.
      throw new Error(
        "Supabase URL or Anon Key is missing or empty in useSupabase hook. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are set correctly in your Vercel project."
      );
    }

    // If the checks pass, create and return the Supabase client.
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  return { supabase };
}

// Optional: Define Database type based on Supabase schema
// You can generate this using: npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
// Then import it here: import type { Database } from '@/types/supabase';
// If you don't have it, use generic SupabaseClient type or remove <Database> generic
// NOTE: The previous type definition was below the hook, moved it up for better organization.
// type Database = any; // Replace with your actual Database type if generated

// Removed the old Database type definition from here