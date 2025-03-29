"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import type { Session, User, AuthError } from "@supabase/supabase-js"

/**
 * @typedef AuthContextType
 * @property {User | null} user The currently authenticated Supabase user, or null if not logged in.
 * @property {Session | null} session The current Supabase session, or null if not logged in.
 * @property {boolean} loading True while the authentication state is being determined (initial load), false otherwise.
 * @property {(email: string, password: string) => Promise<{ error: AuthError | null }>} signIn Function to sign in a user with email and password. Returns an error object if sign-in fails.
 * @property {(email: string, password: string) => Promise<{ data: { user: User; session: Session; } | null; error: AuthError | null }>} signUp Function to sign up a new user. Returns data and error objects. Requires email confirmation by default.
 * @property {() => Promise<{ error: AuthError | null }>} signOut Function to sign out the current user. Returns an error object if sign-out fails.
 * @property {(email: string) => Promise<{ error: AuthError | null }>} resetPassword Function to initiate the password reset process for a given email. Returns an error object if the request fails.
 */
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ data: { user: User; session: Session } | null; error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Provides authentication state and functions to its children components.
 * Manages user session, loading state, and interactions with Supabase auth.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components to be wrapped by the provider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("Auth useEffect running...")
    const getSession = async () => {
      console.log("Attempting to get session...")
      try {
        if (!supabase) {
          console.error("Supabase client not available in getSession")
          setLoading(false)
          return
        }
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Error getting session in useEffect:", error)
        }
        console.log("getSession result:", currentSession ? "Session found" : "No session")
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
      } catch (error) {
        console.error("Unexpected error during getSession:", error)
      } finally {
        console.log("getSession finally block: setting loading false")
        setLoading(false)
      }
    }

    getSession()

    if (!supabase) {
       console.error("Supabase client not available for onAuthStateChange")
       setLoading(false)
       return
    }

    console.log("Setting up onAuthStateChange listener...")
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("onAuthStateChange triggered:", event, newSession ? "Session found" : "No session")
      setSession(newSession)
      setUser(newSession?.user ?? null) 
      setLoading(false)
    })

    return () => {
      console.log("Cleaning up auth useEffect: Unsubscribing...")
      subscription?.unsubscribe()
    }
  }, [supabase])

  /**
   * Signs in a user using email and password.
   * Relies on onAuthStateChange to update user/session state.
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null }> => {
      setLoading(true)
      let errorResult: AuthError | null = null
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        
        errorResult = error

        if (errorResult) {
          setLoading(false)
        }
      } catch (err) {
        console.error("Unexpected error during sign in API call:", err)
        setLoading(false)
        errorResult = err instanceof Error ? { name: err.name, message: err.message } as AuthError : err as AuthError
      }
      return { error: errorResult }
    },
    [supabase],
  )

  /**
   * Signs up a new user. Requires email confirmation.
   */
  const signUp = useCallback(
    async (email: string, password: string): Promise<{ data: any | null; error: AuthError | null }> => {
      setLoading(true)
      try {
        const emailRedirectTo = typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: emailRedirectTo,
          },
        })
        if (error) {
          console.error("Error during sign up:", error)
        }
        setLoading(false)
        return { data, error }
      } catch (err) {
        console.error("Unexpected error during sign up:", err)
        setLoading(false)
        return { data: null, error: err instanceof Error ? { name: err.name, message: err.message } as AuthError : err as AuthError }
      }
    },
    [supabase],
  )

  /**
   * Signs out the currently authenticated user.
   * Navigates the user to the login page upon successful sign out.
   */
  const signOut = useCallback(async (): Promise<{ error: AuthError | null }> => {
    setLoading(true)
    let error: AuthError | null = null
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error("Error during sign out:", signOutError)
        error = signOutError
        setLoading(false)
      } else {
        setUser(null)
        setSession(null)
        router.push("/login")
      }
    } catch (err) {
      console.error("Unexpected error during sign out:", err)
      setLoading(false)
      error = err instanceof Error ? { name: err.name, message: err.message } as AuthError : err as AuthError
    }
    return { error }
  }, [supabase, router])

  /**
   * Sends a password reset email to the user.
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: AuthError | null }> => {
      try {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/update-password` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo,
        })
        if (error) {
          console.error("Error requesting password reset:", error)
        }
        return { error }
      } catch (err) {
        console.error("Unexpected error during password reset:", err)
        return { error: err instanceof Error ? { name: err.name, message: err.message } as AuthError : err as AuthError }
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

/**
 * Hook to access the authentication context (user, session, loading state, and auth functions).
 * Must be used within a component wrapped by AuthProvider.
 * @returns {AuthContextType} The authentication context.
 * @throws {Error} If used outside of an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

