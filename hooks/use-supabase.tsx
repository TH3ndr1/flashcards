"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, useRef } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === "development") {
    console.warn("Missing Supabase URL or anon key in environment variables.");
  }
  // Optionally, throw an error or fallback to a safe default
}

// Create a single instance for the entire application
let clientInstance: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
  if (clientInstance) return clientInstance;

  clientInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      debug: process.env.NODE_ENV === "development",
      storage: {
        getItem: (key) => {
          if (typeof window === "undefined") return null;
          return window.localStorage.getItem(key);
        },
        setItem: (key, value) => {
          if (typeof window === "undefined") return;
          window.localStorage.setItem(key, value);
        },
        removeItem: (key) => {
          if (typeof window === "undefined") return;
          window.localStorage.removeItem(key);
        },
      },
    },
  });

  return clientInstance;
};

export function useSupabase() {
  const [initialized, setInitialized] = useState(false);
  const supabaseRef = useRef(getSupabaseClient());

  useEffect(() => {
    setInitialized(true);
  }, []);

  return {
    supabase: supabaseRef.current,
    initialized,
  };
}