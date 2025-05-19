"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import type { AuthError } from '@supabase/supabase-js'
import { appLogger, statusLogger } from '@/lib/logger'

/**
 * Login Page component.
 *
 * This component serves as the entry point for the login route.
 * It wraps the main `LoginContent` component within a React Suspense
 * boundary to handle client-side rendering dependencies like `useSearchParams`.
 *
 * @returns {JSX.Element} The Login Page UI with a Suspense boundary.
 */
export default function LoginPage() {
  // The main export wraps LoginContent in Suspense
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Page...</div>}>
      <LoginContent />
    </Suspense>
  )
}

/**
 * Renders the actual login form and handles user interactions.
 *
 * This client component manages the state for email and password inputs,
 * handles form submission, interacts with the `useAuth` hook for signing in,
 * displays loading states and error messages using toasts, and handles
 * redirection based on authentication status or feedback query parameters
 * (e.g., from email confirmation links).
 *
 * @returns {JSX.Element} The Login form UI or a loading spinner.
 */
// --- Define the inner component containing the client logic ---
function LoginContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const message = searchParams.get('message')
    const error = searchParams.get('error')

    if (message === 'email_already_confirmed_or_link_invalid') {
      toast("Your email may already be confirmed, or the link was invalid/expired. Please try logging in.")
    } else if (error === 'confirmation_failed') {
      toast.error("Email Confirmation Failed", {
        description: "Could not confirm your email. Please try the link again or sign up if needed."
      })
    } else if (error === 'missing_confirmation_code') {
      toast.error("Invalid Link", {
        description: "The confirmation link is missing necessary information. Please use the link from your email."
      })
    }

    if (message || error) {
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (!authLoading && user) {
      const callbackUrl = searchParams.get('callbackUrl');
      // Check if callbackUrl exists and is a non-empty string
      if (callbackUrl && typeof callbackUrl === 'string' && callbackUrl.trim() !== '') {
        appLogger.info(`Login successful, redirecting to callbackUrl: ${callbackUrl}`);
        // Decode the URL in case it contains encoded characters
        router.push(decodeURIComponent(callbackUrl)); 
      } else {
        appLogger.info("Login successful, redirecting to default '/'");
        router.push("/"); // Default redirect to homepage
      }
    }
  }, [user, authLoading, router, searchParams]); // Added searchParams dependency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!email || !password) {
      toast.error("Missing Information", {
        description: "Please enter both email and password."
      })
      setIsSubmitting(false)
      return
    }

    try {
      const { error } = await signIn(email, password)

      if (error) {
        appLogger.error("Sign in error:", error)
        if (error && typeof error === 'object' && 'message' in error) {
          toast.error(String(error.message) || "Invalid login credentials.")
        } else {
          toast.error("An unexpected error occurred during sign in.")
        }
      } else {
        toast.success("Sign in successful! Redirecting...")
        // Let the useEffect handle redirection
        // router.push("/") 
      }
    } catch (error) {
      appLogger.error("Login submit error:", error)
      toast.error("Login Failed", {
        description: "An unexpected error occurred. Please try again later."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || user) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )
  }

  // The actual JSX for the login form
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">StudyCards</CardTitle>
          <CardDescription className="text-center">Enter your email and password to sign in</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </CardFooter>
        </form>
        <CardFooter className="flex flex-col items-center justify-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
// --- End of LoginContent component ---


