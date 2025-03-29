"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// Assume Database type is defined elsewhere or use 'any'
// import type { Database } from '@/types/supabase';
type Database = any; // Replace with your actual Database type if generated

/**
 * Custom hook to provide a memoized Supabase client instance for use in client components.
 * Initializes the client only after component mount to avoid issues during SSR/build.
 *
 * @returns {{ supabase: SupabaseClient<Database> | null }} An object containing the Supabase client instance (null initially).
 */
export function useSupabase() {
  // Initialize state to null. Client will be created after mount.
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    // Create the client only on the client side after initial render.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Robust check for environment variables.
    if (!supabaseUrl || supabaseUrl.trim() === '' || !supabaseAnonKey || supabaseAnonKey.trim() === '') {
      // Log error or handle appropriately. Maybe set an error state?
      console.error(
        "Supabase URL or Anon Key is missing or empty in useSupabase hook. Cannot create client."
      );
      // Optionally throw or set an error state here if needed.
      // For now, we just prevent client creation.
      return; // Don't attempt to create client if keys are missing
    }

    // Create and set the Supabase client instance.
    const client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
    setSupabase(client);

    // No cleanup needed for the client itself, Supabase handles connections.
    // If there were listeners setup here, we'd return a cleanup function.
  }, []); // Empty dependency array ensures this runs once on mount

  // Return the client state. Components using this hook must handle the initial null value.
  return { supabase };
}

// Optional: Define Database type based on Supabase schema
// You can generate this using: npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
// Then import it here: import type { Database } from '@/types/supabase';
// If you don't have it, use generic SupabaseClient type or remove <Database> generic
// NOTE: The previous type definition was below the hook, moved it up for better organization.
// type Database = any; // Replace with your actual Database type if generated

// Removed the old Database type definition from here