"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase, initialized } = useSupabase()

  useEffect(() => {
    if (!initialized) return

    const handleAuthCallback = async () => {
      try {
        // Get the auth code from the URL
        const code = searchParams.get("code")
        
        if (!code) {
          console.error("No code found in URL")
          throw new Error("No code found in URL")
        }

        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          console.error("Error exchanging code for session:", error)
          throw error
        }

        // Get the session to ensure everything worked
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          console.error("Error getting session:", sessionError)
          throw sessionError || new Error("No session found")
        }

        // Redirect to the home page
        router.push("/")
      } catch (error) {
        console.error("Error during auth callback:", error)
        router.push("/auth/error")
      }
    }

    handleAuthCallback()
  }, [supabase, router, searchParams, initialized])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Verifying your email...</h1>
        <p className="text-gray-600">Please wait while we complete the process.</p>
      </div>
    </div>
  )
} 