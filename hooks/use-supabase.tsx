"use client"
import { createClient } from "@supabase/supabase-js"
import { useEffect, useState, useRef } from "react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create the Supabase client outside of the component to avoid recreation on each render
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export function useSupabase() {
  // Use a ref to store the client to prevent recreation on each render
  const supabaseRef = useRef(supabaseClient)
  const [initialized, setInitialized] = useState(false)

  // Only run once on mount
  useEffect(() => {
    setInitialized(true)
  }, [])

  return {
    supabase: supabaseRef.current,
    initialized,
  }
}

