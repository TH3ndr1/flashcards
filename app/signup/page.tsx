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

/**
 * Renders the sign-up page component.
 * Wraps the client-side logic in a Suspense boundary.
 * Allows new users to create an account with email and password.
 * Requires email confirmation after submission.
 * Redirects authenticated users away from this page.
 */
export default function SignupPage() {
  // The main export wraps SignupContent in Suspense
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Page...</div>}>
      <SignupContent />
    </Suspense>
  )
}

// --- Define the inner component containing the client logic ---
function SignupContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [signupInitiated, setSignupInitiated] = useState(false)
  const { signUp, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const message = searchParams.get('message')
    const error = searchParams.get('error')
    if (message === 'confirmation_email_sent') {
      toast.success("Confirmation Email Sent", {
        description: "Please check your email to confirm your account."
      })
      setSignupInitiated(true)
    }
    if (error) {
      toast.error("Signup Error", { description: error })
    }
    if (message || error) {
      router.replace('/signup', { scroll: false })
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password || !confirmPassword) {
      toast.error("Missing Information", {
        description: "Please fill in all fields."
      })
      return
    }

    if (password !== confirmPassword) {
      toast.error("Password Mismatch", {
        description: "The passwords entered do not match."
      })
      return
    }

    if (password.length < 6) {
      toast.error("Password Too Short", {
        description: "Password must be at least 6 characters long."
      })
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await signUp(email, password)

      if (error) {
        console.error("Sign up error:", error)
        if (error instanceof Error) {
          toast.error(error.message || "An unexpected error occurred during sign up.")
        } else {
          toast.error((error as any).message || "Sign up failed. Please try again.")
        }
      } else if (data?.user) {
        if (data.user.identities && data.user.identities.length > 0 && !data.user.email_confirmed_at) {
          toast.info("Sign up successful! Please check your email to confirm your account.")
          router.push("/login?message=check_email")
        } else {
          toast.success("Sign up successful! Redirecting...")
          router.push("/")
        }
      } else {
        toast.error("An unexpected issue occurred during sign up. Please try again.")
      }
    } catch (err) {
      console.error("Signup submit error:", err)
      toast.error("Sign Up Failed", {
        description: "An unexpected error occurred. Please try again later."
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Create an account</CardTitle>
          <CardDescription className="text-center">Enter your email and password to sign up</CardDescription>
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
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </CardFooter>
        </form>
        <CardFooter className="flex flex-col items-center justify-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
// --- End of SignupContent component ---

