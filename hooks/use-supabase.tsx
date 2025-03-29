"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Custom hook to provide a memoized Supabase client instance for use in client components.
 * Uses `createBrowserClient` from `@supabase/ssr` to ensure compatibility with middleware
 * and server-side Supabase handling.
 *
 * @returns {{ supabase: SupabaseClient }} An object containing the Supabase client instance.
 */
export function useSupabase() {
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase URL or Anon Key for client-side client.");
    }

    return createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!);
  });

  return { supabase };
}

// Optional: Define Database type based on Supabase schema
// You can generate this using: npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
// Then import it here: import type { Database } from '@/types/supabase';
// If you don't have it, use generic SupabaseClient type or remove <Database> generic
type Database = any; // Replace with your actual Database type if generated