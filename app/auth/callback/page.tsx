"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"

export default function AuthCallback() {
  const router = useRouter()
  const { supabase, initialized } = useSupabase()

  useEffect(() => {
    if (!initialized) return

    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        const { error } = await supabase.auth.getSession()
        if (error) throw error

        // Redirect to the home page
        router.push("/")
      } catch (error) {
        console.error("Error during auth callback:", error)
        router.push("/auth/error")
      }
    }

    handleAuthCallback()
  }, [supabase, router, initialized])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Verifying your email...</h1>
        <p className="text-gray-600">Please wait while we complete the process.</p>
      </div>
    </div>
  )
} 