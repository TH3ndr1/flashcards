"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import type { Session, User, AuthError } from "@supabase/supabase-js"

/**
 * @typedef AuthContextType
 * @property {User | null} user The currently authenticated Supabase user, or null if not logged in.
 * @property {Session | null} session The current Supabase session, or null if not logged in.
 * @property {boolean} loading True while the authentication state is being determined (initial load), false otherwise.
 * @property {(email: string, password: string) => Promise<{ error: AuthError | Error | null }>} signIn Function to sign in a user with email and password. Returns an error object if sign-in fails.
 * @property {(email: string, password: string) => Promise<{ data: any | null; error: AuthError | Error | null }>} signUp Function to sign up a new user. Returns data and error objects. Requires email confirmation by default.
 * @property {() => Promise<{ error: AuthError | Error | null }>} signOut Function to sign out the current user. Returns an error object if sign-out fails.
 * @property {(email: string) => Promise<{ error: AuthError | Error | null }>} resetPassword Function to initiate the password reset process for a given email. Returns an error object if the request fails.
 */
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>
  signUp: (email: string, password: string) => Promise<{ data: any | null; error: AuthError | Error | null }>
  signOut: () => Promise<{ error: AuthError | Error | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEBUG_AUTH = process.env.NODE_ENV !== 'production'

const logAuth = (...args: any[]) => {
  if (DEBUG_AUTH) {
    console.log('[Auth Debug]:', ...args);
  }
};
const logAuthError = (...args: any[]) => {
  if (DEBUG_AUTH) {
    console.error('[Auth Error]:', ...args);
  }
};

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
    logAuth("Auth useEffect triggered...");

    // --- Guard Clause ---
    // Only proceed if the Supabase client is initialized.
    if (!supabase) {
      logAuth("Supabase client not ready yet, waiting...");
      // Keep loading true until supabase client is available.
      // Note: If supabase NEVER becomes available (e.g., missing env vars caught in useSupabase),
      // loading might stay true indefinitely. Consider adding a timeout or error state if needed.
      setLoading(true); 
      return; 
    }
    // --- End Guard Clause ---

    logAuth("Supabase client is ready. Proceeding with auth checks.");
    setLoading(true); // Ensure loading is true while we check the session

    let initialSessionFetched = false; // Flag to track if initial fetch completed

    const getSession = async () => {
      logAuth("Attempting to get session...");
      try {
        // Supabase client is guaranteed to be non-null here
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          logAuthError("Error getting session in useEffect:", error);
        }
        logAuth("getSession result:", currentSession ? "Session found" : "No session");
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (error) {
        logAuthError("Unexpected error during getSession:", error);
        setSession(null); // Ensure clean state on error
        setUser(null);
      } finally {
        initialSessionFetched = true;
        // Only set loading false if the listener is also set (or failed to set)
        // This check prevents flicker if onAuthStateChange runs immediately after getSession
        if (authListener) { 
            logAuth("getSession finally block: setting loading false (listener ready).");
            setLoading(false);
        } else {
            logAuth("getSession finally block: listener not ready yet, keeping loading true.");
        }
      }
    };

    getSession(); // Call getSession now that supabase is confirmed

    logAuth("Setting up onAuthStateChange listener...");
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, newSession) => {
      logAuth("onAuthStateChange triggered:", event, newSession ? "Session found" : "No session");
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Set loading to false once the listener provides an update OR
      // if the initial getSession has already finished. This handles cases
      // where the listener fires very quickly or after the initial check.
      if (!loading || initialSessionFetched) {
          logAuth("onAuthStateChange: setting loading false.");
          setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      logAuth("Cleaning up auth useEffect: Unsubscribing...");
      authListener?.unsubscribe();
    };

    // This effect depends only on the supabase client instance.
    // It runs once when supabase is null (returns early),
    // and again when supabase becomes non-null.
  }, [supabase]);

  /**
   * Signs in a user using email and password.
   * Relies on onAuthStateChange to update user/session state.
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | Error | null }> => {
      // Add guard clause for supabase availability
      if (!supabase) {
        logAuthError("Sign in failed: Supabase client not available.");
        return { error: new Error("Authentication service not ready.") };
      }
      setLoading(true);
      let errorResult: AuthError | Error | null = null;
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        errorResult = error
        if (errorResult) {
          logAuthError("Sign in error:", errorResult)
        } else {
          logAuth("Sign in successful (state update via listener)")
        }
      } catch (err) {
        logAuthError("Unexpected error during sign in API call:", err)
        setLoading(false)
        errorResult = err instanceof Error ? err : new Error("An unexpected error occurred during sign in")
      }
      return { error: errorResult }
    },
    [supabase],
  )

  /**
   * Signs up a new user. Requires email confirmation.
   */
  const signUp = useCallback(
    async (email: string, password: string): Promise<{ data: any | null; error: AuthError | Error | null }> => {
      // Add guard clause for supabase availability
      if (!supabase) {
        logAuthError("Sign up failed: Supabase client not available.");
        return { data: null, error: new Error("Authentication service not ready.") };
      }
      setLoading(true);
      let errorResult: AuthError | Error | null = null;
      try {
        const emailRedirectTo = typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        })
        errorResult = error
        if (errorResult) {
          logAuthError("Error during sign up:", errorResult)
        } else {
          logAuth("Sign up successful (pending confirmation)", data)
        }
        setLoading(false)
        return { data, error: errorResult }
      } catch (err) {
        logAuthError("Unexpected error during sign up:", err)
        setLoading(false)
        errorResult = err instanceof Error ? err : new Error("An unexpected error occurred during sign up")
        return { data: null, error: errorResult }
      }
    },
    [supabase],
  )

  /**
   * Signs out the currently authenticated user.
   * Navigates the user to the login page upon successful sign out.
   */
  const signOut = useCallback(async (): Promise<{ error: AuthError | Error | null }> => {
    // Add guard clause for supabase availability
    if (!supabase) {
      logAuthError("Sign out failed: Supabase client not available.");
      // Still attempt navigation? Or return error? Let's return error for consistency.
      return { error: new Error("Authentication service not ready.") };
    }
    setLoading(true);
    let errorResult: AuthError | Error | null = null;
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      errorResult = signOutError
      if (errorResult) {
        logAuthError("Error during sign out:", errorResult)
      } else {
        logAuth("Sign out successful - redirecting")
        router.push("/login")
      }
    } catch (err) {
      logAuthError("Unexpected error during sign out:", err)
      errorResult = err instanceof Error ? err : new Error("An unexpected error occurred during sign out")
    }
    return { error: errorResult }
  }, [supabase, router])

  /**
   * Sends a password reset email to the user.
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: AuthError | Error | null }> => {
      // Add guard clause for supabase availability
      if (!supabase) {
        logAuthError("Password reset failed: Supabase client not available.");
        return { error: new Error("Authentication service not ready.") };
      }
      let errorResult: AuthError | Error | null = null;
      try {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/update-password` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
        errorResult = error
        if (errorResult) {
          logAuthError("Error requesting password reset:", errorResult)
        } else {
          logAuth("Password reset email sent successfully for:", email)
        }
      } catch (err) {
        logAuthError("Unexpected error during password reset:", err)
        errorResult = err instanceof Error ? err : new Error("An unexpected error occurred during password reset")
      }
      return { error: errorResult }
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

