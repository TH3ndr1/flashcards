"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import type { Session, User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any | null }>
  signUp: (email: string, password: string) => Promise<{ error: any | null; data: any | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Use a ref to track if the effect has run
  const effectRan = useRef(false)

  useEffect(() => {
    // Only run this effect once
    if (effectRan.current) return
    effectRan.current = true

    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error getting session:", error)
        }

        setSession(session)
        setUser(session?.user || null)
      } catch (error) {
        console.error("Unexpected error during getSession:", error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (!error) {
          // Force a reload of the page after successful login to ensure proper state update
          setTimeout(() => {
            router.push("/")
          }, 500)
        }

        return { error }
      } catch (error) {
        console.error("Error during sign in:", error)
        return { error }
      }
    },
    [supabase, router],
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" 
              ? `${window.location.origin}/auth/callback`
              : undefined,
          },
        })
        return { data, error }
      } catch (error) {
        console.error("Error during sign up:", error)
        return { data: null, error }
      }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (error) {
      console.error("Error during sign out:", error)
    }
  }, [supabase, router])

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '',
        })
        return { error }
      } catch (error) {
        console.error("Error during password reset:", error)
        return { error }
      }
    },
    [supabase],
  )

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

